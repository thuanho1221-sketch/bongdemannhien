const fs = require('fs');
const path = require('path');

function loadConfig() {
  const candidatePaths = [
    path.join(__dirname, '.env'),
    path.join(__dirname, '..', '.env'),
    path.join(process.cwd(), '.env'),
    path.join(__dirname, 'resend_config.txt'),
    path.join(__dirname, '..', 'resend_config.txt'),
  ];

  const fileVars = {};
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
            const v = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (k && v && !fileVars[k]) {
              fileVars[k] = v;
              if (!process.env[k]) {
                process.env[k] = v;
              }
            }
          } else if (line.startsWith('re_') && !fileVars.RESEND_API_KEY) {
            fileVars.RESEND_API_KEY = line;
            if (!process.env.RESEND_API_KEY) {
              process.env.RESEND_API_KEY = line;
            }
          }
        }
      }
    } catch (_) {}
  }

  const config = {
    SEPAY_API_TOKEN: process.env.SEPAY_API_TOKEN || fileVars.SEPAY_API_TOKEN || '',
    RESEND_API_KEY: process.env.RESEND_API_KEY || fileVars.RESEND_API_KEY || '',
    EMAIL_FROM: process.env.EMAIL_FROM || fileVars.EMAIL_FROM || '',
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO || fileVars.EMAIL_REPLY_TO || 'thuanho1221@gmail.com',
    PAYMENT_URL: process.env.PAYMENT_URL || fileVars.PAYMENT_URL || 'https://bongdemannhien.io.vn/#sale-off',
    TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || fileVars.TURSO_DATABASE_URL || '',
    TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN || fileVars.TURSO_AUTH_TOKEN || '',
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || fileVars.ADMIN_PASSWORD || '',
  };

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
