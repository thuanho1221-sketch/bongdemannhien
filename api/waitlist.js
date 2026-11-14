const { getDb, ensureReady } = require('./_lib');
const { runSequence, isTestAddress } = require('./_sequence_run');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  const send = (code, obj) => res.status(code).send(JSON.stringify(obj));
  if (req.method !== 'POST') return send(405, { success: false, error: 'Phương thức không được hỗ trợ' });

  try {
    const b = req.body || {};
    const name = String(b.name || '').trim().slice(0, 100);
    const phone = String(b.phone || '').replace(/[\s.\-()]/g, '');
    const email = String(b.email || '').trim().toLowerCase();
    const product = String(b.product || '').trim().slice(0, 150);

    if (name.length < 2) {
      return send(400, { success: false, error: 'Tên không hợp lệ' });
    }
    if (!/^\+?\d{8,13}$/.test(phone)) {
      return send(400, { success: false, error: 'Số điện thoại không hợp lệ' });
    }
    if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) {
      return send(400, { success: false, error: 'Email không hợp lệ' });
    }

    let db = null;
    let cust = { name, phone, email, zalo: phone, notes: product ? 'Quan tâm: ' + product : null };

    // 1. Lưu vào cơ sở dữ liệu
    try {
      await ensureReady();
      db = getDb();
      const note = product ? 'Quan tâm: ' + product : null;
      await db.execute({
        sql: `INSERT INTO customers (name, phone, zalo, email, notes, registered_at)
              VALUES (?, ?, ?, ?, ?, datetime('now', '+7 hours'))
              ON CONFLICT(phone) DO UPDATE SET
                name = excluded.name,
                notes = COALESCE(excluded.notes, customers.notes),
                email = COALESCE(excluded.email, customers.email)`,
        args: [name, phone, phone, email || null, note],
      });
      const r = await db.execute({ sql: 'SELECT * FROM customers WHERE phone=?', args: [phone] });
      if (r && r.rows && r.rows[0]) {
        cust = { ...r.rows[0] };
      }
    } catch (dbErr) {
      console.warn('Lưu DB không thành công (tiếp tục gửi email):', dbErr.message);
    }

    // 2. Kích hoạt chuỗi email qua Resend (độc lập, không bị nghẽn bởi DB)
    let sequenceResult = null;
    if (email) {
      try {
        sequenceResult = await runSequence(db, cust, { name, product, email });
      } catch (emailErr) {
        console.error('Lỗi khi gửi email qua Resend:', emailErr.message);
        sequenceResult = { error: emailErr.message };
      }
    }

    return send(200, {
      success: true,
      message: 'Đăng ký danh sách chờ thành công',
      sequence: sequenceResult,
    });
  } catch (e) {
    console.error('Lỗi xử lý waitlist:', e.message);
    return send(500, { success: false, error: e.message || 'Lỗi máy chủ' });
  }
};
