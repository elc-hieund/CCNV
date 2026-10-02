# DESIGN RULE — AMBULANCE COMMAND CENTER (CCNV)
**Phiên bản:** 1.0 · **Ngày ban hành:** 01/10/2026 · **Áp dụng:** Toàn bộ hệ thống giao diện CCNV

---

## 1. PHONG CÁCH TỔNG THỂ (CORE DESIGN PHILOSOPHY)

Hệ thống được thiết kế theo tiêu chuẩn **Trung tâm Điều hành Cấp cứu Hiện đại (Ambulance Command Center)**:
- **Phong cách:** Dark Navy Command Center, Medical Emergency, Realtime Fleet Monitoring, Professional / High-tech / Minimal.
- **Tiêu chuẩn vận hành:** Ưu tiên khả năng quan sát 24/7 trên màn hình Desktop độ phân giải **1920×1080**, hiển thị mật độ thông tin cao nhưng trực quan, dễ quan sát.
- **Cảm giác chủ đạo:** *COMMAND CENTER — REALTIME — MEDICAL — EMERGENCY — PRECISION — RELIABILITY*.
- **Quy định nghiêm ngặt:**
  - Không thiết kế giống website bệnh viện, admin dashboard thông thường.
  - Không thiết kế kiểu gaming dashboard, crypto dashboard.
  - Không sử dụng cyan/neon làm màu chủ đạo.
  - Không dùng gradient màu sặc sỡ, không dùng glassmorphism quá mức.
  - Không dùng background đen tuyệt đối (`#000000`).

---

## 2. MÀU SẮC VÀ NGUYÊN TẮC SỬ DỤNG (3 NHÓM MÀU CHỦ ĐẠO)

Toàn bộ hệ thống giao diện **CHỈ SỬ DỤNG 3 MÀU CHÍNH**:

### 2.1. DARK NAVY (Chiếm khoảng 80% giao diện)
- Main background: `#071522`
- Sidebar & Header: `#081827`
- Panel: `#0A1B2A`
- Elevated panel: `#0E2435`
- Border: `#183449`
- Border nổi / Popup: `#29465A`

### 2.2. WHITE (Chiếm khoảng 15% giao diện)
Dùng cho:
- Text chính
- Số liệu
- Icon
- Thông tin quan trọng
- Tên xe
- Tên địa điểm
- Bảng mã màu: `#FFFFFF`, `#F5F7FA`, `#CBD5E1`, `#AAB8C2`

### 2.3. EMERGENCY RED (Chiếm khoảng 5% giao diện — "Hiếm nhưng nổi bật")
Dải màu: `#E52521`, `#FF3B35`, `#B91C1C`
- **Nguyên tắc:** RED phải hiếm nhưng nổi bật. Không biến toàn bộ dashboard thành màu đỏ.
- **Chỉ dùng cho:**
  - Cấp cứu
  - SOS
  - Cảnh báo nghiêm trọng
  - Xe đang thực hiện nhiệm vụ cấp cứu
  - Notification quan trọng
  - Active emergency state
  - CTA quan trọng

---

## 3. QUY ĐỊNH BỘ ICON (STANDARDIZED ICON SET)

- **Sử dụng bộ icon chuẩn trên mạng:** Nhúng trực tiếp SVG từ các bộ icon chuẩn web quốc tế như **Lucide Icons**, **Remix Icon**, hoặc **Bootstrap Icons**.
- **Tuyệt đối KHÔNG dùng loại tự gen (AI gen icon):** Đảm bảo tính sắc nét, đồng bộ nét vẽ (stroke 1.75px hoặc 2px), không bị vỡ hạt.
- **Tuyệt đối KHÔNG dùng emoji làm icon:** Toàn bộ biểu tượng chức năng phải là SVG chuẩn.
- **Màu sắc icon:**
  - Icon mặc định: Màu **WHITE (`#FFFFFF`)** hoặc Slate sáng (`#CBD5E1`).
  - **Chỉ icon của trạng thái CẢNH BÁO, SOS, CẤP CỨU mới sử dụng RED (`#E52521`)**.

---

## 4. TYPOGRAPHY & HIERARCHY

- **Font family:** `Inter`, sans-serif. Chữ phải rõ ràng, tương phản cao. Không dùng font futuristic.
- **Phân cấp kích thước:**
  - `KPI Numbers`: **28px – 32px** / 700 (Bold)
  - `Page Title`: **20px – 24px** / 600
  - `Section Title`: **14px – 16px** / 600
  - `Body`: **13px – 14px**
  - `Metadata`: **11px – 12px**

---

## 5. THÀNH PHẦN GIAO DIỆN (COMPONENTS SPECIFICATION)

### 5.1. Header (Cao 64px)
- **Background:** `#081827`, Border đáy: `1px solid #183449`.
- **Bên trái:**
  - [ICON DẤU THẬP CẤP CỨU MÀU ĐỎ `#E52521`]
  - `AMBULANCE COMMAND CENTER` (Chữ trắng, 18-20px/600)
  - `HỆ THỐNG GIÁM SÁT XE CỨU THƯƠNG` (Màu nhạt, 11px)
- **Ở giữa:**
  - `● LIVE` (chấm LIVE sử dụng RED `#FF3B35`, nhấp nháy pulse)
  - Đồng hồ: `10:31:24`
  - Ngày: `01/10/2026`
- **Bên phải:**
  - Trạng thái 4G / Server status
  - Notification (chuông)
  - User
  - Settings

### 5.2. Sidebar (Rộng khoảng 200px)
- **Background:** `#081827`, Border phải: `1px solid #183449`.
- **Menu Items:**
  - Tổng quan
  - Bản đồ realtime
  - Danh sách xe
  - Điều phối
  - Camera
  - Sự kiện / cảnh báo
  - Lịch sử hành trình
  - Báo cáo
  - Quản trị hệ thống
- **Trạng thái menu:**
  - Menu mặc định: Text `#CBD5E1`, Icon màu trắng.
  - Menu active: Background `#0E2435`, Text `#FFFFFF`, Left border `3px solid #E52521`.
  - Icon cảnh báo: Dùng RED khi có báo động khẩn.
- **Cuối sidebar (Khung gọi 115):**
  - Background: Dark red (`#160B0F`)
  - Border: RED (`1px solid #E52521`)
  - Text: WHITE
  - Nội dung: `☎ GỌI CẤP CỨU 115`

### 5.3. KPI Header (Ngay phía trên bản đồ)
- **Card specs:** Background `#0A1B2A`, Border `1px solid #183449`, Border-radius `6-8px`.
- **Danh sách 6 chỉ số:**
  1. `TỔNG XE`: Số lớn WHITE (`42`)
  2. `ĐANG HOẠT ĐỘNG`: Số lớn WHITE (`28`)
  3. `ĐANG DI CHUYỂN`: Số lớn WHITE (`21`)
  4. `ĐANG CẤP CỨU`: **Số lớn RED (`#FF3B35`)** (`03`) $\rightarrow$ Chỉ KPI này dùng RED!
  5. `MẤT KẾT NỐI`: Số lớn WHITE/GRAY (`02`)
  6. `GPS WARNING`: Số lớn WHITE/GRAY (`01`)

### 5.4. Realtime Map — Thành phần quan trọng nhất (~60% diện tích)
- **Map type:** Dark map chuyên dụng (không dùng bản đồ sáng).
  - Map background: `#071522`
  - Road: `#20394A`
  - Major road: `#385468`
  - District boundary: `#294252`
  - Map label: `#AAB8C2`
- **Hiển thị:** Hà Nội, Quận/huyện, Đường chính, Đường nhỏ, Vị trí xe cứu thương, Vị trí bệnh viện, Điểm sự kiện.
- **Ambulance Marker (Xe cứu thương):**
  - *Marker bình thường:* Icon xe WHITE, Background DARK NAVY (`#0A1B2A`), Border WHITE mảnh `1px`.
  - *Marker đang di chuyển:* Icon WHITE, Background DARK NAVY, Border WHITE.
  - *Marker được chọn:* Icon WHITE, Background RED (`#E52521`), Border WHITE.
  - *Marker đang cấp cứu:* Icon WHITE, Background RED (`#E52521`), **có vòng RED pulse animation** lan tỏa.
  - Không sử dụng quá nhiều màu cho marker. Chỉ RED mới biểu thị trạng thái cấp cứu.

### 5.5. Vehicle Popup & Vehicle List (Danh sách xe bên phải)
- **Vehicle Popup (Khi click vào xe trên bản đồ):**
  - Popup background: `#0A1B2A`, Border: `#29465A`, Radius: 8px.
  - Header: `🚑 29A-12345` + Badge `CẤP CỨU` (RED background + WHITE text).
  - Nội dung: Bệnh viện Bạch Mai | Tốc độ: 58 km/h | GPS Accuracy: 4m | Hướng: 135° | Kết nối: 4G | Camera: LIVE | Cập nhật: 3 giây.
- **Danh sách xe (Panel bên phải bản đồ):**
  - Title: `DANH SÁCH XE CỨU THƯƠNG` (42 XE).
  - Search box: `Tìm kiếm biển số / xe...`
  - Vehicle card: Background `#0A1B2A`, Border `1px solid #183449`, Radius `6-8px`.
  - Card bình thường: Dark Navy.
  - Card được chọn: Border RED.
  - Card xe cấp cứu: Left border RED (`3px solid #E52521`).

### 5.6. Emergency Alert & Live Camera (Dưới bản đồ)
- **Emergency Alert (Bên dưới bản đồ, bên trái):**
  - Title: `⚠ CẢNH BÁO KHẨN CẤP`
  - Background `#0A1B2A`, Border `#B91C1C`.
  - Nội dung: `🔴 CẢNH BÁO KHẨN CẤP` | `🚑 29A-12345` | Đang thực hiện nhiệm vụ cấp cứu | Vị trí: Nguyễn Trãi, Hà Nội | Tốc độ: 58 km/h.
  - Button `[ XEM TRÊN BẢN ĐỒ ]`: Background `#E52521`, Text `#FFFFFF`.
- **Live Camera (Cạnh Emergency Alert, bên phải):**
  - Title: `CAMERA 01 ● LIVE` (Chấm LIVE màu RED).
  - Video background: BLACK / DARK NAVY.
  - Hiển thị: Hình ảnh camera phía sau xe cứu thương.
  - Overlay: `29A-12345` | `LIVE` | `10:31:24`.

---

## 6. HỆ THỐNG TRẠNG THÁI (STRICT STATUS SYSTEM)

| Trạng thái | Màu quy định | Áp dụng cho |
|---|---|---|
| **NORMAL** | WHITE / LIGHT GRAY | Trạng thái bình thường |
| **MOVING** | WHITE | Xe đang di chuyển |
| **GPS** | WHITE | Tín hiệu GPS ổn định |
| **ONLINE** | WHITE | Kết nối trực tuyến |
| **WARNING** | RED (`#E52521`) | Cảnh báo bất thường |
| **EMERGENCY** | RED (`#E52521` / `#FF3B35`) | Ca cấp cứu khẩn |
| **SOS** | RED (`#FF3B35`) | Báo động SOS |
| **OFFLINE** | GRAY (`#64748B`) | Mất kết nối |

> Tuyệt đối không tạo thêm nhiều màu trạng thái (không dùng vàng tươi, cam, tím, cyan).

---

## 7. BỐ CỤC KHÔNG GIAN (DESKTOP 1920×1080)

```text
HEADER (64px) — [✚] AMBULANCE COMMAND CENTER       ● LIVE 10:31:24      [4G] [Bell] [User] [Settings]
--------------------------------------------------------------------------------------------------------
SIDEBAR (200px) | KPI HEADER: TỔNG 42 | HĐ 28 | CHẠY 21 | CẤP CỨU 03 (RED) | MẤT KẾT NỐI 02 | GPS CẢNH BÁO 01
                 |---------------------------------------------------------|----------------------------
• Tổng quan      |                                                         | DANH SÁCH XE CỨU THƯƠNG
• Bản đồ realtime|                    REALTIME DARK MAP                    | 42 XE
• Danh sách xe   |                 (Chiếm ~60% diện tích)                  | [Tìm kiếm biển số / xe...]
• Điều phối      |                                                         |
• Camera         |             - Hà Nội, Marker xe, Bệnh viện -            | [ Card: 29A-12345 ]
• Sự kiện/C.báo  |                                                         | (Left border RED nếu cấp cứu)
• Lịch sử        |                                                         |
• Báo cáo        |---------------------------------------------------------| [ Card: 29A-67890 ]
• Quản trị       | EMERGENCY ALERT (Cảnh báo khẩn)  | CAMERA 01 ● LIVE     |
                 | 🔴 29A-12345 Đang cấp cứu        | [Camera feed mock]   | [ Card: 29A-45678 ]
[☎ GỌI CẤP CỨU]  | Nguyễn Trãi | [XEM TRÊN BẢN ĐỒ]  | 29A-12345 | 10:31:24 |
--------------------------------------------------------------------------------------------------------
```

---

## 8. CODE DESIGN TOKENS (CSS VARIABLES)

```css
:root {
  /* Dark Navy (80%) */
  --bg-main: #071522;
  --bg-sidebar-header: #081827;
  --bg-panel: #0A1B2A;
  --bg-elevated: #0E2435;
  --border-main: #183449;
  --border-accent: #29465A;

  /* White & Light Gray (15%) */
  --text-white: #FFFFFF;
  --text-light: #F5F7FA;
  --text-slate: #CBD5E1;
  --text-muted: #AAB8C2;
  --text-gray: #64748B;

  /* Emergency Red (5%) */
  --red-primary: #E52521;
  --red-vivid: #FF3B35;
  --red-dark: #B91C1C;
  --red-glow: rgba(255, 59, 53, 0.25);

  /* Map Colors */
  --map-bg: #071522;
  --map-road: #20394A;
  --map-road-major: #385468;
  --map-boundary: #294252;
  --map-label: #AAB8C2;

  /* Typography */
  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

  /* Radii */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
}
```

---

## 9. QUY TẮC ƯU TIÊN THỊ GIÁC (VISUAL PRIORITY)

1. Bản đồ realtime
2. Xe cứu thương
3. Xe đang cấp cứu (Red + Pulse)
4. Cảnh báo khẩn cấp
5. KPI
6. Danh sách xe
7. Camera
8. Các thông tin phụ

Khi có một xe chuyển sang trạng thái **CẤP CỨU**:
- Marker chuyển RED `#E52521` + Pulse animation
- Vehicle card chuyển border RED
- Emergency alert xuất hiện
- Notification tăng số lượng
- Toàn bộ dashboard vẫn giữ nền DARK NAVY.
