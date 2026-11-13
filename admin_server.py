import http.server
import socketserver
import json
import sqlite3
import os
import urllib.parse
import shutil

PORT = 3000
DB_FILE = os.path.abspath("brain.db")
BACKUP_DB_FILE = os.path.abspath("D:/my-brain/brain.db")

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def sync_backup():
    if os.path.exists(BACKUP_DB_FILE):
        try:
            shutil.copy(DB_FILE, BACKUP_DB_FILE)
        except Exception:
            pass

class AdminHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        
        # Route /admin -> serve /admin/index.html
        if parsed.path in ['/admin', '/admin/']:
            self.path = '/admin/index.html'
            return super().do_GET()

        # API endpoint /api/admin
        if parsed.path == '/api/admin':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()

            conn = get_db()
            cursor = conn.cursor()

            # Lấy sản phẩm
            cursor.execute("SELECT id, name, product_type, price, description, stock_quantity, created_at FROM products ORDER BY id DESC")
            products = [dict(row) for row in cursor.fetchall()]

            # Lấy khách hàng
            cursor.execute("SELECT id, name, phone, zalo, registered_at, created_at FROM customers ORDER BY id DESC")
            customers = [dict(row) for row in cursor.fetchall()]

            # Lấy đơn hàng
            cursor.execute("""
                SELECT o.id, o.customer_id, o.product_id, o.amount, o.status, o.order_date, o.created_at,
                       c.name as customer_name, c.phone as customer_phone,
                       p.name as product_name, p.product_type
                FROM orders o
                LEFT JOIN customers c ON o.customer_id = c.id
                LEFT JOIN products p ON o.product_id = p.id
                ORDER BY o.id DESC
            """)
            orders = [dict(row) for row in cursor.fetchall()]
            conn.close()

            res = {
                "success": True,
                "products": products,
                "customers": customers,
                "orders": orders
            }
            self.wfile.write(json.dumps(res, ensure_ascii=False).encode('utf-8'))
            return

        # Mặc định phục vụ file tĩnh
        return super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == '/api/admin':
            content_length = int(self.headers.get('Content-Length', 0))
            body_str = self.rfile.read(content_length).decode('utf-8')
            
            try:
                payload = json.loads(body_str) if body_str else {}
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Invalid JSON"}).encode('utf-8'))
                return

            action = payload.get("action")
            data = payload.get("data", {})
            conn = get_db()
            cursor = conn.cursor()

            try:
                # 1. SẢN PHẨM (PRODUCTS)
                if action == "add_product":
                    p_type = data.get("product_type", "physical")
                    stock = data.get("stock_quantity")
                    if p_type == "physical":
                        stock = int(stock) if stock is not None and str(stock).strip() != "" else 0
                    else:
                        stock = None

                    cursor.execute("""
                        INSERT INTO products (name, product_type, price, description, stock_quantity)
                        VALUES (?, ?, ?, ?, ?)
                    """, (data["name"], p_type, float(data["price"]), data.get("description", ""), stock))
                    conn.commit()

                elif action == "edit_product":
                    p_type = data.get("product_type", "physical")
                    stock = data.get("stock_quantity")
                    if p_type == "physical":
                        stock = int(stock) if stock is not None and str(stock).strip() != "" else 0
                    else:
                        stock = None

                    cursor.execute("""
                        UPDATE products 
                        SET name = ?, product_type = ?, price = ?, description = ?, stock_quantity = ?
                        WHERE id = ?
                    """, (data["name"], p_type, float(data["price"]), data.get("description", ""), stock, data["id"]))
                    conn.commit()

                elif action == "delete_product":
                    cursor.execute("DELETE FROM products WHERE id = ?", (data["id"],))
                    conn.commit()

                # 2. KHÁCH HÀNG (CUSTOMERS)
                elif action == "add_customer":
                    cursor.execute("""
                        INSERT INTO customers (name, phone, zalo, registered_at)
                        VALUES (?, ?, ?, datetime('now', 'localtime'))
                    """, (data["name"], data.get("phone", ""), data.get("zalo", "")))
                    conn.commit()

                elif action == "edit_customer":
                    cursor.execute("""
                        UPDATE customers 
                        SET name = ?, phone = ?, zalo = ?
                        WHERE id = ?
                    """, (data["name"], data.get("phone", ""), data.get("zalo", ""), data["id"]))
                    conn.commit()

                elif action == "delete_customer":
                    cursor.execute("DELETE FROM customers WHERE id = ?", (data["id"],))
                    conn.commit()

                # 3. ĐƠN HÀNG (ORDERS)
                elif action == "add_order":
                    cust_id = int(data["customer_id"])
                    prod_id = int(data["product_id"])
                    amount = float(data["amount"])
                    status = data.get("status", "paid")
                    
                    # Thêm đơn hàng
                    cursor.execute("""
                        INSERT INTO orders (customer_id, product_id, amount, status, order_date)
                        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
                    """, (cust_id, prod_id, amount, status))
                    
                    # KIỂM TRA LOẠI SẢN PHẨM ĐỂ TRỪ TỒN KHO:
                    # Chỉ tự động trừ số lượng còn lại nếu là sản phẩm vật lý (physical)
                    # Sản phẩm số (digital) hoặc dịch vụ (service) KHÔNG trừ tồn kho
                    cursor.execute("SELECT product_type, stock_quantity FROM products WHERE id = ?", (prod_id,))
                    prod_row = cursor.fetchone()
                    if prod_row and prod_row["product_type"] == "physical":
                        cursor.execute("""
                            UPDATE products 
                            SET stock_quantity = MAX(0, COALESCE(stock_quantity, 0) - 1)
                            WHERE id = ?
                        """, (prod_id,))
                        print(f"[*] Đã trừ 1 tồn kho cho sản phẩm vật lý ID={prod_id}")
                    else:
                        print(f"[*] Sản phẩm {prod_row['product_type'] if prod_row else ''} không trừ tồn kho.")
                    
                    conn.commit()

                elif action == "edit_order":
                    cursor.execute("""
                        UPDATE orders 
                        SET customer_id = ?, product_id = ?, amount = ?, status = ?
                        WHERE id = ?
                    """, (int(data["customer_id"]), int(data["product_id"]), float(data["amount"]), data.get("status", "paid"), data["id"]))
                    conn.commit()

                elif action == "delete_order":
                    cursor.execute("DELETE FROM orders WHERE id = ?", (data["id"],))
                    conn.commit()

                else:
                    conn.close()
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(json.dumps({"success": False, "error": "Unknown action"}).encode('utf-8'))
                    return

                conn.close()
                sync_backup()

                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "message": "Action completed successfully"}).encode('utf-8'))
                return

            except Exception as e:
                conn.close()
                self.send_response(500)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
                return

        return super().do_POST()

if __name__ == "__main__":
    server_address = ('', PORT)
    with socketserver.TCPServer(server_address, AdminHandler) as httpd:
        print(f"[*] Admin Server đang chạy tại: http://localhost:{PORT}/admin")
        httpd.serve_forever()
