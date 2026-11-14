const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const seed = require('./_seed.json');

let client = null;
let ready = null;

// Thư mục lưu dữ liệu fallback khi không có Turso DB:
// Trên Vercel: dùng /tmp/bongde_store.json (thư mục có quyền ghi trên serverless)
// Chạy local: dùng ./bongde_store.json
const STORE_FILE = process.env.VERCEL ? '/tmp/bongde_store.json' : path.join(__dirname, 'bongde_store.json');

function getLocalStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const data = JSON.parse(fs.readFileSync(STORE_FILE, 'utf8'));
      if (data && Array.isArray(data.products) && Array.isArray(data.customers)) {
        return data;
      }
    }
  } catch (_) {}

  // Khởi tạo từ _seed.json
  const initial = {
    products: (seed.products || []).map((p) => ({ ...p })),
    customers: (seed.customers || []).map((c) => ({ ...c })),
    orders: (seed.orders || []).map((o) => ({ ...o })),
  };
  saveLocalStore(initial);
  return initial;
}

function saveLocalStore(data) {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('Lỗi ghi local store:', e.message);
  }
}

// Client database giả lập để chạy độc lập khi chưa cấu hình TURSO_DATABASE_URL
function createLocalClient() {
  return {
    async execute(query) {
      const sql = (typeof query === 'string' ? query : query.sql || '').trim();
      const args = (typeof query === 'object' && query.args) || [];
      const store = getLocalStore();

      // 1. SELECT products
      if (/^SELECT .* FROM products/i.test(sql)) {
        const rows = [...store.products].sort((a, b) => (b.id || 0) - (a.id || 0));
        return { rows };
      }

      // 2. SELECT customers
      if (/^SELECT .* FROM customers/i.test(sql)) {
        if (/WHERE phone=\?/i.test(sql)) {
          const phone = String(args[0] || '').trim();
          const rows = store.customers.filter((c) => String(c.phone || '').trim() === phone);
          return { rows };
        }
        if (/WHERE email=\?/i.test(sql)) {
          const email = String(args[0] || '').trim().toLowerCase();
          const rows = store.customers.filter((c) => String(c.email || '').trim().toLowerCase() === email);
          return { rows };
        }
        const rows = [...store.customers].sort((a, b) => (b.id || 0) - (a.id || 0));
        return { rows };
      }

      // 3. SELECT orders
      if (/^SELECT .* FROM orders/i.test(sql)) {
        const rows = store.orders.map((o) => {
          const cust = store.customers.find((c) => c.id === o.customer_id) || {};
          const prod = store.products.find((p) => p.id === o.product_id) || {};
          return {
            ...o,
            customer_name: cust.name || 'Khách #' + o.customer_id,
            customer_phone: cust.phone || '',
            product_name: prod.name || 'Sản phẩm #' + o.product_id,
            product_type: prod.product_type || 'physical',
          };
        }).sort((a, b) => (b.id || 0) - (a.id || 0));
        return { rows };
      }

      // 4. INSERT INTO customers
      if (/^INSERT INTO customers/i.test(sql)) {
        // [name, phone, zalo, email, notes]
        const [name, phone, zalo, email, notes] = args;
        let cust = store.customers.find((c) => String(c.phone || '').trim() === String(phone || '').trim());
        if (cust) {
          cust.name = name || cust.name;
          cust.email = email || cust.email;
          cust.notes = notes || cust.notes;
          cust.zalo = zalo || cust.zalo;
        } else {
          const maxId = store.customers.reduce((m, c) => Math.max(m, c.id || 0), 0);
          cust = {
            id: maxId + 1,
            name: name || '',
            phone: phone || '',
            zalo: zalo || phone || '',
            email: email || null,
            notes: notes || null,
            registered_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
            created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
          };
          store.customers.push(cust);
        }
        saveLocalStore(store);
        return { rows: [cust] };
      }

      // 5. UPDATE customers
      if (/^UPDATE customers/i.test(sql)) {
        if (/SET.*WHERE id=\?/i.test(sql)) {
          const id = Number(args[args.length - 1]);
          const cust = store.customers.find((c) => c.id === id);
          if (cust) {
            if (/welcome_sent_at/i.test(sql)) cust.welcome_sent_at = new Date().toISOString();
            if (/email2_scheduled_at/i.test(sql)) cust.email2_scheduled_at = new Date().toISOString();
            if (/email3_scheduled_at/i.test(sql)) cust.email3_scheduled_at = new Date().toISOString();
            if (args.length >= 5) {
              cust.name = args[0];
              cust.phone = args[1];
              cust.zalo = args[2];
              cust.email = args[3];
            }
            saveLocalStore(store);
          }
        }
        return { rows: [] };
      }

      // 6. DELETE customers
      if (/^DELETE FROM customers/i.test(sql)) {
        const id = Number(args[0]);
        store.customers = store.customers.filter((c) => c.id !== id);
        saveLocalStore(store);
        return { rows: [] };
      }

      // 7. INSERT INTO products
      if (/^INSERT INTO products/i.test(sql)) {
        const [name, product_type, price, description, stock_quantity] = args;
        const maxId = store.products.reduce((m, p) => Math.max(m, p.id || 0), 0);
        const prod = {
          id: maxId + 1,
          name,
          product_type,
          price: Number(price) || 0,
          description: description || '',
          stock_quantity: product_type === 'physical' ? (Number(stock_quantity) || 0) : null,
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        };
        store.products.push(prod);
        saveLocalStore(store);
        return { rows: [prod] };
      }

      // 8. UPDATE products
      if (/^UPDATE products/i.test(sql)) {
        const id = Number(args[args.length - 1]);
        const prod = store.products.find((p) => p.id === id);
        if (prod) {
          if (/stock_quantity=MAX/i.test(sql)) {
            if (prod.product_type === 'physical' && prod.stock_quantity !== null) {
              prod.stock_quantity = Math.max(0, (prod.stock_quantity || 0) - 1);
            }
          } else if (args.length >= 6) {
            prod.name = args[0];
            prod.product_type = args[1];
            prod.price = Number(args[2]) || 0;
            prod.description = args[3];
            prod.stock_quantity = prod.product_type === 'physical' ? (Number(args[4]) || 0) : null;
          }
          saveLocalStore(store);
        }
        return { rows: [] };
      }

      // 9. DELETE products
      if (/^DELETE FROM products/i.test(sql)) {
        const id = Number(args[0]);
        store.products = store.products.filter((p) => p.id !== id);
        saveLocalStore(store);
        return { rows: [] };
      }

      // 10. INSERT INTO orders
      if (/^INSERT INTO orders/i.test(sql)) {
        const [customer_id, product_id, amount, status] = args;
        const maxId = store.orders.reduce((m, o) => Math.max(m, o.id || 0), 0);
        const ord = {
          id: maxId + 1,
          customer_id: Number(customer_id),
          product_id: Number(product_id),
          amount: Number(amount) || 0,
          status: status || 'paid',
          order_date: new Date().toISOString().replace('T', ' ').slice(0, 19),
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        };
        store.orders.push(ord);
        // Trừ tồn kho nếu sản phẩm vật lý
        const prod = store.products.find((p) => p.id === ord.product_id);
        if (prod && prod.product_type === 'physical' && prod.stock_quantity !== null) {
          prod.stock_quantity = Math.max(0, (prod.stock_quantity || 0) - 1);
        }
        saveLocalStore(store);
        return { rows: [ord] };
      }

      // 11. UPDATE orders
      if (/^UPDATE orders/i.test(sql)) {
        const id = Number(args[args.length - 1]);
        const ord = store.orders.find((o) => o.id === id);
        if (ord && args.length >= 5) {
          ord.customer_id = Number(args[0]);
          ord.product_id = Number(args[1]);
          ord.amount = Number(args[2]) || 0;
          ord.status = args[3];
          saveLocalStore(store);
        }
        return { rows: [] };
      }

      // 12. DELETE orders
      if (/^DELETE FROM orders/i.test(sql)) {
        const id = Number(args[0]);
        store.orders = store.orders.filter((o) => o.id !== id);
        saveLocalStore(store);
        return { rows: [] };
      }

      // Fallback cho PRAGMA hoặc lệnh khác
      return { rows: [] };
    },

    async batch(stmts) {
      const results = [];
      for (const stmt of stmts) {
        results.push(await this.execute(stmt));
      }
      return results;
    },
  };
}

function getDb() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;

  // Nếu có TURSO_DATABASE_URL thì kết nối Turso
  if (url) {
    try {
      const { createClient } = url.startsWith('file:')
        ? require('@libsql/client')
        : require('@libsql/client/web');
      client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
      return client;
    } catch (e) {
      console.warn('Lỗi kết nối Turso, chuyển sang Local Store:', e.message);
    }
  }

  // Nếu không có TURSO_DATABASE_URL: tự động dùng Local Store fallback
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

function ensureReady() {
  if (ready) return ready;
  ready = (async () => {
    const db = getDb();
    if (process.env.TURSO_DATABASE_URL) {
      await db.batch(SCHEMA, 'write').catch(() => {});
      const cols = await db.execute('PRAGMA table_info(customers)').catch(() => ({ rows: [] }));
      const have = new Set(cols.rows.map((r) => r.name));
      for (const col of ['email', 'welcome_sent_at', 'email2_scheduled_at', 'email3_scheduled_at']) {
        if (!have.has(col)) {
          await db.execute('ALTER TABLE customers ADD COLUMN ' + col + (col === 'email' ? ' TEXT' : ' TIMESTAMP')).catch(() => {});
        }
      }
    }
  })().catch((e) => {
    console.warn('ensureReady non-critical warning:', e.message);
  });
  return ready;
}

// ---- Đăng nhập: chỉ bắt buộc nếu có biến môi trường ADMIN_PASSWORD ----
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sign = (exp) => crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || 'default_sec').update(String(exp)).digest('hex');

function checkPassword(pw) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return true; // Không cấu hình password -> cho qua trực tiếp
  return crypto.timingSafeEqual(sha(pw || ''), sha(real));
}

function makeToken() {
  const exp = Date.now() + 7 * 24 * 3600 * 1000;
  return exp + '.' + sign(exp);
}

function verifyToken(req) {
  // Nếu không cấu hình ADMIN_PASSWORD: Không cần token, cho phép xem trực tiếp theo yêu cầu "Không cần đăng nhập"
  if (!process.env.ADMIN_PASSWORD) return true;
  const m = /^Bearer (.+)$/.exec(req.headers['authorization'] || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { getDb, ensureReady, checkPassword, makeToken, verifyToken };
