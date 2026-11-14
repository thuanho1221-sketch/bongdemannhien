const { sendEmail } = require('./_email');
const { email1, email2, email3 } = require('./_sequence');
const { loadConfig } = require('./_config');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY = 24 * 3600 * 1000;
const NOW_VN = "datetime('now','+7 hours')";

// Kiểm tra chế độ test: email có chứa "+test" (ví dụ: thuanho1221+test@gmail.com)
function isTestAddress(email) {
  if (!email) return false;
  return /\+test/i.test(String(email).trim());
}

/**
 * Gửi chuỗi 3 email:
 * 1. Email 1: gửi ngay lập tức khi đăng ký.
 * 2. Email 2: hẹn giờ gửi sau 2 ngày (qua Resend scheduled_at).
 * 3. Email 3: hẹn giờ gửi sau 3 ngày (+1 ngày sau Email 2).
 *
 * Chế độ test (+test): Gửi toàn bộ 3 email ngay lập tức thay vì chờ theo lịch.
 */
async function runSequence(db, cust, ctx) {
  const config = loadConfig();
  const test = isTestAddress(ctx.email);
  const to = ctx.email;
  const paymentUrl = config.PAYMENT_URL || 'https://bongdemannhien.io.vn/#sale-off';
  const c = { name: ctx.name, product: ctx.product, paymentUrl };
  const t0 = Date.now();

  const steps = [
    { col: 'welcome_sent_at', build: email1, at: null, tag: '1/3' },
    { col: 'email2_scheduled_at', build: email2, at: t0 + 2 * DAY, tag: '2/3' },
    { col: 'email3_scheduled_at', build: email3, at: t0 + 3 * DAY, tag: '3/3' },
  ];

  const results = [];
  for (const s of steps) {
    // Nếu không phải test và bước này đã gửi rồi thì bỏ qua
    if (!test && cust && cust[s.col]) continue;

    // Giữ khoảng cách giữa các request để không vượt quá giới hạn 2 req/giây của Resend
    if (results.length) await sleep(600);

    const msg = s.build(c);
    if (test) {
      msg.subject = `[TEST ${s.tag}] ` + msg.subject;
    }

    // Nếu là test mode thì scheduledAt = undefined -> Resend gửi ngay lập tức!
    const scheduledAt = !test && s.at ? new Date(s.at).toISOString() : undefined;

    const resendRes = await sendEmail({
      to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      scheduledAt,
    });

    if (db && cust && cust.id) {
      try {
        await db.execute({
          sql: `UPDATE customers SET ${s.col}=${NOW_VN} WHERE id=?`,
          args: [cust.id],
        });
      } catch (err) {
        console.warn('DB update failed for ' + s.col, err.message);
      }
    }

    results.push({
      step: s.tag,
      scheduledAt: scheduledAt || 'IMMEDIATE',
      id: resendRes ? resendRes.id : null,
    });
  }

  return { test, results };
}

module.exports = { runSequence, isTestAddress };
