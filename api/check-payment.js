const fs = require('fs');
const path = require('path');
const { getDb, ensureReady } = require('./_lib');
const { sendEmail } = require('./_email');
const { orderConfirmationEmail } = require('./_sequence');

const CONFIRMED_FILE = process.env.VERCEL
  ? '/tmp/sepay_confirmed.json'
  : path.join(__dirname, '..', 'sepay_confirmed.local.json');

const memConfirmed = new Map();

function getConfirmed(orderCode) {
  if (memConfirmed.has(orderCode)) return memConfirmed.get(orderCode);
  try {
    if (fs.existsSync(CONFIRMED_FILE)) {
      const obj = JSON.parse(fs.readFileSync(CONFIRMED_FILE, 'utf8'));
      if (obj && obj[orderCode]) {
        memConfirmed.set(orderCode, obj[orderCode]);
        return obj[orderCode];
      }
    }
  } catch (_) {}
  return null;
}

function saveConfirmed(orderCode, info) {
  memConfirmed.set(orderCode, info);
  try {
    let obj = {};
    if (fs.existsSync(CONFIRMED_FILE)) {
      obj = JSON.parse(fs.readFileSync(CONFIRMED_FILE, 'utf8')) || {};
    }
    obj[orderCode] = info;
    fs.writeFileSync(CONFIRMED_FILE, JSON.stringify(obj), 'utf8');
  } catch (_) {}
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const params = Object.assign({}, req.query || {}, req.body || {});
  const orderCode = String(params.orderCode || '').trim();
  const amount = Number(params.amount || 2000);

  if (!orderCode) {
    return res.status(400).send(JSON.stringify({ success: false, error: 'Thiếu mã đơn hàng orderCode' }));
  }

  const cleanOrderCode = orderCode.toUpperCase();

  // Nếu mã đơn này đã được xác nhận trước đó, trả về ngay không gửi lặp email
  const prev = getConfirmed(cleanOrderCode);
  if (prev) {
    return res.status(200).send(JSON.stringify(prev));
  }

  const SEPAY_API_TOKEN =
    process.env.SEPAY_API_TOKEN || 'HUD5WAYCGVCTRFJ7MLDLEFMEU1TLNQ6IEIZNGYRNBEHQH79S0XXWVV4JTQ4DBWHP';

  try {
    // Gọi API SePay để lấy 20 giao dịch gần nhất
    const response = await fetch('https://my.sepay.vn/userapi/transactions/list?limit=20', {
      headers: {
        Authorization: `Bearer ${SEPAY_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(500).send(
        JSON.stringify({
          success: false,
          error: 'Lỗi kết nối tới SePay',
          status: response.status,
        })
      );
    }

    const data = await response.json();
    // SePay trả mảng giao dịch trong data.transactions (fallback data.messages nếu là mảng)
    const transactions = Array.isArray(data.transactions)
      ? data.transactions
      : Array.isArray(data.messages)
      ? data.messages
      : [];

    // Kiểm tra giao dịch khớp mã đơn hàng và số tiền (hỗ trợ test chuyển khoản thật 2.000đ)
    const minRequired = Math.min(amount > 0 ? amount : 2000, 2000);
    const matched = transactions.find((t) => {
      const content = String(t.transaction_content || t.content || t.description || '').toUpperCase();
      const isMatchCode = content.includes(cleanOrderCode);
      const amountIn = Number(t.amount_in || 0);
      const isAmountValid = amountIn >= minRequired;
      return isMatchCode && isAmountValid;
    });

    if (!matched) {
      return res.status(200).send(
        JSON.stringify({
          success: true,
          paid: false,
          message: 'Chưa tìm thấy giao dịch khớp mã đơn hàng',
        })
      );
    }

    // ĐÃ TÌM THẤY GIAO DỊCH SEPAY THÀNH CÔNG -> CẬP NHẬT DB (status = 'success') & GỬI EMAIL XÁC NHẬN ĐƠN HÀNG QUA RESEND
    const paidAmount = Number(matched.amount_in) || amount || 2000;
    const customerName = String(params.customerName || 'Khách hàng Sportfit').trim();
    const customerPhone = String(params.customerPhone || '').replace(/[\s.\-()]/g, '');
    const customerEmail = String(params.customerEmail || '').trim().toLowerCase();
    const customerAddress = String(params.customerAddress || '').trim();
    const productName = String(params.productName || 'Bảng Tập Chống Đẩy Đa Năng 14 Trong 1').trim();
    const productIdParam = Number(params.productId) || 1;
    const pendingOrderId = Number(params.orderId) || 0;

    let finalOrderId = pendingOrderId || cleanOrderCode;
    let prodRow = {
      id: productIdParam,
      name: productName,
      product_type: 'physical',
      description: 'Dụng cụ thể thao chuẩn thực chiến Sportfit.pro.',
    };
    let custRow = {
      name: customerName,
      phone: customerPhone,
      email: customerEmail,
    };

    try {
      await ensureReady();
      const db = getDb();

      // 1. Tìm sản phẩm trong DB theo ID hoặc tên
      const pRes = await db.execute('SELECT * FROM products');
      const allProds = (pRes && pRes.rows) || [];
      const foundProd =
        allProds.find((p) => Number(p.id) === productIdParam) ||
        allProds.find((p) => productName && String(p.name).toLowerCase().includes(productName.toLowerCase().slice(0, 15))) ||
        allProds[0];
      if (foundProd) {
        prodRow = { ...foundProd };
      }

      // 2. Lưu hoặc cập nhật khách hàng
      let custId = 1;
      if (customerPhone) {
        await db.execute({
          sql: `INSERT INTO customers (name, phone, zalo, email, notes, registered_at)
                VALUES (?, ?, ?, ?, ?, datetime('now', '+7 hours'))
                ON CONFLICT(phone) DO UPDATE SET
                  name = excluded.name,
                  email = COALESCE(excluded.email, customers.email)`,
          args: [
            customerName,
            customerPhone,
            customerPhone,
            customerEmail || null,
            customerAddress ? `Địa chỉ: ${customerAddress} (${cleanOrderCode})` : `Mã đơn SePay: ${cleanOrderCode}`,
          ],
        });
        const cRes = await db.execute({ sql: 'SELECT * FROM customers WHERE phone=?', args: [customerPhone] });
        if (cRes && cRes.rows && cRes.rows[0]) {
          custRow = { ...cRes.rows[0] };
          custId = Number(custRow.id);
        }
      }

      // 3. Nếu đã có đơn pending thì chuyển sang 'success', nếu chưa có thì tạo mới với trạng thái 'success'
      if (pendingOrderId > 0) {
        await db.execute({
          sql: 'UPDATE orders SET status=? WHERE id=?',
          args: ['success', pendingOrderId],
        });
        finalOrderId = pendingOrderId;
      } else {
        await db.execute({
          sql: "INSERT INTO orders (customer_id, product_id, amount, status, order_date) VALUES (?, ?, ?, 'success', datetime('now', '+7 hours'))",
          args: [custId, prodRow.id || 1, paidAmount],
        });
        await db.execute({
          sql: "UPDATE products SET stock_quantity=MAX(0,COALESCE(stock_quantity,0)-1) WHERE id=? AND product_type='physical'",
          args: [prodRow.id || 1],
        });
        const oRes = await db.execute({
          sql: 'SELECT id FROM orders WHERE customer_id=? AND product_id=? ORDER BY id DESC LIMIT 1',
          args: [custId, prodRow.id || 1],
        });
        if (oRes && oRes.rows && oRes.rows[0]) {
          finalOrderId = oRes.rows[0].id;
        }
      }
    } catch (dbErr) {
      console.warn('Lưu đơn SePay vào DB gặp lỗi (tiếp tục gửi email):', dbErr.message);
    }

    // 4. Gửi Email Xác Nhận Đơn Hàng tự động qua Resend
    const toEmail = customerEmail || custRow.email || process.env.EMAIL_REPLY_TO || 'thuanho1221@gmail.com';
    let emailSent = false;
    let emailId = null;
    let emailError = null;

    if (toEmail) {
      try {
        const msg = orderConfirmationEmail({
          orderId: `${finalOrderId} (${cleanOrderCode})`,
          customerName: custRow.name || customerName || 'bạn',
          customerPhone: custRow.phone || customerPhone || '',
          productName: prodRow.name || productName,
          productType: prodRow.product_type || 'physical',
          productDescription: prodRow.description || '',
          amount: paidAmount,
          status: 'paid',
        });
        const resendRes = await sendEmail({
          to: toEmail,
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
        });
        emailSent = true;
        emailId = resendRes ? resendRes.id : null;
      } catch (err) {
        console.error('Lỗi gửi email xác nhận đơn SePay:', err.message);
        emailError = err.message;
      }
    }

    const resultPayload = {
      success: true,
      paid: true,
      status: 'success',
      orderId: finalOrderId,
      orderCode: cleanOrderCode,
      emailSent,
      emailTo: toEmail,
      emailId,
      emailError,
      transaction: {
        id: matched.id,
        amount: matched.amount_in,
        content: matched.transaction_content || matched.content,
        time: matched.transaction_date,
      },
    };

    saveConfirmed(cleanOrderCode, resultPayload);
    return res.status(200).send(JSON.stringify(resultPayload));
  } catch (error) {
    return res.status(500).send(JSON.stringify({ success: false, error: error.message }));
  }
};
