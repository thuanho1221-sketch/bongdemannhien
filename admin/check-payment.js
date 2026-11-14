// API Serverless kiểm tra trạng thái thanh toán từ SePay
export default async function handler(req, res) {
    // Thiết lập CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { orderCode, amount } = req.query;

    if (!orderCode) {
        return res.status(400).json({ error: 'Thiếu mã đơn hàng orderCode' });
    }

    const SEPAY_API_TOKEN = process.env.SEPAY_API_TOKEN || "HUD5WAYCGVCTRFJ7MLDLEFMEU1TLNQ6IEIZNGYRNBEHQH79S0XXWVV4JTQ4DBWHP";

    try {
        // Gọi API SePay để lấy 20 giao dịch gần nhất
        const response = await fetch("https://my.sepay.vn/userapi/transactions/list?limit=20", {
            headers: {
                "Authorization": `Bearer ${SEPAY_API_TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            return res.status(500).json({ error: "Lỗi kết nối tới SePay", status: response.status });
        }

        const data = await response.json();
        const transactions = data.messages || [];

        // Kiểm tra xem có giao dịch nào khớp với mã đơn hàng không
        const cleanOrderCode = orderCode.trim().toUpperCase();
        const matched = transactions.find(t => {
            const content = (t.transaction_content || "").toUpperCase();
            const isMatchCode = content.includes(cleanOrderCode);
            const isAmountValid = amount ? Number(t.amount_in) >= Number(amount) : Number(t.amount_in) > 0;
            return isMatchCode && isAmountValid;
        });

        if (matched) {
            return res.status(200).json({
                success: true,
                paid: true,
                transaction: {
                    id: matched.id,
                    amount: matched.amount_in,
                    content: matched.transaction_content,
                    time: matched.transaction_date
                }
            });
        }

        return res.status(200).json({
            success: true,
            paid: false,
            message: "Chưa tìm thấy giao dịch khớp mã đơn hàng"
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
