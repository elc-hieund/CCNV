# CCNV Agent Workspace Rules

Tập luật này tự động kích hoạt cho mọi tác vụ trong dự án Cấp cứu Ngoại viện TP. Cần Thơ (CCNV).

---

## 1. Triết lý Lazy Senior Developer (Kế thừa từ Ponytail)
- **Tối giản là trên hết (KISS & YAGNI):** Đoạn code tốt nhất là đoạn code không cần phải viết. Không tạo cấu trúc phức tạp hay viết code cho các tính năng "để dành cho tương lai".
- **Không backend, không framework dư thừa:** Toàn bộ hệ thống chạy trên nền HTML5, CSS thuần và JavaScript ES Modules tĩnh. Dữ liệu nạp từ `data.json`.
- **Thực hiện tại chỗ:** Mỗi tab/màn hình thực hiện chức năng trong bộ nhớ client (`window.appState` / DOM), không làm CRUD backend.

---

## 2. Tiêu chuẩn Thiết kế Đỉnh cao (Kế thừa từ Impeccable & design_rule.md)
- **Phong cách:** Dark Navy Ambulance Command Center (Màn hình giám sát và điều hành cấp cứu chuyên nghiệp).
- **Hệ 3 màu nghiêm ngặt (Tỷ lệ 80 - 15 - 5):**
  - Dark Navy (`#071522`, `#081827`, `#0A1B2A`, `#0E2435`, `#183449`): Chiếm ~80% diện tích.
  - White / Light Gray (`#FFFFFF`, `#CBD5E1`, `#AAB8C2`): Chiếm ~15% diện tích (thể hiện thông tin, số liệu, nhãn).
  - Emergency Red (`#E52521`, `#FF3B35`, `#B91C1C`): Chiếm ~5% diện tích (chỉ dành cho điểm nóng cấp cứu, SOS, cảnh báo, live pulse, nút Gọi 115).
- **Bộ icon chuẩn (NGHIÊM NGẶT):**
  - CẤM TUYỆT ĐỐI việc tự chèn Emoji unicode (như 📍, 🧭, 🏥, 📞, ✕, 🟢, ⚠️, ✚...) làm icon trong các nút bấm (button), nhãn hành động, chip lọc, bảng biểu, danh sách hay popup bản đồ.
  - Toàn bộ icon trong button/label PHẢI dùng inline SVG chuẩn (Lucide Icons vector) hoặc chữ text chuyên nghiệp rõ ràng.
  - Emoji CHỈ ĐƯỢC PHÉP dùng trong ngữ cảnh tiêu đề chính (title) hoặc thanh điều hướng (navbar) nếu thật sự phù hợp, không bao giờ dùng trong button tương tác hay nội dung bảng dữ liệu.
- **Độ phân giải chuẩn:** Desktop 1920×1080 (không xuất hiện thanh cuộn ngang, mật độ thông tin cao, dễ đọc).

