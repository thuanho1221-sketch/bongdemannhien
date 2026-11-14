// Gửi email qua Resend bằng API (không cần cài thêm thư viện)
async function sendEmail({ to, subject, html, text, scheduledAt }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error('Thiếu RESEND_API_KEY hoặc EMAIL_FROM');
  const body = { from, to: [to], subject, html, text };
  if (process.env.EMAIL_REPLY_TO) body.reply_to = process.env.EMAIL_REPLY_TO;
  if (scheduledAt) body.scheduled_at = scheduledAt; // ISO 8601, Resend cho hẹn trước tối đa 30 ngày
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Resend ' + res.status + ': ' + (await res.text()).slice(0, 300));
  return res.json();
}

module.exports = { sendEmail };
