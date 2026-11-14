// NỘI DUNG 3 EMAIL. Muốn đổi chữ, chỉ cần sửa file này.
// Email 1: chào mừng. Email 2 và 3 hiện là BẢN NHÁP, cần thay bằng nội dung trong email_sequence.md của bạn.

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Tên gọi: lấy từ cuối trong họ tên Việt Nam (Nguyễn Minh Quân -> Quân)
const callName = (full) => String(full || '').trim().split(/\s+/).pop() || 'bạn';

const FOOTER_TEXT = 'Bạn nhận email này vì đã đăng ký danh sách chờ trên bongdemannhien.io.vn. Không muốn nhận nữa, chỉ cần trả lời email này với một chữ "Hủy".';

function wrap(paragraphsHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1f2937;max-width:560px;margin:0 auto;padding:8px">
${paragraphsHtml}
<p>Thuận<br>SportFit Pro</p>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
<p style="font-size:12px;color:#6b7280">${esc(FOOTER_TEXT)}</p>
</div>`;
}

function email1({ name, product }) {
  const ten = callName(name);
  const sp = product ? ` cho món "${product}"` : '';
  return {
    subject: `${ten} ơi, mình đã ghi nhận bạn vào danh sách chờ SportFit Pro`,
    text: `Chào ${ten},

Mình là Thuận, người đứng sau SportFit Pro. Mình đã ghi nhận bạn vào danh sách chờ${sp}.

Từ giờ bạn sẽ nhận được:
- Sau khoảng 2 ngày: một email hướng dẫn thực tế để chọn đúng dụng cụ tập, không lan man.
- Sau đó: ưu đãi dành riêng cho người trong danh sách chờ.

Mình chỉ gửi những thứ có giá trị, không gửi thư rác.

Để mình viết đúng thứ bạn cần: hiện giờ bạn vướng nhất ở chỗ nào khi tập luyện? Không có thời gian, không biết bắt đầu từ đâu, hay chưa chọn được dụng cụ phù hợp? Bấm trả lời email này và nói thẳng với mình.

Thuận
SportFit Pro

${FOOTER_TEXT}`,
    html: wrap(`<p>Chào ${esc(ten)},</p>
<p>Mình là Thuận, người đứng sau SportFit Pro. Mình đã ghi nhận bạn vào danh sách chờ${esc(sp)}.</p>
<p>Từ giờ bạn sẽ nhận được:</p>
<ul>
<li><strong>Sau khoảng 2 ngày:</strong> một email hướng dẫn thực tế để chọn đúng dụng cụ tập, không lan man.</li>
<li><strong>Sau đó:</strong> ưu đãi dành riêng cho người trong danh sách chờ.</li>
</ul>
<p>Mình chỉ gửi những thứ có giá trị, không gửi thư rác.</p>
<p>Để mình viết đúng thứ bạn cần: hiện giờ bạn vướng nhất ở chỗ nào khi tập luyện? Không có thời gian, không biết bắt đầu từ đâu, hay chưa chọn được dụng cụ phù hợp? <strong>Bấm trả lời email này và nói thẳng với mình.</strong></p>`),
  };
}

// BẢN NHÁP: thay bằng nội dung trong email_sequence.md
function email2({ name }) {
  const ten = callName(name);
  return {
    subject: `${ten} ơi, 3 câu hỏi cần trả lời trước khi mua dụng cụ tập`,
    text: `Chào ${ten},

Phần lớn người mua nhầm dụng cụ không phải vì hàng dở, mà vì chưa trả lời đúng mấy câu hỏi trước khi bấm mua. Mình tóm lại 3 câu:

1. Thứ nhất là, mục tiêu của bạn là gì? Giảm mỡ, tăng cơ, hay giảm đau mỏi vai gáy do ngồi nhiều? Mỗi mục tiêu cần một loại dụng cụ khác nhau.
2. Thứ hai là, bạn tập ở đâu và có bao nhiêu phút mỗi ngày? Tập 20 phút trong phòng khách khác hẳn tập ngoài sân.
3. Thứ ba là, bạn đang ở mức nào? Người mới cần dụng cụ chỉnh được mức kháng lực, đừng mua loại quá nặng ngay từ đầu.

Kiểu như là, nếu bạn ngồi máy tính 8 đến 10 tiếng mỗi ngày, ưu tiên nên nghiêng về bài kéo giãn và tập vai lưng trước, rồi mới tính đến các món nặng.

Bạn trả lời được mấy câu trong ba câu trên? Trả lời email này, mình sẽ gợi ý thẳng dụng cụ phù hợp.

Thuận
SportFit Pro

${FOOTER_TEXT}`,
    html: wrap(`<p>Chào ${esc(ten)},</p>
<p>Phần lớn người mua nhầm dụng cụ không phải vì hàng dở, mà vì chưa trả lời đúng mấy câu hỏi trước khi bấm mua. Mình tóm lại 3 câu:</p>
<ol>
<li><strong>Thứ nhất là, mục tiêu của bạn là gì?</strong> Giảm mỡ, tăng cơ, hay giảm đau mỏi vai gáy do ngồi nhiều? Mỗi mục tiêu cần một loại dụng cụ khác nhau.</li>
<li><strong>Thứ hai là, bạn tập ở đâu và có bao nhiêu phút mỗi ngày?</strong> Tập 20 phút trong phòng khách khác hẳn tập ngoài sân.</li>
<li><strong>Thứ ba là, bạn đang ở mức nào?</strong> Người mới cần dụng cụ chỉnh được mức kháng lực, đừng mua loại quá nặng ngay từ đầu.</li>
</ol>
<p>Kiểu như là, nếu bạn ngồi máy tính 8 đến 10 tiếng mỗi ngày, ưu tiên nên nghiêng về bài kéo giãn và tập vai lưng trước, rồi mới tính đến các món nặng.</p>
<p>Bạn trả lời được mấy câu trong ba câu trên? <strong>Trả lời email này, mình sẽ gợi ý thẳng dụng cụ phù hợp.</strong></p>`),
  };
}

// BẢN NHÁP: thay bằng nội dung trong email_sequence.md. paymentUrl lấy từ biến môi trường PAYMENT_URL.
function email3({ name, paymentUrl }) {
  const ten = callName(name);
  return {
    subject: `${ten} ơi, ưu đãi Starter Kit VĐV dành cho danh sách chờ`,
    text: `Chào ${ten},

Hôm nay mình gửi ưu đãi đã hứa cho người trong danh sách chờ: Combo Starter Kit VĐV, 890.000đ (giá niêm yết 1.290.000đ).

Trong gói có:
- 1 suất tư vấn kỹ thuật 1-1 theo môn
- Bộ video 30 bài tập chuẩn HLV và phòng ngừa chấn thương
- Miễn phí giao hàng và bảo hành kỹ thuật 12 tháng

Bạn được mở hộp kiểm tra hàng trước khi thanh toán.

Đặt hàng và thanh toán tại đây: ${paymentUrl}

Nếu bạn còn phân vân chưa biết gói này có hợp với mình không, trả lời email này kèm môn bạn tập, mình sẽ nói thẳng là nên mua hay chưa nên.

Thuận
SportFit Pro

${FOOTER_TEXT}`,
    html: wrap(`<p>Chào ${esc(ten)},</p>
<p>Hôm nay mình gửi ưu đãi đã hứa cho người trong danh sách chờ: <strong>Combo Starter Kit VĐV, 890.000đ</strong> (giá niêm yết 1.290.000đ).</p>
<p>Trong gói có:</p>
<ul>
<li>1 suất tư vấn kỹ thuật 1-1 theo môn</li>
<li>Bộ video 30 bài tập chuẩn HLV và phòng ngừa chấn thương</li>
<li>Miễn phí giao hàng và bảo hành kỹ thuật 12 tháng</li>
</ul>
<p>Bạn được mở hộp kiểm tra hàng trước khi thanh toán.</p>
<p><a href="${esc(paymentUrl)}" style="display:inline-block;background:#f97316;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Đặt hàng và thanh toán</a></p>
<p>Nếu bạn còn phân vân chưa biết gói này có hợp với mình không, <strong>trả lời email này kèm môn bạn tập</strong>, mình sẽ nói thẳng là nên mua hay chưa nên.</p>`),
  };
}

module.exports = { email1, email2, email3 };
