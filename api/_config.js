const fs = require('fs');
const path = require('path');

function loadConfig() {
  const config = {
    RESEND_API_KEY: process.env.RESEND_API_KEY || '',
    EMAIL_FROM: process.env.EMAIL_FROM || '',
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || 'thuanho1221@gmail.com',
    PAYMENT_URL: process.env.PAYMENT_URL || 'https://bongdemannhien.io.vn/#sale-off',
  };

  const candidatePaths = [
    path.join(__dirname, 'resend_config.txt'),
    path.join(__dirname, '..', 'resend_config.txt'),
    path.join(process.cwd(), 'resend_config.txt'),
    'D:\\my-brain\\resend_config.txt',
    'D:/my-brain/resend_config.txt',
  ];

  for (const p of candidatePaths) {
    try {
      if (fs.existsSync(p)) {
        const content = fs.readFileSync(p, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith('#')) continue;
          if (line.includes('=')) {
            const idx = line.indexOf('=');
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim();
            if (k && v && !config[k]) {
              config[k] = v;
            }
          } else if (line.startsWith('re_') && !config.RESEND_API_KEY) {
            config.RESEND_API_KEY = line;
          }
        }
        if (config.RESEND_API_KEY) break;
      }
    } catch (_) {}
  }

  // Đảm bảo địa chỉ người gửi luôn sử dụng domain riêng đã verify trên Resend (mail.bongdemannhien.io.vn)
  // và hiển thị đúng tên người gửi Hồ Minh Thuận theo brand voice trong email_sequence.md
  if (!config.EMAIL_FROM || !/bongdemannhien\.io\.vn/i.test(config.EMAIL_FROM)) {
    config.EMAIL_FROM = 'Hồ Minh Thuận — Sportfit.pro <thuan@mail.bongdemannhien.io.vn>';
  } else if (!/Thuận/i.test(config.EMAIL_FROM)) {
    const addrMatch = config.EMAIL_FROM.match(/<([^>]+)>/);
    const addr = addrMatch ? addrMatch[1] : config.EMAIL_FROM.trim();
    config.EMAIL_FROM = `Hồ Minh Thuận — Sportfit.pro <${addr}>`;
  }

  return config;
}

module.exports = { loadConfig };
