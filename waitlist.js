const { getDb, ensureReady } = require('./_lib');
const { runSequence, isTestAddress } = require('./_sequence_run');

// Endpoint công khai cho form Waitlist trên landing page
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

    await ensureReady();
    const db = getDb();
    const note = product ? 'Quan tâm: ' + product : null;

    // Lưu khách hàng vào database
    await db.execute({
      sql: `INSERT INTO customers (name, phone, zalo, email, notes, registered_at)
            VALUES (?, ?, ?, ?, ?, datetime('now', '+7 hours'))
            ON CONFLICT(phone) DO UPDATE SET
              name = excluded.name,
              notes = COALESCE(excluded.notes, customers.notes),
              email = COALESCE(excluded.email, customers.email)`,
      args: [name, phone, phone, email || null, note],
    });

    // Kích hoạt chuỗi 3 email nếu khách có để lại email
    let sequenceResult = null;
    if (email) {
      try {
        const r = await db.execute({ sql: 'SELECT * FROM customers WHERE phone=?', args: [phone] });
        const cust = r.rows[0] ? { ...r.rows[0] } : { name, email, phone };

        // Kiểm tra tránh gửi trùng lặp (trừ khi là email test có đuôi +test)
        const isTest = isTestAddress(email);
        const dup = isTest
          ? { rows: [] }
          : await db.execute({
              sql: 'SELECT 1 FROM customers WHERE email=? AND welcome_sent_at IS NOT NULL AND id<>? LIMIT 1',
              args: [email, cust.id || 0],
            });

        if (!dup.rows.length) {
          sequenceResult = await runSequence(db, cust, { name, product, email });
        } else {
          sequenceResult = { skipped: true, reason: 'Email này đã nhận chuỗi email trước đó' };
        }
      } catch (err) {
        console.error('Lỗi khi gửi email sequence qua Resend:', err.message);
        sequenceResult = { error: err.message };
      }
    }

    return send(200, {
      success: true,
      message: 'Đăng ký danh sách chờ thành công',
      sequence: sequenceResult,
    });
  } catch (e) {
    console.error('Lỗi xử lý waitlist:', e.message);
    return send(500, { success: false, error: 'Lỗi máy chủ' });
  }
};
