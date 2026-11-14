const { getDb, ensureReady } = require('./_lib');
const { sendEmail, welcomeEmail } = require('./_email');

// Endpoint công khai cho form Waitlist trên landing page
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => res.status(code).send(JSON.stringify(obj));
  if (req.method !== 'POST') return send(405, { success: false });

  try {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 100);
    const phone = String(b.phone || '').replace(/[\s.\-()]/g, '');
    const email = String(b.email || '').trim().toLowerCase();
    const product = String(b.product || '').trim().slice(0, 150);
    if (name.length < 2) return send(400, { success: false, error: 'Tên không hợp lệ' });
    if (!/^\+?\d{8,13}$/.test(phone)) return send(400, { success: false, error: 'Số điện thoại không hợp lệ' });
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) return send(400, { success: false, error: 'Email không hợp lệ' });

    await ensureReady();
    const db = getDb();
    const note = product ? 'Quan tâm: ' + product : null;
    await db.execute({
      sql: `INSERT INTO customers (name,phone,zalo,email,notes,registered_at) VALUES (?,?,?,?,?,datetime('now','+7 hours'))
            ON CONFLICT(phone) DO UPDATE SET notes=COALESCE(excluded.notes, customers.notes), email=COALESCE(excluded.email, customers.email)`,
      args: [name, phone, phone, email || null, note],
    });

    // Email chào mừng: chỉ gửi 1 lần cho mỗi số điện thoại và mỗi email. Gửi lỗi không làm hỏng việc đăng ký.
    let emailed = false;
    if (email) {
      try {
        const r = await db.execute({
          sql: `SELECT id, welcome_sent_at FROM customers WHERE phone=?`, args: [phone] });
        const cust = r.rows[0];
        const dup = await db.execute({
          sql: `SELECT 1 FROM customers WHERE email=? AND welcome_sent_at IS NOT NULL LIMIT 1`, args: [email] });
        if (cust && !cust.welcome_sent_at && !dup.rows.length) {
          await sendEmail({ to: email, ...welcomeEmail({ name, product }) });
          await db.execute({ sql: `UPDATE customers SET welcome_sent_at=datetime('now','+7 hours') WHERE id=?`, args: [cust.id] });
          emailed = true;
        }
      } catch (e) {
        console.error('Welcome email failed:', e.message);
      }
    }
    return send(200, { success: true, emailed });
  } catch (e) {
    return send(500, { success: false });
  }
};
