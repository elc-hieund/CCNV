# TÀI LIỆU KIẾN TRÚC, THIẾT KẾ & QUY TẮC BẢN ĐỒ GIS HỆ THỐNG CCNV
### CAN THO EMERGENCY MEDICAL SERVICE — UNIFIED GIS MAPPING ARCHITECTURE & RULES
**Phiên bản:** 2.0 (Hợp nhất) · **Ngày ban hành:** 11/10/2026 · **Phạm vi áp dụng:** Toàn bộ bản đồ trên tất cả ứng dụng CCNV

---

## 1. MA TRẬN KIẾN TRÚC BẢN ĐỒ TOÀN HỆ THỐNG (SYSTEM ARCHITECTURE MAPPING)

Hệ thống CCNV (Cấp Cứu Ngoại Viện TP. Cần Thơ) sử dụng chung một động cơ bản đồ Web GIS trên nền tảng **Leaflet 1.9.4** kết hợp dịch vụ bản đồ vệ tinh tối giản cao cấp **ArcGIS Canvas Dark Gray**. Dữ liệu phương tiện, ca cấp cứu và trạng thái nhiệm vụ được đồng bộ thời gian thực giữa các phân hệ.

### 1.1. Bảng Ma trận Ánh xạ Phân hệ & Bản đồ

| Phân hệ / Ứng dụng | File HTML | File JS Chính | Viewport / Container | Vai trò (Role) | Chức năng Bản đồ GIS |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **App Central** *(Điều hành toàn thành)* | `central.html` | `js/central/central-app.js`<br>`js/shared/map.js` | `#cantho-map-viewport` | Điều phối viên (`DISPATCHER` / `dpv01`) | Full-bleed citywide overview: giám sát 5 xe cứu thương trực chiến, 6 bệnh viện, các điểm sự cố và lộ trình 2 chặng live. |
| **App Central** *(Modal Chi tiết ca)* | `central.html` | `js/central/central-app.js`<br>`js/shared/map.js` | `#modal-overview-map-viewport` | Điều phối viên (`DISPATCHER`) | Split view 50%: GIS độc lập nạp tuyến đường OSRM riêng biệt của ca được chọn, bám theo xe đang xử lý ca. |
| **App Central** *(Cổng Bệnh viện)* | `central.html` | `js/central/central-app.js`<br>`js/shared/map.js` | `#cantho-map-viewport` | Bệnh viện tiếp nhận (`HOSPITAL_RECEIVER` / `bvtu.tn`) | **Role Scoping cô lập**: Chỉ hiển thị vị trí bệnh viện của tài khoản đang đăng nhập và các xe cứu thương đang chuyển viện đến viện mình. |
| **App Lái xe** *(Mobile HUD)* | `driver.html` | `js/driver/driver-app.js` | `#driver-map-container` | Lái xe / Kíp cấp cứu (`DRIVER` / `CREW-03`) | Giao diện di động HUD dẫn đường turn-by-turn: Xe cố định tâm bản đồ, puck xoay góc hướng đường đi, 6 bước nhiệm vụ TX-00 $\rightarrow$ TX-05. |
| **App Người dân** *(Radar Y tế)* | `citizen.html` | `js/citizen/citizen-app.js` | `#home-facilities-map` | Người dân (`CITIZEN`) | Radar quét cơ sở y tế / trạm cấp cứu trong bán kính 5km từ vị trí GPS người dân, hiển thị tình trạng tiếp nhận và cự ly. |
| **App Người dân** *(Theo dõi Live)* | `citizen.html` | `js/citizen/citizen-app.js` | `#citizen-tracking-map` | Người dân (`CITIZEN`) | Theo dõi trực quan tiến độ điều động xe cấp cứu: vị trí hiện trường nhấp nháy, xe cứu thương di chuyển bám đường và đồng hồ đếm ngược ETA. |

### 1.2. Luồng Dữ liệu Liên Phân hệ (Cross-App Realtime Bus)
```
[js/shared/data-seed.js] (DEMO_CASE_TEMPLATE bất biến)
          │
          ▼
[js/shared/data-loader.js] (StateManager: Quản lý State & Storage)
          │
    ┌─────┴─────────────────────────┐
    ▼                               ▼
[BroadcastChannel]           [localStorage] ('storage' event listener)
'ccnv_realtime_bus'                 │
    │                               │
    ├───────────────────────────────┼───────────────────────────────┐
    ▼                               ▼                               ▼
App Central                     App Lái xe                      App Người dân
(central-app.js)                (driver-app.js)                 (citizen-app.js)
```

---

## 2. TRIẾT LÝ THIẾT KẾ BẢN ĐỒ & DESIGN TOKENS (GIS DESIGN SYSTEM)

Hệ thống bản đồ CCNV được thiết kế theo tiêu chuẩn **Trung tâm Điều hành Cấp cứu Hiện đại (Dark Navy Command Center GIS)**, đảm bảo khả năng quan sát 24/7 với độ tương phản cao, định vị chính xác và nhận diện sự kiện tức thì.

### 2.1. Bảng màu chủ đạo (3 nhóm màu)
- **Dark Navy (80% không gian nền & khung điều khiển):**
  - Màu nền bản đồ khi chưa nạp tile: `#050d17`
  - Nền container bản đồ: `#071522`
  - Viền khung bản đồ & widget nổi: `#183449`
  - Viền nổi / Popover / Tooltip: `#29465A`
- **White & Slate (15% thông tin & text):**
  - Biển số xe, tên bệnh viện, số liệu tốc độ: `#FFFFFF`
  - Nhãn đường phố, phụ chú: `#CBD5E1` / `#AAB8C2`
- **Emergency Red & Accent (5% trạng thái khẩn cấp — "Hiếm nhưng nổi bật"):**
  - Cấp cứu / Đang làm nhiệm vụ: `#E52521` / `#DC2626` / `#EF4444`
  - Xe sẵn sàng trực chiến: `#059669` / `#10B981` (Xanh ngọc y tế)
  - Tuyến lộ trình về bệnh viện: `#38BDF8` / `#60A5FA` (Xanh lơ phát sáng)
  - Tuyến lộ trình đến hiện trường: `#F97316` / `#EF4444` (Đỏ cam phát sáng)

### 2.2. Lớp bản đồ nền (Tile Layers)
- **Dịch vụ Tile:** ArcGIS Canvas Dark Gray (Vector Dark)
  - Base Layer: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`
  - Reference Layer: `https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`
- **CSS Filter tăng cường độ nét:**
  ```css
  .leaflet-tile-pane {
    filter: contrast(1.15) brightness(0.92) saturate(1.1);
  }
  ```

### 2.3. Hằng số Tọa độ Địa lý Chuẩn (Thành phố Cần Thơ)
- **Tâm bản đồ thành phố:** `CITY_CENTER = [10.0335, 105.7725]` (Zoom mặc định: 14, min: 11, max: 18)
- **Tọa độ chốt đỗ xe cứu thương thường trực:**
  - `65A-012.34`: `[10.0105, 105.7700]` (Trạm Cấp cứu Cái Răng — Kíp 3, xe chạy demo chính)
  - `65A-011.15`: `[10.0395, 105.7800]` (Trạm Cấp cứu Trung tâm Ninh Kiều)
  - `65A-016.88`: `[10.0298, 105.7685]` (Chốt ĐH Cần Thơ)
  - `65A-010.02`: `[10.0215, 105.7850]` (KDC Hưng Phú)
  - `65A-018.89`: `[10.0580, 105.7460]` (Trục Võ Văn Kiệt — Bình Thủy)
  - `65A-019.99`: `[10.0420, 105.7600]` (Trạm Cấp cứu An Khánh — Kíp 5)
- **Tọa độ các bệnh viện tiếp nhận chính:**
  - BVĐK Trung ương Cần Thơ (`HOSP_BVTU`): `[10.0270, 105.7620]`
  - BVĐK TP Cần Thơ (`HOSP_BVDK`): `[10.0460, 105.7845]`
  - BV Ung bướu Cần Thơ (`HOSP_UB`): `[10.0520, 105.7580]`
  - BV Nhi đồng Cần Thơ (`HOSP_ND`): `[10.0125, 105.7435]`
  - BV Tim mạch Cần Thơ (`HOSP_TM`): `[10.0350, 105.7780]`
  - BV Quốc tế Phương Châu (`HOSP_PC`): `[10.0195, 105.7595]`

---

## 3. QUY CHUẨN THIẾT KẾ MARKER, TUYẾN ĐƯỜNG & PHÂN TẦNG Z-INDEX

Toàn bộ Marker trên bản đồ phải tuân thủ kiến trúc **2-Tier Stem Pin** (Mũi neo cắm chuẩn xác vào tim đường, không bị trôi lệch khi zoom).

### 3.1. Marker Xe cứu thương (`.map-veh-stem-marker`)
- **Cấu trúc 3 phần:**
  1. *Top Badge (Tầng trên):* Hiển thị biển số xe (`.map-veh-plate-val`) + Badge trạng thái.
     - **Sẵn sàng (READY):** Nền xanh lá `#059669`, viền `#10B981`, chữ trắng.
     - **Làm nhiệm vụ (EMERGENCY / MISSION):** Nền đỏ `#DC2626`, viền `#EF4444`, chữ trắng kèm tốc độ live (VD: `52 km/h`).
  2. *Navigation Puck (Tầng giữa):* Khối tròn đường kính 28px tinh gọn (không gắn mũi tên tam giác trên đỉnh), icon xe cứu thương SVG màu trắng ở tâm.
  3. *Stem Pin (Mũi neo):* Kim nhọn chỉ thẳng vào tọa độ GPS tim đường.
- **Kích thước Icon Leaflet:** `iconSize: [106, 52]`, `iconAnchor: [53, 52]`.

### 3.2. Marker Bệnh viện tiếp nhận (`.map-hosp-stem-marker`)
- **Cấu trúc 3 phần:**
  1. *Top Card:* Tên bệnh viện viết tắt chuẩn (VD: `BVĐK TW Cần Thơ`), trạng thái tiếp nhận (`is-ready` hoặc `restricted`). Nếu là bệnh viện của tài khoản đăng nhập, hiển thị thêm pill `BỆNH VIỆN TIẾP NHẬN`.
  2. *Shield Icon:* Biểu tượng khiên bảo hộ với dấu thập y tế; riêng bệnh viện trung tâm điều hành hiển thị icon ngôi sao vàng nổi bật (`#FEF3C7`).
  3. *Stem Pin:* Kim nhọn chỉ vào cổng bệnh viện.
- **Kích thước Icon Leaflet:**
  - Bệnh viện thường: `iconSize: [130, 54]`, `iconAnchor: [65, 54]`
  - Bệnh viện tiếp nhận / trung tâm: `iconSize: [154, 68]`, `iconAnchor: [77, 68]`

### 3.3. Marker Hiện trường tai nạn (`.map-incident-beacon-container`)
- **Hiệu ứng trực quan:**
  - 3 vòng sóng radar (`.map-incident-radar-rings`) lan tỏa liên tục từ tâm tọa độ.
  - Banner thông tin rung báo động (`.map-incident-shake`), hiển thị:
    - Mã màu khẩn cấp quốc tế: `CODE BLUE`, `CODE PINK`, `CODE RED`, `CODE ORANGE`
    - Tên rút gọn của sự cố (VD: `TAI NẠN GIAO THÔNG`, `ĐỘT QUỴ`)
    - Thời gian dự kiến tiếp cận (`ETA 4 phút`)
- **Kích thước Icon Leaflet:** `iconSize: [300, 40]`, `iconAnchor: [150, 20]`.

### 3.4. Quy chuẩn Tuyến đường dẫn truyền (OSRM Routing Polylines)
- **Công nghệ định tuyến:** OSRM Driving Service (`router.project-osrm.org`) kết hợp bộ nhớ đệm `routeCache`.
- **Cơ chế Fallback:** Tự động fallback đường thẳng sau 6 giây nếu mất kết nối mạng OSRM.
- **Quy cách hiển thị 2 chặng:**
  - **Chặng 1 (Leg 1 — Trạm $\rightarrow$ Hiện trường):** Đường nét đứt màu đỏ cam khẩn cấp, có lớp glow phát sáng:
    - Glow layer: `#EF4444`, opacity `0.45`, weight `9`
    - Core line: `#FFA39E`, opacity `0.95`, weight `4`, `dashArray: '8, 12'`
  - **Chặng 2 (Leg 2 — Hiện trường $\rightarrow$ Bệnh viện đích):** Đường nét liền màu xanh lơ phát sáng:
    - Glow layer: `#0284C7`, opacity `0.4`, weight `9`
    - Core line: `#38BDF8`, opacity `0.95`, weight `4`

### 3.5. Cụm điều khiển & Chú thích chiến thuật (Tactical Controls & Legend)
- **Cụm nút góc trên phải (`.map-unified-cluster`):**
  - Nút Chú thích (`#btn-map-legend-info`): Bật/tắt bảng chú thích chiến thuật.
  - Nút Phóng to (`#btn-map-zoom-in`) & Thu nhỏ (`#btn-map-zoom-out`).
- **Bảng chú thích chiến thuật (`#map-tactical-legend`):**
  - Mặc định thu gọn (`is-collapsed`), khi mở hiển thị bảng mã màu ký hiệu xe, bệnh viện, hiện trường và bảng tra cứu mã cấp cứu bệnh viện.

### 3.6. Quy chuẩn Popup & Tooltip Leaflet (Popup Design Specs)
- **Màu nền (Background):** `#0A1B2A` (Dark Blue Navy) hoặc `rgba(7, 21, 34, 0.96)` kèm `backdrop-filter: blur(8px)`.
- **Viền khung (Border):** `1px solid #1E3A56`, bo góc `border-radius: 8px`.
- **Đổ bóng (Shadow):** `0 8px 24px rgba(0, 0, 0, 0.7)`.
- **Mũi tên chỉ (Leaflet Tip):** `.leaflet-popup-tip` có cùng màu `#0A1B2A`, không dùng màu trắng mặc định của Leaflet.
- **Typography:**
  - Tiêu đề: Font Sans (Inter/Outfit), trọng số 700, màu trắng `#FFFFFF` hoặc màu trạng thái tương ứng.
  - Biển số xe & Tọa độ GPS: Font Mono (`ui-monospace`, `SFMono-Regular`, `Consolas`), kích thước `11px - 12px`.

### 3.7. Phân tầng Z-Index & Leaflet Panes (Pane Layering Hierarchy)
- `tilePane` (Lớp bản đồ nền vệ tinh / canvas): `z-index: 100`
- `overlayPane` (Các đường dẫn truyền OSRM Polylines Leg 1 / Leg 2): `z-index: 200`
- `markerPane` (Các icon Stem Pin xe, Bệnh viện, Radar Beacon): `z-index: 300`
- `markerPane:hover` (Marker khi rê chuột / chạm ngón tay): `z-index: 9999 !important`
- `popupPane` (Cửa sổ thông tin chi tiết / Tooltip Leaflet): `z-index: 400`
- `controls / floating HUD` (Thanh điều hướng nổi, widget tìm kiếm xe): `z-index: 500 - 1000`

---

## 4. THIẾT KẾ VÀ ÁNH XẠ BẢN ĐỒ THEO TỪNG ỨNG DỤNG & VAI TRÒ

### 4.1. App Central — Vai trò Điều phối viên (`DISPATCHER`)
- **Màn hình chính (`realtime-map` · `#cantho-map-viewport`):**
  - Chiếm 100% diện tích không gian làm việc (Full-bleed).
  - Hiển thị toàn cảnh toàn bộ 5 xe cứu thương và 6 bệnh viện trong thành phố.
  - **Widget nổi bên trái (`#fleet-side-panel`):**
    - Nút toggle layer thu gọn/mở rộng nhanh.
    - Tab Đội xe (5 xe) & Tab Ca xử lý.
    - Tìm kiếm và bộ lọc sắp xếp xe theo trạng thái / khoảng cách.
  - **Thanh điều khiển đáy (`#realtime-bottom-strip`):**
    - Tự động xuất hiện khi chọn 1 xe trên bản đồ.
    - Chuyển đổi Camera trước / Camera khoang bệnh nhân.
    - Nút chụp ảnh kíp trực, nút gọi nhanh 4 luồng (Người dân, Kíp xe, Bệnh viện, CSGT).
- **Màn hình Modal Chi tiết ca (`#modal-overview-map-viewport`):**
  - Chia đôi layout 50%: Bên trái thông tin bệnh án, bên phải là bản đồ GIS Leaflet độc lập nạp riêng lộ trình của ca được chọn.

### 4.2. App Central — Vai trò Bệnh viện tiếp nhận (`HOSPITAL_RECEIVER`)
- **Màn hình chính (`hospital-map` · `#cantho-map-viewport`):**
  - **Nguyên tắc phân quyền cô lập (Role Scoping):** TUYỆT ĐỐI CHỈ hiển thị vị trí bệnh viện của tài khoản đăng nhập (VD: `bvtu.tn` chỉ thấy BVĐK Trung ương).
  - **Tuyệt đối không hiển thị xe của đơn vị khác** hoặc các xe không chuyển viện về bệnh viện này.
  - **Trạng thái trước xác nhận (Idle):** Bản đồ tĩnh, chỉ có vị trí bệnh viện, 0 ca tiếp nhận.
  - **Trạng thái cảnh báo (Incoming Alert):** Modal báo động `#hospital-incoming-alert-modal` mở ra kèm còi hú khẩn cấp và thông số sinh hiệu ePCR.
  - **Trạng thái sau xác nhận:** Bản đồ hiển thị xe cấp cứu đang di chuyển về viện và lộ trình chặng 2 tới cổng cấp cứu.

### 4.3. App Lái xe cấp cứu (`driver.html` · `#driver-map-container`)
- **Giao diện di động toàn màn hình (Mobile Full-bleed):**
  - Xe `65A-012.34` ở trung tâm bản đồ.
  - HUD nổi dẫn đường phía trên (`#nav-floating-hud`): Mũi tên chuyển hướng kế tiếp, khoảng cách, tốc độ km/h, thời gian dự kiến tiếp cận.
  - Nút SOS khẩn cấp độc lập phía dưới góc phải.
- **Tích hợp quy trình nhiệm vụ 6 bước (TX-00 $\rightarrow$ TX-05):**
  1. `TX-00` (Sẵn sàng): Xe đỗ tại Trạm Cái Răng, icon xanh.
  2. `TX-01` (Nhận lệnh): Popup cảnh báo khẩn cấp, thanh trượt vuốt xác nhận (hoặc từ chối có lý do).
  3. `TX-02` (Đang đến hiện trường): Bản đồ vẽ tuyến Chặng 1, xe di chuyển bám đường.
  4. `TX-03` (Tại hiện trường): Xe dừng đón bệnh nhân, mở form ePCR.
  5. `TX-04` (Chuyển viện): Bản đồ chuyển sang tuyến Chặng 2 về BVĐK Trung ương.
  6. `TX-05` (Bàn giao): Xe dừng tại viện, mở biên bản bàn giao, sau đó trở về `TX-00`.

### 4.4. App Người dân (`citizen.html`)
- **Bản đồ Radar Cơ sở Y tế Trang chủ (`#home-facilities-map`):**
  - Tâm bản đồ là vị trí GPS người dân (Cổng A ĐH Cần Thơ).
  - Quét và hiển thị các bệnh viện/trạm cấp cứu trong bán kính 5km kèm cự ly, tình trạng quá tải và nút bấm gọi hotline/chỉ đường.
- **Bản đồ Theo dõi Điều xe Trực tiếp (`#citizen-tracking-map`):**
  - Giai đoạn Tiếp nhận: Chỉ hiển thị mốc đỏ nhấp nháy "VỊ TRÍ CỦA BẠN".
  - Giai đoạn Đang đến: Hiển thị xe `65A-012.34` xuất phát từ Cái Răng, đường OSRM màu cam và đồng hồ đếm ngược ETA trực tiếp.
  - Giai đoạn Chuyển viện: Hiển thị lộ trình đưa người thân đến bệnh viện.

---

## 5. 8 QUY TẮC BẤT DI BẤT DỊCH KHI BẢO TRÌ BẢN ĐỒ (GOLDEN RULES)

Mọi AI Agent và lập trình viên khi sửa đổi mã nguồn liên quan đến bản đồ **BẮT BUỘC** tuân thủ 8 quy tắc sau:

### Quy tắc 1: Bảo toàn Tuyệt đối Dữ liệu Mẫu (Zero-Mutation Seed Rule)
- **Nghiêm cấm tuyệt đối** mọi hành vi gán `window.SEED_DATA.demoCase = null` hoặc `window.DEMO_CASE_TEMPLATE = null`.
- Dữ liệu mẫu trong `js/shared/data-seed.js` là tài sản bất biến của phiên làm việc.
- Khi dọn dẹp hệ thống hoặc kết thúc demo, **chỉ được phép xóa trong mảng ca hoạt động**:
  ```javascript
  state.cases = [];
  state.demoRunning = false;
  state.demoCase = null; // Chỉ xóa ca đang chạy trong state bộ nhớ
  // TUYỆT ĐỐI KHÔNG SỬA: window.SEED_DATA.demoCase
  ```

### Quy tắc 2: Luôn Nạp Template qua API An toàn
- Khi khởi tạo ca demo hoặc nạp ca mẫu, bắt buộc sử dụng thứ tự fallback:
  ```javascript
  const seedCase = window.StateManager?.getDemoCaseTemplate?.()
    || window.DEMO_CASE_TEMPLATE
    || state.demoCase
    || window.SEED_DATA?.demoCase;
  ```

### Quy tắc 3: Quản lý Vòng đời & Giải phóng Bộ nhớ Leaflet
- Trước khi re-render bản đồ hoặc chuyển đổi giữa các tab menu, bắt buộc phải hủy instance cũ để chống rò rỉ vòng lặp chuyển động:
  ```javascript
  if (this.mapInstance) {
    this.mapInstance.destroy();
    this.mapInstance = null;
  }
  ```
- Trong phương thức `destroy()`, phải hủy cả `cancelAnimationFrame(this.rafId)` và gọi `this.map.remove()`.

### Quy tắc 4: Cách ly Tuyệt đối Xe ở Trạng thái Sẵn sàng (Ready Vehicle Isolation)
- Xe có `status === 'READY'` và không có ca điều động thì **tuyệt đối không được gán tuyến đường hoặc hiện trường tai nạn**.
- Trong `js/shared/map.js`, điều kiện sau phải luôn được bảo toàn:
  ```javascript
  if (veh && veh.status === 'READY' && !veh.isDispatchedSimulated && !veh.currentCaseId) {
    return null;
  }
  ```

### Quy tắc 5: Ràng buộc CSS Transform trên Leaflet Marker
- **Không bao giờ** đặt thuộc tính CSS `transform` hoặc `transition: transform` lên phần tử gốc `.map-leaflet-marker` / `.leaflet-marker-icon`, vì Leaflet sử dụng thuộc tính `transform: translate3d(...)` trên phần tử gốc để tính toán tọa độ bản đồ.
- Nếu muốn tạo hiệu ứng hover / nhấc nổi marker, **phải áp dụng trên phần tử con**:
  ```css
  /* ĐÚNG */
  .map-leaflet-marker > * {
    transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .map-leaflet-marker:hover > * {
    transform: translateY(-3px) scale(1.06);
  }

  /* SAI - GÂY LỆCH TỌA ĐỘ VÀ RUNG LẮC BẢN ĐỒ */
  .map-leaflet-marker {
    transition: transform 0.2s; /* CẤM */
  }
  ```

### Quy tắc 6: Phân định Ranh giới Phân quyền Vai trò (Role Scoping)
- Vai trò **Điều phối viên (`DISPATCHER`)** luôn nhìn thấy toàn cảnh toàn bộ mạng lưới phương tiện và cơ sở y tế.
- Vai trò **Bệnh viện tiếp nhận (`HOSPITAL_RECEIVER`)** chỉ được nhìn thấy bệnh viện của mình và các xe đang chuyển viện đến viện mình. Không bao giờ hiển thị xe của các trạm khác trên màn hình bệnh viện.

### Quy tắc 7: Đồng bộ Sự kiện Đa Tab qua Realtime Bus
- Mọi thay đổi trạng thái ca hoặc xe trên bản đồ phải phát tín hiệu qua `StateManager.notify(event, payload)`.
- Kênh `BroadcastChannel('ccnv_realtime_bus')` và sự kiện `storage` trên `localStorage` phải luôn được lắng nghe để cập nhật vị trí xe đồng thời giữa App Central, App Lái xe và App Người dân.

### Quy tắc 8: Bắt buộc gọi `map.invalidateSize()` khi Render / Mở Modal / Chuyển Tab
- Khi container bản đồ ban đầu bị ẩn (`display: none` hoặc nằm trong modal chưa mở), Leaflet không thể xác định chính xác kích thước pixel của viewport.
- Bắt buộc phải kích hoạt `map.invalidateSize()` ngay sau khi container hiển thị (bọc trong `setTimeout` hoặc `requestAnimationFrame` từ 100ms - 250ms) để nạp đủ tile và tính lại tâm bản đồ, triệt tiêu hoàn toàn hiện tượng bản đồ bị xám mảng hoặc lệch tâm tọa độ.
