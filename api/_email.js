// Gửi email qua Resend bằng API (không cần cài thêm thư viện)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendEmail({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error('Thiếu RESEND_API_KEY hoặc EMAIL_FROM');
  const body = { from, to: [to], subject, html, text };
  if (process.env.EMAIL_REPLY_TO) body.reply_to = process.env.EMAIL_REPLY_TO;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Resend ' + res.status + ': ' + (await res.text()).slice(0, 300));
  return res.json();
}

// Tên gọi: lấy từ cuối trong họ tên Việt Nam (Nguyễn Minh Quân -> Quân)
const callName = (full) => String(full || '').trim().split(/\s+/).pop() || 'bạn';

function welcomeEmail({ name, product }) {
  const ten = callName(name);
  const sp = product ? ` cho món "${product}"` : '';
  const subject = `${ten} ơi, mình đã ghi nhận bạn vào danh sách chờ SportFit Pro`;
  const text = `Chào ${ten},

Mình là Thuận, người đứng sau SportFit Pro. Mình đã ghi nhận bạn vào danh sách chờ${sp}.

Từ giờ bạn sẽ nhận được:
- Sau khoảng 2 ngày: một email hướng dẫn thực tế để chọn đúng dụng cụ tập, không lan man.
- Sau đó: ưu đãi dành riêng cho người trong danh sách chờ.

Mình chỉ gửi những thứ có giá trị, không gửi thư rác.

Để mình viết đúng thứ bạn cần: hiện giờ bạn vướng nhất ở chỗ nào khi tập luyện? Không có thời gian, không biết bắt đầu từ đâu, hay chưa chọn được dụng cụ phù hợp? Bấm trả lời email này và nói thẳng với mình.

Thuận
SportFit Pro

Bạn nhận email này vì đã đăng ký danh sách chờ trên bongdemannhien.io.vn. Không muốn nhận nữa, chỉ cần trả lời email này với một chữ "Hủy".`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:8px">
<p>Chào ${esc(ten)},</p>
<p>Mình là Thuận, người đứng sau SportFit Pro. Mình đã ghi nhận bạn vào danh sách chờ${esc(sp)}.</p>
<p>Từ giờ bạn sẽ nhận được:</p>
<ul>
<li><strong>Sau khoảng 2 ngày:</strong> một email hướng dẫn thực tế để chọn đúng dụng cụ tập, không lan man.</li>
<li><strong>Sau đó:</strong> ưu đãi dành riêng cho người trong danh sách chờ.</li>
</ul>
<p>Mình chỉ gửi những thứ có giá trị, không gửi thư rác.</p>
<p>Để mình viết đúng thứ bạn cần: hiện giờ bạn vướng nhất ở chỗ nào khi tập luyện? Không có thời gian, không biết bắt đầu từ đâu, hay chưa chọn được dụng cụ phù hợp? <strong>Bấm trả lời email này và nói thẳng với mình.</strong></p>
<p>Thuận<br>SportFit Pro</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
<p style="font-size:12px;color:#6b7280">Bạn nhận email này vì đã đăng ký danh sách chờ trên bongdemannhien.io.vn. Không muốn nhận nữa, chỉ cần trả lời email này với một chữ "Hủy".</p>
</div>`;
  return { subject, html, text };
}

module.exports = { sendEmail, welcomeEmail };
