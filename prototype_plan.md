# MASTER PROTOTYPE IMPLEMENTATION PLAN — CẤP CỨU NGOẠI VIỆN TP. CẦN THƠ

Phiên bản 2.1 · 01/10/2026 · Nguồn: `context.md` v1.2 + trả lời Q01–Q21 + quyết định tinh giản tối đa ngày 01/10/2026 · **Demo: 09/10/2026**

Nhãn dùng trong tài liệu:

| Nhãn | Nghĩa |
|---|---|
| **ASSUMPTION** | Logic chưa được xác nhận, tôi chọn phương án đơn giản nhất cho demo |
| **MOCK** | Dữ liệu giả; tất cả các trang HTML đọc chung từ 1 file JSON (`data.json`); không dùng Node server, không backend CRUD, mỗi tab độc lập xử lý hiển thị và tương tác tại chỗ |
| **SIMULATED REALTIME** | Hành vi realtime (di chuyển xe, timer) do JS tại tab đó mô phỏng |
| **Required Gap** | Không có trong sitemap nhưng bắt buộc để luồng chạy (giữ ở mức tối thiểu, không thêm màn mới) |
| **Future** | Chưa làm trong prototype |
| **L1 / L2 / L3** | Mức tương tác: **L1** = interactive + đổi trạng thái luồng chính tại tab · **L2** = interactive nhẹ (lọc, tab, form lưu vào state cục bộ, không ảnh hưởng luồng) · **L3** = chỉ visual (dữ liệu mock từ JSON, nút chỉ hiện toast "Demo") |

---

## 0. TÓM TẮT ĐIỀU HÀNH

- **Bắt đầu từ đâu**: P1.0 Foundation, gồm 1 file JSON mock dùng chung (`data.json`), token CSS theo Design System, ba file HTML độc lập (`central.html`, `driver.html`, `citizen.html`) và bản đồ SVG mock. Hoàn toàn chạy tĩnh, **không dùng Node server, không backend**.
- **Cơ chế dữ liệu & tương tác**:
  - Dữ liệu toàn bộ hệ thống (danh mục, xe, kíp, bệnh viện, ca mẫu, ePCR, tọa độ) đọc chung từ file **`data.json`**.
  - **Không thực hiện CRUD** ghi đè lại file JSON (tránh phức tạp và tiết kiệm tối đa thời gian).
  - **Mỗi tab thực hiện độc lập ở tab đó**: người dùng thao tác ở tab nào thì JavaScript của tab đó cập nhật state trong bộ nhớ (in-memory) và re-render giao diện tại tab đó.
- **Phân định file HTML & vai trò**:
  - `central.html`: Gộp chung cả **Điều hành Trung tâm** và **Bệnh viện tiếp nhận (Tiếp nhận hồ sơ)**, phân biệt bằng **chuyển đổi tài khoản / phân quyền** ngay trên trang (D16).
  - `driver.html`: App Tài xế / Kíp cấp cứu trên xe.
  - `citizen.html`: App Người dân gọi cấp cứu và theo dõi.
  - *(Bỏ `control.html` — người thuyết trình thao tác trực tiếp trên giao diện các app; bỏ `hospital.html` — đã tích hợp vào `central.html`)*.
- **Thứ tự triển khai**: Trung tâm & BV tiếp nhận (`central.html`) → App Tài xế (`driver.html`) → App Người dân (`citizen.html`). Không làm song song.
- **Cách demo luồng**: Thao tác trực tiếp trên 3 tab trình duyệt: tạo ca và tiếp nhận ở `central.html`, chuyển mốc ở `driver.html`, xem trạng thái ở `citizen.html`.
- **Giao diện và thứ tự hoàn thiện**: áp dụng dark theme cho toàn bộ trang ngay từ P1.0 theo [`ccnv-prototype/design_system.md`](ccnv-prototype/design_system.md).
- **Luồng demo chính**: 1 ca – 1 xe – 1 kíp – 1 bệnh viện, từ lúc người dân gọi qua app đến khi bệnh viện xác nhận bàn giao và ca Hoàn tất.
- **Mốc nghiệm thu quan trọng nhất**: kết thúc P1.4. Lúc đó một ca chạy trọn vòng với `central.html`.

---

## 1. QUYẾT ĐỊNH ĐÃ CHỐT (DECISION LOG)

| ID | Quyết định | Hệ quả cho prototype |
|---|---|---|
| D01 | Phạm vi demo: **toàn bộ** sitemap | Mọi menu đều có màn hình. Luồng chính ở mức L1, phần quản trị và báo cáo ở mức L2/L3 |
| D02 (cập nhật 01/10) | **HTML/CSS/JavaScript thuần tĩnh; mỗi app là 1 file HTML riêng biệt; không Node server, không CRUD** | Dữ liệu khởi tạo đọc chung từ 1 file `data.json`. Mỗi tab tự quản lý state hiển thị và tương tác tại chỗ. Không có backend, không SSE, không Demo Shell, React, TypeScript hay Vite (§3). Ưu tiên tối đa tiến độ demo 09/10 |
| D03 | Giữ 3 trạng thái ca/lệnh; **thêm mốc nhiệm vụ** (Xuất phát, Đến hiện trường, Rời hiện trường, Đến BV) làm sự kiện timeline + nhãn giai đoạn | TX-04 có stepper 1 chạm; timeline và KPI có đủ mốc |
| D04 | Cuộc gọi không cần điều xe thì **không tạo ca** | ĐPV đóng form, bản nháp bị bỏ, cuộc gọi vẫn lưu trong Lịch sử cuộc gọi. Không làm các nhánh kết thúc đặc biệt khác |
| D05 | Không làm nhiều xe / nhiều nạn nhân; demo **1 ca 1 xe** | Đổi xe = thu hồi xe cũ rồi gán xe mới. Major Incident: Future |
| D06 | Không demo luồng tự di chuyển | Ẩn "Xác nhận tự di chuyển" (ND-05), bỏ "Nhận cảnh báo người bệnh tự đến" (BV-01) → Future |
| D07 | Người dân **gọi trực tiếp qua app** | Trung tâm nhận như một cuộc gọi đến, gắn tag "Từ App" và kèm GPS chính xác |
| D08 | Người dân **được hủy bất kỳ lúc nào**, chưa cần kiểm tra quy tắc | Hủy → ca "Đã hủy", lệnh thu hồi, xe về Sẵn sàng, Trung tâm/xe/BV nhận thông báo |
| D09 | Trạng thái xe: làm bản MVP nhất theo tài liệu | Sẵn sàng → Đang điều xe → Đang cấp cứu → Sẵn sàng; Bảo trì đặt thủ công (§4) |
| D10 | Kíp **không cố định theo xe**; tùy ĐPV chọn | Form tạo ca có 2 bộ chọn: Xe và Kíp (kíp lấy từ phân công ca trực) |
| D11 | Có **nhiều tài khoản** để demo | 2 tài khoản ĐPV + 3 tài khoản bệnh viện tiếp nhận (§5) |
| D12 | Chưa làm các quy tắc phản hồi BV (timeout, đổi phản hồi...) | Chỉ có Xác nhận / Từ chối. Từ chối → thông báo → ĐPV giữ hoặc đổi bệnh viện |
| D13 | Gợi ý xe / bệnh viện: **cố định sẵn vài gợi ý** | Hard-code 2 gợi ý cho mỗi loại, kèm dòng lý do |
| D14 | Liên lạc & phối hợp: **1 nút** cho mỗi chức năng | Toast + ghi log; riêng "Gửi thông tin & Gọi" có bật popup BV-02 |
| D15 | Nhiều ĐPV; **1 cuộc gọi chỉ về 1 ĐPV** | Cuộc gọi được gán cho ĐPV nhấc máy; ĐPV khác chỉ thấy "đang do ... xử lý" |
| D16 | Chỉ cần 2 loại tài khoản: **Trung tâm** và **Tiếp nhận** | Trung tâm thấy toàn bộ menu Trung tâm; Tiếp nhận thấy nhóm Tiếp nhận hồ sơ + Báo cáo (lọc theo bệnh viện) |
| D17 | Gộp TT-08 và TT-12 thành **một trang Hồ sơ ca** đủ 7 tab; được sửa vị trí, mức độ, thông tin bệnh nhân trong ca | Một module giao diện `CaseDetail` có 2 chế độ: đang xử lý / chỉ đọc |
| D18 | SOS: Mới → Đã tiếp nhận → Đã xử lý; ngưỡng mất GPS >60s (vàng), >3 phút (đỏ); dừng bất thường >5 phút | Áp dụng như mô tả |
| D19 | Bản đồ dùng dữ liệu mock | Tọa độ, route, ETA đều giả lập |
| D20 | **Không có trong sitemap thì không làm**; "Ghi nhận sinh hiệu" ở App Người dân là một ô text | Bỏ gợi ý mức độ bằng bộ câu hỏi, AI điền form, cập nhật năng lực phía BV, khung chat phía Trung tâm |
| D21 | Toàn bộ dữ liệu là mock | Xem §5 |
| D22 | Dark theme theo `ccnv-prototype/design_system.md` trên toàn bộ app | Navy là nền chính; đỏ chỉ cho cấp cứu/cảnh báo/CTA quan trọng; icon chìm; kiểm tra lại tính nhất quán và độ rõ ở desktop/tablet/mobile |

---

## 2. PHẠM VI PROTOTYPE

### 2.1. Điều chỉnh so với sitemap

| Loại | Nội dung |
|---|---|
| **Làm theo sitemap** | Toàn bộ màn §8 của context (TT, BV, TX, ND), riêng cấu trúc hồ sơ ca theo D17 |
| **Thêm (đã được duyệt)** | Nút Hủy yêu cầu trên ND-05 (D08); stepper mốc nhiệm vụ trên TX-04 (D03, thuộc chức năng "Cập nhật mốc trạng thái nhiệm vụ" đã có trong sitemap) |
| **Required Gap (không tạo màn mới)** | (1) Banner thông báo trên App Tài xế khi lệnh bị thu hồi, đổi BV, ca bị hủy hoặc BV phản hồi. (2) Trạng thái "chờ nhiệm vụ" của TX-03. (3) Trạng thái yêu cầu "Đang kết nối / Chờ tiếp nhận" trên ND-05 |
| **Thao tác demo** | Thao tác thủ công trực tiếp trên giao diện các app theo kịch bản demo; không đặt thanh chuyển app, bố cục chia màn hay nút Reset can thiệp vào giao diện sản phẩm |
| **Future** | Nhiều xe/nhiều nạn nhân, Major Incident, tự di chuyển, gợi ý mức độ, AI điền form, timeout BV, khai báo chuyên khoa và cập nhật trạng thái tiếp nhận phía BV, khung chat phía Trung tâm, offline sync, các nhánh kết thúc ca đặc biệt |

### 2.2. Các luồng bắt buộc INTERACTIVE (L1)

1. Cuộc gọi đến → nhấc máy → form tạo ca tự mở → xác nhận tạo ca và phát lệnh.
2. Cuộc gọi không cần điều xe → đóng form, không tạo ca.
3. Kíp xác nhận lên xe → các mốc nhiệm vụ → xe di chuyển trên bản đồ (SIMULATED REALTIME).
4. Bệnh viện nhận cảnh báo → Xác nhận / Từ chối → ĐPV giữ hoặc đổi bệnh viện.
5. Đổi xe, thu hồi lệnh, hủy ca kèm lý do.
6. SOS → tiếp nhận → điều xe thay thế → đã xử lý.
7. Check-in xe → biên bản → Xác nhận bàn giao → ca Hoàn tất.
8. ePCR: kíp nhập, BV xem và sửa (có log), Trung tâm xem.
9. Người dân: đăng ký, OTP, SOS gọi qua app, theo dõi trạng thái và ETA, hủy.
10. Tra cứu hồ sơ của ca vừa hoàn tất → xem Mốc thời gian.

### 2.3. Phần chỉ cần VISUAL hoặc interactive nhẹ (L2/L3)

Lịch trực, Báo cáo thống kê, Báo cáo Chi tiết, Danh mục (8 màn), Quản trị (4 màn), Danh bạ, Chuyển tiếp, Xuất PDF, Ghi âm, Đổi mật khẩu, Kết thúc ca trực (App Tài xế), Danh sách cơ sở y tế, Quyền riêng tư, Lịch sử yêu cầu, Nhắn tin (người dân).

---

## 3. KIẾN TRÚC PROTOTYPE HTML TĨNH ĐỘC LẬP

### 3.1. Ba file HTML riêng biệt và một file dữ liệu chung

Không dùng Node server, không cần build. Mỗi app là một **file HTML riêng biệt**, mở trực tiếp bằng bất kỳ static web server nào (như VS Code Live Server, Python `http.server`, hoặc mở trực tiếp trên trình duyệt):

| File HTML | Vai trò | Bố cục |
|---|---|---|
| `central.html` | **Trung tâm điều hành & Bệnh viện tiếp nhận** (chuyển đổi vai trò theo tài khoản: ĐPV hoặc BV tiếp nhận) | Desktop |
| `driver.html` | **Tài xế / Kíp cấp cứu**, gắn với một xe demo | Tablet/mobile |
| `citizen.html` | **Người dân**, hồ sơ demo và SOS 1 chạm | Mobile |

```text
┌─────────────────────────┐       ┌─────────────────────────┐       ┌─────────────────────────┐
│      central.html       │       │       driver.html       │       │      citizen.html       │
│  (Trung tâm điều hành   │       │   (Tài xế / Kíp xe)     │       │      (Người dân)        │
│   & BV tiếp nhận hồ sơ) │       │                         │       │                         │
└────────────┬────────────┘       └────────────┬────────────┘       └────────────┬────────────┘
             │                                 │                                 │
             └─────────────────────────────────┼─────────────────────────────────┘
                                               │ Đọc dữ liệu khởi tạo (Seed/Mock)
                                               ▼
                                     ┌───────────────────┐
                                     │     data.json     │
                                     │ (Kho dữ liệu tĩnh │
                                     │    dùng chung)    │
                                     └───────────────────┘
```

- **Cơ chế phân quyền trên `central.html` (D16)**:
  - Tài khoản **Điều phối viên (`dpv01`)**: Hiển thị đầy đủ menu Trung tâm (Tổng đài, Cấp cứu, Giám sát, Ca trực, Báo cáo, Danh mục, Quản trị).
  - Tài khoản **Bệnh viện (`bvdk.tn`)**: Chỉ hiển thị menu **Tiếp nhận hồ sơ** (Cảnh báo ca đang đến, Ca đang đến, Chi tiết ca, Xác nhận bàn giao, ePCR) và **Báo cáo BV**.

- **Mỗi tab thực hiện độc lập ở tab đó**:
  - Dữ liệu ban đầu (danh sách xe, tài khoản, bệnh viện, kíp trực, danh mục, ca mẫu) được nạp chung từ file **`data.json`**.
  - **Không thực hiện CRUD** ghi đè file JSON: Khi người dùng bấm nút, chọn form hoặc đổi trạng thái, JavaScript của tab đó cập nhật state trong bộ nhớ (in-memory state) và vẽ lại giao diện tại chính tab đó.
  - Người thuyết trình thao tác thủ công trực tiếp trên giao diện các trang theo kịch bản demo (không cần trang trung gian `control.html`).

### 3.1.1. Cấu trúc mã nguồn

Stack: **HTML5, Vanilla CSS, JavaScript thuần (ES modules)**. Không dùng React, TypeScript, Vite, Zustand, Node server hay bất kỳ build-tool nào.

```text
ccnv-prototype/
├── data.json                    # Kho dữ liệu mock chung cho toàn bộ hệ thống (danh mục, xe, BV, kíp, ca)
├── central.html                 # App Trung tâm điều hành & Tiếp nhận BV (TT-01 đến TT-21, BV-01 đến BV-07)
├── driver.html                  # App Tài xế / Kíp cấp cứu (TX-00 đến TX-06)
├── citizen.html                 # App Người dân (ND-01 đến ND-10)
├── css/
│   ├── tokens.css               # Hệ thống màu dark theme (#071522), typography, spacing
│   ├── global.css               # Layout chung, reset, utils, scrollbar
│   ├── desktop.css              # Giao diện Trung tâm & Bệnh viện tiếp nhận
│   └── mobile.css               # Giao diện Tài xế & Người dân
├── js/
│   ├── shared/
│   │   ├── data-loader.js       # Hàm fetch 'data.json' nạp vào bộ nhớ
│   │   ├── map.js               # Bản đồ SVG mock TP. Cần Thơ, vẽ xe/BV/route
│   │   ├── components.js        # Badge, Toast, Modal, DataTable, Stepper
│   │   └── epcr-form.js         # Mẫu form ePCR dùng chung cho TX và BV
│   ├── central/                 # Logic màn hình Trung tâm & BV tiếp nhận
│   ├── driver/                  # Logic màn hình Tài xế (lệnh mới, stepper mốc, ePCR)
│   └── citizen/                 # Logic màn hình Người dân (onboarding, SOS, theo dõi)
├── assets/                      # SVG icon, ảnh mock, avatar
└── design_system.md
```

### 3.1.2. Chuyển đổi mã nguồn

- Tận dụng toàn bộ dữ liệu seed và cấu trúc màn hình đã chuẩn bị để đóng gói thành 1 file **`data.json`**.
- Xây dựng 3 file HTML độc lập cùng hệ thống CSS token; chuyển logic các màn thành các hàm render HTML + xử lý sự kiện DOM trực tiếp.
- Khi demo: chỉ cần khởi chạy một static web server (hoặc mở trực tiếp) và mở 3 file HTML trên các tab của trình duyệt.

### 3.2. Nguyên tắc state và tương tác tại từng tab

1. **Khởi tạo dữ liệu**: Khi trang tải, `data-loader.js` nạp file `data.json` và lưu vào biến state cục bộ của trang đó (`window.appState`).
2. **Không CRUD file JSON**: Toàn bộ thao tác thêm, sửa, đổi trạng thái chỉ làm biến đổi `window.appState` trong phiên làm việc của tab đó và cập nhật lại DOM hiển thị. F5 trang sẽ nạp lại trạng thái ban đầu từ `data.json`.
3. **Mô phỏng thời gian thực (Simulated Realtime)**: Bản đồ di chuyển xe và đếm ngược ETA được chạy bằng `setInterval` nhẹ nhàng ngay tại client của tab đang mở (như tab Trung tâm hoặc Tài xế).
4. **Độc lập và tự chủ**: Mỗi tab có đầy đủ dữ liệu mẫu để diễn tròn vai nghiệp vụ của mình (Trung tâm có thể tự chuyển ca từ Mới $\rightarrow$ Đã điều động $\rightarrow$ Vận chuyển; Bệnh viện có thể tự xem ca $\rightarrow$ Xác nhận bàn giao; Tài xế có thể tự bấm chuỗi mốc nhiệm vụ).

### 3.2.1. Quy chuẩn giao diện chung

- Toàn bộ 3 app dùng token từ `design_system.md`: nền `#071522`, sidebar/header `#081827`, panel `#0A1B2A`, panel nổi `#0E2435`, viền `#183449`; chữ trắng/xám sáng. Đỏ `#E52521`/`#FF3B35` dành cho SOS, tình huống cấp cứu và CTA quan trọng.
- Desktop ưu tiên bản đồ khoảng 60% vùng giám sát, sidebar gọn, panel phẳng, viền mảnh. Trang tablet và mobile giữ cùng hệ màu nhưng ưu tiên nút bấm lớn, thao tác một chạm tại hiện trường.
- Icon nét mảnh đơn sắc, độ tương phản vừa phải; không dùng emoji làm icon, không gradient lòe loẹt.

### 3.3. Danh mục hành vi tương tác tại các tab

| Hành vi / Nghiệp vụ | Tab thực hiện | Xử lý giao diện tại tab đó |
|---|---|---|
| Đổ chuông & Nhấc máy | `central.html` (ĐPV) | Hiện popup cuộc gọi đến $\rightarrow$ Nhấc máy $\rightarrow$ tự mở Form tạo ca TT-07 |
| Tạo ca & Phát lệnh | `central.html` (ĐPV) | Form kiểm tra trường bắt buộc $\rightarrow$ tạo ca mới vào danh sách ca, xe chuyển sang Đang điều xe |
| Điều phối & Đổi xe/BV | `central.html` (ĐPV) | Đổi xe/BV trên giao diện Hồ sơ ca TT-08, cập nhật danh sách và log |
| Xe di chuyển & GIS | `central.html`, `driver.html` | JS Timer di chuyển xe trên SVG map, ETA đếm lùi, hiển thị trạng thái |
| Cảnh báo & Tiếp nhận | `central.html` (vai trò BV) | Hiện popup cảnh báo ca đang đến BV-01 $\rightarrow$ Bấm Xác nhận/Từ chối cập nhật trạng thái |
| Bàn giao ca | `central.html` (vai trò BV) | Điền biên bản bàn giao $\rightarrow$ Bấm Xác nhận bàn giao $\rightarrow$ ca chuyển Hoàn tất |
| Nhận lệnh & Stepper mốc | `driver.html` | Hiện popup lệnh $\rightarrow$ bấm Stepper 1 chạm: Xuất phát $\rightarrow$ Đến hiện trường $\rightarrow$ Rời HT $\rightarrow$ Đến BV |
| Nhập ePCR | `driver.html`, `central.html` | Mở form ePCR, nhập sinh hiệu, lưu hiển thị trực tiếp trên tab |
| SOS & Gọi cấp cứu | `citizen.html` | Bấm nút SOS 1 chạm $\rightarrow$ chuyển màn hình theo dõi trạng thái yêu cầu và hướng dẫn sơ cứu |

---

## 4. STATE MODEL

### 4.1. Trạng thái từng đối tượng

| Đối tượng | Trạng thái | Ghi chú |
|---|---|---|
| Cuộc gọi | Đang đổ chuông → Đang nghe (gán ĐPV) → Đã kết thúc · Nhỡ | Tag nguồn: 115 / Từ App |
| Ca | (Nháp, chưa lưu) → **Đã điều động → Đang vận chuyển → Hoàn tất** · **Đã hủy** (ASSUMPTION về tên) | Nháp chỉ tồn tại khi form đang mở |
| Nhãn giai đoạn (D03) | Chờ kíp xác nhận → Đang đến hiện trường → Tại hiện trường → Đang chuyển đến BV → Đã đến BV → Đã bàn giao | Chỉ hiển thị, không thay trạng thái ca |
| Lệnh | **Chưa xác nhận → Đang di chuyển → Hoàn thành** · **Đã thu hồi** (ASSUMPTION về tên) | 1 ca có 1 lệnh hiệu lực (D05) |
| Xe | **Sẵn sàng → Đang điều xe → Đang cấp cứu → Sẵn sàng** · **Bảo trì** | Sau bàn giao tự về Sẵn sàng (ASSUMPTION, D09). Bảo trì đặt ở TT-14 |
| Kíp | Sẵn sàng · Đang làm nhiệm vụ · Ngoài ca | ASSUMPTION: suy ra từ lệnh và phân công |
| Phản hồi BV | Chờ phản hồi → Đã xác nhận / Từ chối | Không có timeout (D12) |
| Năng lực BV | Đang nhận / Hạn chế / Tạm ngưng | Chỉ Trung tâm đổi, ở TT-16 (D20). Không chặn việc chọn |
| SOS | Mới → Đã tiếp nhận → Đã xử lý | D18 |
| Yêu cầu người dân | Đang kết nối → Chờ tiếp nhận → (theo trạng thái ca + nhãn giai đoạn) → Hoàn tất · Đã hủy · Đã kết thúc (không tạo ca) | Required Gap tối thiểu |

### 4.2. Bảng chuyển trạng thái tổng (luồng chính)

| # | Sự kiện | Ca | Lệnh | Xe | Phản hồi BV | Người dân thấy | Tài xế thấy | BV thấy |
|---|---|---|---|---|---|---|---|---|
| 1 | Người dân gọi qua app | — | — | Sẵn sàng | — | Đang kết nối | — | — |
| 2 | ĐPV nhấc máy | Nháp | — | — | — | Chờ tiếp nhận | — | — |
| 3 | Xác nhận tạo ca | **Đã điều động** | **Chưa xác nhận** | **Đang điều xe** | Chờ phản hồi | Đã điều động – Xe 65B-xxx | Popup lệnh mới | Popup cảnh báo |
| 4 | BV xác nhận | = | = | = | **Đã xác nhận** | = | Badge "BV đã nhận" | Đã xác nhận |
| 5 | Kíp xác nhận lên xe (mốc Xuất phát) | **Đang vận chuyển** · Đang đến hiện trường | **Đang di chuyển** | **Đang cấp cứu** | = | Xe đang đến + ETA | Dẫn đường tới hiện trường | ETA |
| 6 | Đến hiện trường | = · Tại hiện trường | = | = | = | Xe đã đến | ePCR | = |
| 7 | Rời hiện trường | = · Đang chuyển đến BV | = | = | = | Đang chuyển đến BV X | Dẫn đường tới BV | ETA tới BV |
| 8 | Đến BV | = · Đã đến BV | = | = | = | = | Chờ bàn giao | Xe đã đến |
| 9 | Check-in xe | = | = | = | = | = | = | Đã check-in |
| 10 | Xác nhận bàn giao | **Hoàn tất** | **Hoàn thành** | **Sẵn sàng** | = | Hoàn tất | Nhiệm vụ hoàn thành → chờ | Đã bàn giao |

Ký hiệu "=" nghĩa là không đổi so với bước trước.

### 4.3. Các nhánh

| Nhánh | Kích hoạt | Kết quả |
|---|---|---|
| B1 · BV từ chối | BV-04 | TT-03 báo đỏ → TT-09 [Giữ BV] hoặc [Đổi BV] → BV mới nhận BV-01 |
| B2 · Đổi xe / thu hồi | TT-09 | Xe cũ: banner "Lệnh đã thu hồi", về Sẵn sàng; xe mới nhận TX-01 |
| B3 · Người dân hủy | ND-05 | Ca Đã hủy; TT-03 cảnh báo; TX và BV nhận banner |
| B4 · ĐPV hủy ca | TT-09 + lý do từ danh mục | Như B3 |
| B5 · SOS | TX-02 | Popup TT-04 → Tiếp nhận → (Điều xe thay thế = B2) → Đã xử lý |
| B6 · Mất GPS | Demo Control | Marker xám, "cập nhật X phút trước"; >60s vàng, >3 phút đỏ |
| B7 · Không tạo ca | TT-07 [Kết thúc – không tạo ca] | Không có ca; cuộc gọi lưu trong lịch sử |
| B8 · Gửi thông tin & Gọi BV | TT-10 | Popup BV-02 ở bệnh viện |
| B9 · Chuyển lực lượng phối hợp | TT-05c / TT-10 | Toast + log |

---

## 5. DỮ LIỆU CẦN CHUẨN BỊ (MOCK SEED)

| Dataset | Số lượng | Trường chính | Dùng ở |
|---|---|---|---|
| Tài khoản | 5 | dpv01, dpv02 (Trung tâm); bvdk.tn (BVĐK TP Cần Thơ), bv02.tn, bv03.tn (Tiếp nhận) | Trang Trung tâm/BV, TT-01, TT-Q1 |
| Xe | 6 | Biển số mock, Type (2A / 3B / 1C), trạm, vị trí, trạng thái ban đầu (4 Sẵn sàng, 1 Đang cấp cứu cho ca nền, 1 Bảo trì), thiết bị | TT-07, TT-13, TT-14, TX-00 |
| Nhân sự | ~15 | Họ tên, vai trò (lái xe, bác sĩ, điều dưỡng, cấp cứu viên), chứng chỉ | TT-17, TT-15, TT-D |
| Phân công ca trực hôm nay | 5 kíp | Kíp (3 người), giờ vào/ra ca | CrewPicker, TT-17 |
| Lịch trực / tổ xe | 1 tuần | Lịch | TT-18 |
| Bệnh viện | 6 | BVĐK TP Cần Thơ (trung tâm + tiếp nhận) + 5 bệnh viện mock; tọa độ, chuyên khoa, trạng thái (4 Đang nhận, 1 Hạn chế, 1 Tạm ngưng) | TT-07, TT-13, TT-16, ND-06 |
| Danh bạ bệnh viện | ~12 | Đầu mối, số điện thoại | TT-05b, TT-D3 |
| Địa chỉ tìm kiếm | ~10 | Địa chỉ ở Ninh Kiều, Cái Răng, Bình Thủy kèm tọa độ | LocationPicker |
| Loại tình huống | ~8 | TNGT, đột quỵ, ngừng tuần hoàn, chấn thương, sản khoa... | TT-07, TT-D4 |
| Lý do kết thúc ca | ~6 | Người dân hủy, trùng ca, điều phối nhầm, khác... | TT-09, TT-D7 |
| Kịch bản cuộc gọi | 3 | TNGT (115), tư vấn (115), App (GPS chính xác); số điện thoại, tên thuê bao, vùng Cell-ID | Demo Control, TT-05 |
| Lịch sử cuộc gọi | ~20 | Có cả cuộc gọi nhỡ | TT-05a |
| Ca lịch sử | ~30 | 25 Hoàn tất + 5 Đã hủy trong 30 ngày, đủ mốc thời gian | TT-11, TT-19–21, BV-07 |
| Ca nền đang chạy | 1 | Giúp bản đồ có sẵn hoạt động khi bắt đầu demo | TT-13 |
| Route | 4–5 polyline | Trạm → hiện trường; hiện trường → BV gợi ý 1; hiện trường → BVĐK; xe thay thế → hiện trường; route của ca nền | Simulator, TX-05, ND-05 |
| Gợi ý cố định (D13) | 2 xe + 2 BV | Kèm dòng lý do, ví dụ "Gần nhất · ETA ~6 phút · Type B phù hợp mức Khẩn cấp" | TT-07, TT-09 |
| ePCR mẫu, biên bản mẫu | 1 + nhiều | 8 nhóm thông tin của ePCR | TX-06, BV-05, BV-06 |
| Ảnh hiện trường / hành trình | 4–6 | Ảnh placeholder | TT-08, TT-13 |
| Ghi âm | 1–2 | Player giả (dạng sóng + thời lượng) | TT-12 tab Ghi âm |
| Người dân | 1 | Số điện thoại, OTP mock, nhóm máu, dị ứng, bệnh nền, người liên hệ | ND-01..10, TX-06 |
| Hướng dẫn sơ cứu | 2–3 thẻ | Theo loại tình huống | TT-10 → ND-05 |
| KPI tổng hợp | — | Tính từ các ca lịch sử + ca demo | TT-19 |

Quy ước mã ca (ASSUMPTION): `CC-YYMMDD-NNN`.

---

## 6. MODULE GIAO DIỆN DÙNG CHUNG VÀ PHÂN LOẠI

| Module / mẫu HTML | Dùng ở | MOCK | SIM RT | Map | State transition | Mức |
|---|---|---|---|---|---|---|
| JSON data loader (`data.json`) + In-memory state | Toàn bộ | ✓ | | | ✓ | Nền |
| Client Simulator (di chuyển xe, route mock, ETA) | TT-13, TT-08, BV-04, TX-05, ND-05 | ✓ | ✓ | ✓ | | Nền |
| AccountSelector, VehicleSelector, DemoControl | Trang tương ứng | | | | ✓ | L1 |
| AppLayout + Sidebar (menu theo loại tài khoản) | TT, BV | | | | | L1 |
| **MapView** (SVG mock: layers Ca / Xe / BV, popover, lọc) | TT-07, TT-08, TT-13, TT-19, BV-04, TX-05, ND-05, ND-06 | ✓ | ✓ | ✓ | | L1 |
| VehicleMarker (tốc độ, ETA, lần cập nhật cuối, cờ mất GPS) | Mọi bản đồ | ✓ | ✓ | ✓ | | L1 |
| StatusBadge (ca, lệnh, xe, BV, SOS, phản hồi) + SeverityTag + StageLabel | Mọi app | | | | | L1 |
| HeaderCaseStatusBar (TT-02) | TT | | ✓ | | | L1 |
| NotificationCenter (TT-03) + Toast | TT, BV | | ✓ | | | L1 |
| SOSAlertModal (TT-04) | TT | | ✓ | ✓ | ✓ | L1 |
| IncomingCallBanner + CallerInfoPopup | TT-05, BV-02 | ✓ | ✓ | | ✓ | L1 |
| LocationPicker (tìm địa chỉ + ghim + vùng Cell-ID) | TT-07, TT-09 | ✓ | | ✓ | | L1 |
| VehiclePicker / CrewPicker / HospitalPicker (kèm gợi ý cố định) | TT-07, TT-09 | ✓ | | | ✓ | L1 |
| **CaseDetail** (7 tab, 2 chế độ) | TT-08, TT-12 | | ✓ | ✓ | ✓ | L1 |
| MilestoneTimeline + EventLogList | TT-08, TT-12, BV-04, TX-04 | | ✓ | | | L1 |
| **EPCRForm** (module JS dùng chung: sửa / chỉ đọc + log) | TX-06, BV-05, TT-08 | ✓ | | | ✓ | L1 |
| HandoverForm | BV-06 | | | | ✓ | L1 |
| ReasonPicker | TT-09 | ✓ | | | ✓ | L1 |
| PhotoGallery | TT-08, TT-13 | ✓ | | | | L2 |
| AudioPlayer (giả) | TT-12 | ✓ | | | | L3 |
| DataTable (lọc, tìm, phân trang) | TT-06, TT-11, TT-14..18, TT-20, TT-D, TT-Q, BV-03 | ✓ | | | | L2 |
| CrudDrawer (form chung cho danh mục) | TT-D1..8, TT-Q1 | ✓ | | | | L2 |
| KPI tiles + Charts | TT-19..21, BV-07 | ✓ | ✓ (ca demo đẩy số) | ✓ | | L2 |
| ConfirmDialog, EmptyState, LastUpdatedIndicator | Toàn bộ | | | | | — |
| Mobile: BigActionButton, StepperMilestone, BannerChange | TX, ND | | ✓ | | ✓ | L1 |

---

## 7. PHASE 1 — APP TRUNG TÂM + TIẾP NHẬN HỒ SƠ (80%)

### 7.0. Tổng quan các slice

| Slice | Tên | Effort | Demo được gì khi xong |
|---|---|---|---|
| P1.0 | Foundation | 10% | Mở 3 file HTML tĩnh, nạp data.json, thấy bản đồ Cần Thơ và danh mục ban đầu |
| P1.1 | Tiếp nhận & Tạo ca | 17% | Cuộc gọi → form → ca Đã điều động tại tab Trung tâm |
| P1.2 | Quản lý ca & Điều phối | 15% | Theo dõi ca, đổi xe/BV, hủy ca, mốc giả lập |
| P1.3 | Giám sát GIS & SOS | 12% | Xe chạy realtime client, ETA, mất GPS, SOS |
| P1.4 | Phối hợp bệnh viện | 12% | **E2E: ca chạy tới Hoàn tất tại tab BV** |
| P1.5 | Hồ sơ & Liên lạc | 7% | Tra cứu, mốc thời gian, liên lạc 1 nút |
| P1.6 | Vận hành nền & Báo cáo | 7% | Mọi menu đều có màn có dữ liệu từ data.json |

### P1.0 — Foundation (10%)

- **Objective**: dựng khung HTML tĩnh và kho dữ liệu mock JSON chạy được ngay. Các slice sau chỉ thêm màn và logic hiển thị, không cần setup backend.
- **Business Flow**: Đăng nhập một chạm theo tài khoản mẫu → menu theo vai trò (Trung tâm vs BV tiếp nhận ngay trên `central.html`).
- **Screens**: trang `central.html` với TT-01 Tài khoản, sidebar menu Trung tâm và chuyển sang menu Tiếp nhận hồ sơ khi chọn tài khoản BV; trang `driver.html` và `citizen.html` có khung giao diện mẫu; TT-02 và TT-03 ở dạng rỗng.
- **Modules**: `data.json`, `data-loader.js`, AppLayout, MapView SVG cơ bản, StatusBadge, DataTable, Toast, ConfirmDialog; token CSS theo `design_system.md`.
- **Core Logic**: nạp dữ liệu từ `data.json` vào state in-memory của trang; lựa chọn tài khoản/xe lưu trong `sessionStorage` của tab đó.
- **Required Data**: toàn bộ seed §5 được đóng gói vào 1 file `data.json`.
- **Demo Scenario**: Mở `central.html` trên trình duyệt → chọn `dpv01` thấy menu Trung tâm; đổi sang `bvdk.tn` thấy menu Tiếp nhận hồ sơ của Bệnh viện; bản đồ Trung tâm hiển thị 6 xe và 6 bệnh viện từ file JSON.
- **Definition of Done**:
  - Ba file HTML (`central.html`, `driver.html`, `citizen.html`) mở và chạy được trực tiếp trên trình duyệt, không cần build, không cần Node server.
  - Đọc thành công dữ liệu từ `data.json` và render danh sách xe, bệnh viện trên bản đồ SVG.
  - Menu hiển thị đúng theo loại tài khoản đã chọn tại từng tab (ĐPV hoặc Bệnh viện tiếp nhận).
  - Giao diện tuân thủ dark theme theo `design_system.md`.

### P1.1 — Tiếp nhận & Tạo ca (16%)

- **Objective**: từ một cuộc gọi đến tạo ra ca **Đã điều động**, đồng thời phát lệnh và cảnh báo trước (ở mức state).
- **Business Flow**: §4.1 bước 2–7: đổ chuông → nhấc máy → popup thông tin người gọi + form tự mở → định vị (Cell-ID, sau đó tìm hoặc ghim; nếu gọi từ App thì có GPS chính xác) → mức độ → chọn xe → chọn kíp → chọn BV → **Xác nhận**. Nhánh B7: kết thúc, không tạo ca.
- **Screens**: TT-05 Cuộc gọi hiện tại (+ popup chi tiết cuộc gọi, chỉ báo đang ghi âm); TT-07 Form Tạo ca (drawer lớn, tự mở).
- **Components**: IncomingCallBanner, CallerInfoPopup, LocationPicker, SeverityTag, VehiclePicker, CrewPicker, HospitalPicker (badge năng lực + gợi ý cố định), ConfirmDialog.
- **Core Actions**: `incomingCall`, `answerCall`, `endCallWithoutCase`, `createCaseAndDispatch`.
- **Required Data**: kịch bản cuộc gọi, địa chỉ, loại tình huống, xe, phân công kíp, bệnh viện, gợi ý cố định.
- **States**: Cuộc gọi (Đổ chuông → Đang nghe → Kết thúc); Ca (Nháp → Đã điều động); Lệnh (Chưa xác nhận); Xe (Đang điều xe); BV (Chờ phản hồi).
- **Dependencies**: P1.0 (MapView, server state, seed).
- **Demo Scenario**: Demo Control "Cuộc gọi 115: TNGT" → banner đổ chuông → Nhấc máy → popup số điện thoại, tên thuê bao, vùng Cell-ID; form tự mở → tìm địa chỉ và ghim → chọn Khẩn cấp → chọn xe gợi ý (Type B) và kíp 2 → chọn BV gợi ý → Xác nhận → toast "Đã tạo ca CC-…, phát lệnh tới xe …, cảnh báo tới BV …". Ca xuất hiện ở header. Nhánh: "Cuộc gọi 115: tư vấn" → [Kết thúc – không tạo ca].
- **Definition of Done**:
  - Mã ca là duy nhất.
  - Bắt buộc có vị trí, mức độ, xe, kíp, BV mới cho xác nhận.
  - Event log có đủ: nhận cuộc gọi (kèm ĐPV), tạo ca, phát lệnh, gửi cảnh báo BV.
  - Xe đổi trạng thái ở mọi nơi hiển thị.
  - Cuộc gọi không tạo ca vẫn nằm trong lịch sử.
  - dpv02 thấy cuộc gọi "đang do dpv01 xử lý" (D15).

### P1.2 — Quản lý ca & Điều phối (14%)

- **Objective**: theo dõi một ca đang mở và thay đổi phương án mà vẫn giữ nguyên mã ca (BR-02).
- **Business Flow**: §4.2, §4.5, §4.8 (rút gọn), cộng các mốc giả lập của kíp (D03).
- **Screens**:
  - TT-06 Danh sách ca (bảng các ca đang mở).
  - **TT-08 Hồ sơ ca hợp nhất** (D17), gồm các tab: Tổng quan (mini-map + khung tổng quan) · **Điều phối (TT-09)** · Hồ sơ (ảnh/tệp) · Lịch sử (Log) · Mốc thời gian · Ghi âm · ePCR (chỉ đọc).
  - TT-02 Thanh trạng thái ca (có dữ liệu thật).
  - TT-03 Thông báo (có dữ liệu thật).
- **Components**: CaseDetail, MilestoneTimeline, EventLogList, ReasonPicker, các Picker (tái sử dụng), StageLabel.
- **Core Actions**: `assignVehicle`, `revokeOrder`, `changeHospital`, `keepHospital`, `editCaseInfo`, `cancelCase`. Trên Demo Control: `crewConfirmBoarding`, `recordMilestone` (SIMULATED cho tới Phase 2).
- **Required Data**: lý do kết thúc ca; ca vừa tạo ở P1.1.
- **States**: toàn bộ §4.2 và nhánh B2, B4.
- **Dependencies**: P1.1.
- **Demo Scenario**: bấm ca trên header → tab Tổng quan → Demo Control "Kíp lên xe" → ca chuyển Đang vận chuyển, nhãn "Đang đến hiện trường" → tab Điều phối: thu hồi xe, xe về Sẵn sàng, chọn xe khác → đổi BV → tab Log có log trước/sau → hủy một ca phụ kèm lý do.
- **Definition of Done**:
  - Mọi thay đổi đều có log (ai, khi nào, trước/sau, lý do).
  - Mã ca không đổi.
  - TT-02 và TT-03 cập nhật ngay khi có thay đổi.
  - 7 tab đều mở được; tab chưa có dữ liệu hiện trạng thái rỗng.

### P1.3 — Giám sát GIS & SOS (12%)

- **Objective**: trả lời được 3 câu hỏi về nguồn lực: *ở đâu, trạng thái gì, có phù hợp không*. Xử lý được SOS.
- **Business Flow**: §4.1 bước 10–12 (giám sát), §4.4 SOS, §4.7 mất kết nối.
- **Screens**:
  - TT-13 Bản đồ ca: layer Ca/Xe/BV, danh sách ca đang xử lý, lọc, cảnh báo bất thường, "Xem ảnh hành trình".
  - TT-14 Tình trạng xe (đặt Bảo trì).
  - TT-15 Tình trạng kíp.
  - TT-16 Tình trạng bệnh viện (Trung tâm đổi trạng thái năng lực).
  - TT-04 Popup SOS.
- **Components**: MapView đủ layer, VehicleMarker, LastUpdatedIndicator, SOSAlertModal, PhotoGallery.
- **Core Actions**: `gpsTick` (simulator), `setGpsLost`, `triggerSOS` (Demo Control), `ackSOS`, `resolveSOS`, `setVehicleStatus`, `setHospitalCapacity`. Điều xe thay thế dùng lại `revokeOrder` + `assignVehicle`.
- **Required Data**: route, ảnh, ca nền.
- **States**: SOS; cờ GPS; xe; năng lực BV.
- **SIMULATED REALTIME**:
  - Xe chạy theo polyline, ETA giảm dần, tốc độ hiển thị dao động.
  - Khi xe chạy hết route, hệ thống **gợi ý** "Đã đến hiện trường?". Đây là cách thể hiện chức năng *Tự động nhận biết mốc*.
- **Dependencies**: P1.2 (cần có ca và lệnh); MapView từ P1.0.
- **Demo Scenario**: Bản đồ ca: xe chạy về hiện trường (tốc độ x5) → bấm xe để xem tốc độ, ETA, "cập nhật 2 giây trước" → Demo Control "Mất GPS" → marker xám, cảnh báo vàng rồi đỏ → "SOS" → popup đỏ phủ toàn màn kèm âm báo → Tiếp nhận → Điều xe thay thế → Đã xử lý.
- **Definition of Done**:
  - Trạng thái xe đồng nhất ở TT-07, TT-13, TT-14.
  - SOS luôn nằm trên cùng, không bị toast hay modal khác che.
  - Có ngưỡng 60 giây / 3 phút.
  - Đổi năng lực BV ở TT-16 thì HospitalPicker hiển thị theo.

### P1.4 — Phối hợp bệnh viện tiếp nhận (12%) ⭐ GATE E2E

- **Objective**: khép vòng luồng chính tới **Hoàn tất**. Demo được nhiều tài khoản bệnh viện (D11).
- **Business Flow**: §4.9: cảnh báo trước → phản hồi → (từ chối → Trung tâm xác nhận lại) → xe đến → check-in → biên bản → **Xác nhận bàn giao** → Hoàn tất.
- **Screens**:
  - BV-01 Popup cảnh báo ca đang đến.
  - BV-03 Ca đang đến.
  - BV-04 Chi tiết ca (tóm tắt, ETA, vị trí xe, diễn biến) + Popup Phản hồi.
  - BV-05 tab ePCR (thêm/xem/sửa/xóa, có log).
  - BV-06 tab Tiếp nhận & bàn giao (check-in, biên bản, Xác nhận bàn giao, In ở mức L3).
  - BV-02 Popup cuộc gọi kèm dữ liệu.
  - Phía Trung tâm: thông báo BV từ chối → tab Điều phối [Giữ] hoặc [Đổi BV].
- **Components**: **EPCRForm** (làm ở đây, Phase 2 dùng lại), HandoverForm, MapView mini, Toast/Popup.
- **Core Actions**: `hospitalRespond`, `checkInVehicle`, `confirmHandover`, `updateEPCR`, `sendInfoAndCallHospital`.
- **Required Data**: 3 tài khoản BV, ePCR mẫu, biên bản mẫu.
- **States**: Phản hồi BV; Ca Hoàn tất; Lệnh Hoàn thành; Xe Sẵn sàng.
- **Phạm vi dữ liệu**: tài khoản BV chỉ thấy các ca gửi tới BV đó. Khi bị đổi BV, BV cũ thấy dòng "Đã chuyển BV khác" (ASSUMPTION).
- **Dependencies**: P1.1 (cảnh báo được phát), P1.2 (đổi BV), P1.3 (vị trí và ETA của xe).
- **Demo Scenario**: Mở tab 1 `central.html` (đăng nhập `dpv01`) và tab 2 `central.html` (chuyển sang tài khoản `bv02.tn`) → ĐPV tạo ca gửi BV mock 02 → tab BV hiện cảnh báo và bấm **Từ chối** → tab ĐPV nhận thông báo đỏ, đổi sang BVĐK → tab BV chuyển sang tài khoản `bvdk.tn` và bấm **Xác nhận** → chuyển trạng thái xe đến hiện trường, ePCR, rời hiện trường, đến BV → tab BV: Ca đang đến → Chi tiết → tab ePCR (sửa 1 trường, có log) → Check-in → Biên bản → **Xác nhận bàn giao** → tab ĐPV thấy ca **Hoàn tất**, xe Sẵn sàng.
- **Definition of Done**:
  - **Một ca chạy trọn vòng từ cuộc gọi đến Hoàn tất mà không cần sửa code hay state bằng tay.**
  - Từ chối, đổi BV và bàn giao đều xuất hiện trong log và Mốc thời gian.
  - Phân hệ Tiếp nhận hồ sơ của BV trên `central.html` hiển thị đầy đủ và xử lý mượt mà theo tài khoản BV.

### P1.5 — Hồ sơ & Liên lạc (7%)

- **Objective**: hồ sơ xuyên suốt sau khi ca kết thúc; liên lạc được ngay từ ngữ cảnh ca.
- **Business Flow**: §4.1 bước 14; A7 (mỗi chức năng 1 nút, D14).
- **Screens**:
  - TT-11 Tra cứu hồ sơ.
  - TT-12 Chi tiết hồ sơ (= CaseDetail chế độ chỉ đọc) + Xuất PDF (in trình duyệt, L3).
  - Tab Mốc thời gian có tính các khoảng thời gian: Call-to-Dispatch, Dispatch-to-Accept, Call-to-Scene, Scene time, Scene-to-Hospital, Arrival-to-Handover.
  - Tab Ghi âm (L3).
  - TT-10 Liên lạc & phối hợp: Gọi kíp · Gửi thông tin & Gọi BV · Chuyển lực lượng phối hợp · Gửi hướng dẫn sơ cứu.
  - TT-05a Lịch sử cuộc gọi, TT-05b Danh bạ BV, TT-05c Chuyển tiếp.
- **Core Actions**: `sendFirstAidGuide`, `sendInfoAndCallHospital`, `forwardToAgency`, tìm kiếm.
- **Required Data**: 30 ca lịch sử, danh bạ, hướng dẫn sơ cứu, ghi âm giả.
- **Dependencies**: P1.4 (cần có ca vừa Hoàn tất để tra cứu); CaseDetail từ P1.2.
- **Demo Scenario**: Tra cứu bằng mã ca vừa demo → Chi tiết → Mốc thời gian đủ 7 mốc kèm khoảng thời gian → Xuất PDF.
- **Definition of Done**: ca vừa demo xuất hiện trong Tra cứu; 4 nút ở TT-10 đều có phản hồi và log.

### P1.6 — Vận hành nền & Báo cáo (7%)

- **Objective**: mọi menu trong sitemap đều mở ra một màn có dữ liệu (D01).
- **Screens**:
  - TT-17 Phân công ca trực (L2: khai báo thành viên kíp, thay đổi sẽ hiện trong CrewPicker).
  - TT-18 Lịch trực / tổ xe (L3).
  - TT-19 Báo cáo Tổng quan (L2: KPI tile, biểu đồ, bản đồ số xe đang cấp cứu lấy dữ liệu live; ca demo làm tăng số).
  - TT-20 Chi tiết, TT-21 Thống kê (L3, export mock).
  - BV-07 Báo cáo BV (dùng lại component, lọc theo BV).
  - TT-D1..D8 Danh mục (L2, DataTable + CrudDrawer dùng chung).
  - TT-Q1 Người dùng (L2), TT-Q2 Phân quyền (ma trận, L3), TT-Q3 **Nhật ký thao tác (L2, đọc event log thật)**, TT-Q4 Sao lưu (L3).
- **Dependencies**: seed; event log; component DataTable.
- **Definition of Done**: không có màn trắng hoặc 404; Nhật ký thao tác hiển thị đúng các thao tác của phiên demo.

### 7.7. GATE 1: Trung tâm hoàn tất

Chỉ chuyển sang Phase 2 khi đạt đủ các điều kiện sau:

- [x] Luồng chính §4.2 chạy được trên `central.html` (cả vai trò ĐPV và Tiếp nhận BV).
- [x] Các nhánh B1–B9 đều demo được qua giao diện tab Trung tâm và thao tác trực tiếp.
- [x] Đọc thành công dữ liệu danh mục, xe, kíp, bệnh viện từ file `data.json`.
- [x] EPCRForm, MapView, StageLabel, MilestoneTimeline đã sẵn sàng để tái sử dụng dưới dạng hàm render HTML thuần.
- [x] Toàn bộ menu sitemap của Trung tâm và Web BV đã có màn hình với dữ liệu tĩnh hiển thị đầy đủ trên `central.html`.
- [x] `central.html` mở độc lập trên trình duyệt mượt mà, chuyển đổi linh hoạt giữa tài khoản ĐPV và BV, không phụ thuộc server.
- [x] Dark theme tuân thủ `design_system.md` trên toàn bộ màn đã hoàn thành.

---

## 8. PHASE 2 — APP TÀI XẾ / KÍP (15%)

### 8.1. Đối chiếu với workflow Trung tâm

| Trung tâm làm | App Tài xế nhận / làm | Màn | Xử lý tại tab Tài xế |
|---|---|---|---|
| Xác nhận tạo ca (phát lệnh) | Popup lệnh mới (âm báo) → **Xác nhận lên xe** | TX-01 | Chuyển trạng thái sang Đang di chuyển |
| — | Dẫn đường tới hiện trường, ETA | TX-05 | Client timer chạy xe trên route |
| — | **Đến hiện trường** (có gợi ý tự động khi gần tới) | TX-04 | Stepper chuyển mốc "Đến hiện trường" |
| — | Check-in bệnh nhân, sinh hiệu, can thiệp, thuốc, ảnh | TX-06 | Mở form ePCR, nhập thông tin mẫu |
| — | **Rời hiện trường** → dẫn đường đổi đích sang BV | TX-04, TX-05 | Stepper chuyển mốc "Rời hiện trường" |
| — | Cập nhật diễn biến (gửi BV) | TX-06 | Cập nhật ô diễn biến bệnh nhân |
| — | **Đến BV** → "Chờ BV bàn giao" | TX-04 | Stepper chuyển mốc "Đến BV" |
| BV xác nhận bàn giao | "Nhiệm vụ hoàn thành" → về trạng thái chờ | TX-03 | Đổi trạng thái xe về Sẵn sàng |
| Thu hồi lệnh / đổi BV / hủy ca / BV phản hồi | Banner thay đổi (Required Gap) | Mọi màn | Banner hiển thị thông báo |
| Xử lý SOS | Nút SOS / Yêu cầu hỗ trợ | TX-02 | Kích hoạt cảnh báo SOS khẩn cấp |

### 8.2. Các slice

| Slice | Effort | Screens | Mức | DoD |
|---|---|---|---|---|
| **P2.1 Khởi động & nhận lệnh** | 5% | TX-00 Chọn xe (demo, ASSUMPTION §12.2); TX-03 Thông tin ca: trạng thái chờ, khi có lệnh thì hiện thông tin ca; TX-01 Popup lệnh mới | L1 | Mở `driver.html`: hiển thị ca được giao, bấm Xác nhận lên xe chuyển sang trạng thái thực hiện nhiệm vụ |
| **P2.2 Thực hiện nhiệm vụ** | 6% | TX-04 Nhiệm vụ hiện tại (stepper 1 chạm: Đến hiện trường → Rời hiện trường → Đến BV → chờ bàn giao); TX-05 Dẫn đường (route mock, ETA, tự đổi đích); banner thay đổi | L1 | Stepper 1 chạm bấm chuyển mốc mượt mà; dẫn đường hiển thị bản đồ di chuyển |
| **P2.3 ePCR & SOS** | 4% | TX-06 ePCR (dùng EPCRForm chung); TX-02 Nút SOS nổi (SOS / Yêu cầu hỗ trợ) | L1 | Form ePCR cho phép nhập sinh hiệu và diễn biến; nút SOS kích hoạt cảnh báo đỏ |

- **Thiết kế**: nút lớn, ít nhập liệu (BR-08), trang `driver.html` responsive cho tablet ngang; dark theme theo token chung.

### 8.3. GATE 2

- [x] Luồng nhiệm vụ của kíp xe chạy trơn tru trên `driver.html` ở tab/tablet riêng.
- [x] Stepper 4 mốc nhiệm vụ, dẫn đường bản đồ, form ePCR và nút SOS đều hoạt động tại chỗ.
- [x] Đọc dữ liệu xe và thông tin ban đầu chuẩn xác từ `data.json`.

---

## 9. PHASE 3 — APP NGƯỜI DÂN (5%)

### 9.1. Minimum Viable Journey

```
Đăng ký → Xác thực SĐT (OTP mock) → Đồng ý chia sẻ dữ liệu → Trang chủ [SOS 1 chạm = gọi qua app]
→ Màn hình yêu cầu: Đang kết nối → Chờ tiếp nhận
→ Đã điều động (xe, biển số) → Xe đang đến + ETA trên bản đồ → nhận Hướng dẫn sơ cứu
→ (Hủy được bất kỳ lúc nào) → Đang chuyển đến BV → Hoàn tất → Lịch sử yêu cầu
```

### 9.2. Màn hình

| Màn | Mức | Ghi chú |
|---|---|---|
| ND-01 Đăng ký, ND-02 OTP, ND-03 Đồng ý | L1 | OTP mock cố định, onboarding nhanh gọn |
| ND-04 Trang chủ: SOS 1 chạm | L1 | Bấm SOS 1 chạm kích hoạt luồng yêu cầu cấp cứu |
| ND-05 Yêu cầu cấp cứu | L1 | Trạng thái + nhãn giai đoạn, bản đồ xe và ETA, thẻ hướng dẫn sơ cứu, Gọi lại, Sinh hiệu (ô text), Hủy yêu cầu |
| ND-06 Danh sách cơ sở y tế | L2 | Danh sách + bản đồ lấy từ `data.json` |
| ND-07 Thông tin y tế khẩn cấp, ND-08 Người liên hệ | L2 | Form nhập lưu vào state cục bộ của tab |
| ND-09 Quyền riêng tư, ND-10 Lịch sử yêu cầu | L3 / L2 | Danh sách lịch sử các yêu cầu đã gọi |

### 9.3. GATE 3: luồng nghiệp vụ hoàn chỉnh

- [x] Hành trình người dân chạy trọn vẹn trên `citizen.html` (mobile view).
- [x] SOS 1 chạm, theo dõi tiến độ xe, xem hướng dẫn sơ cứu và hủy yêu cầu hoạt động tốt.
- [x] Toàn bộ dữ liệu ban đầu nạp đồng bộ từ `data.json`.

### 9.4. GATE 4: rà soát và bàn giao bản HTML

- [x] Không còn phụ thuộc React/TypeScript/Vite/Zustand hoặc Node server; toàn bộ chạy bằng HTML/CSS/JS thuần tĩnh + file `data.json`.
- [x] Kiểm tra toàn bộ mã màn TT, BV, TX, ND trong §7–9: không có menu dẫn tới màn trắng, 404; mức L1/L2/L3 đúng phạm vi đã chốt.
- [ ] Diễn tập kịch bản demo §13 trên các tab trình duyệt tương ứng (Trung tâm, BV, Tài xế, Người dân).
- [ ] Soát trực quan từng trang ở desktop 1920×1080, tablet ngang và điện thoại: đúng màu/token dark theme, bản đồ là trọng tâm ở Trung tâm, icon chìm, phân cấp chữ rõ, ít bóng/hiệu ứng.
- [x] Sẵn sàng phục vụ buổi demo ngày 09/10/2026 với độ ổn định cao nhất, không lo lỗi kết nối server.

---

## 10. THỨ TỰ MÀN HÌNH & DEPENDENCY

| # | Màn / hạng mục | Phụ thuộc | Lý do đứng ở vị trí này |
|---|---|---|---|
| 1 | Kho data.json dùng chung + CSS tokens + MapView SVG + 5 file HTML tĩnh | — | Mọi app dùng chung dữ liệu tĩnh, mở độc lập trên từng tab |
| 2 | TT-01, AppLayout, menu theo tài khoản trên `/central` và `/hospital` | 1 | Khung điều hướng theo vai trò |
| 3 | TT-05 Cuộc gọi hiện tại | 1, 2 | Điểm khởi phát mọi ca |
| 4 | **TT-07 Form tạo ca** | 3, seed xe/kíp/BV, MapView | Sinh ra ca, lệnh, cảnh báo, là dữ liệu cho mọi màn sau |
| 5 | TT-06, **TT-08 CaseDetail** (Tổng quan, Log, Mốc) | 4 | Cần có ca để hiển thị |
| 6 | TT-09 tab Điều phối | 5 | Sửa đổi ca |
| 7 | TT-02, TT-03 (có dữ liệu) | 4, 6 | Cần sự kiện để hiển thị |
| 8 | TT-13 Bản đồ ca + simulator chạy route | 4, 5 | Cần lệnh đang di chuyển |
| 9 | TT-14, TT-15, TT-16 | 8 | Dùng lại map và trạng thái |
| 10 | TT-04 SOS | 8, 6 | Cần xe đang chạy + điều xe thay thế |
| 11 | BV-01, BV-03, BV-04 | 4 (cảnh báo), 8 (ETA) | Bên nhận cảnh báo |
| 12 | BV-05 ePCR (EPCRForm) | 11 | Component dùng lại cho TX-06 |
| 13 | **BV-06 Bàn giao** | 11, mốc Đến BV | Khép vòng: **GATE E2E** |
| 14 | BV-02 + TT-10 | 11 | Liên lạc |
| 15 | TT-11, TT-12 | 13 | Cần ca đã đóng |
| 16 | TT-05a/b/c | 3 | Phụ trợ tổng đài |
| 17 | TT-17, TT-18 | seed | TT-17 cấp dữ liệu cho CrewPicker (seed đã đủ nên làm sau được) |
| 18 | TT-19..21, BV-07 | 15 | Cần dữ liệu ca để tổng hợp |
| 19 | TT-D1..8, TT-Q1..4 | DataTable | Mẫu chung, làm nhanh |
| — | **GATE 1** | | |
| 20 | TX-00, TX-03, TX-01 | Gate 1 | Nhận lệnh |
| 21 | TX-04, TX-05 | 20 | Thực hiện nhiệm vụ |
| 22 | TX-06, TX-02, banner | 21, EPCRForm | Hoàn thiện |
| — | **GATE 2** | | |
| 23 | ND-01..03 | Gate 2 | Onboarding |
| 24 | ND-04 → ND-05 | 23, TT-05 | Hành trình chính |
| 25 | ND-06..10 | 24 | Phụ trợ |
| — | **GATE 3** | | |
| 26 | Rà soát toàn bộ mã màn, nhánh B1–B9, nhiều trình duyệt và giao diện theo §9.4 | Gate 3 | Chốt bản HTML để demo |
| — | **GATE 4** | | |

**Dependency giữa 3 phần mềm**:

```
App Người dân ──(cuộc gọi + GPS)──► TRUNG TÂM ──(lệnh)──► App Tài xế
      ▲                                │  ▲                    │
      │ (trạng thái, ETA, hướng dẫn)   │  │ (mốc, GPS, ePCR, SOS)
      └────────────────────────────────┘  └────────────────────┘
                         │ (cảnh báo trước)    ▲ (bàn giao → Hoàn tất)
                         ▼                     │
                    Web BV tiếp nhận ──────────┘
```

Trung tâm là nguồn sinh ra mọi đối tượng (ca, lệnh, cảnh báo). Vì vậy Trung tâm phải xong trước. App Tài xế cần lệnh để có việc làm. App Người dân chỉ cần trạng thái ca và GPS xe. **File data.json và cả năm file HTML phải có từ P1.0** để phát triển và kiểm tra giao diện từng màn độc lập ngay từ đầu.

---

## 11. HƯỚNG DẪN GIAO VIỆC CHO AI (VIBE CODING)

Mỗi lần giao việc cho AI, nên làm như sau:

1. **Ngữ cảnh cố định** (gửi kèm mọi prompt): §1 Decision log, §3 Kiến trúc HTML tĩnh + `data.json`, §4 State model, §5 Seed và `ccnv-prototype/design_system.md`.
2. **Giao đúng một slice mỗi lần**, kèm khối slice đó (Screens, Components, Actions, DoD) và các mục liên quan trong `context.md` (§8.1 sitemap, §4.x luồng).
3. **Ràng buộc bắt buộc nêu rõ**:
   - Không thêm màn ngoài sitemap.
   - Dữ liệu ban đầu đọc từ file `data.json`; **không làm backend CRUD ghi đè JSON**.
   - Mỗi tab tự quản lý state và tương tác hiển thị tại chỗ (`window.appState` / DOM).
   - Dữ liệu chỉ lấy từ `data.json`.
   - Giữ mã màn (TT-xx, BV-xx, TX-xx, ND-xx) trong tên module hoặc hàm render.
   - Chỉ dùng HTML/CSS/JavaScript thuần; không thêm Node server, framework, bundler hoặc bước build.
   - Giữ ba app ở ba file HTML riêng biệt (`central.html`, `driver.html`, `citizen.html`), không có file trung gian nào khác.
4. **Kiểm tra DoD** bằng cách mở trực tiếp file HTML trên trình duyệt và kiểm tra tương tác của slice đó.
5. **Sau mỗi slice**, rà soát màu sắc/icon/bố cục theo dark theme design system.

---

## 12. CROSS-SYSTEM FLOW: MỘT CA HOÀN CHỈNH

| Step | Người dân (`citizen.html`) | Trung tâm (`central.html` - ĐPV) | Tài xế / Kíp (`driver.html`) | Bệnh viện (`central.html` - BV) | Nghiệp vụ thể hiện |
|---|---|---|---|---|---|
| 1 | Bấm **SOS 1 chạm** (gọi qua app) | Đổ chuông, tag "Từ App" | — | — | Kích hoạt luồng cuộc gọi cấp cứu |
| 2 | Thấy "Đang kết nối" | dpv01 **nhấc máy**; popup thông tin; form tự mở, vị trí GPS điền sẵn | — | — | Nhấc máy, tự mở Drawer tạo ca |
| 3 | Mô tả tình huống | Nhập thông tin bệnh nhân, xác nhận vị trí, chọn **Khẩn cấp** | — | — | Điền thông tin ca |
| 4 | — | Chọn xe gợi ý + kíp + BV gợi ý → **Xác nhận** | — | — | Ca **Đã điều động**; Lệnh Chưa xác nhận; Xe Đang điều xe |
| 5 | "Đã điều động – Xe 65B-…" | Ca hiện trên header & bản đồ | **Popup lệnh mới** (âm báo) | **Popup cảnh báo ca đang đến** | Thông báo xuất hiện tại các app |
| 6 | Nhận **thẻ hướng dẫn sơ cứu** | Bấm "Gửi hướng dẫn sơ cứu" | — | — | Thẻ hướng dẫn sơ cứu hiển thị |
| 7 | — | Thông báo xanh "BV đã nhận" | Badge "BV đã nhận" | **Xác nhận** tiếp nhận | BV xác nhận tiếp nhận ca |
| 8 | "Xe đang đến – ETA 6 phút" | Lệnh Đang di chuyển | **Xác nhận lên xe** | ETA | Ca **Đang vận chuyển**; Xe Đang cấp cứu; mốc Xuất phát |
| 9 | Bản đồ: xe đang tới | Bản đồ ca theo dõi | **Dẫn đường** tới hiện trường | Vị trí xe | Client timer chạy xe trên route |
| 10 | "Xe đã đến" | Nhãn: Tại hiện trường | Stepper → **Đến hiện trường** | — | Mốc Đến hiện trường |
| 11 | — | Tab ePCR, tab Hồ sơ (ảnh) | **ePCR**: check-in bệnh nhân, sinh hiệu, can thiệp, ảnh | Thấy ePCR | Điền và xem form ePCR |
| 12 | "Đang chuyển đến BV ĐK TP Cần Thơ" | Nhãn: Đang chuyển đến BV | **Rời hiện trường** → dẫn đường tới BV | ETA tới BV | Mốc Rời hiện trường |
| 13 | — | — | **Cập nhật diễn biến** | Thấy diễn biến | Cập nhật ô diễn biến bệnh nhân |
| 14 | — | Nhãn: Đã đến BV | **Đến BV** → chờ bàn giao | **Check-in xe** | Mốc Đến BV; giờ cập bến |
| 15 | — | — | — | Biên bản → **Xác nhận bàn giao** | Ca **Hoàn tất**; Lệnh Hoàn thành; Xe **Sẵn sàng** |
| 16 | "Hoàn tất"; có trong Lịch sử yêu cầu | Ca có trong Tra cứu hồ sơ; KPI tăng | "Nhiệm vụ hoàn thành" → chờ | Ca có trong Báo cáo BV | Đóng hồ sơ, hoàn thành demo |

---
