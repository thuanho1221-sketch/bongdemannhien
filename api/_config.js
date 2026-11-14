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

  // Fallback defaults khớp với domain đã verify trên Resend
  if (!config.EMAIL_FROM) {
    config.EMAIL_FROM = 'Hồ Minh Thuận <thuan@mail.bongdemannhien.io.vn>';
  }

  return config;
}

module.exports = { loadConfig };
