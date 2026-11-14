const { sendEmail } = require('./_email');
const { email1, email2, email3 } = require('./_sequence');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 24 * 3600 * 1000;
const NOW_VN = "datetime('now','+7 hours')";

// Chế độ test: email có "+test" VÀ địa chỉ gốc (bỏ phần +test) trùng EMAIL_REPLY_TO của chủ shop.
// Ví dụ EMAIL_REPLY_TO=abc@gmail.com thì abc+test@gmail.com sẽ nhận cả 3 email ngay.
function isTestAddress(email) {
  const owner = String(process.env.EMAIL_REPLY_TO || '').trim().toLowerCase();
  const [local, domain] = String(email).toLowerCase().split('@');
  if (!owner || !local || !domain || !/\+test/.test(local)) return false;
  return local.replace(/\+test[^@]*/, '') + '@' + domain === owner;
}

// Gửi Email 1 ngay, hẹn Email 2 sau 2 ngày, Email 3 sau 3 ngày (tức 1 ngày sau Email 2).
// Mỗi bước ghi mốc vào DB nên nếu lỗi giữa chừng thì lần sau chỉ gửi bước còn thiếu.
async function runSequence(db, cust, ctx) {
  const test = isTestAddress(ctx.email);
  const to = ctx.email;
  const paymentUrl = process.env.PAYMENT_URL || 'https://www.bongdemannhien.io.vn/#sale-off';
  const c = { name: ctx.name, product: ctx.product, paymentUrl };
  const t0 = Date.now();
  const steps = [
    { col: 'welcome_sent_at', build: email1, at: null, tag: '1/3' },
    { col: 'email2_scheduled_at', build: email2, at: t0 + 2 * DAY, tag: '2/3' },
    { col: 'email3_scheduled_at', build: email3, at: t0 + 3 * DAY, tag: '3/3' },
  ];
  const sent = [];
  for (const s of steps) {
    if (!test && cust[s.col]) continue; // bước này đã làm rồi
    if (sent.length) await sleep(600); // Resend giới hạn 2 yêu cầu/giây
    const msg = s.build(c);
    if (test) msg.subject = `[TEST ${s.tag}] ` + msg.subject;
    await sendEmail({ to, ...msg, scheduledAt: !test && s.at ? new Date(s.at).toISOString() : undefined });
    await db.execute({ sql: `UPDATE customers SET ${s.col}=${NOW_VN} WHERE id=?`, args: [cust.id] });
    sent.push(s.tag);
  }
  return { test, sent };
}

module.exports = { runSequence, isTestAddress };
