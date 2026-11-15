const { getDb, ensureReady, getStorageInfo, checkPassword, makeToken, verifyToken } = require('./_lib');
const { sendEmail } = require('./_email');
const { orderConfirmationEmail } = require('./_sequence');

const NOW = "datetime('now','+7 hours')"; // giờ Việt Nam
const STATUSES = ['pending', 'paid', 'success', 'completed', 'cancelled'];
const TYPES = ['physical', 'digital', 'service'];

const PHONE_VN_RE = /^(?:0|\+84|84)(?:3|5|7|8|9)\d{8}$/;
const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const phoneVN = (v, required = true) => {
  const c = String(v ?? '').replace(/[\s.\-()]/g, '');
  if (!c) {
    if (required) throw new Error('Vui lòng nhập số điện thoại');
    return '';
  }
  if (!PHONE_VN_RE.test(c)) {
    throw new Error('Số điện thoại không hợp lệ (cần đúng 10 số di động Việt Nam, đầu 03, 05, 07, 08, 09)');
  }
  if (c.startsWith('+84')) return '0' + c.slice(3);
  if (c.startsWith('84') && c.length === 11) return '0' + c.slice(2);
  return c;
};
const email = (v, required = false) => {
  const e = String(v ?? '').trim().toLowerCase();
  if (!e) {
    if (required) throw new Error('Vui lòng nhập địa chỉ email');
    return null;
  }
  if (e.length > 254 || /\.\./.test(e) || !EMAIL_RE.test(e)) {
    throw new Error('Email không hợp lệ (ví dụ: ten@gmail.com)');
  }
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
    // Hỗ trợ login nếu giao diện cũ gửi action=login, nhưng không chặn truy cập (theo yêu cầu "Không cần đăng nhập")
    if (req.method === 'POST' && req.body && req.body.action === 'login') {
      return send(200, { success: true, token: makeToken() });
    }

    await ensureReady();
    const db = getDb();

    if (req.method === 'GET') {
      const [p, c, o] = await Promise.all([
        db.execute('SELECT id,name,product_type,price,description,stock_quantity,created_at FROM products ORDER BY id DESC'),
        db.execute('SELECT id,name,phone,zalo,email,notes,registered_at,created_at FROM customers ORDER BY id DESC'),
        db.execute(`SELECT o.id,o.customer_id,o.product_id,o.amount,o.status,o.order_date,o.created_at,
                           c.name AS customer_name,c.phone AS customer_phone,c.email AS customer_email,
                           p.name AS product_name,p.product_type
                    FROM orders o LEFT JOIN customers c ON o.customer_id=c.id LEFT JOIN products p ON o.product_id=p.id
                    ORDER BY o.id DESC`),
      ]);
      const rows = (r) => (r && r.rows ? r.rows.map((x) => ({ ...x })) : []);
      return send(200, { success: true, ...getStorageInfo(), products: rows(p), customers: rows(c), orders: rows(o) });
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
        const pVal = phoneVN(data.phone, true);
        const zVal = data.zalo ? phoneVN(data.zalo, false) : pVal;
        await db.execute({ sql: 'INSERT INTO customers (name,phone,zalo,email,registered_at) VALUES (?,?,?,?,' + NOW + ')', args: [name, pVal, zVal, email(data.email)] });
        break;
      }
      case 'edit_customer': {
        const name = str(data.name, 100);
        if (!name) throw new Error('Thiếu tên khách hàng');
        const pVal = phoneVN(data.phone, true);
        const zVal = data.zalo ? phoneVN(data.zalo, false) : pVal;
        await db.execute({ sql: 'UPDATE customers SET name=?,phone=?,zalo=?,email=? WHERE id=?', args: [name, pVal, zVal, email(data.email), id(data.id)] });
        break;
      }
      case 'delete_customer':
        await db.execute({ sql: 'DELETE FROM customers WHERE id=?', args: [id(data.id)] });
        break;

      case 'add_order': {
        let cust = Number(data.customer_id) || 0;
        const prod = id(data.product_id || 1);
        const amountVal = num(data.amount, 'Số tiền');
        const status = STATUSES.includes(data.status) ? data.status : 'paid';
        const rawEmail = data.email || data.customer_email;
        const inputEmail = rawEmail ? email(rawEmail) : null;

        // Nếu đơn tạo từ trang chủ (chưa có customer_id), tự động tìm hoặc tạo khách hàng theo SĐT
        if (!cust && data.customer_phone) {
          const cleanPhone = phoneVN(data.customer_phone, true);
          const cName = str(data.customer_name, 100) || 'Khách hàng Sportfit';
          await db.execute({
            sql: `INSERT INTO customers (name, phone, zalo, email, notes, registered_at)
                  VALUES (?, ?, ?, ?, ?, ${NOW})
                  ON CONFLICT(phone) DO UPDATE SET
                    name = excluded.name,
                    email = COALESCE(excluded.email, customers.email)`,
            args: [cName, cleanPhone, cleanPhone, inputEmail, str(data.notes, 300) || null],
          });
          const foundC = await db.execute({ sql: 'SELECT id FROM customers WHERE phone=?', args: [cleanPhone] });
          if (foundC && foundC.rows && foundC.rows[0]) {
            cust = Number(foundC.rows[0].id);
          }
        }
        if (!cust) cust = 1;

        const stmts = [
          { sql: 'INSERT INTO orders (customer_id,product_id,amount,status,order_date) VALUES (?,?,?,?,' + NOW + ')', args: [cust, prod, amountVal, status] },
          // Chỉ sản phẩm vật lý mới trừ tồn kho
          { sql: "UPDATE products SET stock_quantity=MAX(0,COALESCE(stock_quantity,0)-1) WHERE id=? AND product_type='physical'", args: [prod] },
        ];
        if (inputEmail) {
          stmts.push({ sql: 'UPDATE customers SET email=? WHERE id=?', args: [inputEmail, cust] });
        }
        await db.batch(stmts, 'write');

        // Lấy thông tin khách hàng, sản phẩm và mã đơn vừa tạo để gửi email xác nhận đơn hàng tự động qua Resend
        const [custRes, prodRes, ordRes] = await Promise.all([
          db.execute({ sql: 'SELECT * FROM customers WHERE id=?', args: [cust] }),
          db.execute({ sql: 'SELECT * FROM products WHERE id=?', args: [prod] }),
          db.execute({ sql: 'SELECT id FROM orders WHERE customer_id=? AND product_id=? ORDER BY id DESC LIMIT 1', args: [cust, prod] }),
        ]);

        const custRow = (custRes && custRes.rows && custRes.rows[0]) || {};
        const prodRow = (prodRes && prodRes.rows && prodRes.rows[0]) || {};
        const ordRow = (ordRes && ordRes.rows && ordRes.rows[0]) || {};
        const orderId = data.order_code || ordRow.id || data.order_id || '';
        const toEmail = inputEmail || custRow.email || process.env.EMAIL_REPLY_TO || 'thuanho1221@gmail.com';

        let emailSent = false;
        let emailId = null;
        let emailError = null;

        if (toEmail && !data.skip_email) {
          try {
            const msg = orderConfirmationEmail({
              orderId,
              customerName: custRow.name || str(data.customer_name, 100) || 'bạn',
              customerPhone: custRow.phone || str(data.customer_phone, 30) || '',
              productName: prodRow.name || str(data.product_name, 200) || 'Sản phẩm Sportfit.pro',
              productType: prodRow.product_type || str(data.product_type, 30) || 'physical',
              productDescription: prodRow.description || str(data.product_description, 1000) || '',
              amount: amountVal,
              status,
            });
            const resendRes = await sendEmail({
              to: toEmail,
              subject: msg.subject,
              html: msg.html,
              text: msg.text,
            });
            emailSent = true;
            emailId = resendRes ? resendRes.id : null;
          } catch (err) {
            console.error('Lỗi gửi email xác nhận đơn hàng qua Resend:', err.message);
            emailError = err.message;
          }
        }

        return send(200, {
          success: true,
          message: 'Đã tạo đơn hàng thành công',
          id: ordRow.id || orderId,
          order_id: ordRow.id || orderId,
          customer_id: cust,
          email_sent: emailSent,
          email_to: toEmail,
          email_id: emailId,
          email_error: emailError,
        });
      }
      case 'edit_order': {
        const nextStatus = STATUSES.includes(data.status) ? data.status : 'paid';
        if (data.customer_id && data.product_id && data.amount !== undefined) {
          await db.execute({
            sql: 'UPDATE orders SET customer_id=?,product_id=?,amount=?,status=? WHERE id=?',
            args: [id(data.customer_id), id(data.product_id), num(data.amount, 'Số tiền'), nextStatus, id(data.id)],
          });
        } else {
          await db.execute({
            sql: 'UPDATE orders SET status=? WHERE id=?',
            args: [nextStatus, id(data.id)],
          });
        }
        break;
      }
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
