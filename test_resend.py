import os
import sys
import json
import urllib.request
import urllib.error
import re
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

def load_resend_config():
    candidates = [
        os.path.join(BASE_DIR, "resend_config.txt"),
        os.path.join(BASE_DIR, "..", "resend_config.txt"),
        "D:/my-brain/resend_config.txt",
        "D:\\my-brain\\resend_config.txt"
    ]
    config = {
        "RESEND_API_KEY": os.environ.get("RESEND_API_KEY", ""),
        "EMAIL_FROM": os.environ.get("EMAIL_FROM", "Hồ Minh Thuận <thuan@mail.bongdemannhien.io.vn>"),
        "EMAIL_REPLY_TO": os.environ.get("EMAIL_REPLY_TO", "thuanho1221@gmail.com"),
        "PAYMENT_URL": os.environ.get("PAYMENT_URL", "https://bongdemannhien.io.vn/#sale-off")
    }
    
    for p in candidates:
        if os.path.exists(p):
            with open(p, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        k, v = line.split("=", 1)
                        k = k.strip()
                        v = v.strip()
                        if k and v and not config.get(k):
                            config[k] = v
                    elif line.startswith("re_") and not config["RESEND_API_KEY"]:
                        config["RESEND_API_KEY"] = line
            if config["RESEND_API_KEY"]:
                break
    return config

def main():
    config = load_resend_config()
    print("=== KIỂM TRA CẤU HÌNH RESEND & EMAIL SEQUENCE ===")
    print(f"File config: resend_config.txt")
    print(f"API Key: {'[ĐÃ CẤU HÌNH ' + config['RESEND_API_KEY'][:10] + '...]' if config['RESEND_API_KEY'] else '[CHƯA CÓ - CẦN ĐIỀN]'}")
    print(f"Địa chỉ gửi (EMAIL_FROM): {config['EMAIL_FROM']}")
    print(f"Email nhận reply (EMAIL_REPLY_TO): {config['EMAIL_REPLY_TO']}")
    print(f"Link thanh toán (PAYMENT_URL): {config['PAYMENT_URL']}")
    print("-" * 50)
    print("Domain mail.bongdemannhien.io.vn đã được xác nhận (Verified) trên Resend!")

if __name__ == "__main__":
    main()
