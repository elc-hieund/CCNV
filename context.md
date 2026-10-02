# CONTEXT.MD - HỆ THỐNG CẤP CỨU NGOẠI VIỆN (CCNV) TP. CẦN THƠ

**Single Source of Truth** cho toàn bộ dự án. Mục tiêu sử dụng trước mắt: làm đầu vào cho AI Agent thực hiện **BA / Product / UX / Prototype cho 3 app**: (1) App Trung tâm (Web điều hành, bao gồm phân hệ Tiếp nhận hồ sơ của bệnh viện), (2) App Tài xế / Kíp cấp cứu, (3) App Người dân.

Quy ước nhãn: **ASSUMPTION** = nội dung suy luận, chưa được xác nhận; **TBD** = chưa chốt.

---

## 1. PROJECT OVERVIEW

### 1.1. Tên dự án

- Tên hiện tại: **Hệ thống cấp cứu ngoại viện**
- Phạm vi địa lý: toàn bộ địa bàn Thành phố Cần Thơ (thành phố trực thuộc Trung ương).
- Chủ đầu tư / đơn vị chủ quản: **Bệnh viện Đa khoa thành phố Cần Thơ** (BVĐK TP Cần Thơ).

### 1.2. Bối cảnh

**Bối cảnh ngành**:

- Cấp cứu ngoại viện là hoạt động cấp cứu trước khi người bệnh được tiếp nhận tại cơ sở y tế: tiếp nhận thông tin → đánh giá ban đầu → hướng dẫn sơ cấp cứu → điều động phương tiện → xử trí hiện trường → vận chuyển → bàn giao cho cơ sở KCB phù hợp.
- Với ngừng tuần hoàn, đột quỵ, chấn thương nặng, tai nạn giao thông, thời gian đáp ứng có ý nghĩa quyết định; thời gian phụ thuộc vào định vị, đánh giá mức độ, chọn phương tiện, bố trí kíp và chuẩn bị nơi tiếp nhận, không chỉ tốc độ xe.
- Mạng lưới CCNV tại Việt Nam chưa đồng đều: nơi có Trung tâm 115 độc lập + trạm vệ tinh, nơi giao cho BVĐK tỉnh.
- Các tổng đài nhận gần 1 triệu cuộc gọi/năm nhưng tỷ lệ cuộc gọi thực sự cần cấp cứu thấp; nhiều cuộc gọi không đúng mục đích.
- Mô hình giai đoạn mới hướng đến tiếp nhận và điều phối tập trung, tăng phối hợp Công an - Y tế - Quân đội - PCCC & CNCH.

**Bối cảnh dự án**:

- Dự án đang ở giai đoạn lập thuyết minh giải pháp kỹ thuật khẩn cấp để kịp giải ngân nguồn vốn trong năm.
- BVĐK TP Cần Thơ được định hướng là đầu mối tổ chức hệ thống cấp cứu ngoại viện trên địa bàn.
- Hồ sơ thiết bị đã hình thành các lớp hạ tầng: mạng, firewall, đường truyền, camera trung tâm, thiết bị trên xe, GPS/4G, tablet, nền tảng giám sát hành trình. Phần cần phát triển tiếp là **lớp điều phối nghiệp vụ và liên thông dữ liệu y tế**.
- Quy mô ban đầu: **6 xe cứu thương**; phần mềm phải mở rộng quản lý **tối thiểu 64 xe**.
- Mốc thời gian dự kiến: chuẩn bị và demo với khách hàng 2 tuần, **dự kiến demo ngày 09/10/2026**; triển khai Giai đoạn I: 4 tuần (tính từ khi chốt phương án triển khai); Giai đoạn II: 4 tuần (tiếp nối GĐ I); Giai đoạn III: trong năm 2027.

### 1.3. Problem Statement

| # | Vấn đề hiện trạng | Hệ quả |
|---|---|---|
| P1 | Điều phối xe phụ thuộc điện thoại, sổ trực, Excel, phần mềm giám sát hành trình chạy độc lập | Điều phối viên không nắm đủ vị trí, trạng thái sẵn sàng, thành phần kíp, trang thiết bị từng xe; chọn xe dựa nhiều vào kinh nghiệm |
| P2 | Dữ liệu phân tán: cuộc gọi ở tổng đài, vị trí xe ở phần mềm GPS, xử trí hiện trường trên biểu mẫu giấy, kết quả điều trị ở bệnh viện | Không có hồ sơ xuyên suốt theo một sự kiện; khó đo thời gian đáp ứng, khó tìm nguyên nhân chậm trễ |
| P3 | Phối hợp với bệnh viện tiếp nhận chủ yếu bằng trao đổi trực tiếp; bệnh viện chỉ biết khi xe sắp đến hoặc đã đến | Bệnh viện không kịp chuẩn bị nhân lực, thiết bị, buồng cấp cứu |
| P4 | Thiếu công cụ định vị người gọi, sàng lọc, phân loại mức độ, hướng dẫn sơ cứu | Tăng áp lực tổng đài, chiếm năng lực tiếp nhận |
| P5 | Thiết bị định vị/phần mềm giám sát hành trình chỉ cho biết vị trí xe | Vị trí chưa gắn với sự kiện, lệnh điều động, kíp trực, trạng thái nhiệm vụ |
| P6 | Kết nối trên xe dùng mạng di động, chất lượng không ổn định | Cần chạy được khi mất mạng, ưu tiên dữ liệu quan trọng |

Tóm tắt vấn đề: chuyển hoạt động CCNV từ mô hình điều phối phân tán, phụ thuộc điện thoại và kinh nghiệm cá nhân sang mô hình điều hành tập trung, có dữ liệu, giám sát và đo lường xuyên suốt.

### 1.4. Mục tiêu

**Mục tiêu tổng quát**: xây dựng hệ thống quản lý và điều hành CCNV tập trung, kết nối các khâu từ tiếp nhận thông tin, đánh giá ban đầu, điều phối phương tiện, cấp cứu hiện trường, vận chuyển đến bàn giao người bệnh. Nền tảng công nghệ **không thay thế quyết định chuyên môn** của tổng đài viên, điều phối viên, bác sĩ, kíp cấp cứu.

**Mục tiêu cụ thể**:

1. Tiếp nhận và quản lý tập trung yêu cầu cấp cứu: mỗi yêu cầu là một hồ sơ sự kiện có mã định danh; cuộc gọi, lệnh điều động, hành trình xe, thông tin xử trí, kết quả bàn giao liên kết trong cùng hồ sơ.
2. Hỗ trợ đánh giá ban đầu và hướng dẫn sơ cấp cứu (bộ câu hỏi, hướng dẫn, danh mục tình huống, cảnh báo dấu hiệu nguy kịch).
3. Nâng cao hiệu quả điều phối (vị trí, trạng thái, sẵn sàng của xe, kíp, trang thiết bị chính).
4. Theo dõi xuyên suốt các mốc: nhận lệnh, xuất xe, đến hiện trường, bắt đầu vận chuyển, đến cơ sở y tế, hoàn tất bàn giao.
5. Kết nối cơ sở tiếp nhận: chuyển trước thông tin người bệnh, tình trạng, biện pháp đã làm, ETA; bệnh viện phản hồi khả năng tiếp nhận.
6. Quản lý nguồn lực: phương tiện, nhân lực, trạm, lịch trực, thiết bị, trạng thái sẵn sàng.
7. Hình thành dữ liệu quản lý: số cuộc gọi, thời gian xử lý, thời gian xuất xe, thời gian tiếp cận hiện trường, tỷ lệ điều phối thành công, sử dụng phương tiện, kết quả bàn giao.
8. Bảo đảm kết nối và mở rộng: 113/114/115, tổng đài, GIS, HIS/EMR.

### 1.5. Phạm vi (In scope)

Phạm vi nghiệp vụ: quản lý xuyên suốt **một ca cấp cứu** từ tiếp nhận yêu cầu đến khi bàn giao người bệnh và ca được hoàn tất trên hệ thống, gồm 8 nhóm:

1. Tiếp nhận và quản lý yêu cầu cấp cứu (ghi nhận yêu cầu, vị trí, tình trạng ban đầu, tạo ca).
2. Phân loại và hỗ trợ xác định mức độ ưu tiên.
3. Điều phối và theo dõi nguồn lực cấp cứu.
4. Quản lý mạng lưới cấp cứu (trạm/đơn vị, phương tiện, kíp trực, năng lực, trang thiết bị, trạng thái sẵn sàng).
5. Hỗ trợ kíp cấp cứu thực hiện nhiệm vụ (nhận nhiệm vụ, dẫn đường, cập nhật trạng thái, trao đổi, ghi nhận xử trí).
6. Quản lý hồ sơ CCNV (ePCR).
7. Phối hợp với cơ sở y tế tiếp nhận (cảnh báo trước, ETA, thông tin lâm sàng, xác nhận tiếp nhận, bàn giao).
8. Giám sát, báo cáo, đánh giá hoạt động.

Phạm vi phần mềm: 5 nhóm Epic A-E (A. Web Điều hành trung tâm; B. App Tài xế / Kíp cấp cứu; C. Web Bệnh viện tiếp nhận; D. Quản trị & dữ liệu dùng chung; E. Ứng dụng dành cho người dân). Chi tiết ở mục 7.

**Phạm vi kết thúc của một ca**: ca hoàn tất khi (1) người bệnh đã bàn giao tại cơ sở tiếp nhận **hoặc** ca kết thúc theo trạng thái nghiệp vụ phù hợp; (2) thông tin CCNV đã hoàn thiện; (3) trạng thái phương tiện và kíp đã cập nhật; (4) các mốc thời gian và dữ liệu cần thiết đã ghi nhận.

### 1.6. Out of scope / Ranh giới

- Không thay thế HIS/EMR hay hệ thống quản lý KCB tại bệnh viện; chỉ trao đổi dữ liệu cần thiết cho tiếp nhận và bàn giao. Không mặc định sao chép toàn bộ hồ sơ HIS/EMR.
- Không thay thế hệ thống nghiệp vụ của Công an, PCCC & CNCH hay nền tảng liên ngành; chỉ kết nối/chia sẻ thông tin phối hợp theo phạm vi cho phép.
- Không tự động ra quyết định: triage, gợi ý nguồn lực, gợi ý cơ sở tiếp nhận chỉ hỗ trợ; quyết định cuối thuộc người có thẩm quyền.
- Không truyền liên tục video camera về Trung tâm. Hiện tại chỉ truyền **ảnh hiện trường trong và ngoài xe** về Trung tâm; phương thức kỹ thuật chi tiết đang nghiên cứu.
- Không quy định cứng cấu hình nhân lực, trang thiết bị chi tiết cho từng loại xe.

### 1.7. Đối tượng sử dụng

| Đối tượng | Giá trị kỳ vọng |
|---|---|
| Lãnh đạo bệnh viện | Bức tranh realtime về ca, nguồn lực, thời gian đáp ứng, SLA; dữ liệu để chỉ đạo và quy hoạch |
| Trung tâm / Trực ban điều phối | Theo dõi tập trung xe, kíp, nhiệm vụ; giảm phụ thuộc điện thoại và Excel; giảm thời gian tìm xe/trạm |
| Kíp cấp cứu | Nhiệm vụ rõ ràng, có vị trí và tình huống, dẫn đường, cập nhật trạng thái nhanh, giảm gọi điện lặp lại và ghi chép trùng |
| Cơ sở y tế tiếp nhận | Nhận thông tin sớm, chủ động ekip/phòng cấp cứu, rút ngắn bàn giao |
| Người dân / người bệnh | Tiếp nhận và điều phối nhanh hơn; không phải gọi nhiều nơi; biết xe đang đến đâu |
| Sở Y tế / Thành phố | Dữ liệu tổng hợp để giám sát, quy hoạch mạng lưới, phân bổ nguồn lực, phối hợp liên ngành |

### 1.8. Các hệ thống / phần mềm thuộc dự án

| App | Thành phần | Nền tảng | Ghi chú |
|---|---|---|---|
| **App Trung tâm** | Web Điều hành trung tâm (Epic A) + phân hệ "Tiếp nhận hồ sơ" (bản Web BV tiếp nhận của BVĐK) + Quản trị (Epic D) | Desktop Web | Các bệnh viện tiếp nhận khác dùng chung nền tảng, phân biệt bằng phân quyền theo tài khoản (Epic C). App Trung tâm phải tiếp nhận và xử lý được yêu cầu cấp cứu đến từ cuộc gọi và từ App Người dân |
| **App Tài xế / Kíp cấp cứu** | Epic B | Chủ yếu chạy trên **tablet** trên xe; dùng **song song điện thoại cá nhân** của tài xế (Android) | Người dùng: ekip (tài xế và kíp cấp cứu). App gắn theo xe, không cần đăng nhập. Cách dùng song song điện thoại: TBD |
| **App Người dân** | Epic E | Mobile (Android) | Ở giai đoạn hiện tại là **app độc lập**. Người dân phải đăng ký và xác thực số điện thoại trước khi gửi yêu cầu. Kênh nhận yêu cầu cấp cứu của người dân chưa chốt final |

---

## 2. SYSTEM LANDSCAPE

### 2.1. Mô hình tổng thể

Nguyên tắc kiến trúc: **"Một trung tâm điều hành - nhiều đơn vị tham gia - một luồng thông tin thống nhất"**. Tất cả các bên khai thác chung một nền tảng qua Web/Cloud; cơ sở tuyến dưới chỉ cần máy tính có Internet và tài khoản, không cài đặt phức tạp. Toàn bộ dữ liệu liên kết theo **mã ca cấp cứu**.

Phân lớp:

| Lớp | Cấu phần | Vai trò chính |
|---|---|---|
| 1 | Người dân và kênh tiếp nhận | Gọi 115/hotline, chia sẻ vị trí, cung cấp thông tin; về sau mở rộng app/web/Zalo |
| 2 | Contact Center | Tiếp nhận, ghi âm, phân phối cuộc gọi, tạo ca, hỗ trợ gọi lại, QA tổng đài |
| 3 | CAD/EMS | Triage, quản lý ca, gợi ý nguồn lực, điều động, theo dõi trạng thái, đóng ca |
| 4 | GIS và bản đồ nguồn lực | Hiện trường, trạm, xe, bệnh viện, vùng phục vụ, ETA, lịch sử hành trình |
| 5 | Mạng lưới cấp cứu | Năng lực trạm/bệnh viện, xe, kíp trực, chuyên môn, trang thiết bị |
| 6 | Thiết bị trên xe | GPS, 4G/5G, tablet, MDVR, camera hành trình/cabin, camera AI/DMS |
| 7 | Ứng dụng kíp cấp cứu | Nhận nhiệm vụ, dẫn đường, cập nhật trạng thái, ePCR, trao đổi với trung tâm |
| 8 | Bệnh viện tiếp nhận | Nhận cảnh báo trước, ETA, thông tin lâm sàng tóm tắt, xác nhận khả năng tiếp nhận |
| 9 | Dữ liệu và tích hợp | Dashboard, KPI, API Gateway, HIS/EMR, Telemedicine, báo cáo, phân tích |

### 2.2. Luồng tương tác giữa các thành phần (tóm tắt)

Các cặp trao đổi thông tin chính:

- Người dân ↔ Trung tâm: yêu cầu cấp cứu, vị trí, thông tin tình huống, hướng dẫn ban đầu.
- Trung tâm ↔ Trạm/đơn vị cấp cứu: yêu cầu huy động, trạng thái sẵn sàng, năng lực, xác nhận nhiệm vụ.
- Trung tâm ↔ Xe/kíp: điều động, vị trí, ETA, trạng thái thực hiện, thông tin người bệnh, ảnh hiện trường trong và ngoài xe.
- Trung tâm/kíp ↔ Cơ sở y tế tiếp nhận: thông tin lâm sàng tóm tắt, ETA, khả năng tiếp nhận, kết quả bàn giao.
- Trung tâm ↔ Lực lượng phối hợp liên ngành: thông tin tình huống, yêu cầu phối hợp, trạng thái xử lý.

Dữ liệu cập nhật ngược về Trung tâm trong quá trình thực hiện: vị trí xe hoặc người bệnh tự di chuyển; trạng thái nhiệm vụ; ETA; tình trạng người bệnh; thông tin xử trí; ePCR; trạng thái cơ sở tiếp nhận; cảnh báo SOS/sự cố.

---

## 3. ACTORS & ROLES

### 3.1. Nguyên tắc phân quyền

- Phân quyền theo **vai trò + đơn vị + chức năng + phạm vi dữ liệu** (RBAC).
- Mỗi người chỉ khai thác thông tin cần cho nhiệm vụ: người tiếp nhận/điều phối truy cập thông tin xử lý ca; kíp truy cập thông tin nhiệm vụ được giao; cơ sở tiếp nhận truy cập thông tin người bệnh dự kiến tiếp nhận.
- Phân quyền theo **đơn vị** khi đăng nhập: **Bệnh viện trung tâm** (chỉ có một: BVĐK TP Cần Thơ, nơi đặt Data Center chính) hoặc **Bệnh viện tiếp nhận** (tất cả bệnh viện trong thành phố). Bệnh viện trung tâm có thể kiêm bệnh viện tiếp nhận; bệnh viện tiếp nhận không mặc nhiên là bệnh viện trung tâm.
- BVĐK TP Cần Thơ có cả chức năng A + C; bệnh viện khác chỉ có C.
- Quy trình cấp/thu hồi quyền khi nhân sự thay ca hoặc chuyển công tác; ưu tiên MFA cho tài khoản quản trị.
- Ba hoạt động **Tiếp nhận - Phân loại (triage) - Điều phối nguồn lực** do **một người** thực hiện: Tổng đài viên - Điều phối viên (AC-02).

### 3.2. Danh sách actor

| # | Actor | Vai trò | Trách nhiệm | Quyền chính | Hệ thống sử dụng |
|---|---|---|---|---|---|
| AC-01 | **Người dân / Người phát tín hiệu cấp cứu** (người gặp nạn, người nhà, người đi đường, du khách) | Nguồn phát sinh yêu cầu | Gọi 115/hotline hoặc gửi yêu cầu qua app; cung cấp vị trí, tình huống, người cần hỗ trợ; có thể tự đưa người bệnh đi | Đăng ký và xác thực số điện thoại (bắt buộc trước khi gửi yêu cầu); gửi yêu cầu; hủy yêu cầu trước hoặc trong khi xe đang điều động; chia sẻ vị trí; xem trạng thái yêu cầu và xe đang đến/ETA; nhận hướng dẫn sơ cứu; nhắn tin/gọi lại Trung tâm; xác nhận điểm đến khi tự di chuyển; khai báo hồ sơ y tế khẩn cấp và người liên hệ; quản lý đồng ý chia sẻ dữ liệu; tra cứu CSYT gần nhất; xem lịch sử yêu cầu | Điện thoại (gọi 115); **App Người dân** |
| AC-02 | **Tổng đài viên - Điều phối viên** (một người đảm nhận cả tiếp nhận, phân loại và điều phối; còn gọi: Trực ban điều phối, Điều hành viên) | Tiếp nhận và điều động | Nhận cuộc gọi/yêu cầu (form tạo ca tự mở), khai thác thông tin, định vị, phân loại mức độ, chọn xe + kíp hiện tại và bệnh viện, xác nhận tạo ca (phát lệnh), theo dõi hành trình, cập nhật phương án, xác nhận lại khi BV từ chối/không phản hồi, xử lý SOS, liên lạc kíp/BV, chuyển thông tin sang lực lượng phối hợp, kết thúc/hủy ca | Toàn bộ nhóm Tổng đài, Cấp cứu, Giám sát, Liên lạc. **Luôn là người quyết định cuối cùng** | **App Trung tâm** + tổng đài IP |
| AC-03 | **Tài xế / Lái xe cứu thương** | Thực hiện nhiệm vụ di chuyển | Nhận lệnh, xác nhận lên xe, di chuyển, cập nhật trạng thái nhiệm vụ, gửi yêu cầu hỗ trợ, bấm SOS | Thao tác App Tài xế / Kíp cấp cứu | **App Tài xế / Kíp cấp cứu** gắn theo xe, không đăng nhập (tablet; dùng song song điện thoại cá nhân: TBD) |
| AC-04 | **Thành viên kíp cấp cứu** (bác sĩ, điều dưỡng, cấp cứu viên, KTV) | Xử trí chuyên môn trên xe | Xác nhận lên xe, đánh giá, xử trí người bệnh, check-in bệnh nhân, ghi ePCR (sinh hiệu, can thiệp, thuốc, diễn biến), chụp ảnh hiện trường | Thao tác App Tài xế / Kíp cấp cứu, gồm Phiếu cấp cứu (ePCR) | **App Tài xế / Kíp cấp cứu** (vai trò: Ekip) |
| AC-05 | **Trực ban / Lễ tân Khoa Cấp cứu bệnh viện tiếp nhận** | Đón người bệnh | Nhận cảnh báo trước, xem tóm tắt + ETA, phản hồi nhận/không nhận, xác nhận xe cập bến (check-in xe) | Thao tác nhóm Tiếp nhận hồ sơ | **Web BV tiếp nhận** (BV khác) / phân hệ Tiếp nhận hồ sơ trong App Trung tâm (BVĐK) |
| AC-06 | **Bác sĩ / Nhân viên trực Khoa Cấp cứu bệnh viện tiếp nhận** | Tiếp nhận chuyên môn | Kiểm tra người bệnh, lập biên bản tiếp nhận (chẩn đoán ban đầu, tình trạng sống/chết, sự cố y tế nếu có), **nhấn Xác nhận bàn giao** (ca tự chuyển Hoàn tất); quản lý ePCR | Lập biên bản bàn giao, xác nhận bàn giao, in/xuất biên bản (tùy chọn), **quản lý ePCR (thêm, xem, sửa, xóa; mọi chỉnh sửa có log)** | Web BV tiếp nhận |
| AC-07 | **Đầu mối cập nhật năng lực tiếp nhận của bệnh viện** | Cập nhật dữ liệu nguồn lực | Cập nhật trạng thái tiếp nhận (Đang nhận / Hạn chế / Tạm ngưng) và chuyên khoa/năng lực; giai đoạn đầu cập nhật thủ công/bán tự động | Cập nhật trạng thái tiếp nhận, Khai báo chuyên khoa / năng lực. **ASSUMPTION**: có thể là AC-05/AC-06 kiêm nhiệm | Web BV tiếp nhận |
| AC-08 | **Lực lượng phối hợp liên ngành** (Công an trật tự, Cảnh sát giao thông, Cảnh sát khu vực, PCCC & CNCH, Quân đội) | Phối hợp khi có yêu cầu | Bảo đảm an ninh, phân luồng giao thông, cứu nạn cứu hộ, xử lý sự cố | Nhận thông tin ca được chuyển. Prototype: chỉ mô phỏng bằng một nút "Chuyển"; cách thức cụ thể TBD | Ngoài hệ thống |
| AC-09 | **Trung tâm Thông tin Chỉ huy (TTTTCH) Công an TP** | Không còn trong mô hình hiện hành | Trước đây: đầu mối tiếp nhận tổng đài khẩn cấp hợp nhất, phân luồng liên ngành | - | - |
| AC-10 | **Trạm / Đơn vị cấp cứu ngoại viện** (bao gồm đơn vị vận chuyển tư nhân) | Cung cấp nguồn lực | Quản lý xe, kíp trực, nhân lực, trang thiết bị, vùng phục vụ, trạng thái sẵn sàng | TBD | TBD |
| AC-11 | **Người quản lý ca trực / lịch trực** | Lập lịch | Phân công ca trực (xe + kíp); dữ liệu này là nguồn danh sách xe và kíp hiện tại khi tạo ca; quản lý tổ xe, lịch trực | TBD: là AC-02 hay vai trò quản lý riêng | App Trung tâm (menu Ca trực) |
| AC-12 | **Quản trị hệ thống** (đơn vị quản trị và vận hành) | Quản trị | Tài khoản, phân quyền, danh mục, cấu hình trạng thái/mẫu form, nhật ký thao tác, sao lưu & khôi phục, tích hợp, ATTT | Toàn bộ nhóm Danh mục & cấu hình, Quản trị hệ thống | App Trung tâm |
| AC-13 | **Hệ thống (System actor)** | Tự động | Tự mở form tạo ca khi nhấc máy, tự ghi mốc thời gian, tính ETA, cảnh báo bất thường, gợi ý xe/BV, gửi thông báo, chuyển trạng thái ca, đồng bộ | - | Backend |

---

## 4. QUY TRÌNH NGHIỆP VỤ (BUSINESS FLOWS)

### 4.1. Luồng chính end-to-end

| Bước | Giai đoạn | Mô tả | Actor | App / tính năng |
|---|---|---|---|---|
| 1 | Phát sinh yêu cầu | Người dân gọi 115/hotline hoặc gửi yêu cầu trên App Người dân (phải đăng ký và xác thực số điện thoại trước). Qua app: truyền GPS chính xác và liên tục realtime. Kênh nhận yêu cầu của người dân chưa chốt final; App Trung tâm tiếp nhận và xử lý mọi yêu cầu đến | AC-01 | Điện thoại; App Người dân E1 |
| 2 | Tiếp nhận | Khi tổng đài viên nhấc máy (cuộc gọi) hoặc nhận yêu cầu từ app, hệ thống **tự mở form tạo ca**; popup thông tin số gọi (số điện thoại, tên chủ thuê bao định danh, vị trí tương đối theo Cell-ID); ghi âm | AC-02, AC-13 | Tổng đài > Cuộc gọi hiện tại; Cấp cứu > Form Tạo ca cấp cứu |
| 3 | Xác định vị trí | Định vị tương đối trước (trạm sóng) → hỏi thêm để xác nhận vị trí tuyệt đối; tìm địa chỉ, ghim bản đồ, tọa độ, GPS | AC-02 | A3 Định vị trí cuộc gọi tự động / thủ công |
| 4 | Phân loại | Khai thác thông tin, chọn mức độ khẩn cấp của ca (Vận chuyển / Khẩn cấp / Nguy kịch) | AC-02 | A4 Phân loại mức độ khẩn cấp; Gợi ý mức độ khẩn cấp |
| 4a | Phối hợp liên ngành (nhánh) | Nếu sự cố có yếu tố cháy nổ/ùn tắc → PCCC & CNCH; ẩu đả/mất an ninh → Công an trật tự/Cảnh sát khu vực. Prototype: một nút "Chuyển" để demo; cách thức cụ thể TBD | AC-02 | A1 Chuyển thông tin sang lực lượng phối hợp (Công An/ Cứu hỏa); A7 Chia sẻ thông tin ca cho lực lượng phối hợp |
| 5 | Chọn xe và kíp | Form hiển thị **danh sách xe và kíp hiện tại** (lấy từ phân công ca trực). Tổng đài viên thêm thủ công **một hoặc nhiều xe** (mỗi xe kèm kíp) vào ca. Hệ thống gợi ý xe/kíp phù hợp (GĐ 2.0) | AC-02, AC-13 | A5 Gợi ý xe/ kíp phù hợp; A9 Theo dõi phân công xe – nhân sự trong ca |
| 6 | Chọn bệnh viện | Chọn bệnh viện tiếp nhận **ngay trong lần điều phối**; có thể cập nhật sau. Trạng thái tiếp nhận của BV là một yếu tố để cân nhắc, không chặn lựa chọn | AC-02 | A5 Gợi ý bệnh viện phù hợp |
| 7 | Xác nhận tạo ca = phát lệnh | Tổng đài viên xác nhận → ca được tạo, trạng thái ca **Đã điều động**. Hệ thống gửi **đồng thời** lệnh tới app trên từng xe (lệnh: Chưa xác nhận) và cảnh báo trước tới BV tiếp nhận | AC-02, AC-13 | A2 Tạo ca cấp cứu; A5 Phát lệnh điều động |
| 8 | Kíp xác nhận lên xe | Kíp lên xe và xác nhận trên app → lệnh **Đang di chuyển**, ca **Đang vận chuyển**. Không có luồng từ chối lệnh | AC-03 / AC-04 | App Tài xế: popup Lệnh điều động mới |
| 9 | BV phản hồi | BV xác nhận/từ chối khả năng tiếp nhận. Từ chối hoặc không phản hồi → cảnh báo trên App Trung tâm, điều phối viên **xác nhận lại** (giữ hoặc đổi BV) | AC-05, AC-02 | Web BV: popup Cảnh báo ca đang đến, Phản hồi khả năng tiếp nhận; App Trung tâm: Thông báo |
| 10 | Tiếp cận hiện trường | Dẫn đường; theo dõi GPS, ETA; liên lạc người gọi; Trung tâm và BV giám sát trên bản đồ | AC-03, AC-02 | App Tài xế: Dẫn đường, Nhiệm vụ hiện tại; App Trung tâm: Giám sát > Bản đồ ca |
| 11 | Xử trí tại hiện trường | Kíp đánh giá, xử trí; check-in bệnh nhân; cập nhật sinh hiệu, can thiệp vào ePCR; chụp ảnh hiện trường | AC-04 | App Tài xế: Phiếu cấp cứu (ePCR) |
| 12 | Vận chuyển | Theo dõi hành trình, ETA; kíp cập nhật diễn biến người bệnh cho BV; điều phối viên có thể đổi BV qua "Cập nhật phương án điều phối" | AC-03 / AC-04, AC-02 | App Tài xế: Cập nhật diễn biến bệnh nhân; App Trung tâm: tab Điều phối |
| 13 | Bàn giao | Xe đến: trực ban check-in xe (xác nhận thời gian xe cập bến); bác sĩ/nhân viên trực lập biên bản (chẩn đoán ban đầu, tình trạng sống/chết, sự cố y tế nếu có) và **nhấn Xác nhận bàn giao → ca tự chuyển Hoàn tất**. In biên bản là tùy chọn | AC-05 / AC-06, AC-13 | Web BV: tab Tiếp nhận & bàn giao |
| 14 | Hoàn thiện hồ sơ | Hồ sơ ca lưu tự động (mốc thời gian, điều phối, ePCR, biên bản). BV tiếp nhận có thể chỉnh sửa ePCR, mọi chỉnh sửa có log. Trạng thái xe sau bàn giao: quy tắc TBD | AC-06, AC-13 | A8 Hồ sơ cấp cứu; C2 Quản lý hồ sơ ePCR |

### 4.2. Luồng gán xe - kíp

- Khi có ca, form tạo ca hiển thị danh sách xe và kíp hiện tại (lấy từ **phân công ca trực**). Tổng đài viên thêm thủ công vào ca.
- Một ca có thể có **nhiều xe**, mỗi xe kèm kíp. **ASSUMPTION**: mỗi xe trong ca có một lệnh điều động và một trạng thái nhiệm vụ riêng.
- Khi kíp lên xe thì **xác nhận trên app**. App Tài xế / Kíp gắn theo xe, không cần đăng nhập. Cách dùng song song điện thoại cá nhân: TBD.
- Thêm/đổi xe hoặc đổi BV sau khi tạo ca: qua "Cập nhật phương án điều phối". Thu hồi lệnh của một xe → xe đó về **Sẵn sàng**.

### 4.3. Luồng người bệnh tự di chuyển đến cơ sở y tế

Tình huống: người bệnh/người thân đã gọi 115 nhưng không chờ xe; chủ động đưa đi bằng ô tô, xe máy...; hoặc Trung tâm xác định người bệnh có thể tự di chuyển.

Luồng: Phát sinh yêu cầu → Gọi 115/gửi yêu cầu trên ứng dụng → Xác nhận người bệnh tự di chuyển → Chia sẻ vị trí → Theo dõi hành trình → App gợi ý cơ sở y tế phù hợp, **người dân xác nhận điểm đến** → Hướng dẫn di chuyển → Gửi thông báo trước cho cơ sở tiếp nhận → Người bệnh đến nơi → Xác nhận bàn giao.

Quy tắc: hồ sơ ca **kết thúc khi xác nhận bàn giao** (giống mọi ca). TBD: trạng thái ca khi không có xe điều động.

Tính năng liên quan: A2 Theo dõi ca người bệnh tự di chuyển; C1 Nhận cảnh báo người bệnh tự đến; E3 (4 tính năng).

### 4.4. Luồng SOS của xe / kíp

Tình huống kích hoạt: xe tai nạn, va chạm nghiêm trọng, bị lật; xe không thể tiếp tục nhiệm vụ; bị cản trở nghiêm trọng; kíp/nhân viên y tế bị đe dọa, gây rối, hành hung; tình huống ảnh hưởng an toàn người bệnh/lái xe/kíp.

Luồng: Phát sinh sự cố → Kíp bấm **nút SOS trên phần mềm trên xe** (App Tài xế / Kíp) → Trung tâm nhận cảnh báo ưu tiên (vị trí xe, mã phương tiện, kíp, mã ca, trạng thái nhiệm vụ, thông tin liên lạc) → Xác định vị trí, tình trạng → Đánh giá khả năng tiếp tục nhiệm vụ → Theo dõi/hỗ trợ **hoặc** điều động xe/kíp thay thế → Tiếp tục xử lý ca trên cùng hồ sơ. Nếu chính kíp có người bị thương: ghi nhận thêm tình huống cấp cứu phát sinh.

Ảnh hiện trường trong và ngoài xe: có tính năng, chi tiết TBD.

### 4.5. Luồng điều phối lại / thay đổi phương án

Trường hợp: vị trí ban đầu sai; nguồn lực không còn sẵn sàng; xe sự cố; cần thêm xe/nhân lực; tình trạng người bệnh thay đổi; BV đổi trạng thái, từ chối hoặc không phản hồi; mất GPS/mất kết nối; phát sinh nhiều nạn nhân.

Hệ thống cho phép: thêm xe vào ca; chọn xe/kíp thay thế; thu hồi lệnh (xe về Sẵn sàng); cập nhật BV tiếp nhận; tính lại ETA; gửi lại thông tin cho các bên; **tiếp tục trên cùng mã ca**, không tạo hồ sơ tách rời; lưu lịch sử điều phối trước/sau. Tính năng: A5 Cập nhật phương án điều phối; Hủy / thu hồi lệnh điều động.

### 4.6. Luồng sự cố nhiều nạn nhân / sự cố hàng loạt

- Một ca có thể điều nhiều xe (mục 4.2).
- Một **sự kiện** gắn với nhiều phương tiện, nhiều kíp (khác cấp độ) và nhiều cơ sở tiếp nhận; vẫn theo dõi riêng từng người bệnh/nhiệm vụ.
- Tai nạn lớn (5-10 nạn nhân): điều phối đa bệnh viện đồng thời để tránh quá tải một cơ sở.
- Tạo **Major Incident**, triage nhiều nạn nhân, phân bổ nhiều bệnh viện, phối hợp liên ngành.
- TBD: chưa có tính năng tương ứng trong danh sách tính năng; chưa xác định giai đoạn xử lý.

### 4.7. Luồng gián đoạn kết nối / thiếu dữ liệu

Hệ thống cần: hiển thị thời điểm cập nhật gần nhất; cảnh báo khi mất kết nối hoặc vị trí không cập nhật; giữ thông tin đã nhận; app trên xe lưu tạm và đồng bộ lại; ưu tiên truyền lệnh điều động, vị trí, trạng thái nhiệm vụ, tình trạng người bệnh. Trung tâm phải có phương thức liên lạc dự phòng theo quy trình vận hành.

### 4.8. Luồng kết thúc / hủy ca không theo luồng chuẩn

- Ca không tiếp tục theo luồng chuẩn → ghi lý do kết thúc theo **danh mục nghiệp vụ**, không xóa/bỏ hồ sơ.
- Ví dụ: đóng ca không điều xe (tư vấn, gọi nhầm).
- Tính năng: "Kết thúc/ hủy ca kèm lý do", lý do lấy từ "Danh mục lý do kết thúc ca". TBD: nội dung danh mục.
- Người dân hủy yêu cầu trên app: được phép **trước hoặc trong khi xe đang điều động**. TBD: hành vi phía Trung tâm khi người dân hủy lúc xe đã được điều.
- KPI có "tỷ lệ không vận chuyển", "tỷ lệ cuộc gọi không phải cấp cứu" → cần phân biệt các lý do này trong danh mục (**ASSUMPTION**).

### 4.9. Luồng cảnh báo trước & phản hồi của bệnh viện

1. Khi phát lệnh (xác nhận tạo ca), hệ thống gửi đồng thời cảnh báo trước tới BV đã chọn: tóm tắt ca, tình trạng, sinh hiệu, chẩn đoán nghi ngờ, xử trí/can thiệp đã làm, ETA. Thông tin được cập nhật tiếp trong quá trình vận chuyển.
2. BV phản hồi khả năng tiếp nhận (Xác nhận/ Từ chối nhận bệnh nhân).
3. BV từ chối hoặc không phản hồi → cảnh báo trên App Trung tâm; điều phối viên xác nhận lại (giữ hoặc đổi BV). TBD: thời hạn được coi là "không phản hồi".
4. Đổi BV: qua "Cập nhật phương án điều phối"; BV mới nhận cảnh báo trước.
5. Kênh song song: Trung tâm bấm 1 nút "Gửi thông tin & Gọi" → BV nhận cuộc gọi kèm dữ liệu ca (GĐ 2.0). Cuộc gọi tới BV không bao giờ bị chặn theo trạng thái tiếp nhận.
6. Khi xe đến: check-in xe, biên bản bàn giao, Xác nhận bàn giao → ca Hoàn tất.

---

## 5. TRẠNG THÁI & VÒNG ĐỜI (STATES)

### 5.1. Trạng thái ca cấp cứu

`Đã điều động → Đang vận chuyển → Hoàn tất`

| Trạng thái | Sự kiện chuyển vào |
|---|---|
| Đã điều động | Tổng đài viên xác nhận tạo ca (đã gắn xe + kíp, BV) |
| Đang vận chuyển | Xe xác nhận (kíp xác nhận lên xe trên app) |
| Hoàn tất | Nhấn Xác nhận bàn giao (tự chuyển) |

- Trước khi xác nhận, form tạo ca chỉ là bản nháp, chưa thành ca.
- Nhánh ngoài luồng chuẩn: kết thúc/hủy kèm lý do theo danh mục. TBD: tên trạng thái (ví dụ "Đã hủy").
- TBD: với ca nhiều xe, ca chuyển "Đang vận chuyển" khi xe đầu tiên hay khi tất cả xe xác nhận; trạng thái ca tự di chuyển (không có xe).
- Trạng thái cấu hình được qua "Cấu hình trạng thái".

### 5.2. Trạng thái nhiệm vụ (lệnh điều động của từng xe)

`Chưa xác nhận → Đang di chuyển → Hoàn thành`

| Trạng thái lệnh | Sự kiện | Trạng thái ca tương ứng |
|---|---|---|
| Chưa xác nhận | Lệnh vừa phát | Đã điều động |
| Đang di chuyển | Kíp xác nhận lên xe | Đang vận chuyển |
| Hoàn thành | Xác nhận bàn giao | Hoàn tất |

Thu hồi lệnh: xe về Sẵn sàng. TBD: tên trạng thái của lệnh đã thu hồi.

Mốc thời gian dùng tính KPI (tiếp nhận, điều động, xuất phát, đến hiện trường, rời hiện trường, đến cơ sở y tế, hoàn tất bàn giao) và cơ chế "Tự động nhận biết mốc": quy tắc chi tiết TBD.

### 5.3. Trạng thái xe

`Sẵn sàng / Đang điều xe / Đang cấp cứu / Bảo trì`

- Thu hồi lệnh → **Sẵn sàng**.
- Quy tắc chuyển trạng thái khác (tự động hay thủ công, ai đặt Bảo trì): TBD.
- Danh mục trạng thái xe là danh mục cấu hình được (Danh mục & cấu hình > Trạng thái).

### 5.4. Trạng thái tiếp nhận của bệnh viện

`Đang nhận / Hạn chế / Tạm ngưng`

Không chặn cuộc gọi tới BV và không chặn việc chọn BV; là một yếu tố để điều phối viên cân nhắc khi chọn bệnh viện.

### 5.5. Xác nhận lệnh của kíp

Kíp chỉ **xác nhận lên xe**. Không có luồng từ chối lệnh và không có xử lý hết hạn xác nhận.

### 5.6. Trạng thái yêu cầu của người dân (App Người dân)

Hiển thị **giống App Trung tâm**: Đã điều động / Đang vận chuyển / Hoàn tất (và trạng thái hủy). **ASSUMPTION**: cần thêm một trạng thái trước khi ca được tạo (ví dụ "Đã gửi - chờ tiếp nhận"), vì yêu cầu chưa thành ca cho tới khi tổng đài viên xác nhận.

---

## 6. PHÂN LOẠI NGHIỆP VỤ & BUSINESS RULES

### 6.1. Mức độ khẩn cấp

3 mức: **Vận chuyển / Khẩn cấp / Nguy kịch**. Mức độ gắn với **ca**, tách khỏi loại xe, vì một ca có thể điều nhiều xe khác loại.

### 6.2. Phân loại phương tiện

| Type | Tên | Vai trò |
|---|---|---|
| **Type A** | Xe vận chuyển | Vận chuyển người bệnh không cần năng lực cấp cứu/hồi sức chuyên sâu |
| **Type B** | Xe cấp cứu cơ bản | Tiếp cận hiện trường, cấp cứu cơ bản, vận chuyển |
| **Type C** | Xe cấp cứu chuyên sâu / Mobile ICU | Ca nguy kịch, hồi sức, theo dõi, xử trí chuyên sâu |

### 6.3. Business Rules

| Mã | Rule |
|---|---|
| BR-01 | Mỗi yêu cầu cấp cứu = **một hồ sơ ca có mã định danh duy nhất**; mọi dữ liệu (cuộc gọi, ghi âm, lệnh, hành trình, ePCR, bàn giao) liên kết theo mã ca |
| BR-02 | Điều phối lại, đổi xe, đổi BV, tự di chuyển: **giữ nguyên mã ca**, không tạo hồ sơ tách rời; lưu lịch sử trước/sau |
| BR-03 | Ca không theo luồng chuẩn: kết thúc với **lý do từ danh mục**, không xóa hồ sơ ca |
| BR-04 | Mọi thay đổi quan trọng lưu vết: thời điểm, người thực hiện, nội dung, lý do |
| BR-05 | Các mốc thời gian quan trọng ghi **tự động** hoặc xác nhận ngay khi phát sinh |
| BR-06 | Hồ sơ cấp cứu lưu tự động: giờ gọi đến, ai tiếp nhận đầu tiên, tài xế nào nhận lúc mấy giờ, toàn bộ lịch sử mốc |
| BR-07 | Một sự kiện có thể gắn nhiều người bệnh, nhiều xe/kíp (khác cấp độ), nhiều BV; theo dõi riêng từng người bệnh/nhiệm vụ |
| BR-08 | Thao tác ngắn gọn; không bắt tổng đài viên/kíp nhập quá nhiều khi đang xử lý khẩn cấp; mỗi trường dữ liệu phải có mục đích rõ |
| BR-09 | Khi tổng đài viên nhấc máy hoặc nhận yêu cầu từ app, form tạo ca tự mở; ca chỉ được tạo khi tổng đài viên xác nhận. Xác nhận tạo ca đồng thời là phát lệnh điều động |
| BR-10 | Một ca có thể gắn nhiều xe, mỗi xe kèm kíp; xe và kíp được chọn thủ công từ danh sách hiện tại theo phân công ca trực |
| BR-11 | Bệnh viện tiếp nhận được chọn khi phát lệnh và có thể cập nhật sau. Trạng thái tiếp nhận của BV không chặn cuộc gọi hay lựa chọn, chỉ là yếu tố tham khảo |
| BR-12 | BV từ chối hoặc không phản hồi → cảnh báo; điều phối viên phải xác nhận lại |
| BR-13 | Mọi ca kết thúc khi xác nhận bàn giao; nhấn Xác nhận bàn giao → ca tự chuyển Hoàn tất. In biên bản là tùy chọn |
| BR-14 | Thu hồi lệnh → xe về Sẵn sàng |
| BR-15 | BV tiếp nhận được thêm, xem, sửa, xóa ePCR (kể cả dữ liệu do kíp nhập); mọi chỉnh sửa được ghi log |
| BR-16 | Người dân phải đăng ký và xác thực số điện thoại trước khi gửi yêu cầu cấp cứu |
| BR-17 | Người dân chỉ hủy được yêu cầu trước hoặc trong khi xe đang điều động |
| BR-18 | Khi tự di chuyển, hệ thống gợi ý cơ sở y tế; người dân phải xác nhận điểm đến |

---

## 7. FEATURE CATALOG (DANH SÁCH TÍNH NĂNG)

Quy ước cột:

- **Giai đoạn**: giai đoạn triển khai chính thức (1.0 / 2.0). `-` = có trong site map nhưng chưa xếp giai đoạn. Với **prototype**: triển khai toàn bộ tính năng có trong site map (mục 8), không phân biệt giai đoạn.
- **Tác nhân**: **Thủ công** (người dùng nhập, chọn, xác nhận hoặc chủ động tra cứu); **Tự động** (hệ thống tự thực hiện hoặc tự tính); **Hệ thống gợi ý** (hệ thống đề xuất theo quy tắc, người dùng chọn/xác nhận); **AI gợi ý** (AI xử lý và đề xuất, người dùng kiểm tra rồi xác nhận).
- **Màn hình**: vị trí trong site map (mục 8).

### 7.1. A. Web Điều hành trung tâm (App Trung tâm)

| Epic | Tính năng | Giai đoạn | Tác nhân | Màn hình | Mô tả / ghi chú |
|---|---|---|---|---|---|
| A1. Tổng đài | Tiếp nhận cuộc gọi | 1.0 | Thủ công | Tổng đài > Cuộc gọi hiện tại | Qua tổng đài IP |
| A1 | Chi tiết cuộc gọi | 1.0 | Tự động | Cuộc gọi hiện tại | Popup: số điện thoại, tên chủ thuê bao định danh, vị trí tương đối theo Cell-ID |
| A1 | Lịch sử cuộc gọi | 1.0 | Tự động | Cuộc gọi hiện tại > tab Lịch sử cuộc gọi | |
| A1 | Ghi âm cuộc gọi | 1.0 | Tự động | Cuộc gọi hiện tại; Chi tiết hồ sơ > tab Ghi âm cuộc gọi | Gắn vào ca; nghe lại trong hồ sơ |
| A1 | Xem danh bạ bệnh viện | 1.0 | Thủ công | Cuộc gọi hiện tại > tab Danh bạ bệnh viện | Quản lý danh bạ ở mục 7.4 |
| A1 | Chuyển thông tin sang lực lượng phối hợp (Công An/ Cứu hỏa) | 2.0 | Thủ công | Cuộc gọi hiện tại > tab Chuyển tiếp; Liên lạc & phối hợp | Prototype: một nút "Chuyển" để demo; cách thức cụ thể TBD |
| A2. Tạo & quản lý ca | Tạo ca cấp cứu | 1.0 | Thủ công | Cấp cứu > Danh sách ca > Form Tạo ca cấp cứu | Form tự mở khi tổng đài viên nhấc máy hoặc nhận yêu cầu từ app. Trong form: thông tin ban đầu, vị trí, mức độ; danh sách xe và kíp hiện tại (theo phân công ca trực) để thêm thủ công một hoặc nhiều xe + kíp; chọn bệnh viện. Xác nhận → ca được tạo (Đã điều động) và phát lệnh (mục 4.1, 4.2) |
| A2 | Nhập thông tin bệnh nhân | 1.0 | Thủ công | Form Tạo ca cấp cứu | |
| A2 | AI hỗ trợ điền biểu mẫu từ nội dung cuộc gọi | 2.0 | AI gợi ý | - | Bóc tách loại sự cố, số người bị nạn, địa chỉ/ngõ hẻm |
| A2 | Danh sách ca đang xử lý | 1.0 | Tự động | Giám sát > Bản đồ ca; Thanh trạng thái ca bệnh | |
| A2 | Tìm kiếm ca cấp cứu | 1.0 | Thủ công | Cấp cứu > Tra cứu hồ sơ (ca đã kết thúc/hủy); Giám sát > Bản đồ ca (lọc ca đang mở) | Theo mã ca, SĐT, địa chỉ, thời gian, trạng thái |
| A2 | Kết thúc/ hủy ca kèm lý do | 1.0 | Thủ công | Thông tin ca > tab Điều phối | Lý do lấy từ Danh mục lý do kết thúc ca |
| A2 | Theo dõi ca người bệnh tự di chuyển | 2.0 | Thủ công | - | Mục 4.3 |
| A3. Xác định vị trí | Định vị trí cuộc gọi tự động | 2.0 | Tự động | Form Tạo ca cấp cứu | Vị trí tương đối theo Cell-ID (phụ thuộc nhà mạng); GPS từ App Người dân |
| A3 | Định vị trí cuộc gọi thủ công | 1.0 | Thủ công | Form Tạo ca cấp cứu | Tìm địa chỉ + ghim bản đồ; điểm mốc |
| A4. Đánh giá & phân loại | Phân loại mức độ khẩn cấp | 1.0 | Thủ công | Form Tạo ca cấp cứu | Mức độ của ca: Vận chuyển / Khẩn cấp / Nguy kịch; tách khỏi loại xe (mục 6.1) |
| A4 | Gợi ý mức độ khẩn cấp | 2.0 | Hệ thống gợi ý | - | Bộ câu hỏi theo tình huống. Cơ chế gợi ý chi tiết: TBD |
| A5. Điều phối | Phát lệnh điều động | 1.0 | Thủ công | Thông tin ca > tab Điều phối | Thực hiện khi xác nhận tạo ca; gửi đồng thời tới các xe và BV tiếp nhận (mục 4.1) |
| A5 | Gợi ý xe/ kíp phù hợp | 2.0 | Hệ thống gợi ý | Form Tạo ca cấp cứu; tab Điều phối | Cơ chế gợi ý (quy tắc hay AI): TBD |
| A5 | Gợi ý bệnh viện phù hợp | 2.0 | Hệ thống gợi ý | Form Tạo ca cấp cứu; tab Điều phối | Trạng thái tiếp nhận của BV là yếu tố tham khảo, không chặn. Cơ chế gợi ý (quy tắc hay AI): TBD |
| A5 | Xác nhận phương án điều phối | - | Thủ công | tab Điều phối | |
| A5 | Cập nhật phương án điều phối | 1.0 | Thủ công | tab Điều phối | Thêm/đổi xe, đổi BV sau khi tạo ca; giữ nguyên mã ca (BR-02) |
| A5 | Hủy / thu hồi lệnh điều động | 1.0 | Thủ công | tab Điều phối | Thu hồi lệnh → xe về Sẵn sàng (BR-14) |
| A6. Giám sát hành trình | Bản đồ điều hành và theo dõi timeline/ vị trí xe thời gian thực | 1.0 | Tự động | Giám sát > Bản đồ ca | Theo dõi ca/xe/kíp trực; tốc độ, ETA; timeline trạng thái nhiệm vụ |
| A6 | Cập nhật thời gian dự kiến đến (ETA) | 1.0 | Tự động | Bản đồ ca | |
| A6 | Cảnh báo bất thường hành trình | 2.0 | Tự động | Bản đồ ca; Thông báo toàn cục | Mất GPS, mất kết nối, dừng bất thường |
| A6 | Xử lý tín hiệu SOS | 2.0 | Thủ công | Popup Cảnh báo SOS | Mục 4.4 |
| A6 | Xem camera hành trình | 2.0 | Thủ công | Bản đồ ca ("Xem ảnh hành trình") | Xem ảnh hiện trường trong và ngoài xe gửi về Trung tâm; chi tiết TBD |
| A7. Liên lạc | Gọi nhanh kíp / bệnh viện | 2.0 | Thủ công | Cấp cứu > Liên lạc & phối hợp | Gọi từ màn hình ca |
| A7 | Chia sẻ thông tin ca cho lực lượng phối hợp | 2.0 | Tự động | Liên lạc & phối hợp | Prototype: nút "Chuyển" để demo; cách thức cụ thể TBD |
| A7 | Gửi hướng dẫn sơ cứu cho người báo tin | 2.0 | Thủ công | Liên lạc & phối hợp | |
| A8. Hồ sơ cấp cứu | Ghi nhận mốc thời gian tự động | 1.0 | Tự động | Chi tiết hồ sơ > tab Mốc thời gian | BR-05, BR-06 |
| A8 | Quản lý hồ sơ hình ảnh/ thao tác trong ca | 2.0 | Tự động | Thông tin ca > tab Hồ sơ, tab Lịch sử (Log) | |
| A8 | Xem hồ sơ ca cấp cứu | 1.0 | Thủ công | Tra cứu hồ sơ > Chi tiết hồ sơ | Gồm thông tin & điều phối, mốc thời gian, ghi âm, ePCR |
| A8 | Xuất hồ sơ | 1.0 | Thủ công | Chi tiết hồ sơ | PDF |
| A9. Quản lý nguồn lực | Quản lý trạng thái xe sử dụng/ đang sử dụng | 1.0 | Tự động + Thủ công | Giám sát > Tình trạng xe | Sẵn sàng / Đang điều xe / Đang cấp cứu / Bảo trì (mục 5.3) |
| A9 | Quản lý các bệnh viện sẵn sàng | 2.0 | Thủ công | Giám sát > Tình trạng bệnh viện | Đang nhận / Hạn chế / Tạm ngưng; không chặn điều phối |
| A9 | Quản lý các kíp sẵn sàng | - | - | Giám sát > Tình trạng kíp | |
| A9 | Theo dõi phân công xe – nhân sự trong ca | 1.0 | Tự động | Ca trực > Phân công ca trực | Xe nào - ai giữ trong ca; là nguồn danh sách xe và kíp hiện tại khi tạo ca |
| A9 | Quản lý thành viên kíp | 2.0 | Thủ công | Ca trực > Phân công ca trực | |
| A9 | Quản lý tổ xe | 2.0 | Thủ công | Ca trực > Lịch trực | |
| A9 | Quản lý lịch trực | 2.0 | Thủ công | Ca trực > Lịch trực | |
| A10. Dashboard & báo cáo | Dashboard | 1.0 | Tự động | Báo cáo > Tổng quan | Mục 11 |
| A10 | Theo dõi KPI thời gian đáp ứng | 2.0 | Tự động | Báo cáo > Tổng quan | Mục 11 |
| A10 | Báo cáo thống kê | 2.0 | Tự động | Báo cáo > Báo cáo thống kê; Báo cáo > Chi tiết | Xuất Excel/PDF |
| A10 | Bản đồ số xe đang cấp cứu | 1.0 | Tự động | Báo cáo > Tổng quan | |

### 7.2. B. App Tài xế / Kíp cấp cứu

| Epic | Tính năng | Giai đoạn | Tác nhân | Màn hình | Mô tả / ghi chú |
|---|---|---|---|---|---|
| B1. Tài khoản & ca trực | Chọn xe vào ca | 1.0 | Thủ công | Thông tin ca | **ASSUMPTION**: không áp dụng vì app gắn theo xe, không đăng nhập; chờ xác nhận |
| B1 | Cập nhật trạng thái sẵn sàng | 1.0 | Thủ công | Thông tin ca | Quy tắc chuyển trạng thái xe: TBD |
| B1 | Kết thúc ca | 1.0 | Thủ công | Thông tin ca | TBD: còn cần không khi ca trực do Trung tâm phân công |
| B2. Quản lý nhiệm vụ | Nhận lệnh điều động | 1.0 | Tự động | Popup Lệnh điều động mới | |
| B2 | Xem thông tin ca | 1.0 | Thủ công | Thông tin ca | Vị trí ngõ hẻm, mức độ, tình trạng bệnh nhân, phương án sơ cứu tạm thời của bác sĩ chỉ đạo |
| B2 | Xác nhận lệnh (lên xe) | 1.0 | Thủ công | Popup Lệnh điều động mới | Kíp xác nhận khi lên xe → lệnh Đang di chuyển, ca Đang vận chuyển. Không có từ chối lệnh (tên cũ: "Xác nhận / từ chối lệnh") |
| B2 | Cập nhật mốc trạng thái nhiệm vụ | 1.0 | Thủ công | Nhiệm vụ hiện tại | Chưa xác nhận / Đang di chuyển / Hoàn thành (mục 5.2); quy tắc mốc chi tiết TBD |
| B2 | Tự động nhận biết mốc | 1.0 | Tự động | Nhiệm vụ hiện tại | Cơ chế: TBD |
| B3. Định vị & dẫn đường | Dẫn đường | 1.0 | Tự động | Dẫn đường | Đến hiện trường/bệnh viện |
| B3 | Chia sẻ vị trí liên tục | 1.0 | Tự động | (chạy nền) | |
| B4. Hồ sơ ePCR | Check-in bệnh nhân | 1.0 | Thủ công | Phiếu cấp cứu (ePCR) | |
| B4 | Ghi nhận sinh hiệu & can thiệp | 2.0 | Thủ công | Phiếu cấp cứu (ePCR) | Sinh hiệu, can thiệp, thuốc |
| B4 | Chụp ảnh hiện trường | 2.0 | Thủ công | Phiếu cấp cứu (ePCR): "Lưu ảnh hồ sơ/ tệp đính kèm" | Ảnh hiện trường trong và ngoài xe gửi về Trung tâm; chi tiết TBD |
| B4 | Cập nhật diễn biến bệnh nhân | 2.0 | Thủ công | Phiếu cấp cứu (ePCR) | Cập nhật cho BV trên đường |
| B4 | Xem thông tin y tế khẩn cấp của người bệnh | 2.0 | Tự động | Phiếu cấp cứu (ePCR) | **ASSUMPTION**: dữ liệu lấy từ thông tin người dân khai ở E4 |
| B5. Khẩn cấp & hỗ trợ | Kích hoạt SOS | 2.0 | Thủ công | Nút SOS (thành phần nổi) | Nút trên phần mềm trên xe; mục 4.4 |
| B5 | Yêu cầu hỗ trợ | 2.0 | Thủ công | Nút SOS: "Yêu cầu hỗ trợ từ trung tâm" | Ví dụ: hỗ trợ phân luồng giao thông khi tắc đường |

Ghi chú: App Tài xế / Kíp gắn theo xe, **không cần đăng nhập** (không có tính năng đăng nhập/đổi mật khẩu/đăng xuất trên app này).

### 7.3. C. Web Bệnh viện tiếp nhận

| Epic | Tính năng | Giai đoạn | Tác nhân | Màn hình | Mô tả / ghi chú |
|---|---|---|---|---|---|
| C1. Thông báo tiếp nhận bệnh nhân | Nhận cảnh báo xe đang đến | 1.0 | Tự động | Tiếp nhận hồ sơ > Cảnh báo ca đang đến [Popup] | Thông tin ca + ETA |
| C1 | Nhận cảnh báo người bệnh tự đến | 2.0 | Tự động | Tiếp nhận hồ sơ > Cảnh báo ca đang đến [Popup] | Mục 4.3 |
| C1 | Xem tóm tắt ca & ETA | 1.0 | Thủ công | Tiếp nhận hồ sơ > Chi tiết ca | Kèm vị trí xe |
| C1 | Phản hồi khả năng tiếp nhận | 1.0 | Thủ công | Tiếp nhận hồ sơ > Chi tiết ca > Phản hồi khả năng tiếp nhận [Popup] | Xác nhận/ Từ chối nhận bệnh nhân. Từ chối hoặc không phản hồi → cảnh báo trên App Trung tâm, điều phối viên xác nhận lại |
| C1 | Nhận cuộc gọi kèm dữ liệu ca | 2.0 | Tự động | Tiếp nhận hồ sơ > Cuộc gọi kèm dữ liệu ca [Popup] | Trung tâm bấm 1 nút "Gửi thông tin & Gọi" |
| C2. Tiếp nhận & bàn giao | Check-in xe đến | 1.0 | Thủ công | Tiếp nhận hồ sơ > Chi tiết ca > tab Tiếp nhận & bàn giao | Xác nhận thời gian xe cập bến |
| C2 | Lập biên bản bàn giao | 1.0 | Thủ công | Tiếp nhận hồ sơ > Chi tiết ca > tab Tiếp nhận & bàn giao > Form Biên bản bàn giao | Chẩn đoán ban đầu, tình trạng sống/chết, sự cố y tế nếu có. Nhấn **Xác nhận bàn giao** → ca tự chuyển Hoàn tất |
| C2 | Cập nhật trạng thái tiếp nhận | 1.0 | Thủ công | Tiếp nhận hồ sơ > Cập nhật trạng thái tiếp nhận | Đang nhận / Hạn chế / Tạm ngưng; không chặn cuộc gọi hay điều phối |
| C2 | Khai báo chuyên khoa / năng lực | 2.0 | Thủ công | Tiếp nhận hồ sơ > Khai báo chuyên khoa / năng lực | |
| C2 | In / xuất biên bản | 1.0 | Thủ công | Tiếp nhận hồ sơ > Chi tiết ca > tab Tiếp nhận & bàn giao | Tùy chọn |
| C2 | Quản lý hồ sơ ePCR | 1.0 | Thủ công | Tiếp nhận hồ sơ > Chi tiết ca > tab Phiếu cấp cứu (ePCR) | BV tiếp nhận được **CRUD** (thêm, xem, sửa, xóa) ePCR, kể cả dữ liệu do kíp nhập; mọi chỉnh sửa có log |
| C3. Lịch sử | Danh sách ca đã tiếp nhận | 2.0 | Thủ công | Báo cáo > Chi tiết | |
| C3 | Thống kê tiếp nhận | 2.0 | Tự động | Báo cáo > Thống kê tiếp nhận | |

### 7.4. D. Quản trị & dữ liệu dùng chung

| Epic | Tính năng | Giai đoạn | Tác nhân | Màn hình (App Trung tâm) |
|---|---|---|---|---|
| D1. Người dùng & phân quyền | Quản lý tài khoản người dùng | 1.0 | Thủ công | Quản trị hệ thống > Người dùng |
| D1 | Xác thực người dùng | 1.0 | Thủ công | Tài khoản: đăng nhập, đổi mật khẩu, đăng xuất (mọi app) |
| D1 | Phân quyền theo vai trò & đơn vị | 1.0 | Thủ công | Quản trị hệ thống > Phân quyền |
| D2. Danh mục | Danh mục xe | 2.0 | Thủ công | Danh mục & cấu hình > Xe cứu thương |
| D2 | Danh mục tổ xe | 2.0 | Thủ công | Chưa có màn riêng trong site map (Ca trực > Lịch trực có "tổ xe") |
| D2 | Danh mục nhân sự | 2.0 | Thủ công | Chưa có màn riêng trong site map |
| D2 | Danh mục bệnh viện / cơ sở y tế | 2.0 | Thủ công | Danh mục & cấu hình > Bệnh viện |
| D2 | Quản lý danh bạ bệnh viện | - | Thủ công | Danh mục & cấu hình > Danh bạ bệnh viện |
| D2 | Danh mục loại tình huống | 2.0 | Thủ công | Danh mục & cấu hình > Loại tình huống |
| D2 | Danh mục trang thiết bị | 2.0 | Thủ công | Danh mục & cấu hình > Trang thiết bị trên xe |
| D2 | Danh mục lý do kết thúc ca | 2.0 | Thủ công | Danh mục & cấu hình > Lý do kết thúc ca |
| D2 | Danh mục trạng thái xe | - | Thủ công | Danh mục & cấu hình > Trạng thái |
| D3. Cấu hình | Cấu hình trạng thái | 2.0 | Thủ công | Danh mục & cấu hình > Trạng thái (**ASSUMPTION**) |
| D3 | Cấu hình mẫu form | 2.0 | Thủ công | Danh mục & cấu hình > Mẫu biểu |
| D4. Truy vết & an toàn | Nhật ký thao tác | 2.0 | Tự động | Quản trị hệ thống > Nhật ký thao tác |
| D4 | Sao lưu & khôi phục | 2.0 | Tự động | Quản trị hệ thống > Sao lưu & khôi phục |

Lưu ý: danh mục (D2) và cấu hình (D3) ở 2.0 nhưng các tính năng 1.0 (tạo ca, điều phối, chọn xe vào ca...) **phụ thuộc** dữ liệu danh mục xe, bệnh viện, nhân sự, loại tình huống. **ASSUMPTION**: GĐ 1.0 dùng dữ liệu nạp sẵn (seed) thay cho màn quản lý danh mục.

### 7.5. E. Ứng dụng dành cho người dân (App Người dân)

| Epic | Tính năng | Giai đoạn | Tác nhân | Màn hình | Mô tả / ghi chú |
|---|---|---|---|---|---|
| E1. Gửi yêu cầu cấp cứu | Yêu cầu hỗ trợ từ trung tâm | 2.0 | Thủ công | Trang chủ > Gọi cấp cứu (Button "SOS 1 chạm") | Yêu cầu vào App Trung tâm như cuộc gọi đến; ca được tạo khi tổng đài viên xác nhận |
| E1 | Tự động gửi vị trí GPS | 2.0 | Tự động | (chạy nền) | |
| E1 | Xác thực số điện thoại | 2.0 | Tự động | Đăng ký sử dụng > Xác thực số điện thoại | Bắt buộc trước khi gửi yêu cầu |
| E2. Theo dõi yêu cầu | Xem trạng thái yêu cầu | 2.0 | Tự động | Yêu cầu cấp cứu ("Quản lý yêu cầu cấp cứu") | Trạng thái giống App Trung tâm (mục 5.6) |
| E2 | Theo dõi xe đang đến & ETA | 2.0 | Tự động | Yêu cầu cấp cứu | |
| E2 | Nhận hướng dẫn sơ cứu | 2.0 | Tự động | Yêu cầu cấp cứu | |
| E2 | Nhắn tin / gọi lại trung tâm | 2.0 | Thủ công | Yêu cầu cấp cứu | |
| E2 | Hủy yêu cầu cấp cứu | 2.0 | Thủ công | Chưa có trong site map | Chỉ được hủy trước hoặc trong khi xe đang điều động |
| E2 | Ghi nhận sinh hiệu & can thiệp | - | Thủ công | Yêu cầu cấp cứu | Giữ theo site map |
| E3. Tự di chuyển đến cơ sở y tế | Xác nhận tự di chuyển | 2.0 | Thủ công | Yêu cầu cấp cứu | Mục 4.3 |
| E3 | Chia sẻ vị trí trên hành trình | 2.0 | Tự động | Yêu cầu cấp cứu | |
| E3 | Gợi ý cơ sở y tế phù hợp & dẫn đường | 2.0 | Hệ thống gợi ý | Chưa có trong site map | Người dân phải xác nhận điểm đến |
| E3 | Xác nhận đã đến cơ sở y tế | 2.0 | Thủ công | Chưa có trong site map | |
| E4. Thông tin cá nhân | Khai báo thông tin y tế khẩn cấp (nhóm máu, dị ứng, bệnh nền) | 2.0 | Thủ công | Hồ sơ cá nhân > Thông tin y tế khẩn cấp | |
| E4 | Khai báo người liên hệ khẩn cấp | 2.0 | Thủ công | Hồ sơ cá nhân > Người liên hệ khẩn cấp | |
| E4 | Tra cứu cơ sở y tế gần nhất | 2.0 | Thủ công | Danh sách cơ sở y tế | |
| E4 | Quản lý chia sẻ dữ liệu cá nhân | 2.0 | Thủ công | Đăng ký sử dụng > Đồng ý chia sẻ dữ liệu; Hồ sơ cá nhân > Quyền riêng tư | Xác nhận, xem lại, thu hồi đồng ý |
| E4 | Lịch sử yêu cầu cấp cứu | 2.0 | Thủ công | Hồ sơ cá nhân > Lịch sử yêu cầu | |


---

## 8. SITE MAP & MÀN HÌNH (CHO PROTOTYPE)

Loại thành phần giữ nguyên: Nhóm menu, Màn hình, Tab, Form, Popup, Header bar, Thành phần toàn cục, Thành phần nổi, Menu người dùng, Button.

### 8.1. App Trung tâm (Web điều hành)

```
App Trung tâm
├── Tổng đài [Nhóm menu]
│   └── Cuộc gọi hiện tại [Màn hình] - Tiếp nhận cuộc gọi; Chi tiết cuộc gọi; Ghi âm cuộc gọi
│       ├── Lịch sử cuộc gọi [Tab]
│       ├── Danh bạ bệnh viện [Tab] - Xem danh bạ bệnh viện
│       └── Chuyển tiếp [Tab] - Chuyển thông tin sang lực lượng phối hợp (Công An/ Cứu hỏa)
├── Thanh công cụ
│   ├── Cảnh báo SOS [Popup] - Xử lý tín hiệu SOS
│   ├── Thông báo [Thành phần toàn cục] - Tổng hợp cảnh báo: cuộc gọi nhỡ, bất thường hành trình,
│   │                                      bệnh viện phản hồi (từ chối / không phản hồi)
│   └── Tài khoản [Menu người dùng] - Đăng nhập, đổi mật khẩu, đăng xuất
├── Thanh trạng thái ca bệnh [Header bar] - Hiển thị xuyên suốt các màn về các ca cấp cứu hiện tại
├── Cấp cứu [Nhóm menu]
│   ├── Danh sách ca [Màn hình] - Danh sách các ca cấp cứu
│   │   ├── Tạo ca cấp cứu [Form, tự mở khi nhấc máy] - Tạo ca cấp cứu; Nhập thông tin bệnh nhân;
│   │   │                            Định vị trí cuộc gọi tự động; Định vị trí cuộc gọi thủ công; Phân loại mức độ khẩn cấp;
│   │   │                            Chọn xe + kíp hiện tại (nhiều xe); Chọn bệnh viện; Xác nhận (= tạo ca + phát lệnh)
│   │   ├── Thông tin ca cấp cứu [Tab]
│   │   │   ├── Tổng quan: khu vực bản đồ nhỏ giám sát vị trí xe và ca cấp cứu;
│   │   │   │   khung thông tin tổng quan: Thời điểm phát hiện cuộc gọi, người tiếp nhận, thời gian gọi xe,
│   │   │   │   xe được điều động, thời gian kết thúc, người nhận, kết quả xử lý
│   │   │   └── Chi tiết:
│   │   │       ├── Tab Tổng quan: thông tin chung người bệnh, nguyên nhân/triệu chứng
│   │   │       ├── Tab Phân công / Điều phối: xe nhận ca, danh sách kíp cấp cứu, người nhận, bệnh viện tiếp nhận
│   │   │       ├── Tab Hồ sơ: lưu trữ toàn bộ hình ảnh và tệp tin (file) đính kèm liên quan đến ca
│   │   │       └── Tab Lịch sử (Log): toàn bộ nhật ký sự kiện (log nhận cuộc gọi, log điều xe, log đổi trạng thái...)
│   │   └── Điều phối [Tab] - Phát lệnh điều động; Xác nhận phương án điều phối; Cập nhật phương án điều phối;
│   │                         Hủy/ thu hồi lệnh điều động; Gợi ý xe/ kíp phù hợp; Gợi ý bệnh viện phù hợp;
│   │                         Kết thúc / hủy ca kèm lý do (lấy lý do từ danh mục Lý do kết thúc ca)
│   ├── Liên lạc & phối hợp [Màn hình] - Gọi nhanh kíp / bệnh viện; Chuyển thông tin sang lực lượng phối hợp;
│   │                                     Chia sẻ thông tin ca cho lực lượng phối hợp; Gửi hướng dẫn sơ cứu cho người báo tin
│   ├── Tra cứu hồ sơ [Màn hình] - Tìm kiếm ca (trên ca đã kết thúc / hủy)
│   └── Chi tiết hồ sơ [Màn hình, mở từ Tra cứu hồ sơ] - Xem hồ sơ ca cấp cứu; Xuất hồ sơ PDF
│       ├── Thông tin & điều phối [Tab]
│       ├── Mốc thời gian [Tab] - Hiển thị kết quả Ghi nhận mốc thời gian tự động
│       ├── Ghi âm cuộc gọi [Tab] - Nghe lại bản ghi âm
│       └── Phiếu cấp cứu (ePCR) [Tab] - Xem dữ liệu ePCR
├── Tiếp nhận hồ sơ [Nhóm menu] (phần bệnh viện tiếp nhận của BVĐK)
│   ├── Cảnh báo ca đang đến [Popup] - Nhận cảnh báo xe đang đến; Nhận cảnh báo người bệnh tự đến
│   ├── Cuộc gọi kèm dữ liệu ca [Popup] - Nhận cuộc gọi kèm dữ liệu ca
│   ├── Tài khoản [Menu người dùng]
│   ├── Ca đang đến [Màn hình] - Danh sách xe / người bệnh đang đến bệnh viện
│   ├── Chi tiết ca [Màn hình, mở từ Ca đang đến] - Xem chi tiết thông tin bệnh nhân; Xem tóm tắt ca & ETA
│   │   ├── Phản hồi khả năng tiếp nhận [Popup] - Xác nhận/ Từ chối nhận bệnh nhân
│   │   ├── Phiếu cấp cứu (ePCR) [Tab] - Quản lý hồ sơ ePCR (CRUD)
│   │   └── Tiếp nhận & bàn giao [Tab] - Check-in xe đến; Xác nhận bàn giao
│   │       └── Biên bản bàn giao [Form] - Lập biên bản bàn giao: chẩn đoán ban đầu, tình trạng sống/chết,
│   │                                       sự cố y tế nếu có; In xuất biên bản (tùy chọn)
│   ├── Cập nhật trạng thái tiếp nhận [Màn hình] - Đang nhận / Hạn chế / Tạm ngưng; không chặn cuộc gọi hay điều phối
│   ├── Khai báo chuyên khoa / năng lực [Màn hình] - Khai báo năng lực chuyên khoa của bệnh viện
│   └── Báo cáo [Nhóm menu]
│       ├── Chi tiết [Màn hình] - Danh sách ca đã tiếp nhận
│       └── Thống kê tiếp nhận [Màn hình] - Thống kê tiếp nhận của BVĐK
├── Giám sát [Nhóm menu]
│   ├── Bản đồ ca [Màn hình] - Bản đồ điều hành và theo dõi vị trí xe; theo dõi ca xử lý thời gian thực;
│   │                          theo dõi ca/ xe/ kíp trực; Cảnh báo bất thường hành trình; Danh sách ca đang xử lý;
│   │                          Tìm kiếm ca (lọc trong ca đang mở); Xem ảnh hành trình
│   ├── Tình trạng xe [Màn hình] - Quản lý trạng thái xe (Sẵn sàng / Đang điều xe / Đang cấp cứu / Bảo trì)
│   ├── Tình trạng kíp [Màn hình] - Quản lý các kíp sẵn sàng
│   └── Tình trạng bệnh viện [Màn hình] - Quản lý các bệnh viện sẵn sàng
├── Ca trực [Nhóm menu]
│   ├── Phân công ca trực [Màn hình] - Theo dõi phân công xe - nhân sự trong ca; Khai báo thành viên kíp
│   └── Lịch trực [Màn hình] - Quản lý lịch trực / tổ xe
├── Báo cáo [Nhóm menu]
│   ├── Tổng quan [Màn hình] - Dashboard; Bản đồ số xe đang cấp cứu; Theo dõi KPI thời gian đáp ứng
│   ├── Chi tiết [Màn hình] - Chi tiết & xuất báo cáo KPI: Danh sách ca đã tiếp nhận, Thống kê tiếp nhận, Thời gian xử lý..
│   └── Báo cáo thống kê [Màn hình] - Báo cáo thống kê
├── Danh mục & cấu hình [Nhóm menu]
│   ├── Xe cứu thương - Danh mục xe
│   ├── Bệnh viện - Danh mục bệnh viện / cơ sở y tế
│   ├── Danh bạ bệnh viện - Quản lý danh bạ bệnh viện
│   ├── Loại tình huống - Danh mục loại tình huống
│   ├── Trạng thái - Danh mục trạng thái xe
│   ├── Trang thiết bị trên xe - Danh mục trang thiết bị
│   ├── Lý do kết thúc ca - Danh mục lý do kết thúc ca
│   └── Mẫu biểu - Cấu hình mẫu form
└── Quản trị hệ thống [Nhóm menu]
    ├── Người dùng - Quản lý tài khoản người dùng
    ├── Phân quyền - Phân quyền theo vai trò & đơn vị
    ├── Nhật ký thao tác - Nhật ký thao tác
    └── Sao lưu & khôi phục - Sao lưu & khôi phục
```

Ghi chú cấu trúc: "Tạo ca cấp cứu", "Thông tin ca cấp cứu", "Điều phối" ở cấp 3 dưới "Danh sách ca"; nhóm "Tiếp nhận hồ sơ" nằm trong App Trung tâm.

**Hành vi chính**:

- Nhấc máy (hoặc nhận yêu cầu từ App Người dân) → form Tạo ca cấp cứu tự mở.
- Form Tạo ca gộp cả bước điều phối ban đầu: chọn xe + kíp từ danh sách hiện tại, chọn bệnh viện; nút Xác nhận tạo ca đồng thời phát lệnh (ca: Đã điều động).
- Tab Điều phối dùng cho các thay đổi sau khi tạo ca: thêm/đổi xe, đổi BV, thu hồi lệnh, kết thúc/hủy ca kèm lý do.
- Nút "Chuyển" (lực lượng phối hợp) chỉ để demo.

**Nội dung màn hình bổ sung**:

- Popup cuộc gọi đến: số điện thoại, tên chủ thuê bao định danh, vị trí tương đối theo Cell-ID.
- Màn điều hành: bản đồ GIS toàn thành phố hiển thị ca, xe, bệnh viện; xe kèm tốc độ, ETA.
- Màn điều phối trả lời 3 câu hỏi: "Nguồn lực đang ở đâu? - Đang ở trạng thái nào? - Có phù hợp với ca cấp cứu này hay không?"
- Hiển thị rõ thời điểm cập nhật dữ liệu gần nhất của xe.
- Dashboard điều hành: số ca đang xử lý; trạng thái từng ca; vị trí và trạng thái xe; nguồn lực đang sẵn sàng; tình trạng thực hiện nhiệm vụ; ca cần chú ý/chậm tiến độ; tình hình tiếp nhận của mạng lưới; SLA; KPI call-to-dispatch / call-to-scene / handover; workload theo trạm.

### 8.2. Web Bệnh viện tiếp nhận

```
Web Bệnh viện tiếp nhận
├── Tiếp nhận hồ sơ [Nhóm menu]
│   ├── Cảnh báo ca đang đến [Popup] - Nhận cảnh báo xe đang đến; Nhận cảnh báo người bệnh tự đến
│   ├── Cuộc gọi kèm dữ liệu ca [Popup] - Nhận cuộc gọi kèm dữ liệu ca
│   ├── Tài khoản [Menu người dùng] - Đăng nhập, đổi mật khẩu, đăng xuất
│   ├── Ca đang đến [Màn hình] - Danh sách xe / người bệnh đang đến bệnh viện
│   ├── Chi tiết ca [Màn hình, mở từ Ca đang đến] - Xem chi tiết thông tin bệnh nhân; Xem tóm tắt ca & ETA
│   │   ├── Phản hồi khả năng tiếp nhận [Popup] - Xác nhận/ Từ chối nhận bệnh nhân
│   │   ├── Phiếu cấp cứu (ePCR) [Tab] - Quản lý hồ sơ ePCR (CRUD)
│   │   └── Tiếp nhận & bàn giao [Tab] - Check-in xe đến; Xác nhận bàn giao
│   │       └── Biên bản bàn giao [Form] - Lập biên bản bàn giao: chẩn đoán ban đầu, tình trạng sống/chết,
│   │                                       sự cố y tế nếu có; In xuất biên bản (tùy chọn)
│   ├── Cập nhật trạng thái tiếp nhận [Màn hình] - Đang nhận / Hạn chế / Tạm ngưng; không chặn cuộc gọi hay điều phối
│   └── Khai báo chuyên khoa / năng lực [Màn hình] - Khai báo năng lực chuyên khoa của bệnh viện
└── Báo cáo [Nhóm menu]
    ├── Chi tiết [Màn hình] - Danh sách ca đã tiếp nhận
    └── Thống kê tiếp nhận [Màn hình] - Thống kê tiếp nhận
```

**ASSUMPTION**: báo cáo của BV tiếp nhận chỉ gồm ca của BV đó.

### 8.3. App Tài xế / Kíp cấp cứu

Thiết bị: chủ yếu tablet trên xe, song song điện thoại Android cá nhân của tài xế (cách dùng song song: TBD). App gắn theo xe, **không cần đăng nhập**.

```
App Tài xế
├── Lệnh điều động mới [Popup] - Xác nhận lệnh (kíp xác nhận khi lên xe; không có từ chối)
├── Nút SOS [Thành phần nổi] - SOS / Yêu cầu hỗ trợ từ trung tâm (nút trên phần mềm trên xe)
├── Thông tin ca [Màn hình] - Cập nhật trạng thái sẵn sàng; Kết thúc ca (TBD); Xem thông tin ca;
│                             Chọn xe vào ca (ASSUMPTION: không áp dụng, xem 7.2)
├── Nhiệm vụ hiện tại [Màn hình] - Cập nhật mốc trạng thái nhiệm vụ (Chưa xác nhận / Đang di chuyển / Hoàn thành)
├── Dẫn đường [Màn hình] - Dẫn đường
├── Phiếu cấp cứu (ePCR) [Màn hình] - Check-in bệnh nhân; Cập nhật diễn biến bệnh nhân; Ghi nhận sinh hiệu & can thiệp;
│                                     Lưu ảnh hồ sơ/ tệp đính kèm; Xem thông tin y tế khẩn cấp của người bệnh
```

Lưu ý thuật ngữ: màn "Thông tin ca" gộp cả **ca trực** (chọn xe, sẵn sàng, kết thúc ca) và **ca cấp cứu** (xem thông tin ca). TBD: tách màn hay giữ.

**Nội dung màn hình bổ sung**:

- Thông tin nhiệm vụ: vị trí hiện trường (đến ngõ hẻm), thông tin tóm tắt ca, mức độ khẩn cấp, tình trạng bệnh nhân, phương án sơ cứu tạm thời của bác sĩ chỉ đạo, chỉ đường tối ưu.
- Nhóm thông tin ePCR: thông tin người bệnh; đánh giá ban đầu và tình trạng hiện tại; dấu hiệu sinh tồn; chẩn đoán sơ bộ; biện pháp/can thiệp đã làm; thuốc/nội dung xử trí; diễn biến khi vận chuyển; thông tin và kết quả bàn giao. Danh mục trường, biểu mẫu, chữ ký/xác nhận, thời gian lưu: TBD.
- Thiết kế cho thao tác khi đang làm nhiệm vụ: ngắn gọn, ít nhập liệu (BR-08).

### 8.4. App Người dân

```
App Người dân
├── Đăng ký sử dụng [Màn hình]
│   ├── Xác thực số điện thoại [Màn hình] - Xác thực số điện thoại
│   └── Đồng ý chia sẻ dữ liệu [Màn hình] - Xác nhận chia sẻ dữ liệu cá nhân
├── Trang chủ [Nhóm menu]
│   └── Gọi cấp cứu > Gọi cấp cứu [Button] - SOS 1 chạm
├── Yêu cầu cấp cứu [Màn hình] - Quản lý yêu cầu cấp cứu; Theo dõi xe đang đến & ETA; Nhận hướng dẫn sơ cứu;
│                                Nhắn tin / gọi lại trung tâm; Chia sẻ vị trí trên hành trình; Xác nhận tự di chuyển;
│                                Ghi nhận sinh hiệu & can thiệp
├── Danh sách cơ sở y tế [Nhóm menu] - Tra cứu cơ sở y tế gần nhất
└── Hồ sơ cá nhân [Nhóm menu]
    ├── Thông tin y tế khẩn cấp [Màn hình] - Khai báo thông tin y tế khẩn cấp
    ├── Người liên hệ khẩn cấp [Màn hình] - Khai báo người liên hệ khẩn cấp
    ├── Quyền riêng tư [Màn hình] - Xem lại / thu hồi đồng ý chia sẻ
    └── Lịch sử yêu cầu [Màn hình] - Lịch sử yêu cầu cấp cứu
```

**Hành vi chính**: phải đăng ký và xác thực số điện thoại trước khi gửi yêu cầu; hủy yêu cầu được trước hoặc trong khi xe đang điều động; khi tự di chuyển, app gợi ý cơ sở y tế và người dân phải xác nhận điểm đến; trạng thái yêu cầu hiển thị giống App Trung tâm.

**Nội dung màn hình bổ sung**: khi gửi yêu cầu, app chuyển về Trung tâm: vị trí hiện tại, thông tin liên hệ, thông tin cơ bản về tình huống, dữ liệu bổ sung người dùng cung cấp. Yêu cầu từ app được tiếp nhận trên **cùng hệ thống** với cuộc gọi 115 làm cơ sở tạo ca. Vị trí truyền chính xác và liên tục realtime.

---

## 9. MÔ HÌNH DỮ LIỆU & TRƯỜNG DỮ LIỆU QUAN TRỌNG

Bảng dưới gom các trường đã được nhắc tới; chưa phải đặc tả dữ liệu chi tiết. Kiểu dữ liệu, bắt buộc/không: TBD.

### 9.1. Định danh dùng chung

Mã ca cấp cứu; mã phương tiện; mã đơn vị; mã bệnh nhân / định danh người bệnh trong phạm vi tích hợp; các mốc thời gian nghiệp vụ.

### 9.2. Thực thể

| Thực thể | Trường / thông tin |
|---|---|
| **Ca cấp cứu** | Mã ca; nguồn yêu cầu (kênh); thời gian tiếp nhận; thông tin người gọi; thông tin người bệnh; vị trí sự việc/hiện trường; loại tình huống/loại sự cố; số người cần hỗ trợ/số nạn nhân; tình trạng ban đầu; mức độ khẩn cấp; danh sách xe + kíp được gắn (một hoặc nhiều xe); trạng thái ca (Đã điều động / Đang vận chuyển / Hoàn tất / hủy); các mốc thời gian; hành trình phương tiện; thông tin từ kíp; cơ sở y tế tiếp nhận; kết quả bàn giao; lý do kết thúc; ghi chú; timeline |
| Ca - khung tổng quan | Thời điểm phát hiện cuộc gọi; người tiếp nhận; thời gian gọi xe; xe được điều động; thời gian kết thúc; người nhận; kết quả xử lý |
| Ca - tab chi tiết | Thông tin chung người bệnh; nguyên nhân/triệu chứng; xe nhận ca; danh sách kíp; người nhận; BV tiếp nhận; hình ảnh & tệp đính kèm; log sự kiện |
| **Sự kiện (nhiều nạn nhân)** | 1 sự kiện ↔ nhiều người bệnh / nhiều xe / nhiều BV |
| **Cuộc gọi** | Số điện thoại; tên chủ thuê bao định danh; vị trí Cell-ID; bản ghi âm; lịch sử cuộc gọi; trạng thái nhỡ/gọi lại |
| **Đánh giá / Triage** | Câu hỏi theo tình huống; dấu hiệu/thông tin người bệnh; mức độ; cảnh báo nguy cơ; người thực hiện; thời gian; kết quả |
| **Lệnh điều động / Nhiệm vụ** (mỗi xe một lệnh - **ASSUMPTION**) | Ca; xe; kíp; BV tiếp nhận; thời điểm phát lệnh; trạng thái (Chưa xác nhận / Đang di chuyển / Hoàn thành); thời điểm kíp xác nhận lên xe; thu hồi; lịch sử điều phối trước/sau; lý do thay đổi |
| **Xe (phương tiện)** | Mã xe; loại (Type A/B/C); đơn vị/trạm quản lý; tổ xe; vị trí hiện tại; trạng thái (Sẵn sàng / Đang điều xe / Đang cấp cứu / Bảo trì); kíp gắn với xe; năng lực kíp; trang thiết bị chính; nhiệm vụ đang làm; khả năng nhận nhiệm vụ mới; camera gắn xe; thiết bị (tablet); bảo trì (lịch, tình trạng) |
| **Tổ xe** | Xe cố định của tổ; danh sách tài xế thay ca |
| **Phân công ca trực** | Xe; thành viên kíp; thời gian vào/kết thúc ca. Là nguồn danh sách xe và kíp hiện tại khi tạo ca |
| **Nhân sự / Kíp trực** | Họ tên; vai trò (bác sĩ, điều dưỡng, cấp cứu viên, lái xe); chứng chỉ (BLS/ACLS/ITLS); lịch trực; năng lực chuyên môn; trạng thái sẵn sàng |
| **Trạm / Đơn vị cấp cứu** | Địa chỉ; tọa độ; vùng phục vụ; thời gian hoạt động; đầu mối liên hệ; nguồn lực trực thuộc |
| **Bệnh viện / Cơ sở y tế** | Tên; vị trí; loại hình; năng lực chuyên khoa (cấp cứu đa khoa, đột quỵ, tim mạch can thiệp, chấn thương, sản, nhi, ICU); giường cấp cứu/ICU; trạng thái tiếp nhận (Đang nhận / Hạn chế / Tạm ngưng); vai trò (BV trung tâm / BV tiếp nhận); danh bạ liên hệ |
| **Cảnh báo trước (pre-arrival)** | Tóm tắt ca; tình trạng; sinh hiệu; chẩn đoán nghi ngờ; can thiệp/xử trí đã làm; ETA; vị trí xe; phản hồi BV (xác nhận/từ chối) |
| **ePCR** | 8 nhóm thông tin ở mục 8.3: thông tin bệnh nhân, đánh giá, dấu hiệu sinh tồn, chẩn đoán sơ bộ, can thiệp, thuốc, diễn biến, kết quả bàn giao; ảnh hiện trường/tệp đính kèm. Kíp nhập trên app; BV tiếp nhận CRUD; log mọi chỉnh sửa (người sửa, thời điểm, nội dung trước/sau) |
| **Biên bản bàn giao** | Thời điểm xe cập bến (check-in); chẩn đoán ban đầu; tình trạng sống/chết; sự cố y tế nếu có; thời điểm xác nhận bàn giao; kết quả tiếp nhận |
| **SOS** | Vị trí xe; mã phương tiện; kíp; mã ca; trạng thái nhiệm vụ; thông tin liên lạc; ảnh hiện trường trong/ngoài xe |
| **Hồ sơ người dân (App)** | Số điện thoại đã xác thực; đồng ý chia sẻ dữ liệu; nhóm máu; dị ứng; bệnh nền; người liên hệ khẩn cấp; lịch sử yêu cầu |
| **Yêu cầu cấp cứu (App)** | Số điện thoại đã xác thực; vị trí GPS (liên tục); thông tin liên hệ; thông tin cơ bản tình huống; dữ liệu bổ sung; sinh hiệu & can thiệp (nếu người dân nhập); trạng thái yêu cầu; thời điểm hủy (nếu có); cờ tự di chuyển; cơ sở đích đã xác nhận; ETA |
| **Nhật ký thao tác** | Đăng nhập; truy cập dữ liệu; tạo/sửa ca; phát lệnh; điều phối lại; đổi trạng thái; truy cập dữ liệu BN; trao đổi tích hợp |
| **Danh mục** | Xe; tổ xe; nhân sự; bệnh viện/CSYT; danh bạ BV; loại tình huống; trang thiết bị; lý do kết thúc ca; trạng thái xe; mẫu form |

---

## 10. YÊU CẦU PHI CHỨC NĂNG & AN TOÀN THÔNG TIN

| Nhóm | Yêu cầu |
|---|---|
| Realtime | Ca, vị trí xe, trạng thái nhiệm vụ cập nhật theo thời gian thực; vị trí xe ≤ 30 giây |
| Đa nền tảng | Điều hành trên Web; App Tài xế / Kíp chạy trên tablet (gắn theo xe, không đăng nhập) và điện thoại Android; App Người dân trên Android |
| Khả năng mở rộng | 6 → ≥ 64 xe; thêm đơn vị, trạm, người dùng, khu vực, phân hệ không thay đổi toàn bộ hệ thống |
| Sẵn sàng 24/7 | Giám sát, sao lưu, phục hồi, dự phòng đường truyền; phương thức điều phối dự phòng khi hệ thống gặp sự cố |
| Offline | App trên xe lưu tạm, đồng bộ lại; ưu tiên dữ liệu quan trọng |
| Cấu hình được | Vai trò, quy trình, biểu mẫu, danh mục, phân quyền, trạng thái, quy tắc cảnh báo |
| Phân quyền | RBAC theo vai trò, đơn vị, chức năng, phạm vi dữ liệu |
| Xác thực | Đăng nhập; MFA nếu cần, ưu tiên cho quản trị |
| Mã hóa | Mã hóa kênh truyền; bảo vệ dữ liệu lưu trữ; quản lý chứng thư, token/API key. Giao thức cụ thể quyết định ở thiết kế chi tiết |
| Truy vết | Audit log toàn bộ thao tác; nhật ký hệ thống; cảnh báo truy cập bất thường |
| Quyền riêng tư | Tối thiểu cần thiết; người dân đồng ý/thu hồi đồng ý chia sẻ dữ liệu |
| Tích hợp mở | API kết nối tổng đài, GPS, GIS, bệnh viện, hệ thống liên quan |
| Hiệu năng | Tách dữ liệu realtime và báo cáo |
| Khả dụng cho người dùng | Thao tác ngắn, ưu tiên thông tin cần thiết, không nhập nhiều khi khẩn cấp |

---

## 11. KPI & BÁO CÁO

### 11.1. Mốc thời gian dùng tính KPI

Call-to-Dispatch, Dispatch-to-Accept, Dispatch-to-Mobile, Dispatch-to-Scene, Call-to-Scene, Scene Time, Scene-to-Hospital, Arrival-to-Handover, Handover Time, Call-to-Handover. Định nghĩa chính xác các mốc T0-T6/Tn: TBD.

### 11.2. Nhóm KPI

| Nhóm | Chỉ số |
|---|---|
| Tiếp nhận / Contact Center | Số yêu cầu; thời gian trả lời; tỷ lệ nhận cuộc gọi; cuộc gọi nhỡ; thời gian xử lý ban đầu; tỷ lệ cuộc gọi không phải cấp cứu |
| Điều phối | Call-to-Dispatch; Dispatch-to-Accept (thời gian xác nhận nhiệm vụ); Dispatch-to-Mobile; số lần điều phối lại; tỷ lệ đổi xe |
| Đáp ứng | ETA; Call-to-Scene; thời gian di chuyển; tỷ lệ đáp ứng theo SLA/khu vực |
| Hiện trường | Thời gian tại hiện trường; tỷ lệ can thiệp theo nhóm bệnh; tỷ lệ không vận chuyển |
| Vận chuyển | Scene-to-Hospital; sai lệch ETA; tỷ lệ chuyển đúng cơ sở phù hợp |
| Bàn giao | Arrival-to-Handover; Call-to-Handover; thời gian chờ tiếp nhận |
| Nguồn lực | Mức sử dụng xe/kíp; thời gian sẵn sàng; số nhiệm vụ theo xe/trạm; mất kết nối; heatmap nhu cầu |
| Chất lượng dữ liệu | Tỷ lệ hoàn thiện ePCR; mức đầy đủ các mốc nghiệp vụ; tỷ lệ cảnh báo được xử lý; sự cố an toàn lái xe; chỉ số theo nhóm bệnh trọng điểm |

---

## 12. HƯỚNG DẪN CHO PROTOTYPE 3 APP

### 12.1. Mục tiêu và ràng buộc

- Mục tiêu: prototype cho 3 app; mốc demo khách hàng dự kiến **09/10/2026**.
- Phạm vi prototype: **triển khai toàn bộ tính năng có trong site map** (mục 8), không phân biệt giai đoạn 1.0/2.0.
- Khung màn hình: mục 8. Danh sách tính năng: mục 7.
- Dữ liệu trên prototype là **dữ liệu minh họa**, không phải số liệu hiện trạng của BV/Sở Y tế. Quy mô tham chiếu: 6 xe (Type A/B/C), 1 BV trung tâm (BVĐK TP Cần Thơ) và một số BV tiếp nhận.

### 12.2. Ba app và nền tảng

| App | Nền tảng | Vai trò đăng nhập cần mô phỏng | Ghi chú |
|---|---|---|---|
| **1. App Trung tâm** | Desktop Web, màn hình rộng (máy trạm điều phối, màn dashboard) | Tổng đài viên - Điều phối viên (một vai trò), Lãnh đạo (Báo cáo), Quản trị, nhân sự Khoa Cấp cứu BVĐK (nhóm Tiếp nhận hồ sơ) | Web BV tiếp nhận của BV khác dùng cùng một nền tảng, phân biệt bằng phân quyền theo tài khoản. Tiếp nhận và xử lý yêu cầu từ cuộc gọi và từ App Người dân |
| **2. App Tài xế / Kíp** | Tablet (chính) / điện thoại Android cá nhân của tài xế (song song, tính sau) | Ekip | Gắn theo xe, không đăng nhập; prototype mô phỏng bằng cách chọn xe khi mở app demo (**ASSUMPTION**) |
| **3. App Người dân** | Mobile (Android) | Người dân | Giai đoạn hiện tại là app độc lập |

### 12.3. Nguyên tắc UX (áp dụng cho cả 3 app)

- Thao tác ngắn, ưu tiên thông tin cần cho đánh giá và điều phối; không bắt nhập nhiều khi khẩn cấp → mốc 1 chạm, form tối giản.
- Con người quyết định: mọi gợi ý hiển thị như đề xuất có thể chấp nhận/sửa; lưu lý do khi thay đổi.
- Bức tranh điều hành thống nhất: Thanh trạng thái ca bệnh hiển thị xuyên suốt; Thông báo toàn cục (cuộc gọi nhỡ, bất thường hành trình, BV phản hồi).
- Trả lời 3 câu hỏi nguồn lực: ở đâu - trạng thái gì - có phù hợp không.
- Hiển thị thời điểm cập nhật gần nhất và cảnh báo mất kết nối.
- SOS được ưu tiên cao nhất về hiển thị/cảnh báo.
- Hồ sơ ca là một trang xuyên suốt: Tổng quan / Phân công-Điều phối / Hồ sơ (file) / Lịch sử (Log) / Mốc thời gian / Ghi âm / ePCR.
- Dữ liệu cá nhân hiển thị theo vai trò; mức hiển thị dữ liệu cá nhân TBD.

---

## 13. LỊCH SỬ TÀI LIỆU

| Phiên bản | Ngày | Nội dung |
|---|---|---|
| 1.0 | 01/10/2026 | Tạo lần đầu |
| 1.1 | 01/10/2026 | Cập nhật theo review: đưa các phương án đã chốt vào từng mục (thiết bị app tài xế, ảnh hiện trường, trạng thái xe, trạng thái nhiệm vụ, kênh người dân, tên chủ đầu tư, quyền ePCR của BV, phạm vi prototype); bỏ danh sách tính năng không có trong bản tổng hợp; bỏ trích dẫn nguồn; đánh lại số mục, mã actor và mã BR |
| 1.2 | 01/10/2026 | Cập nhật theo trả lời 26 câu hỏi: tên dự án; một người kiêm tổng đài và điều phối; form tạo ca tự mở và gộp bước điều phối; một ca nhiều xe; chọn BV khi phát lệnh; trạng thái ca 3 bước; kết thúc ca khi xác nhận bàn giao; app tài xế theo xe không đăng nhập, không có từ chối lệnh; SOS trên phần mềm; quy tắc App Người dân; bổ sung BR-09 đến BR-18 |
| 1.3 | 02/10/2026 | Đồng bộ sitemap 8.1 (Tiếp nhận hồ sơ) và 8.2 (Web BV tiếp nhận) với feature catalog 7.3: bổ sung màn "Cập nhật trạng thái tiếp nhận", "Khai báo chuyên khoa / năng lực", "Xem tóm tắt ca & ETA"; thêm nhóm Báo cáo (Danh sách ca đã tiếp nhận, Thống kê tiếp nhận) cho Tiếp nhận hồ sơ trong 8.1; sửa Báo cáo 8.2 theo đúng C3 thay vì sao chép A10 |
