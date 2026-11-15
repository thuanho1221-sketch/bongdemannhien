# Sportfit.pro — Hệ Thống Landing Page, Quản Trị Đơn Hàng & Email Tự Động

Dự án thương mại điện tử dụng cụ thể thao thực chiến **Sportfit.pro**, tích hợp:
- **Landing Page & AI Chatbot 24/7 (`index.html`)**: Giới thiệu sản phẩm, tư vấn kỹ thuật theo môn, form khảo sát và đăng ký danh sách chờ (Waitlist).
- **Cổng thanh toán VietQR tự động (`api/check-payment.js`)**: Tạo mã QR động và tự động đối soát giao dịch qua **SePay**.
- **Hệ thống Email tự động (`api/_email.js`, `api/_sequence.js`)**: Tự động gửi email xác nhận đơn hàng và chuỗi 3 email chăm sóc khách đăng ký qua **Resend**.
- **Trang Quản trị Admin (`admin.html`, `api/admin.js`, `admin_server.py`)**: Quản lý Sản phẩm, Khách hàng, Đơn hàng và tồn kho tự động.

---

## 1. Cấu trúc thư mục chính

```text
├── index.html                  # Trang chủ bán hàng, Waitlist Form, Modal VietQR & Chatbot
├── admin.html                  # Giao diện Quản trị (/admin)
├── api/                        # Serverless API (chuẩn Vercel / Node.js)
│   ├── admin.js                # API CRUD sản phẩm, khách hàng, đơn hàng
│   ├── waitlist.js             # API nhận đăng ký danh sách chờ + kích hoạt chuỗi 3 email
│   ├── check-payment.js        # API đối soát giao dịch ngân hàng SePay tự động
│   ├── health.js               # API kiểm tra trạng thái cấu hình (/api/health)
│   ├── _config.js              # Bộ nạp biến môi trường từ .env / process.env
│   ├── _lib.js                 # Tầng kết nối DB (Turso LibSQL / Fallback JSON)
│   ├── _email.js               # Module gửi mail qua Resend REST API
│   └── _sequence.js            # Nội dung chuỗi email chăm sóc & xác nhận đơn
├── admin_server.py             # Server Python chạy Local trực tiếp với SQLite (brain.db)
├── brain.db                    # Cơ sở dữ liệu SQLite cục bộ
├── backups/                    # Thư mục lưu các bản sao lưu của brain.db
├── .env.example                # Mẫu cấu hình biến môi trường (đã ẩn khóa bí mật)
└── vercel.json                 # Cấu hình định tuyến (routing) khi deploy lên Vercel
```

---

## 2. Thiết lập biến môi trường (`.env`)

1. Sao chép file mẫu `.env.example` thành `.env`:
   ```bash
   cp .env.example .env
   ```
2. Điền đầy đủ các thông số thực tế vào `.env`:
   ```env
   # Cổng thanh toán tự động SePay
   SEPAY_API_TOKEN=your_sepay_api_token_here

   # Dịch vụ gửi Email tự động Resend
   RESEND_API_KEY=re_your_resend_api_key_here
   EMAIL_FROM=Hồ Minh Thuận — Sportfit.pro <thuan@mail.bongdemannhien.io.vn>
   EMAIL_REPLY_TO=thuanho1221@gmail.com
   PAYMENT_URL=https://www.bongdemannhien.io.vn/#sale-off

   # Cơ sở dữ liệu đám mây Turso (khi chạy trên Vercel/Server thật)
   TURSO_DATABASE_URL=libsql://your-db-name.turso.io
   TURSO_AUTH_TOKEN=your_turso_auth_token_here

   # Mật khẩu bảo vệ trang /admin
   ADMIN_PASSWORD=your_strong_admin_password_here
   ```
> **Lưu ý bảo mật:** File `.env` và `brain.db` đã được đưa vào `.gitignore` và `.vercelignore`. Tuyệt đối không commit file `.env` lên GitHub.

---

## 3. Chạy thử trên máy cá nhân (Local)

### Cách 1: Chạy bằng Python (`admin_server.py` + `brain.db`)
Không cần cài đặt thêm thư viện ngoài:
```bash
python admin_server.py
```
- Trang chủ: `http://localhost:3000`
- Trang quản trị: `http://localhost:3000/admin`

### Cách 2: Chạy bằng Node.js / Vercel CLI
```bash
npm install
npx vercel dev
```

---

## 4. Hướng dẫn Deploy lên Server thật

### Phương án A: Deploy lên Vercel (Khuyên dùng)

1. **Cài đặt Vercel CLI** (hoặc kết nối trực tiếp kho GitHub với Vercel Dashboard):
   ```bash
   npm i -g vercel
   vercel login
   ```
2. **Thiết lập Environment Variables trên Vercel:**
   Vào **Vercel Dashboard → Project Settings → Environment Variables**, thêm các biến sau:
   - `SEPAY_API_TOKEN`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `EMAIL_REPLY_TO`
   - `TURSO_DATABASE_URL` *(khuyến nghị tạo DB miễn phí trên [turso.tech](https://turso.tech) để lưu trữ vĩnh viễn)*
   - `TURSO_AUTH_TOKEN`
   - `ADMIN_PASSWORD`
3. **Chạy lệnh Deploy bản Production:**
   ```bash
   vercel --prod
   ```

### Phương án B: Deploy lên VPS / Server riêng (Ubuntu / Debian)

1. Clone mã nguồn về server, tạo file `.env` từ `.env.example`.
2. Đảm bảo có sẵn `python3` (hoặc Node.js) và file `brain.db`.
3. Chạy dịch vụ dưới nền bằng `pm2` hoặc `systemd`:
   ```bash
   pm2 start admin_server.py --name sportfit-web --interpreter python3
   pm2 save
   ```
4. Cấu hình Nginx Reverse Proxy trỏ domain (`sportfit.pro`) về `http://127.0.0.1:3000` và bật SSL bằng Certbot (`certbot --nginx`).

---

## 5. Kiểm tra sau khi Deploy & Sao lưu dữ liệu

- **Kiểm tra trạng thái hệ thống:** Truy cập `https://<ten-mien-cua-ban>/api/health` để kiểm tra kết nối Database, trạng thái `RESEND_API_KEY` và cấu hình bảo mật Admin.
- **Sao lưu `brain.db`:**
  Trước mỗi lần cập nhật hoặc định kỳ hàng tuần, tạo bản sao lưu an toàn vào thư mục `backups/`:
  ```bash
  python -c "import sqlite3; src=sqlite3.connect('brain.db'); dst=sqlite3.connect('backups/brain_backup.db'); src.backup(dst); dst.close(); src.close()"
  ```
