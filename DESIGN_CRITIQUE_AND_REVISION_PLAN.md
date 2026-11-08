# BÁO CÁO ĐÁNH GIÁ THIẾT KẾ TOÀN DIỆN VÀ LỘ TRÌNH KHẮC PHỤC
## FORENSIC DESIGN CRITIQUE & RADICAL EDITORIAL REMEDIATION BLUEPRINT
### Đồ án Kế hoạch Kinh doanh Khởi nghiệp "Laptop Vương Gia" — Môn Giáo dục Kinh tế và Pháp luật (GD KT-PL)

- **Văn bản mục tiêu**: `public/slides.html`
- **Tài liệu căn cứ nghiệp vụ**: `BAN_KE_HOACH_KINH_DOANH_CHI_TIET_KTPL.md`
- **Kho minh chứng thực tế**: `public/evidence/` (10 tệp hình ảnh dòng tiền & chat thực tế)
- **Tác giả thẩm định**: Principal Visual Architect & Executive Presentation Designer
- **Tiêu chuẩn kiểm định**: High-End Executive Presentation, Anti-Slop Directive, Craft Floor Protocol, KT-PL Rubric I & II (20.0/20.0)
- **Ngày lập**: 08/11/2026

---

## 1. TỔNG QUAN ĐIỀU HÀNH & KẾT QUẢ KIỂM TOÁN THẨM MỸ (EXECUTIVE SUMMARY)

### Điểm đánh giá thị giác tổng thể: **4.5 / 10 — Pseudo-Minimalist Wireframe Trap**

Dù `public/slides.html` đã nỗ lực thoát khỏi cạm bẫy sơ đẳng của phong cách AI-slop (gradient tím xanh neon mờ ảo, hiệu ứng đổ bóng glassmorphism rẻ tiền), giao diện hiện tại đã rơi thẳng vào **cạm bẫy thứ hai phổ biến nhất của thiết kế máy móc: "Hội chứng Bảng tính Giả danh Tối giản" (The Warm Paper / Hairline Spreadsheet Cliché)**.

Bộ slide hiện tại tự nhận là "Editorial Design", nhưng dưới góc nhìn chuyên môn của Giám đốc Nghệ thuật (Art Director), đây chỉ là một **bản vẽ khung dây (wireframe) nghèo nàn được ngụy trang bằng những đường viền be mỏng mảnh**. Nó hoàn toàn thiếu đi sự phân cấp kịch tính về tỷ lệ (dramatic scale contrast), thiếu đi sự đĩnh đạc quyền uy của một báo cáo hội đồng quản trị, và thiếu đi sức mạnh cảm xúc thị giác cần thiết cho một bài bảo vệ khởi nghiệp kéo dài 8 phút trước Hội đồng Giám khảo môn Kinh tế và Pháp luật.

```
========================================================================================
BẢNG ĐỐI CHIẾU THỰC TRẠNG VÀ CHUẨN MỰC EXECUTIVE EDITORIAL
========================================================================================
THỰC TRẠNG CŨ (4.5 / 10)                  -->   CHUẨN MỰC TÁI THIẾT KẾ MỚI (10 / 10)
----------------------------------------------------------------------------------------
1. Ngục tù Hairline (Card-slop trá hình)   -->   Bố cục Mở Cardless Open Grid & Macro-Whitespace
2. Bảng màu Sepia trà thảo mộc thiếu lửa   -->   Màu mực Đen Obsidian (#0E1013) & Đỏ Vermilion (#C93B2B)
3. Đại dịch chữ siêu nhỏ (text-xs 11-12px) -->   Typography phân cấp: H1 (64-76px), Số liệu (72-96px)
4. Đơn điệu bố cục (Slide 2, 3, 6, 7 lặp) -->   Nhịp điệu Asymmetric Bento, Ledger & Horizontal Splits
5. Hạ thấp minh chứng (Thumbnail 112px)   -->   Hồ sơ minh chứng Triển lãm (Legible Dossier + Lightbox)
6. Khung viền giam cầm & Modal thừa       -->   Toàn cảnh 16:9 Full-bleed, điều khiển thầm lặng 100%
========================================================================================
```

---

## 2. PHÂN TÍCH CHUYÊN SÂU 6 TRỌNG TỘI HỆ THỐNG (THE 6 CRITICAL SINS)

### TRỌNG TỘI 1: "Card-Slop Trá Hình" — Ngục Tù Của Những Đường Viền Hairline (The Hairline Grid Disease)
- **Vị trí vi phạm trên mã nguồn**: `slides.html:158-161`, `212-225`, `232-251`, `329-365`, `478-528`, `555-587`, `612-662`.
- **Bản chất lỗi**: Người thiết kế loại bỏ các hộp bo tròn và đổ bóng, nhưng lại thay thế bằng một mạng lưới đường viền 1px (`#E5E1D8`) bao vây lấy từng câu chữ, từng gạch đầu dòng và từng ô số liệu. 
  - Tại Slide 5: 15 bước kiểm định phần cứng bị kẻ 15 đường gạch chân `hairline-b pb-1`, tạo nên hiệu ứng thị giác như một trang vở học sinh kẻ ngang nhấp nháy, gây mỏi mắt và phân tán sự chú ý.
  - Tại Slide 4: Khối công thức hòa vốn bị bọc trong một khối nền `p-4 bg-canvas-subtle` — bản chất chính là một thẻ card thu nhỏ.
  - Tại Slide 3 và Slide 6: Bốn cột dọc bị chia cắt bằng các thanh dọc `hairline-l pl-8`, xé nát màn hình thành 4 khe hở hẹp đơn điệu.
- **Giải pháp khắc phục**: Triệt để áp dụng nguyên lý **Cardless Open Plane**. Cấu trúc thông tin phải được định hình bằng khoảng trắng tự nhiên (macro-whitespace từ 3rem đến 5rem), bước nhảy kích thước chữ (typographic tension) và các đường gióng thanh mảnh đơn lẻ, không đóng hộp máy móc.

### TRỌNG TỘI 2: Xung Đột Màu Sắc & Căn Bệnh Nền Giấy Cũ Khởi Nghiệp AI (Chromatic Confusion)
- **Vị trí vi phạm trên mã nguồn**: `slides.html:26-38`, `218-222`, `291-298`, `413-416`, `448`.
- **Bản chất lỗi**:
  - Tông màu giấy be ấm (`canvas: '#F8F7F3'`, `ochre: '#9E6A16'`) tạo cảm giác như một ấn phẩm menu quán trà hoặc bao bì đồ thủ công mỹ nghệ cổ điển, hoàn toàn lệch pha với dự án phân phối công nghệ laptop doanh nhân chuẩn Nhật Bản và giải pháp tự động hóa bằng Bot.
  - Lạm dụng quá nhiều màu nhấn không có quy tắc ngữ nghĩa: Vermilion (`#C93B2B`), Pine (`#1E4D38`) và Ochre (`#9E6A16`) cùng chen chúc trong một slide. Tại Slide 2, tỷ lệ 72,5% màu đen, 81,7% màu đỏ, 65,8% màu xanh lá — biến bài báo cáo kinh tế thành một bảng đèn tín hiệu giao thông thiếu nghiêm túc.
- **Giải pháp khắc phục**: Khóa chặt bảng màu tối giản quyền lực: Nền Bone Canvas thanh sạch (`#F8F7F3`), Chữ mực đen Obsidian nguyên khối (`#0E1013`), Slate xám thép (`#1E293B`), một màu nhấn hành động duy nhất là Đỏ Vermilion (`#C93B2B`) và sắc Xanh Rừng (`#1E4D38`) dành riêng cho các chỉ số tài chính thặng dư/kiểm định đạt chuẩn.

### TRỌNG TỘI 3: Đại Dịch Chữ Siêu Nhỏ & Sự Hèn Nhát Về Tỷ Lệ (Microscopic Typography & Scale Cowardice)
- **Vị trí vi phạm trên mã nguồn**: `slides.html:194`, `230-251`, `286-302`, `333-363`, `479-506`, `514-528`, `559-586`, `616-661`, `697-770`, `799-838`.
- **Bản chất lỗi**:
  - Trên 65% nội dung trên slide đang bị ép vào các lớp CSS `text-xs` (11px - 12px) và `text-sm` (13px - 14px). Khi trình chiếu trên máy chiếu hội trường hoặc màn hình TV 65-85 inch từ khoảng cách 3-5 mét, ban giám khảo sẽ phải nheo mắt trong ức chế.
  - Danh sách 4 nhà sáng lập ở Slide 1 bị dồn thành các dòng chữ li ti; 6 câu hỏi phản biện then chốt ở Slide 7 bị nén thành văn bản hợp đồng khó đọc.
  - Tiêu đề slide co cụm ở mức `text-4xl` thiếu tự tin, trong khi các đoạn văn mô tả lại trải dài 70-80 ký tự gây đứt đoạn nhịp đọc.
- **Giải pháp khắc phục**: Thiết lập trật tự tỷ lệ typographic dứt khoát: Tiêu đề H1 đạt `text-6xl` đến `text-7xl` (56px - 72px), số liệu tài chính bùng nổ ở `text-7xl` đến `text-8xl` (72px - 96px), toàn bộ nội dung diễn giải đạt tối thiểu `text-base` đến `text-lg` (16px - 18px), tiêu diệt sạch sẽ cỡ chữ `text-xs` cho các thông điệp trọng tâm.

### TRỌNG TỘI 4: Đơn Điệu Cấu Trúc Khung Lưới (Structural Monotony)
- **Vị trí vi phạm trên mã nguồn**:
  - Slide 2: Chia 3 cột đối xứng (`grid grid-cols-3 gap-12 hairline-t pt-8`).
  - Slide 3: Chia 4 cột đối xứng (`grid grid-cols-4 gap-8 hairline-t pt-8`).
  - Slide 6: Chia 4 cột đối xứng (`grid grid-cols-4 gap-8 hairline-t pt-8`) — **Bản sao cấu trúc 100% của Slide 3!**
  - Slide 7: Lưới 3 cột x 2 hàng lặp lại nhịp điệu của Slide 2.
- **Bản chất lỗi**: Vi phạm nghiêm trọng quy tắc **Cấm Lặp Lại Bố Cục Liên Tiếp (Section-Layout-Repetition Ban)**. Khi người xem chuyển từ Slide 3 sang Slide 6, họ thấy cùng một mô-típ: 1 dòng tiêu đề, 1 đường gạch ngang và 4 thanh chia dọc với số hiệu trên đỉnh. Não bộ người chấm thi sẽ tự động rơi vào trạng thái bão hòa và ngừng tiếp nhận thông tin.
- **Giải pháp khắc phục**: Đa dạng hóa nhịp điệu thị giác qua từng bước chuyển:
  - Slide 1: Bố cục Asymmetric Editorial Split 65/35.
  - Slide 2: Bố cục Triptych với 1 Hero Metric khổng lồ (81,7%) chiếm ưu thế và 2 cánh ngữ cảnh.
  - Slide 3: Lưới Asymmetric 4P Quad-Grid (Ưu tiên Price & Product là tâm điểm).
  - Slide 4: Sổ cái Kế toán Đơn vị (Ledger Sheet) song song cùng Bằng chứng Kinh tế học $Q=0$ hoành tráng.
  - Slide 5: Chuỗi cung ứng thời gian thực 24H (Timeline Rail) kết hợp Bảng đặc tả kỹ thuật QC 3 tầng.
  - Slide 6: Bức tường Pháp lý 3 trụ cột vững chãi với huy hiệu Điều luật và Con dấu Tuân thủ.
  - Slide 7: Ma trận Chiến lược 2 cột bất đối xứng (Pháp lý & Tài chính đối sánh Vận hành & Cạnh tranh).
  - Slide 8: Triển lãm Minh chứng Thực tế (Dossier Split Exhibit).
  - Slide 9: Tuyên ngôn Kết luận & Lộ trình Thuyết trình Đỉnh cao.

### TRỌNG TỘI 5: Giáng Cấp Minh Chứng Thực Tế Thành "Vườn Thú Thumbnail" (Evidence Degradation)
- **Vị trí vi phạm trên mã nguồn**: `slides.html:683-775` (Slide 8).
- **Bản chất lỗi**:
  - Dự án nắm giữ một "vũ khí sát thương" thượng thặng mà hầu như không một đồ án học sinh nào có được: **10 tệp tư liệu thực tế chứng minh dòng tiền 2.000.000 VNĐ đã chảy vào STK BIDV 8883451443 và 6 đoạn chat chốt đơn thật**.
  - Tuy nhiên, trong Slide 8 hiện tại, 10 viên ngọc quý này lại bị nhét vào các khung ảnh bé tí `h-28` (chiều cao vỏn vẹn 112px). Toàn bộ số tài khoản ngân hàng, dấu mộc giao dịch, tên người chuyển tiền và nội dung trao đổi đều biến thành những vệt mờ không thể đọc nổi nếu không nhấp chuột mở Lightbox. Trong một buổi thuyết trình 8 phút căng thẳng, không một diễn giả nào có đủ thời gian để nhấp mở 10 cái popup.
- **Giải pháp khắc phục**: Tái cấu trúc Slide 8 thành một **Hồ sơ Minh chứng Triển lãm (Curated Evidence Dossier)**: Phân tách rõ ràng giữa Phân khu Dòng tiền Ngân hàng BIDV (4 biên lai sắc nét, số tiền in đậm định dạng lớn, trích xuất mã giao dịch rõ ràng) và Phân khu Nhật ký Khách hàng (6 ảnh chat kèm lời trích dẫn nguyên văn sinh động từ học sinh, thầy giáo và phụ huynh). Giữ nguyên tính năng phóng to Full-screen Lightbox khi cần tương tác sâu.

### TRỌNG TỘI 6: Khung Viền Giam Cầm & Tàn Dư Modal Bản Quyền (Ghost Navigation & Structural Cages)
- **Vị trí vi phạm trên mã nguồn**: `slides.html:191-199`, `257-260`, `864-867`, `882-890`.
- **Bản chất lỗi**:
  - Mọi slide đều bị bọc trong một thanh masthead trên đỉnh (`LAPTOP VƯƠNG GIA /// KẾ HOẠCH KINH DOANH KHỞI NGHIỆP`) và thanh footer ở đáy. Cặp khung cố định này cướp đi gần 20% diện tích hiển thị dọc của tỷ lệ 16:9, tạo cảm giác bức bối, ngột ngạt.
  - Phần tử `#slide0Overlay` (dòng 882-890) vẫn tồn tại như một bóng ma kích hoạt bằng phím 0, vi phạm chỉ thị khởi đầu trực tiếp vào Slide 1.
- **Giải pháp khắc phục**: Giải phóng toàn bộ diện tích 16:9. Tích hợp định danh slide trực tiếp vào bố cục từng trang một cách thanh thoát. Loại bỏ hoàn toàn thanh dock điều hướng nổi và các tooltip hướng dẫn phím bấm thừa thãi. Duy trì thanh tracking tiến độ siêu mỏng (`2px`) ở chân canvas và hỗ trợ chuyển trang thầm lặng qua bàn phím và vùng nhấp chuột thông minh.

---

## 3. LỘ TRÌNH KHẮC PHỤC CHI TIẾT TỪNG SLIDE (SLIDE-BY-SLIDE TRANSFORMATION BLUEPRINT)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             BẢN THIẾT KẾ CẤU TRÚC 9 SLIDE EXECUTIVE EDITORIAL CHUẨN MỰC               │
├───────┬──────────────────────────────────┬─────────────────────────────────────────────┤
│ SLIDE │ TÊN NỘI DUNG CHUẨN KT-PL         │ BỐ CỤC EDITORIAL ĐẶC THÙ                   │
├───────┼──────────────────────────────────┼─────────────────────────────────────────────┤
│ S01   │ Khởi Nghiệp Tinh Gọn & Đội Ngũ   │ Asymmetric Split 65/35 (Hero H1 + C-Levels) │
│ S02   │ Nỗi Đau Thị Trường & N=120 Mẫu   │ Triptych Monolith (Hero 81,7% + Quotes)     │
│ S03   │ Chiến Lược Marketing Mix 4P      │ Asymmetric 4P Quad-Grid (Price & Product)   │
│ S04   │ Tài Chính & Điểm Hòa Vốn Q=0     │ Unit Economics Ledger + Formula Proof Q=0   │
│ S05   │ Vận Hành JIT & Kiểm Định 15 Bước │ 24H Chrono Timeline + 3-Tier QC Matrix      │
│ S06   │ Căn Cứ Pháp Lý & Kinh Tế Tuần Hoàn│ 3-Pillar Legal Fortress + EPR Banner        │
│ S07   │ Bộ Giáp Phản Biện 6 Câu Hỏi      │ 2x3 Strategic Defense Battlecards           │
│ S08   │ Minh Chứng Thực Tế 10 Tư Liệu    │ Curated Evidence Dossier (BIDV + Chat Logs) │
│ S09   │ Kịch Bản 8 Phút & Tuyên Ngôn     │ 8-Min Pitch Roadmap + Jury Q&A Climax       │
└───────┴──────────────────────────────────┴─────────────────────────────────────────────┘
```

### SLIDE 01: TRANG BÌA & TUYÊN NGÔN KHỞI NGHIỆP TINH GỌN (LEAN MANIFESTO)
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 1 Rubric I (1,0đ) & Tiêu chí 3 Rubric II (2,0đ).
- **Nguyên lý bố cục**: Bố cục Mở Bất Đối Xứng 65% / 35%.
- **Chi tiết chuyển đổi**:
  - **Cột Trái (65% Widescreen)**:
    - Nhãn danh mục: `MÔ HÌNH BÁN LẺ JUST-IN-TIME (JIT) & ZERO-INVENTORY` (font-mono text-xs text-vermilion font-bold tracking-widest).
    - Tiêu đề H1: `Hệ Thống Phân Phối Laptop Chuẩn Nhật Cho Học Sinh THPT` (`text-6xl lg:text-7xl font-extrabold text-ink font-display tracking-tight leading-[1.06] mb-6`).
    - Đoạn tuyên ngôn: Khẳng định tính thực chiến giải quyết triệt để rủi ro đọng vốn, cam kết bảo vệ người tiêu dùng học đường và hạch toán minh bạch.
    - Bộ 3 chỉ số mở (Open Stats, không đóng khung): `0 đ` Vốn Đọng Kho &bull; `≥ 500k` Lãi Ròng / Máy &bull; `15 Bước` Kiểm Định Phần Cứng.
  - **Cột Phải (35% Pl-10 Hairline Divider)**:
    - Tiêu đề phụ: `HỘI ĐỒNG SÁNG LẬP DỰ ÁN (4 THÀNH VIÊN)`.
    - Danh sách 4 chức danh lãnh đạo C-Level (CEO Vương Gia, CTO Kỹ thuật trưởng, CMO Phụ trách Tiếp thị, CFO Phụ trách Tài chính) được trình bày mạch lạc với vai trò cụ thể, tạo tiền đề cho tiêu chí chấm điểm tinh thần đồng đội của Ban Giám khảo.

### SLIDE 02: NỖI ĐAU THỊ TRƯỜNG & KHẢO SÁT THỰC ĐỊA 120 HỌC SINH
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 2 Rubric I (1,5đ) & Tiêu chí 4 Rubric II (2,0đ).
- **Nguyên lý bố cục**: Triptych Monolith với 1 Hero Metric khổng lồ.
- **Chi tiết chuyển đổi**:
  - Tiêu đề H2: `Ba Nỗi Đau Lớn Của Học Sinh Khi Tìm Kiếm Công Cụ Học Tập`.
  - Phụ đề điều hành: Báo cáo khảo sát thực nghiệm $N = 120$ học sinh THPT khẳng định nhu cầu cấp bách bị chặn lại bởi rào cản chi phí và nỗi bất an kỹ thuật.
  - 3 Cột số liệu phân cấp dứt khoát:
    - **Cột 1**: `72,5%` (87/120 HS) — Nhu cầu bắt buộc phải có máy tính để học tập số hóa.
    - **Cột 2 (Trọng tâm)**: `81,7%` (98/120 HS & Phụ huynh) — **NỖI SỢ MÁY DỰNG, LUỘC ĐỒ & LỖI ẨN**. Nhấn mạnh bằng màu đỏ Vermilion nguyên khối, trích dẫn tiếng nói lo âu thực tế của học sinh.
    - **Cột 3**: `65,8%` (79/120 Gia đình) — Ngân sách eo hẹp dưới 5 triệu đồng, phân khúc bị các chuỗi bán lẻ lớn bỏ ngỏ.
  - Dải liên kết đối thủ cạnh tranh: Nêu bật khoảng trống thị trường giữa Thế Giới Di Động (giá cao >12tr) và Chợ trời cũ (rủi ro cao).

### SLIDE 03: CHIẾN LƯỢC TIẾP THỊ & BÁN HÀNG 4P ĐỘT PHÁ
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 3 Rubric I (1,5đ).
- **Nguyên lý bố cục**: Asymmetric 4P Quad-Grid (Ưu tiên Product & Price làm tâm điểm).
- **Chi tiết chuyển đổi**:
  - Tiêu đề H2: `Bốn Trụ Cột Tiếp Thị Thích Ứng Cao Độ Với Giới Trẻ`.
  - **Trụ cột 01 // PRODUCT (Sản phẩm chuẩn hóa)**: Tuyển chọn 3 dòng máy doanh nhân chuẩn Nhật (ThinkPad T480, Dell Latitude 7490, HP EliteBook 830 G6). Vỏ hợp kim siêu bền, bàn phím gõ êm, màn chống chói, tặng trọn gói phụ kiện.
  - **Trụ cột 02 // PRICE (Giá bán thấu nhập)**: Định giá **4.600.000 VNĐ** (rẻ hơn chuỗi lớn 800k - 1,2tr; rẻ hơn thị trường 400k - 600k nhờ triệt tiêu chi phí mặt bằng). Đảm bảo sàn lợi nhuận $\ge 500.000đ/máy$.
  - **Trụ cột 03 // PLACE (Kênh phân phối O2O)**: Kết hợp tương tác trực tiếp tại trường học (offline trải nghiệm máy) và Fanpage tự động hóa bằng Bot Autopost 24/7.
  - **Trụ cột 04 // PROMOTION (Xúc tiến thương mại)**: Chính sách cọc 200k - 500k minh bạch; cam kết hoàn cọc 100%; bảo hành 1 đổi 1 trong 30 ngày.

### SLIDE 04: KẾ HOẠCH TÀI CHÍNH & ĐIỂM HÒA VỐN KINH TẾ HỌC (Q = 0)
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 4 Rubric I (2,0đ Trọng điểm) & Tiêu chí 4 Rubric II (2,0đ).
- **Nguyên lý bố cục**: Sổ cái Kế toán Đơn vị (Financial Ledger) đối sánh Bằng chứng Kinh tế học $Q=0$.
- **Chi tiết chuyển đổi**:
  - **Bên Trái (50% Widescreen)**: Bảng hạch toán giá thành đơn vị (HP EliteBook 830 G6 Core i5/8GB/256GB):
    - Giá bán niêm yết (P): **4.600.000 đ** (100%).
    - Giá vốn nhập kho tổng Nhật (COGS): `3.800.000 đ` (82,6%).
    - Gói phụ kiện quà tặng sạc/chuột/túi: `150.000 đ` (3,3%).
    - Vật tư bảo dưỡng & keo gốm MX-4: `50.000 đ` (1,1%).
    - Quỹ trích lập dự phòng bảo hành 1 đổi 1 (3%): `100.000 đ` (2,2%).
    - Chi phí Marketing / Phần mềm Autopost: **0 đ** (0,0%).
    - Tổng biến phí đơn vị (VC): **4.100.000 đ** (89,1%).
    - **LỢI NHUẬN RÒNG / MÁY (P - VC)**: **+ 500.000 đ** (10,9% - Sàn cam kết).
  - **Bên Phải (50% Widescreen)**: Chứng minh kinh tế học đẳng cấp:
    - Con số khổng lồ: `0 MÁY` (`text-7xl lg:text-8xl font-black font-mono text-pine`).
    - Công thức kinh tế chuẩn KT-PL:
      $$Q_{\text{BEP}} = \frac{\text{FC}}{\text{P} - \text{VC}} = \frac{0}{4.600.000 - 4.100.000} = \mathbf{0 \text{ MÁY}}$$
    - Lời giải thích đĩnh đạc: Định phí FC = 0 đồng nhờ mô hình Just-in-Time, không tốn tiền thuê cửa hàng, không nợ đọng vốn. Bán 1 máy là có lãi ròng ngay lập tức.
    - Dự toán 3 tháng đầu: Tiêu thụ 20 máy &bull; Doanh thu **92.000.000 đ** &bull; Lợi nhuận ròng **+10.000.000 đ**.

### SLIDE 05: QUY TRÌNH VẬN HÀNH JIT & KIỂM ĐỊNH PHẦN CỨNG 15 BƯỚC
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 5 Rubric I (1,5đ).
- **Nguyên lý bố cục**: Chuỗi cung ứng thời gian thực (Chrono Pipeline) và Bảng tiêu chuẩn kiểm định 3 khối.
- **Chi tiết chuyển đổi**:
  - **Bên Trái (Chu kỳ 0 - 24H)**:
    - `00:00`: Tiếp nhận nhu cầu học sinh & Thu cọc bảo chứng (200k - 500k) vào BIDV 8883451443.
    - `02:00`: Kích hoạt lệnh xuất kho tổng Nhật Bản (vận dụng dòng tiền cọc kéo máy).
    - `08:00`: Thực thi quy trình kiểm định 15 bước nghiêm ngặt tại phòng kỹ thuật.
    - `24:00`: Bàn giao tận tay tại trường học, ký biên bản nghiệm thu và kích hoạt bảo hành.
  - **Bên Phải (Tiêu chuẩn kiểm định 15 bước)**:
    - Loại bỏ 15 đường gạch chân rối rắm, gom thành 3 tầng kỹ thuật công nghiệp chuẩn phòng lab:
      1. *Tầng Ngoại quan & Cơ khí*: Bản lề, vỏ hợp kim, chân cao su, cổng kết nối Type-C/HDMI/USB, bàn phím gõ 100% phím.
      2. *Tầng Hiệu năng & Ổn định*: Test màn hình IPS không điểm chết, CrystalDiskInfo SSD 100%, Pin zin chai < 20%, Stress test CPU/GPU FurMark chịu tải nhiệt độ cao.
      3. *Tầng Hoàn thiện & Niêm phong*: Vệ sinh tra keo tản nhiệt MX-4, Windows 11 Digital OEM sạch, dán tem niêm phong Vương Gia.

### SLIDE 06: CĂN CỨ PHÁP LÝ KT-PL & TRÁCH NHIỆM MÔI TRƯỜNG (EPR)
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 6 Rubric I (1,5đ Trọng tâm KT-PL).
- **Nguyên lý bố cục**: 3 Trụ Cột Pháp Lý Vững Chắc + Băng Tuyên Ngôn Kinh Tế Tuần Hoàn.
- **Chi tiết chuyển đổi**:
  - Tiêu đề H2: `Nền Tảng Pháp Lý Vững Chắc Cho Dự Án Khởi Nghiệp Học Đường`.
  - **Trụ cột 1 // Nghị định 01/2021/NĐ-CP (Khoản 2 Điều 79)**: Hoạt động kinh doanh nhỏ lẻ, buôn bán lưu động của học sinh có thu nhập thấp không thuộc diện bắt buộc đăng ký Hộ kinh doanh.
  - **Trụ cột 2 // Bộ luật Dân sự 2015 (Khoản 4 Điều 21)**: Người từ đủ 15 tuổi đến dưới 18 tuổi có quyền tự mình xác lập, thực hiện giao dịch dân sự phục vụ nhu cầu sinh hoạt, học tập.
  - **Trụ cột 3 // Thông tư 40/2021/TT-BTC (Điều 4)**: Doanh thu dưới 100 triệu đồng/năm thuộc diện **hoàn toàn miễn thuế GTGT và thuế TNCN**.
  - **Băng chân trang // Kinh tế tuần hoàn & EPR**: Kéo dài vòng đời máy tính thêm 3-5 năm; thu gom pin cũ hỏng chuyển về cơ sở xử lý rác thải nguy hại, bảo vệ môi trường học đường.

### SLIDE 07: BỘ GIÁP PHẢN BIỆN - 6 CÂU HỎI KINH ĐIỂN CỦA GIÁO VIÊN
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 5 Rubric II (2,0đ Năng lực phản biện).
- **Nguyên lý bố cục**: Ma trận Chiến lược 2x3 với các nhãn định vị nổi bật.
- **Chi tiết chuyển đổi**:
  - Tiêu đề H2: `Sẵn Sàng Trả Lời Trực Diện 6 Câu Hỏi Hóc Búa Của Thầy Cô`.
  - Phân loại rõ ràng 6 câu hỏi và câu trả lời súc tích, dứt khoát:
    1. *Học sinh kinh doanh có vi phạm pháp luật?* $\rightarrow$ Đúng Điều 21 BLDS 2015 và Điều 79 NĐ 01/2021; có phụ huynh đồng thuận giám sát.
    2. *Khách hủy cọc thì xử lý thế nào?* $\rightarrow$ Tiền cọc bù chi phí vận chuyển 2 chiều; chuyển máy cho bạn học trong danh sách chờ.
    3. *Máy lỗi trong 30 ngày lấy tiền đâu bù?* $\rightarrow$ Đã trích lập Quỹ dự phòng bảo hành 100k/máy (2 triệu/lô) và thỏa thuận đổi mới từ tổng kho.
    4. *Cạnh tranh với Thế Giới Di Động, FPT ra sao?* $\rightarrow$ Chuỗi lớn không bán máy dưới 6 triệu; nhóm cạnh tranh bằng giá gốc và hỗ trợ kỹ thuật tại chỗ.
    5. *Làm sao chứng minh máy không phải hàng trộm cắp?* $\rightarrow$ Tra cứu Service Tag/Serial trên trang chủ Dell/Lenovo; mở đáy kiểm tra bo mạch zin 100%.
    6. *Kinh doanh có làm sao nhãng việc học?* $\rightarrow$ 4 thành viên phân ca khoa học; Bot Autopost vận hành tự động; chỉ giao máy ngoài giờ học.

### SLIDE 08: MINH CHỨNG THỰC TẾ (10 ẢNH: 4 BIÊN LAI BIDV & 6 CHAT THẬT)
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 7 Rubric I (1,0đ) & Tiêu chí 2 Rubric II (2,0đ Đạo cụ & Minh chứng).
- **Nguyên lý bố cục**: Curated Evidence Dossier (Triển lãm Minh chứng Song song 45% / 55%).
- **Chi tiết chuyển đổi**:
  - **Phân khu Dòng tiền Ngân hàng BIDV (Trái 45%)**:
    - Tiêu đề phụ: `4 BIÊN LAI CỌC QUA NGÂN HÀNG BIDV // STK: 8883451443 (VUONG GIA)`.
    - Con số tổng tiền thật nổi bật: `2.000.000 VNĐ TIỀN THẬT ĐÃ PHÁT SINH`.
    - Lưới 4 ảnh biên lai sắc nét, hiển thị rõ số tiền in đậm:
      1. `coc_200k_thuy_nhung.jpg`: **+200.000 đ** &bull; Võ Thị Thùy Nhung (MGD: 144069664).
      2. `coc_500k_thanhvu.jpg`: **+500.000 đ** &bull; Thanh Vu Store (MGD: 149820512).
      3. `chuyenkhoan_1tr_thanhvu.jpg`: **+1.000.000 đ** &bull; Thanh Vu Store (MGD: 143684140).
      4. `chuyenkhoan_300k_kimhoa.jpg`: **+300.000 đ** &bull; Nguyễn Thị Kim Hoa (MGD: 2788).
  - **Phân khu Nhật ký Tương tác Khách hàng (Phải 55%)**:
    - Tiêu đề phụ: `6 ĐOẠN TIN NHẮN TƯ VẤN & CHỐT ĐƠN THẬT // HOTLINE: 0876637806`.
    - Lưới 6 ô đại diện cho 6 phân khúc khách hàng kèm câu trích dẫn nguyên văn (Verbatim Quotes):
      1. `chat_hocsinh_nguyen_thua.jpg`: Học sinh THPT — *"Ê có máy 3đ ko... chỉ để học onl vs làm pp thôi"*.
      2. `chat_thay_quang_toan_gv.jpg`: Thầy Quang Toán — *"Con này còn ko? Có ưu đãi giáo viên ko?"*.
      3. `chat_phuhuynh_co_le_ghi.jpg`: Phụ huynh Cô Lê — Hỏi mua Dell Latitude 5320 cho con học tập.
      4. `chat_tran_quoc_khanh_fb.jpg`: Khách Fanpage — Tương tác qua bài đăng công cụ Autopost.
      5. `chat_khach_a_mau_hinh_that.jpg`: Khách A Mậu — *"Chụp mình xem này"* (Gửi ảnh máy thật 100%).
      6. `chat_phan_trieu_messenger.jpg`: Khách Phan Triệu — Chốt đơn máy và trao đổi qua Zalo.
  - Hệ thống **HD Lightbox Modal**: Nhấp vào bất kỳ ảnh nào sẽ mở cửa sổ phóng to toàn màn hình sắc nét, hiển thị đầy đủ chi tiết giao dịch.

### SLIDE 09: KỊCH BẢN THUYẾT TRÌNH 8 PHÚT & TUYÊN NGÔN KẾT LUẬN
- **Mục tiêu sư phạm**: Đạt điểm tối đa Tiêu chí 1 Rubric II (2,0đ Quản trị thời gian) & Khép lại bài thi xuất sắc.
- **Nguyên lý bố cục**: Lộ trình Thời gian 8 Phút đối sánh Tuyên ngôn Giá trị.
- **Chi tiết chuyển đổi**:
  - **Bên Trái (Kịch bản 8 Phút)**:
    - Lộ trình 5 chặng phân công rõ ràng từng thành viên:
      - `0:00 - 01:30` (CEO Vương Gia - 1,5p): Nêu vấn đề, mô hình JIT và cơ cấu nhóm.
      - `01:30 - 03:00` (CMO Giám đốc Tiếp thị - 1,5p): Công bố khảo sát $N=120$ & Chiến lược 4P.
      - `03:00 - 05:00` (CFO Giám đốc Tài chính - 2,0p): Chứng minh hòa vốn $Q=0$ & Căn cứ pháp lý NĐ 01/2021.
      - `05:00 - 06:30` (CTO Giám đốc Công nghệ - 1,5p): Kiểm định 15 bước & Demo Bot Autopost.
      - `06:30 - 08:00` (Toàn bộ 4 thành viên - 1,5p): Chiếu 10 minh chứng ngân hàng BIDV & Sẵn sàng phản biện.
  - **Bên Phải (Tuyên ngôn Khép lại & Lời Cảm Ơn)**:
    - Câu châm ngôn đĩnh đạc: *"Khởi nghiệp không bắt đầu từ số vốn khổng lồ, mà từ sự thấu hiểu nỗi đau của người dùng."*
    - Lời cảm ơn trang trọng và lời mời Hội đồng Giám khảo đặt câu hỏi phản biện.

---

## 4. KIẾN TRÚC HIỆU ỨNG MORPH NHƯ POWERPOINT (POWERPOINT MORPH ENGINE)

Để tái hiện hoàn hảo trải nghiệm chuyển cảnh Morph trứ danh của PowerPoint trên nền tảng Web hiện đại, hệ thống ứng dụng kiến trúc hai lớp:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│             KIẾN TRÚC ĐỘNG CƠ MORPH (VIEW TRANSITIONS & SPRING PHYSICS)                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. NATIVE VIEW TRANSITIONS API LAYER (document.startViewTransition)                     │
│    • Chụp trạng thái DOM cũ và mới, tự động nội suy vị trí và kích thước phần tử.    │
│    • Đường cong gia tốc Spring Bézier: cubic-bezier(0.16, 1, 0.3, 1) trong 450ms.     │
│    • Gán view-transition-name cho các phần tử xuyên suốt: #slideProgressBar,...        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. CSS SPRING TRANSFORM STAGGER ENGINE (FALLBACK & IN-SLIDE PHYSICS)                  │
│    • Các phần tử con trong từng slide được gắn lớp .morph-item và độ trễ bậc thang.   │
│    • .morph-delay-1 (0.04s), .morph-delay-2 (0.08s), .morph-delay-3 (0.12s).          │
│    • Hiệu ứng trồi lên tinh tế translateY(16px -> 0) với độ mượt mà cao cấp.          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. ĐIỀU KHIỂN THẦM LẶNG & TƯƠNG TÁC ĐA ĐIỂM                                            │
│    • Phím tắt bàn phím: [Mũi tên phải], [Space], [Enter], [PageDown] -> Slide tiếp     │
│    • [Mũi tên trái], [PageUp], [Backspace] -> Slide trước; [Home] -> S1, [End] -> S9   │
│    • Vùng nhấp chuột: 40% bên trái lùi trang, 60% bên phải tiến trang.                 │
│    • Cử chỉ vuốt cảm ứng (Touch Swipe) cho màn hình tương tác và tablet.              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. ĐẶC TẢ TÍCH HỢP 10 TỆP MINH CHỨNG THỰC TẾ (`public/evidence/`)

Toàn bộ 10 tệp hình ảnh được đối soát đường dẫn, kích thước và nội dung xác thực:

| STT | Tên tệp ảnh | Phân loại | Số tiền / Đối tượng | Nội dung xác thực nghiệp vụ |
|:---:|:---|:---|:---|:---|
| 01 | `evidence/coc_200k_thuy_nhung.jpg` | Biên lai BIDV | **200.000 VNĐ** | Võ Thị Thùy Nhung cọc máy học sinh &bull; STK 8883451443 |
| 02 | `evidence/coc_500k_thanhvu.jpg` | Biên lai BIDV | **500.000 VNĐ** | Thanh Vu Store cọc máy đối tác &bull; STK 8883451443 |
| 03 | `evidence/chuyenkhoan_1tr_thanhvu.jpg` | Biên lai BIDV | **1.000.000 VNĐ** | Thanh Vu Store tất toán đợt hai &bull; STK 8883451443 |
| 04 | `evidence/chuyenkhoan_300k_kimhoa.jpg` | Biên lai BIDV | **300.000 VNĐ** | Nguyễn Thị Kim Hoa chuyển tiền cọc &bull; STK 8883451443 |
| 05 | `evidence/chat_hocsinh_nguyen_thua.jpg` | Chat thực tế | Bạn Nguyễn Thừa | Hỏi mua laptop 3-5tr học online và làm bài PowerPoint |
| 06 | `evidence/chat_thay_quang_toan_gv.jpg` | Chat thực tế | Thầy Quang (GV Toán) | Hỏi mua máy giảng dạy và chính sách ưu đãi giáo viên |
| 07 | `evidence/chat_phuhuynh_co_le_ghi.jpg` | Chat thực tế | Phụ huynh Cô Lê | Hỏi bảng giá và cấu hình Dell Latitude 5320 cho con |
| 08 | `evidence/chat_tran_quoc_khanh_fb.jpg` | Chat thực tế | Trần Quốc Khánh | Inbox mua máy từ bài đăng tự động của phần mềm Autopost |
| 09 | `evidence/chat_khach_a_mau_hinh_that.jpg` | Chat thực tế | Khách A Mậu | Yêu cầu chụp ảnh thật máy, kiểm tra bo mạch và vỏ nhôm |
| 10 | `evidence/chat_phan_trieu_messenger.jpg` | Chat thực tế | Khách Phan Triệu | Chốt đơn máy và xác nhận giao dịch qua Messenger/Zalo |

---

## 6. KẾT LUẬN & CHỈ THỊ TRIỂN KHAI CHO DEVELOPER

Bản phê duyệt thiết kế này là mệnh lệnh kỹ thuật bắt buộc để tiến hành viết lại toàn bộ `public/slides.html`. Mọi chi tiết từ màu sắc, kích thước chữ, cấu trúc lưới mở không dùng card, hiệu ứng morph và 10 tệp minh chứng phải được thi công chính xác 100%, sẵn sàng cho vòng thẩm định độc lập của Ban Kiểm định Teamwork Auditor.
