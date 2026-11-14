const { getDb, ensureReady, getStorageInfo } = require('./_lib');
const { loadConfig } = require('./_config');

// Kiểm tra nhanh cấu hình hệ thống: /api/health  (KHÔNG trả về bất kỳ khóa bí mật nào)
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');

  const cfg = loadConfig();
  const out = {
    resend_api_key: cfg.RESEND_API_KEY ? 'đã cấu hình (' + cfg.RESEND_API_KEY.slice(0, 3) + '…)' : 'CHƯA CẤU HÌNH',
    email_from: cfg.EMAIL_FROM,
    turso_database_url: process.env.TURSO_DATABASE_URL ? 'đã cấu hình' : 'chưa cấu hình (dùng bộ nhớ tạm)',
    admin_password: process.env.ADMIN_PASSWORD ? 'BẬT (trang admin cần đăng nhập)' : 'TẮT (không cần đăng nhập)',
  };

  try {
    await ensureReady();
    const r = await getDb().execute('SELECT id FROM products');
    out.database = { ...getStorageInfo(), products: (r.rows || []).length };
  } catch (e) {
    out.database = { error: e.message };
  }

  // Kiểm tra API key Resend còn hiệu lực không (chỉ đọc danh sách domain, không gửi mail)
  if (cfg.RESEND_API_KEY) {
    try {
      const r = await fetch('https://api.resend.com/domains', { headers: { Authorization: 'Bearer ' + cfg.RESEND_API_KEY } });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        out.resend_status = 'KEY HỢP LỆ';
        out.resend_domains = (j.data || []).map((d) => d.name + ' (' + d.status + ')');
      } else if (/restricted/i.test(String(j.name || '') + String(j.message || ''))) {
        out.resend_status = 'KEY HỢP LỆ (loại chỉ có quyền gửi mail)';
      } else {
        out.resend_status = 'KEY LỖI ' + r.status + ': ' + (j.message || '');
      }
    } catch (e) {
      out.resend_status = 'Không gọi được Resend: ' + e.message;
    }
  }

  res.status(200).send(JSON.stringify(out, null, 2));
};
