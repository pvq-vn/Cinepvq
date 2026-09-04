import os
from google import genai
from dotenv import load_dotenv

# Load biến môi trường từ file .env
load_dotenv()

# Khởi tạo client
client = genai.Client()

try:
    # Cập nhật sang model mới hiện tại
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents="Xin chào, hãy trả lời ngắn gọn: Bạn có hoạt động không?",
    )
    print("API hoạt động thành công!")
    print("Phản hồi từ Gemini:", response.text)
except Exception as e:
    print("Lỗi kết nối API:", e)