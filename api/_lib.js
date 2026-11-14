const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const seed = require('./_seed.json');

// =====================================================================
// LỚP DỮ LIỆU
// - Có TURSO_DATABASE_URL  -> dùng Turso (lưu vĩnh viễn).
// - Không có / Turso lỗi    -> tự chuyển sang bộ nhớ tạm (/tmp trên Vercel),
//   nạp sẵn dữ liệu mẫu từ _seed.json để trang admin luôn có dữ liệu.
// =====================================================================

let client = null;
let ready = null;
let storageMode = 'temporary'; // 'turso' | 'temporary'
let lastDbError = null;

const STORE_FILE = process.env.VERCEL ? '/tmp/bongde_store.json' : path.join(__dirname, '..', 'bongde_store.local.json');
const nowStr = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);

function freshStore() {
  return {
    products: (seed.products || []).map((p) => ({ ...p })),
    customers: (seed.customers || []).map((c) => ({ ...c })),
    orders: (seed.orders || []).map((o) => ({ ...o })),
  };
}
let memStore = null;
function loadStore() {
  if (memStore) return memStore;
  try {
    if (fs.existsSync(STORE_FILE)) {
      const d = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      if (d && Array.isArray(d.products) && Array.isArray(d.customers) && Array.isArray(d.orders)) {
        memStore = d;
        return memStore;
      }
    }
  } catch (_) {}
  memStore = freshStore();
  saveStore();
  return memStore;
}
function saveStore() {
  try { fs.writeFileSync(STORE_FILE, JSON.stringify(memStore), 'utf8'); } catch (_) {}
}
const nextId = (arr) => arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;

// Bộ thực thi giả lập đúng các câu SQL mà admin.js / waitlist.js / _sequence_run.js dùng
function createLocalClient() {
  const run = async (query) => {
    const sql = (typeof query === 'string' ? query : query.sql || '').replace(/\s+/g, ' ').trim();
    const args = (typeof query === 'object' && query.args) || [];
    const s = loadStore();
    const T = (re) => re.test(sql);

    // ---------- SELECT ----------
    if (T(/^SELECT .* FROM orders/i)) {
      const rows = s.orders.map((o) => {
        const c = s.customers.find((x) => x.id === o.customer_id) || {};
        const p = s.products.find((x) => x.id === o.product_id) || {};
        return { ...o, customer_name: c.name || null, customer_phone: c.phone || null, product_name: p.name || null, product_type: p.product_type || null };
      });
      return { rows: rows.sort((a, b) => b.id - a.id) };
    }
    if (T(/^SELECT .* FROM products/i)) return { rows: [...s.products].sort((a, b) => b.id - a.id) };
    if (T(/^SELECT .* FROM customers/i)) {
      let rows = [...s.customers];
      if (T(/WHERE phone ?= ?\?/i)) rows = rows.filter((c) => String(c.phone) === String(args[0]));
      return { rows: rows.sort((a, b) => b.id - a.id) };
    }

    // ---------- CUSTOMERS ----------
    if (T(/^INSERT INTO customers/i)) {
      const [name, phone, zalo, email, notes] = args;
      if (phone && s.customers.some((c) => String(c.phone) === String(phone))) {
        const c = s.customers.find((x) => String(x.phone) === String(phone));
        if (!T(/ON CONFLICT/i)) throw new Error('UNIQUE constraint failed: customers.phone');
        c.name = name || c.name;
        if (email) c.email = email;
        if (notes) c.notes = notes;
      } else {
        s.customers.push({ id: nextId(s.customers), name, phone: phone || null, zalo: zalo || null, email: email || null, notes: notes || null, registered_at: nowStr(), created_at: nowStr() });
      }
      saveStore();
      return { rows: [] };
    }
    if (T(/^UPDATE customers SET (welcome_sent_at|email2_scheduled_at|email3_scheduled_at)/i)) {
      const col = sql.match(/SET (\w+)/i)[1];
      const c = s.customers.find((x) => x.id === Number(args[0]));
      if (c) { c[col] = nowStr(); saveStore(); }
      return { rows: [] };
    }
    if (T(/^UPDATE customers SET name/i)) {
      const [name, phone, zalo, email, id] = args;
      if (phone && s.customers.some((c) => String(c.phone) === String(phone) && c.id !== Number(id))) throw new Error('UNIQUE constraint failed: customers.phone');
      const c = s.customers.find((x) => x.id === Number(id));
      if (c) Object.assign(c, { name, phone, zalo, email });
      saveStore();
      return { rows: [] };
    }
    if (T(/^DELETE FROM customers/i)) {
      const id = Number(args[0]);
      s.customers = s.customers.filter((c) => c.id !== id);
      s.orders = s.orders.filter((o) => o.customer_id !== id); // ON DELETE CASCADE
      saveStore();
      return { rows: [] };
    }

    // ---------- PRODUCTS ----------
    if (T(/^INSERT INTO products/i)) {
      const [name, product_type, price, description, stock_quantity] = args;
      s.products.push({ id: nextId(s.products), name, product_type, price: Number(price), description, stock_quantity: product_type === 'physical' ? Number(stock_quantity) || 0 : null, created_at: nowStr() });
      saveStore();
      return { rows: [] };
    }
    if (T(/^UPDATE products SET stock_quantity ?= ?MAX/i)) {
      // Trừ tồn kho: CHỈ sản phẩm vật lý
      const p = s.products.find((x) => x.id === Number(args[0]));
      if (p && p.product_type === 'physical') { p.stock_quantity = Math.max(0, (Number(p.stock_quantity) || 0) - 1); saveStore(); }
      return { rows: [] };
    }
    if (T(/^UPDATE products SET name/i)) {
      const [name, product_type, price, description, stock_quantity, id] = args;
      const p = s.products.find((x) => x.id === Number(id));
      if (p) Object.assign(p, { name, product_type, price: Number(price), description, stock_quantity: product_type === 'physical' ? Number(stock_quantity) || 0 : null });
      saveStore();
      return { rows: [] };
    }
    if (T(/^DELETE FROM products/i)) {
      const id = Number(args[0]);
      s.products = s.products.filter((p) => p.id !== id);
      s.orders = s.orders.filter((o) => o.product_id !== id);
      saveStore();
      return { rows: [] };
    }

    // ---------- ORDERS ----------
    if (T(/^INSERT INTO orders/i)) {
      const [customer_id, product_id, amount, status] = args;
      s.orders.push({ id: nextId(s.orders), customer_id: Number(customer_id), product_id: Number(product_id), amount: Number(amount), status, order_date: nowStr(), created_at: nowStr() });
      saveStore();
      return { rows: [] };
    }
    if (T(/^UPDATE orders/i)) {
      const [customer_id, product_id, amount, status, id] = args;
      const o = s.orders.find((x) => x.id === Number(id));
      if (o) Object.assign(o, { customer_id: Number(customer_id), product_id: Number(product_id), amount: Number(amount), status });
      saveStore();
      return { rows: [] };
    }
    if (T(/^DELETE FROM orders/i)) {
      s.orders = s.orders.filter((o) => o.id !== Number(args[0]));
      saveStore();
      return { rows: [] };
    }

    return { rows: [] }; // CREATE TABLE, PRAGMA, ... không cần làm gì
  };
  return {
    execute: run,
    async batch(stmts) { const out = []; for (const st of stmts) out.push(await run(st)); return out; },
  };
}

// Lỗi do dữ liệu (trùng SĐT, vi phạm ràng buộc) thì báo cho người dùng, KHÔNG chuyển sang bộ nhớ tạm
const isDataError = (e) => /UNIQUE|CHECK constraint|FOREIGN KEY|NOT NULL|không hợp lệ/i.test(String(e && e.message));

function createClientWithFallback(remote) {
  const local = createLocalClient();
  let useLocal = false;
  const wrap = (fn) => async (...a) => {
    if (useLocal) return fn(local, ...a);
    try {
      return await fn(remote, ...a);
    } catch (e) {
      if (isDataError(e)) throw e;
      console.error('Turso lỗi, chuyển sang bộ nhớ tạm:', e.message);
      lastDbError = e.message;
      useLocal = true;
      storageMode = 'temporary';
      return fn(local, ...a);
    }
  };
  return {
    execute: wrap((c, q) => c.execute(q)),
    batch: wrap((c, s, m) => c.batch(s, m)),
  };
}

function getDb() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    try {
      const { createClient } = url.startsWith('file:') ? require('@libsql/client') : require('@libsql/client/web');
      client = createClientWithFallback(createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN }));
      storageMode = 'turso';
      return client;
    } catch (e) {
      lastDbError = e.message;
      console.error('Không khởi tạo được Turso:', e.message);
    }
  }
  storageMode = 'temporary';
  client = createLocalClient();
  return client;
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS products (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     product_type TEXT NOT NULL CHECK(product_type IN ('physical','digital','service')),
     price REAL NOT NULL,
     description TEXT,
     stock_quantity INTEGER,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT chk_stock_physical CHECK (product_type != 'physical' OR stock_quantity IS NOT NULL)
   )`,
  `CREATE TABLE IF NOT EXISTS customers (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     phone TEXT UNIQUE,
     zalo TEXT,
     notes TEXT,
     email TEXT,
     welcome_sent_at TIMESTAMP,
     email2_scheduled_at TIMESTAMP,
     email3_scheduled_at TIMESTAMP,
     registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )`,
  `CREATE TABLE IF NOT EXISTS orders (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     customer_id INTEGER NOT NULL,
     product_id INTEGER NOT NULL,
     amount REAL NOT NULL,
     status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','completed','cancelled')),
     order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
     FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
   )`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)`,
];

// Tạo bảng + nạp dữ liệu mẫu vào Turso đúng 1 lần (cờ 'seeded' trong bảng meta)
function ensureReady() {
  if (ready) return ready;
  ready = (async () => {
    const db = getDb();
    if (storageMode !== 'turso') return; // bộ nhớ tạm đã tự nạp từ _seed.json
    await db.batch(SCHEMA, 'write');
    if (storageMode !== 'turso') return; // nếu Turso lỗi ở bước trên, đã tự chuyển sang bộ nhớ tạm
    const cols = await db.execute('PRAGMA table_info(customers)');
    const have = new Set((cols.rows || []).map((r) => r.name));
    for (const col of ['email', 'welcome_sent_at', 'email2_scheduled_at', 'email3_scheduled_at']) {
      if (have.size && !have.has(col)) await db.execute('ALTER TABLE customers ADD COLUMN ' + col + (col === 'email' ? ' TEXT' : ' TIMESTAMP'));
    }
    const flag = await db.execute("SELECT value FROM meta WHERE key='seeded'");
    if (flag.rows && flag.rows.length) return;
    const stmts = [];
    for (const p of seed.products)
      stmts.push({ sql: 'INSERT OR IGNORE INTO products (id,name,product_type,price,description,stock_quantity,created_at) VALUES (?,?,?,?,?,?,?)',
        args: [p.id, p.name, p.product_type, p.price, p.description, p.stock_quantity, p.created_at] });
    for (const c of seed.customers)
      stmts.push({ sql: 'INSERT OR IGNORE INTO customers (id,name,phone,zalo,notes,registered_at,created_at) VALUES (?,?,?,?,?,?,?)',
        args: [c.id, c.name, c.phone, c.zalo, c.notes, c.registered_at, c.created_at] });
    for (const o of seed.orders)
      stmts.push({ sql: 'INSERT OR IGNORE INTO orders (id,customer_id,product_id,amount,status,order_date,created_at) VALUES (?,?,?,?,?,?,?)',
        args: [o.id, o.customer_id, o.product_id, o.amount, o.status, o.order_date, o.created_at] });
    stmts.push("INSERT OR REPLACE INTO meta (key,value) VALUES ('seeded','1')");
    await db.batch(stmts, 'write');
  })().catch((e) => { ready = null; lastDbError = e.message; console.error('ensureReady:', e.message); });
  return ready;
}

const getStorageInfo = () => ({ storage: storageMode, dbError: lastDbError });

// ---- Đăng nhập: CHỈ bật khi có biến môi trường ADMIN_PASSWORD trên Vercel ----
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sign = (exp) => crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || '').update(String(exp)).digest('hex');

function checkPassword(pw) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return true;
  return crypto.timingSafeEqual(sha(pw || ''), sha(real));
}
function makeToken() {
  const exp = Date.now() + 7 * 24 * 3600 * 1000;
  return exp + '.' + sign(exp);
}
function verifyToken(req) {
  if (!process.env.ADMIN_PASSWORD) return true;
  const m = /^Bearer (.+)$/.exec(req.headers['authorization'] || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { getDb, ensureReady, getStorageInfo, checkPassword, makeToken, verifyToken };
