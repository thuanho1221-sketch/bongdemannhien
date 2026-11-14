const { getDb, ensureReady, checkPassword, makeToken, verifyToken } = require('./_lib');

const NOW = "datetime('now','+7 hours')"; // giờ Việt Nam
const STATUSES = ['pending', 'paid', 'completed', 'cancelled'];
const TYPES = ['physical', 'digital', 'service'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const email = (v) => {
  const e = String(v ?? '').trim().toLowerCase();
  if (!e) return null;
  if (e.length > 254 || !EMAIL_RE.test(e)) throw new Error('Email không hợp lệ');
  return e;
};
const str = (v, max = 500) => String(v ?? '').trim().slice(0, max);
const num = (v, label) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new Error(label + ' không hợp lệ');
  return n;
};
const id = (v) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new Error('ID không hợp lệ');
  return n;
};
function productFields(d) {
  const type = TYPES.includes(d.product_type) ? d.product_type : 'physical';
  const name = str(d.name, 200);
  if (!name) throw new Error('Thiếu tên sản phẩm');
  const stock = type === 'physical' ? (String(d.stock_quantity ?? '').trim() === '' ? 0 : Math.trunc(num(d.stock_quantity, 'Số lượng'))) : null;
  return [name, type, num(d.price, 'Giá'), str(d.description, 2000), stock];
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  const send = (code, obj) => res.status(code).send(JSON.stringify(obj));

  try {
    // Chỉ yêu cầu login nếu máy chủ có thiết lập ADMIN_PASSWORD
    if (process.env.ADMIN_PASSWORD) {
      if (req.method === 'POST' && req.body && req.body.action === 'login') {
        if (checkPassword(req.body.password)) return send(200, { success: true, token: makeToken() });
        await new Promise((r) => setTimeout(r, 800)); // làm chậm dò mật khẩu
        return send(401, { success: false, error: 'Sai mật khẩu' });
      }
      if (!verifyToken(req)) return send(401, { success: false, error: 'Cần đăng nhập' });
    }

    await ensureReady();
    const db = getDb();

    if (req.method === 'GET') {
      const [p, c, o] = await Promise.all([
        db.execute('SELECT id,name,product_type,price,description,stock_quantity,created_at FROM products ORDER BY id DESC'),
        db.execute('SELECT id,name,phone,zalo,email,notes,registered_at,created_at FROM customers ORDER BY id DESC'),
        db.execute(`SELECT o.id,o.customer_id,o.product_id,o.amount,o.status,o.order_date,o.created_at,
                           c.name AS customer_name,c.phone AS customer_phone,
                           p.name AS product_name,p.product_type
                    FROM orders o LEFT JOIN customers c ON o.customer_id=c.id LEFT JOIN products p ON o.product_id=p.id
                    ORDER BY o.id DESC`),
      ]);
      const rows = (r) => (r && r.rows ? r.rows.map((x) => ({ ...x })) : []);
      return send(200, { success: true, products: rows(p), customers: rows(c), orders: rows(o) });
    }

    if (req.method !== 'POST') return send(405, { success: false, error: 'Method not allowed' });

    const { action, data = {} } = req.body || {};
    switch (action) {
      case 'add_product':
        await db.execute({ sql: 'INSERT INTO products (name,product_type,price,description,stock_quantity,created_at) VALUES (?,?,?,?,?,' + NOW + ')', args: productFields(data) });
        break;
      case 'edit_product':
        await db.execute({ sql: 'UPDATE products SET name=?,product_type=?,price=?,description=?,stock_quantity=? WHERE id=?', args: [...productFields(data), id(data.id)] });
        break;
      case 'delete_product':
        await db.execute({ sql: 'DELETE FROM products WHERE id=?', args: [id(data.id)] });
        break;

      case 'add_customer': {
        const name = str(data.name, 100);
        if (!name) throw new Error('Thiếu tên khách hàng');
        await db.execute({ sql: 'INSERT INTO customers (name,phone,zalo,email,registered_at) VALUES (?,?,?,?,' + NOW + ')', args: [name, str(data.phone, 20), str(data.zalo, 20), email(data.email)] });
        break;
      }
      case 'edit_customer': {
        const name = str(data.name, 100);
        if (!name) throw new Error('Thiếu tên khách hàng');
        await db.execute({ sql: 'UPDATE customers SET name=?,phone=?,zalo=?,email=? WHERE id=?', args: [name, str(data.phone, 20), str(data.zalo, 20), email(data.email), id(data.id)] });
        break;
      }
      case 'delete_customer':
        await db.execute({ sql: 'DELETE FROM customers WHERE id=?', args: [id(data.id)] });
        break;

      case 'add_order': {
        const cust = id(data.customer_id), prod = id(data.product_id);
        const status = STATUSES.includes(data.status) ? data.status : 'paid';
        const stmts = [{ sql: 'INSERT INTO orders (customer_id,product_id,amount,status,order_date) VALUES (?,?,?,?,' + NOW + ')', args: [cust, prod, num(data.amount, 'Số tiền'), status] }];
        // Chỉ sản phẩm vật lý mới trừ tồn kho
        stmts.push({ sql: "UPDATE products SET stock_quantity=MAX(0,COALESCE(stock_quantity,0)-1) WHERE id=? AND product_type='physical'", args: [prod] });
        await db.batch(stmts, 'write');
        break;
      }
      case 'edit_order':
        await db.execute({ sql: 'UPDATE orders SET customer_id=?,product_id=?,amount=?,status=? WHERE id=?',
          args: [id(data.customer_id), id(data.product_id), num(data.amount, 'Số tiền'), STATUSES.includes(data.status) ? data.status : 'paid', id(data.id)] });
        break;
      case 'delete_order':
        await db.execute({ sql: 'DELETE FROM orders WHERE id=?', args: [id(data.id)] });
        break;
      default:
        return send(400, { success: false, error: 'Unknown action' });
    }
    return send(200, { success: true, message: 'Action completed successfully' });
  } catch (e) {
    const msg = /UNIQUE/i.test(e.message) ? 'Số điện thoại này đã tồn tại' : e.message;
    return send(500, { success: false, error: msg });
  }
};
