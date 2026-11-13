const crypto = require('crypto');
const seed = require('./_seed.json');

let client = null;
let ready = null;

function getDb() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error('Thiếu biến môi trường TURSO_DATABASE_URL');
  // file: chỉ dùng để test trên máy; production dùng bản web (fetch) của libsql
  const { createClient } = url.startsWith('file:') ? require('@libsql/client') : require('@libsql/client/web');
  client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
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

// Tạo bảng + nạp dữ liệu ban đầu đúng 1 lần (cờ 'seeded' trong bảng meta)
function ensureReady() {
  if (ready) return ready;
  ready = (async () => {
    const db = getDb();
    await db.batch(SCHEMA, 'write');
    const flag = await db.execute("SELECT value FROM meta WHERE key='seeded'");
    if (flag.rows.length) return;
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
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// ---- Đăng nhập: token ký HMAC bằng ADMIN_PASSWORD, hạn 7 ngày ----
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
const sign = (exp) => crypto.createHmac('sha256', process.env.ADMIN_PASSWORD || '').update(String(exp)).digest('hex');

function checkPassword(pw) {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) return false;
  return crypto.timingSafeEqual(sha(pw || ''), sha(real));
}
function makeToken() {
  const exp = Date.now() + 7 * 24 * 3600 * 1000;
  return exp + '.' + sign(exp);
}
function verifyToken(req) {
  if (!process.env.ADMIN_PASSWORD) return false;
  const m = /^Bearer (.+)$/.exec(req.headers['authorization'] || '');
  if (!m) return false;
  const [exp, sig] = m[1].split('.');
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { getDb, ensureReady, checkPassword, makeToken, verifyToken };
