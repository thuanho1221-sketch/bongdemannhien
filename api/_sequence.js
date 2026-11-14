// NỘI DUNG CHUỖI 3 EMAIL — SPORTFIT.PRO
// Tham chiếu từ: D:/my-brain/email_sequence.md
// Giọng văn: xưng "mình" - gọi "bạn", đoạn ngắn, trực diện, kết bằng câu hỏi

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

// Tách tên gọi thân thiện từ họ tên Việt Nam (ví dụ: "Hồ Minh Thuận" -> "Thuận")
const callName = (full) => {
  const t = String(full || '').trim().split(/\s+/).pop();
  return t ? t : 'bạn';
};

const FOOTER_TEXT =
  'Bạn nhận email này vì đã đăng ký danh sách chờ trên bongdemannhien.io.vn (Sportfit.pro). Nếu không muốn nhận nữa, chỉ cần trả lời email này với chữ "Hủy".';

function wrap(contentHtml, previewText = '') {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${previewText ? `<div style="display:none;font-size:1px;color:#333333;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${esc(previewText)}</div>` : ''}
</head>
<body style="margin:0;padding:20px;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;line-height:1.65;">
  <div style="max-width:580px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
    ${contentHtml}
    <div style="margin-top:28px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 4px 0;font-weight:700;color:#111827;">Thuận</p>
      <p style="margin:0;color:#ea580c;font-weight:600;font-size:14px;">Sportfit.pro</p>
    </div>
    <div style="margin-top:24px;padding-top:16px;border-top:1px dashed #e5e7eb;font-size:12px;color:#9ca3af;line-height:1.5;">
      ${esc(FOOTER_TEXT)}
    </div>
  </div>
</body>
</html>`;
}

// ==========================================
// EMAIL 1 — CHÀO MỪNG (Gửi ngay lập tức)
// ==========================================
function email1({ name }) {
  const ten = callName(name);
  const xưng = ten === 'bạn' ? 'bạn' : ten;
  const subject = `Chào ${xưng}, mình là Thuận — và đây là lý do bạn nên ở lại`;
  const preview = 'Mình không bán đồ thể thao rẻ nhất. Mình làm việc khác.';

  const text = `Chào ${xưng},

Cảm ơn bạn đã để lại thông tin. Mình là Hồ Minh Thuận, người đứng sau Sportfit.pro.

Mình nói luôn để bạn khỏi mất công đoán: Sportfit không phải chỗ bán đồ thể thao rẻ nhất. Mình cũng không cố bán cho tất cả mọi người.

Mình xây Sportfit cho một nhóm rất cụ thể: những người tập nghiêm túc, từ 3 buổi mỗi tuần trở lên, và muốn chọn đúng dụng cụ cho đúng mục tiêu thay vì tự mò một mình.

Vì sao bạn nên chờ đón những email tiếp theo? Thứ nhất là, mình sẽ chia sẻ những điều mình rút ra từ nghiên cứu thực chiến, dựa trên cơ chế vận động của cơ thể chứ không dựa vào lời quảng cáo. Thứ hai là, mỗi gợi ý của mình đều đi từ câu hỏi: bạn tập gì, cường độ ra sao, mục tiêu của bạn là gì. Có đủ ba thứ đó, mình mới dám khuyên bạn dùng gì.

Mình tin một điều khá đơn giản: không có phép màu trong tập luyện. Chỉ có sự chuẩn bị đúng và dụng cụ đúng.

Hai ngày nữa mình sẽ gửi bạn một điều mà rất nhiều người đang làm sai mà không hề biết. Chưa có gì để bán đâu, chỉ có kiến thức để bạn dùng ngay.

Còn bây giờ, mình tò mò một chút: dạo này bạn đang tập môn gì?

Cứ trả lời thẳng email này, mình đọc từng thư.

Thuận
Sportfit.pro

---
${FOOTER_TEXT}`;

  const html = wrap(
    `<p style="font-size:16px;">Chào ${esc(xưng)},</p>
<p>Cảm ơn bạn đã để lại thông tin. Mình là <strong>Hồ Minh Thuận</strong>, người đứng sau <strong>Sportfit.pro</strong>.</p>
<p>Mình nói luôn để bạn khỏi mất công đoán: Sportfit không phải chỗ bán đồ thể thao rẻ nhất. Mình cũng không cố bán cho tất cả mọi người.</p>
<p>Mình xây Sportfit cho một nhóm rất cụ thể: <em>những người tập nghiêm túc, từ 3 buổi mỗi tuần trở lên, và muốn chọn đúng dụng cụ cho đúng mục tiêu thay vì tự mò một mình.</em></p>
<p>Vì sao bạn nên chờ đón những email tiếp theo?</p>
<p><strong>Thứ nhất là</strong>, mình sẽ chia sẻ những điều mình rút ra từ nghiên cứu thực chiến, dựa trên cơ chế vận động của cơ thể chứ không dựa vào lời quảng cáo.</p>
<p><strong>Thứ hai là</strong>, mỗi gợi ý của mình đều đi từ câu hỏi: bạn tập gì, cường độ ra sao, mục tiêu của bạn là gì. Có đủ ba thứ đó, mình mới dám khuyên bạn dùng gì.</p>
<p>Mình tin một điều khá đơn giản: không có phép màu trong tập luyện. Chỉ có sự chuẩn bị đúng và dụng cụ đúng.</p>
<p>Hai ngày nữa mình sẽ gửi bạn một điều mà rất nhiều người đang làm sai mà không hề biết. Chưa có gì để bán đâu, chỉ có kiến thức để bạn dùng ngay.</p>
<p style="background:#fff7ed;border-left:4px solid #ea580c;padding:12px 16px;margin:20px 0;border-radius:4px;">
  <strong>Còn bây giờ, mình tò mò một chút:</strong> dạo này bạn đang tập môn gì?<br>
  Cứ bấm <em>Trả lời (Reply)</em> thẳng email này, mình đọc từng thư.
</p>`,
    preview
  );

  return { subject, preview, text, html };
}

// ==========================================
// EMAIL 2 — NURTURE (2 ngày sau Email 1)
// ==========================================
function email2({ name }) {
  const ten = callName(name);
  const xưng = ten === 'bạn' ? 'bạn' : ten;
  const subject = `${xưng} ơi, cái sai khiến vai bạn đau mà bạn không nhận ra`;
  const preview = 'Chỉ cần nhìn góc của cùi chỏ khi chống đẩy.';

  const text = `Chào ${xưng},

Hôm nay mình chia sẻ một điểm mù mà mình thấy rất nhiều người tập tại nhà mắc phải: bành cùi chỏ ra 90 độ khi chống đẩy.

Nhìn qua thì thấy đúng form, ngực chạm sàn, tay mở rộng. Nhưng nhìn vào cơ chế thì khác.

Thứ nhất là, khi cùi chỏ mở ngang vai, xương cánh tay bị ép vào mỏm cùng vai. Giới chuyên môn gọi đây là hiện tượng kẹp gân (impingement). Tập vài tuần chưa thấy gì, nhưng tập vài tháng thì gân cơ trên gai bắt đầu chịu thiệt.

Thứ hai là, người tập thường chỉ phát hiện khi vai đã đau. Lúc đó cái giá không còn là vài trăm nghìn dụng cụ, mà là tiền chụp chiếu, thuốc, vật lý trị liệu và mấy tháng nghỉ tập.

Cách sửa thì đơn giản:
- Khép cùi chỏ lại, tạo góc khoảng 45 đến 60 độ so với thân người. Hình dung mũi tên, không phải chữ T.
- Đặt cổ tay thẳng dưới vai.
- Quay video một buổi tập và nhìn thẳng vào góc cùi chỏ của mình. Máy quay không nể ai cả.

Nhìn chung, chấn thương hiếm khi đến từ xui rủi. Nó là kết quả của góc sai và lực sai, lặp đi lặp lại. Sửa được góc, bạn sửa được kết quả.

Mình chọn điều này để chia sẻ vì nó là một trong 15 điểm mù kỹ thuật mà mình tổng hợp cho người chơi cầu lông, pickleball và tập kháng lực. Phần còn lại mình sẽ gửi dần cho bạn.

Câu hỏi nhỏ cho bạn: lần gần nhất bạn quay lại một buổi tập để soi form là khi nào?

Thuận
Sportfit.pro

---
${FOOTER_TEXT}`;

  const html = wrap(
    `<p style="font-size:16px;">Chào ${esc(xưng)},</p>
<p>Hôm nay mình chia sẻ một điểm mù mà mình thấy rất nhiều người tập tại nhà mắc phải: <strong>bành cùi chỏ ra 90 độ khi chống đẩy</strong>.</p>
<p>Nhìn qua thì thấy đúng form, ngực chạm sàn, tay mở rộng. Nhưng nhìn vào cơ chế thì khác.</p>
<p><strong>Thứ nhất là</strong>, khi cùi chỏ mở ngang vai, xương cánh tay bị ép vào mỏm cùng vai. Giới chuyên môn gọi đây là hiện tượng kẹp gân (impingement). Tập vài tuần chưa thấy gì, nhưng tập vài tháng thì gân cơ trên gai bắt đầu chịu thiệt.</p>
<p><strong>Thứ hai là</strong>, người tập thường chỉ phát hiện khi vai đã đau. Lúc đó cái giá không còn là vài trăm nghìn dụng cụ, mà là tiền chụp chiếu, thuốc, vật lý trị liệu và mấy tháng nghỉ tập.</p>
<div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:20px 0;border-radius:4px;">
  <p style="margin:0 0 8px 0;font-weight:700;color:#166534;">Cách sửa thì đơn giản:</p>
  <ul style="margin:0;padding-left:20px;color:#1f2937;">
    <li style="margin-bottom:6px;"><strong>Khép cùi chỏ lại</strong>, tạo góc khoảng 45 đến 60 độ so với thân người. Hình dung hình mũi tên, không phải chữ T.</li>
    <li style="margin-bottom:6px;"><strong>Đặt cổ tay thẳng dưới vai.</strong></li>
    <li style="margin-bottom:0;"><strong>Quay video một buổi tập</strong> và nhìn thẳng vào góc cùi chỏ của mình. Máy quay không nể ai cả.</li>
  </ul>
</div>
<p>Nhìn chung, chấn thương hiếm khi đến từ xui rủi. Nó là kết quả của góc sai và lực sai, lặp đi lặp lại. Sửa được góc, bạn sửa được kết quả.</p>
<p>Mình chọn điều này để chia sẻ vì nó là một trong 15 điểm mù kỹ thuật mà mình tổng hợp cho người chơi cầu lông, pickleball và tập kháng lực. Phần còn lại mình sẽ gửi dần cho bạn.</p>
<p style="background:#fff7ed;border-left:4px solid #ea580c;padding:12px 16px;margin:20px 0;border-radius:4px;">
  <strong>Câu hỏi nhỏ cho bạn:</strong> lần gần nhất bạn quay lại một buổi tập để soi form là khi nào?<br>
  Cứ bấm <em>Trả lời</em> chia sẻ với mình nhé!
</p>`,
    preview
  );

  return { subject, preview, text, html };
}

// ==========================================
// EMAIL 3 — CHỐT (1 ngày sau Email 2)
// ==========================================
function email3({ name, paymentUrl }) {
  const ten = callName(name);
  const xưng = ten === 'bạn' ? 'bạn' : ten;
  const link = paymentUrl || 'https://bongdemannhien.io.vn/#sale-off';
  const subject = `${xưng} ơi, dụng cụ mình chọn để sửa đúng cái lỗi hôm qua`;
  const preview = 'Bảng chống đẩy 14 trong 1 — kèm ưu đãi cho đơn đầu tiên.';

  const text = `Chào ${xưng},

Hôm qua mình nói về lỗi bành cùi chỏ khi chống đẩy. Có bạn sẽ hỏi: biết lỗi rồi, nhưng tập tại nhà làm sao giữ đúng góc mỗi lần?

Thật lòng mà nói, ý chí thì ai cũng có, nhưng lúc mệt, form luôn là thứ đổ đầu tiên. Vì vậy mình chọn một dụng cụ để hỗ trợ đúng chỗ đó.

Bảng Tập Chống Đẩy Đa Năng 14 Trong 1 — 489.000đ

Thứ nhất là, bảng phân định 4 vùng cơ bằng mã màu, nên bạn biết mình đang tập vùng nào thay vì tập theo cảm giác.

Thứ hai là, tay nắm chống trượt giúp cổ tay và vai giữ đúng vị trí, hạn chế việc bành cùi chỏ theo thói quen.

Thứ ba là, chịu tải 200kg, nên bạn không phải lo chuyện độ bền khi tập nghiêm túc.

Mình biết 489.000đ không phải con số bé. Nhưng bạn thử so với một đợt điều trị đau vai thì sẽ thấy: mua đúng dụng cụ rẻ hơn rất nhiều so với việc phải nghỉ tập mấy tháng. Bạn không mua một món đồ rẻ hơn, bạn mua sự chắc chắn rằng mình đang tập đúng.

Vì bạn là người đầu tiên trong danh sách, mình dành cho bạn mã SPORTFIT-THUAN2026, giảm 10% cho đơn hàng đầu tiên.

👉 Đặt hàng tại đây: ${link}

Nếu bạn chưa chắc nên chọn dụng cụ nào cho môn của mình, cứ nhắn mình. Mình sẽ hỏi bạn tập gì, nặng bao nhiêu, mục tiêu ra sao, rồi mới gợi ý. Mình không gửi link bừa.

Bạn thấy cùi chỏ của mình đang ở góc nào khi chống đẩy? Trả lời email này, mình cùng soi nhé.

Thuận
Sportfit.pro

---
${FOOTER_TEXT}`;

  const html = wrap(
    `<p style="font-size:16px;">Chào ${esc(xưng)},</p>
<p>Hôm qua mình nói về lỗi bành cùi chỏ khi chống đẩy. Có bạn sẽ hỏi: <em>biết lỗi rồi, nhưng tập tại nhà làm sao giữ đúng góc mỗi lần?</em></p>
<p>Thật lòng mà nói, ý chí thì ai cũng có, nhưng lúc mệt, form luôn là thứ đổ đầu tiên. Vì vậy mình chọn một dụng cụ để hỗ trợ đúng chỗ đó.</p>

<div style="background:#f9fafb;border:2px solid #e5e7eb;border-radius:10px;padding:18px 20px;margin:22px 0;">
  <h3 style="margin:0 0 8px 0;color:#111827;font-size:18px;">Bảng Tập Chống Đẩy Đa Năng 14 Trong 1 — <span style="color:#ea580c;">489.000đ</span></h3>
  <p style="margin:0 0 10px 0;color:#4b5563;font-size:14px;"><strong>Thứ nhất là</strong>, bảng phân định 4 vùng cơ bằng mã màu, nên bạn biết mình đang tập vùng nào thay vì tập theo cảm giác.</p>
  <p style="margin:0 0 10px 0;color:#4b5563;font-size:14px;"><strong>Thứ hai là</strong>, tay nắm chống trượt giúp cổ tay và vai giữ đúng vị trí, hạn chế việc bành cùi chỏ theo thói quen.</p>
  <p style="margin:0;color:#4b5563;font-size:14px;"><strong>Thứ ba là</strong>, chịu tải 200kg, nên bạn không phải lo chuyện độ bền khi tập nghiêm túc.</p>
</div>

<p>Mình biết 489.000đ không phải con số bé. Nhưng bạn thử so với một đợt điều trị đau vai thì sẽ thấy: mua đúng dụng cụ rẻ hơn rất nhiều so với việc phải nghỉ tập mấy tháng. Bạn không mua một món đồ rẻ hơn, bạn mua sự chắc chắn rằng mình đang tập đúng.</p>

<div style="background:#fff7ed;border:1px dashed #f97316;border-radius:8px;padding:14px 18px;margin:20px 0;text-align:center;">
  <p style="margin:0 0 6px 0;font-size:14px;color:#9a3412;">Mã ưu đãi độc quyền cho người trong danh sách chờ:</p>
  <div style="font-size:20px;font-weight:900;letter-spacing:2px;color:#c2410c;">SPORTFIT-THUAN2026</div>
  <p style="margin:6px 0 0 0;font-size:13px;color:#7c2d12;">(Giảm 10% cho đơn hàng đầu tiên)</p>
</div>

<div style="text-align:center;margin:26px 0;">
  <a href="${esc(link)}" style="display:inline-block;background:#ea580c;color:#ffffff;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 32px;border-radius:10px;box-shadow:0 4px 6px rgba(234,88,12,0.25);">👉 Đặt Hàng & Nhận Ưu Đãi Tại Đây</a>
  <p style="margin:8px 0 0 0;font-size:12px;color:#6b7280;">Hoặc truy cập: <a href="${esc(link)}" style="color:#ea580c;">${esc(link)}</a></p>
</div>

<p>Nếu bạn chưa chắc nên chọn dụng cụ nào cho môn của mình, cứ nhắn mình. Mình sẽ hỏi bạn tập gì, nặng bao nhiêu, mục tiêu ra sao, rồi mới gợi ý. Mình không gửi link bừa.</p>

<p style="background:#fff7ed;border-left:4px solid #ea580c;padding:12px 16px;margin:20px 0;border-radius:4px;">
  <strong>Bạn thấy cùi chỏ của mình đang ở góc nào khi chống đẩy?</strong><br>
  Bấm Trả lời email này, mình cùng soi nhé.
</p>`,
    preview
  );

  return { subject, preview, text, html };
}

module.exports = { email1, email2, email3, callName };
