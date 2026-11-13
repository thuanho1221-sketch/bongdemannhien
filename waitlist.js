const { getDb, ensureReady } = require('./_lib');

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
    const product = String(b.product || '').trim().slice(0, 150);
    if (name.length < 2) return send(400, { success: false, error: 'Tên không hợp lệ' });
    if (!/^\+?\d{8,13}$/.test(phone)) return send(400, { success: false, error: 'Số điện thoại không hợp lệ' });

    await ensureReady();
    const note = product ? 'Quan tâm: ' + product : null;
    await getDb().execute({
      sql: `INSERT INTO customers (name,phone,zalo,notes,registered_at) VALUES (?,?,?,?,datetime('now','+7 hours'))
            ON CONFLICT(phone) DO UPDATE SET notes=COALESCE(excluded.notes, customers.notes)`,
      args: [name, phone, phone, note],
    });
    return send(200, { success: true });
  } catch (e) {
    return send(500, { success: false });
  }
};
