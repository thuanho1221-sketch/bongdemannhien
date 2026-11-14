const { loadConfig } = require('./_config');

// Gửi email qua Resend REST API (sử dụng fetch có sẵn trong Node 18+)
async function sendEmail({ to, subject, html, text, scheduledAt }) {
  const config = loadConfig();
  const key = config.RESEND_API_KEY;
  const from = config.EMAIL_FROM;

  if (!key) {
    throw new Error('Chưa cấu hình RESEND_API_KEY trong resend_config.txt hoặc biến môi trường');
  }
  if (!from) {
    throw new Error('Chưa cấu hình EMAIL_FROM trong resend_config.txt hoặc biến môi trường');
  }

  const body = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
  };

  if (config.EMAIL_REPLY_TO) {
    body.reply_to = config.EMAIL_REPLY_TO;
  }

  if (scheduledAt) {
    body.scheduled_at = scheduledAt; // ISO 8601 string: Resend hỗ trợ hẹn giờ gửi
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errText = data.message || JSON.stringify(data);
    throw new Error(`Resend ${res.status}: ${errText}`);
  }

  return data;
}

module.exports = { sendEmail };
