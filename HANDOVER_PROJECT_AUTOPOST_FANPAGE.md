# TÀI LIỆU BÀN GIAO TOÀN DIỆN DỰ ÁN (PROJECT HANDOVER SPECIFICATION)
## HỆ THỐNG TỰ ĐỘNG HÓA TIẾP THỊ & ĐĂNG BÀI BÁN LAPTOP LÊN FACEBOOK FANPAGE
### THƯƠNG HIỆU: LAPTOP VƯƠNG GIA // AUTO-POST FANPAGE SYSTEM
*(Biên soạn độc lập phục vụ chuyển giao toàn diện kiến trúc kỹ thuật & quy trình vận hành)*

---

## 1. TỔNG QUAN DỰ ÁN & THÔNG TIN CHỦ SỞ HỮU (EXECUTIVE SUMMARY)

### 1.1. Mục Tiêu & Bản Chất Dự Án
Hệ thống phần mềm trọn gói (Full-stack Automation Platform) phục vụ hoạt động kinh doanh bán lẻ laptop cũ/lướt tuyển chọn từ Nhật Bản & Mỹ (Dell Latitude, ThinkPad, HP EliteBook) của thương hiệu **Laptop Vương Gia**:
- Tự động hóa 95% quy trình đăng bài tiếp thị từ các nhóm Zalo tổng kho sỉ lên Facebook Fanpage.
- Ứng dụng Trí tuệ Nhân tạo (Google Gemini) để bóc tách cấu hình phần cứng, lọc sạch 100% tiếng lóng và giá sỉ của nhà buôn (như *"lương 500k"*, *"hoa hồng CTV"*, *"giá sỉ kho"*...), viết lại thành bài bán lẻ thu hút chuẩn phong cách mạng xã hội.
- Đồng bộ đa kênh: Tiện ích Chrome Extension 1-click trên Zalo Web, Trợ lý Bot Telegram điều khiển từ xa, Thông báo email tức thời qua Gmail SMTP, Lập lịch đăng bài tự động theo 4 khung giờ vàng mỗi ngày và Bảng điều khiển Web Cockpit giao diện Warm Neo-Brutalist / Student Craft.

### 1.2. Thông Tin Chủ Sở Hữu & Định Danh Hệ Thống
- **Chủ nhiệm đề án & Quản trị viên:** Nguyễn Như Vương Gia (Nguyễn Văn Vương)
- **Số điện thoại / Zalo điều hành:** `0876 637 806`
- **Email quản trị:** `nguyennhu19022008@gmail.com`
- **Facebook cá nhân:** `https://www.facebook.com/gia.vuong.792602`
- **Facebook Fanpage kinh doanh:** [Laptop Nhật Bãi Giá Rẻ - Gia Vương](https://www.facebook.com/profile.php?id=61590327190720) (Page ID nội bộ: `61590327190720` / App ID: `1154184381110692`)
- **Tài khoản ngân hàng đối soát giao dịch:** `8883451443` — NGUYEN VAN VUONG (Ngân hàng TMCP Đầu tư và Phát triển Việt Nam - BIDV)

### 1.3. Kho Mã Nguồn & Triển Khai Trực Tuyến
- **Kho lưu trữ GitHub chính thức:** `https://github.com/nguyennhu19022008-ux/auto-post-fanpage.git`
- **Môi trường Production (Vercel):** `https://auto-post-fanpage-coral.vercel.app/`
- **Môi trường Cục bộ (Localhost):** `http://localhost:3000` (Khởi chạy bằng `start.bat` hoặc `npm start`)
- **Thư mục mã nguồn cục bộ trên máy:** `C:\Users\Admin\.gemini\antigravity\scratch\fb-laptop-autopost`

---

## 2. KIẾN TRÚC KỸ THUẬT & CÔNG NGHỆ (TECHNICAL ARCHITECTURE)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CÁC KÊNH ĐẦU VÀO DỮ LIỆU                                │
│                                                                                        │
│  [Zalo Web (chat.zalo.me)]          [Telegram Bot]             [Web Cockpit Dashboard] │
│   Nhóm "CTV - ĐL LAPTOP"          Forward Album + Text         Dán text thô / Tải ảnh  │
│             │                              │                              │            │
│             ▼                              ▼                              ▼            │
│  Chrome Extension Manifest V3      Telegram Webhook API           REST API Endpoints   │
│  (1-Click Data & HD Img Push)      (Debounce Media Groups)        (Multipart Upload)   │
└────────────────────────────────────────────┬───────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              HỆ THỐNG XỬ LÝ TRUNG TÂM (CORE)                           │
│                                                                                        │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌────────────────────────┐  │
│  │   AI Gemini Engine      │  │  Data Post & Templates  │  │  Scheduler / Cron      │  │
│  │   - Bóc tách cấu hình   │  │  - Smart Matching       │  │  - 4 Khung giờ vàng    │  │
│  │   - Xóa tiếng lóng sỉ   │  │  - Circular Inventory   │  │  - Auto Slot Finder    │  │
│  │   - Viết bài bán lẻ     │  │  - Quản lý hàng đợi     │  │  - Chống trùng bài     │  │
│  └─────────────────────────┘  └─────────────────────────┘  └────────────────────────┘  │
│                                            │                                           │
│                                            ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │  Lớp Dữ Liệu Kép: Local JSON (data/posts.json) <── Sync ──> Supabase PostgreSQL  │  │
│  │  Supabase Project Ref: egjxezhoohzgpbyukfwr (Storage Bucket: media-uploads)      │  │
│  └──────────────────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────┬───────────────────────────────────────────┘
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               CÁC ĐẦU RA & KÊNH PHÂN PHỐI                              │
│                                                                                        │
│  [Facebook Graph API v21.0]         [Gmail SMTP Alerts]            [Telegram Alerts]   │
│   Đăng Album Multi-Photo HD          Gửi email báo cáo              Báo cáo trạng thái │
│   (Gắn Hotline 0876637806)           khi đăng bài thành công        kèm nút tương tác  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Công Nghệ Nền Tảng (Tech Stack):
- **Runtime:** Node.js (v24.x)
- **Backend Framework:** Express.js (`server.js`, `api/index.js`)
- **Database & Cloud Storage:** Dual-layer: Local JSON Database (`data/posts.json`, `data/settings.json`) đồng bộ hai chiều với **Supabase PostgreSQL & Supabase Storage Bucket** (`@supabase/supabase-js`).
- **AI Processing:** Google Gemini API (`gemini-3.5-flash`, `gemini-3.5-flash-lite`, `gemini-3.8-flash`) với cơ chế tự động chuyển đổi mô hình (Fallback Mechanism).
- **Mạng xã hội:** Facebook Graph API v21.0 (Xác thực qua Page Access Token dài hạn, đăng tải đa ảnh dạng Album đính kèm vào bài viết).
- **Thông báo & Tự động hóa:**
  - `node-cron`: Lập lịch tác vụ theo múi giờ `Asia/Ho_Chi_Minh`.
  - `nodemailer`: Gửi thư thông báo tự động qua Gmail SMTP.
  - `Telegram Bot API`: Webhook hai chiều điều khiển và nhận bài viết từ điện thoại.
- **Tiện ích mở rộng:** Chrome Extension Manifest V3 viết bằng Vanilla JS/CSS không phụ thuộc thư viện ngoài.
- **Giao diện Web:** Warm Neo-Brutalist / Student Craft (Tailwind CSS, SVG Icons, PWA Service Worker hỗ trợ cài đặt app lên màn hình điện thoại).

---

## 3. CÁC PHÂN HỆ CHỨC NĂNG CỐT LÕI (CORE SUBSYSTEMS)

### 3.1. Phân Hệ Tiện Ích Chrome Extension Zalo 1-Click (`extension/`)
- **Tên tiện ích:** `Laptop Vương Gia // Zalo Autopost 1-Click` (v1.0.0).
- **Phạm vi hoạt động:** Tự động chèn script vào trang `https://chat.zalo.me/*`.
- **Cơ chế bóc tách:**
  - Lắng nghe các tin nhắn chào bán laptop của các tổng kho trong nhóm chat (tiêu biểu: nhóm *"CTV - ĐL LAPTOP"*).
  - Tự động nhận diện tin nhắn chứa thông số máy, truy vấn toàn bộ hình ảnh đính kèm có độ phân giải gốc trên CDN Zalo (`https://*.zadn.vn/*`).
  - Hiển thị nút bấm nổi Neo-Brutalist trực tiếp trên tin nhắn Zalo: **"Đẩy sang Fanpage"**.
  - Khi người dùng nhấn nút, Extension đóng gói toàn bộ Text + Mảng URL ảnh HD và gửi gói tin HTTP POST về Endpoint `/api/extension/push-post` của máy chủ.

### 3.2. Phân Hệ Xử Lý Ngôn Ngữ Tự Nhiên & Gemini AI (`services/gemini.js`)
- **Chuỗi mô hình tự phục hồi (Fallback Chain):** `gemini-3.5-flash` ➔ `gemini-3.5-flash-lite` ➔ `gemini-3.8-flash`.
- **Nhiệm vụ bóc tách & Lọc từ ngữ nhạy cảm:**
  1. *Lọc bỏ triệt để:* Xóa sạch toàn bộ từ ngữ mang tính nội bộ đại lý: *"lương 500k"*, *"hoa hồng CTV"*, *"giá sỉ"*, *"kho sỉ Thanh Vũ"*, số điện thoại của người bán sỉ.
  2. *Bóc tách cấu hình:* Định danh chính xác Tên hãng, Dòng máy (ThinkPad, Dell Latitude, HP EliteBook), CPU (Intel Core / AMD Ryzen), RAM, SSD, Kích thước màn hình, Tình trạng pin, Card đồ họa.
  3. *Soạn thảo bài bán lẻ thu hút:*
     - Tiêu đề phong cách chuyên nghiệp: `🔥 [SIÊU PHẨM GIÁ TỐT] - MÃ MÁY: [TÊN LAPTOP]`.
     - Liệt kê cấu hình rõ ràng bằng ký tự gạch đầu dòng thẩm mỹ.
     - Tự động gắn chính sách bảo hành mặc định: *Bảo hành 12 tháng, 1 đổi 1 trong 30 ngày, tặng kèm sạc zin, chuột không dây, túi chống sốc*.
     - Gắn cố định thông tin liên hệ: **Hotline / Zalo: `0876637806` — Gia Vương**.

### 3.3. Phân Hệ Lập Lịch Khung Giờ Vàng (Auto Scheduler & Cron Engine)
- **4 Khung giờ vàng mặc định (Golden Posting Hours):**
  - **Sáng:** `08:30` (Đón đầu giờ làm việc và học tập)
  - **Trưa:** `11:45` (Giờ nghỉ trưa, lướt mạng xã hội cao điểm)
  - **Chiều:** `15:30` (Khung giờ xế chiều giải lao)
  - **Tối:** `20:00` (Khung giờ vàng mua sắm và giải trí gia đình)
- **Thuật toán tự động tìm khe thời gian (`getNextAvailableScheduleTime`):**
  - Quét toàn bộ hàng đợi trong ngày. Nếu khung giờ gần nhất đã có bài, hệ thống tự động nhảy sang khung giờ tiếp theo hoặc chuyển sang ngày hôm sau, tránh tình trạng đăng dồn dập bị Facebook bóp tương tác.
- **Chống trùng lặp nội dung (`utils/dedup.js`):**
  - So sánh mã máy và văn bản để ngăn chặn việc đăng cùng một chiếc laptop nhiều lần trong 48 giờ.

### 3.4. Phân Hệ Facebook Graph API & Đăng Album Ảnh HD (`services/facebook.js`)
- **Quy trình xuất bản bài viết nhiều ảnh (Multi-photo Album Publishing):**
  1. Bước 1: Duyệt qua từng ảnh trong danh sách tải lên (tối đa 35 ảnh/bài).
  2. Bước 2: Gọi POST tới `https://graph.facebook.com/v21.0/{FANPAGE_ID}/photos` với tham số `published=false` để lấy về danh sách các `media_fbid`.
  3. Bước 3: Gọi POST tới `https://graph.facebook.com/v21.0/{FANPAGE_ID}/feed` truyền nội dung bài viết và danh sách `attached_media: [{media_fbid: "..."}, ...]`.
  4. Kết quả: Tạo thành một bài viết Album ảnh HD hoàn chỉnh, hiển thị đẹp mắt trên cả máy tính và ứng dụng điện thoại.

### 3.5. Phân Hệ Trợ Lý Telegram Bot Hai Chiều (`services/telegram.js`)
- **Token Bot Telegram:** `9228447935:AAHd0nXxu2Jx98RO_d8V17cJpYMZbd8DT38`
- **Cơ chế gom nhóm Album (Media Group Debouncing):**
  - Khi người dùng dùng điện thoại chia sẻ 5 - 10 bức ảnh laptop cùng lúc vào bot Telegram, Telegram sẽ bắn 5 - 10 webhook riêng lẻ có chung mã `media_group_id`.
  - Bot sử dụng bộ đệm bộ nhớ `mediaGroupBuffer` với timer 1.5 giây để gom toàn bộ ảnh thành một bài đăng duy nhất thay vì tạo nhiều bài lẻ.
- **Tính năng điều khiển qua tin nhắn:**
  - Nhận nội dung thô ➔ Tự gọi Gemini viết bài ➔ Trả về bản nháp cho người dùng xem trước kèm nút bấm `[Đăng Ngay]` hoặc `[Lên Lịch Tự Động]`.
  - Lệnh kiểm tra nhanh: `/next` (xem bài kế tiếp), `/queue` (xem danh sách chờ), `/status` (tình trạng hệ thống).

### 3.6. Phân Hệ Thông Báo Email (Gmail SMTP - `services/mailer.js`)
- Cấu hình qua dịch vụ Gmail với Mật khẩu ứng dụng (App Password).
- Tự động gửi thư thông báo chi tiết khi:
  - Một bài đăng được xuất bản thành công lên Fanpage (kèm đường dẫn trực tiếp tới bài viết trên Facebook).
  - Một bài đăng đến giờ lên lịch nhưng thiếu hình ảnh hoặc gặp lỗi xác thực Facebook Token.

### 3.7. Phân Hệ "DATA POST" & Mẫu Tuần Hoàn (`services/dataPost.js`)
- Quản lý kho mẫu các dòng máy thông dụng (Dell Latitude 3410, ThinkPad T480s, HP EliteBook 830 G6...).
- Hỗ trợ cơ chế Smart Match: Khi nhận tin rao thô từ Zalo, hệ thống tự đối chiếu với kho mẫu để điền nhanh các thông số còn thiếu (chuẩn màn hình, loại ram, cổng kết nối).

---

## 4. DANH MỤC BIẾN MÔI TRƯỜNG & KHÓA BẢO MẬT (.ENV CONFIGURATION)

Khi bàn giao cho đoạn chat mới hoặc triển khai trên máy chủ mới, hãy tạo tệp `.env` tại thư mục gốc với các thông số sau:

| Tên biến môi trường | Ý nghĩa & Mô tả | Trạng thái hiện tại |
| :--- | :--- | :--- |
| `FB_PAGE_TOKEN` | Facebook Page Access Token dài hạn của Fanpage Laptop Vương Gia | Đã cấu hình xác thực quyền `pages_manage_posts`, `pages_read_engagement` |
| `FANPAGE_ID` | Định danh Trang Facebook (`61590327190720` hoặc ID ứng dụng `1154184381110692`) | Hoạt động bình thường |
| `GEMINI_API_KEY` | Khóa API Google Gemini để tạo nội dung và bóc tách bảng | Đã kích hoạt |
| `SMTP_USER` | Tài khoản Gmail gửi thông báo (`nguyennhu19022008@gmail.com`) | Đã kích hoạt |
| `SMTP_PASS` | Mật khẩu ứng dụng 16 ký tự Gmail (`qxjp favm yvvv qzpv`) | Đã kiểm thử gửi email thành công |
| `TELEGRAM_BOT_TOKEN` | Token điều khiển Bot Telegram (`9228447935:AAHd0nXxu2Jx98RO_d8V17cJpYMZbd8DT38`) | Hoạt động bình thường |
| `SUPABASE_URL` | Địa chỉ dự án Supabase Cloud (`https://egjxezhoohzgpbyukfwr.supabase.co`) | Hoạt động bình thường |
| `SUPABASE_KEY` / `ANON` | Khóa xác thực dịch vụ Supabase Service Role và Anon Token | Đã tích hợp đồng bộ dữ liệu |
| `PORT` | Cổng mạng chạy máy chủ Express nội bộ | Mặc định: `3000` |
| `CRON_SECRET` | Mã bí mật bảo vệ đường dẫn gọi Cron `/api/cron` | Tùy chọn |

---

## 5. BẢNG TRA CỨU ROUTE & API BACKEND (`server.js`)

| Phương thức | Đường dẫn API | Mục đích & Chức năng |
| :---: | :--- | :--- |
| `GET` | `/api/cockpit/status` | Kiểm tra trạng thái toàn diện hệ thống (kết nối FB, Gemini, Supabase, Cron) |
| `POST` | `/api/generate-content` | Nhận text Zalo thô ➔ Gọi Gemini bóc tách cấu hình và viết bài bán lẻ |
| `POST` | `/api/upload-media` | Tiếp nhận tải lên tối đa 35 tệp ảnh/video cho một bài viết |
| `POST` | `/api/posts` | Tạo mới một bài đăng vào hàng đợi (Queue) kèm lịch trình cụ thể |
| `GET` | `/api/posts` | Lấy danh sách toàn bộ bài viết trong hàng đợi kèm trạng thái |
| `POST` | `/api/posts/:id/publish-now` | Ép buộc đăng ngay lập tức một bài viết trong hàng đợi lên Facebook Fanpage |
| `POST` | `/api/extension/push-post` | Điểm tiếp nhận gói tin 1-click từ Chrome Extension Zalo Web |
| `POST` | `/api/telegram-webhook` | Điểm tiếp nhận tương tác hai chiều từ Telegram Bot |
| `GET` | `/api/cron` / `/api/cron-check` | Endpoint kích hoạt quét hàng đợi và xuất bản bài viết đến giờ |
| `GET` | `/api/next-slot` | Tính toán khung giờ vàng khả dụng tiếp theo trong ngày |
| `GET` | `/api/data-post/templates` | Lấy danh mục các bài mẫu và cấu hình laptop lưu sẵn |
| `POST` | `/api/data-post/smart-match` | Khớp nối tự động giữa tin nhắn thô và kho mẫu laptop |

---

## 6. CẤU TRÚC THƯ MỤC DỰ ÁN (PROJECT DIRECTORY TREE)

```
fb-laptop-autopost/
├── .env                          # Tệp biến môi trường và khóa bảo mật
├── .env.example                  # Mẫu cấu hình môi trường
├── package.json                  # Khai báo thư viện phụ thuộc (Express, Multer, Supabase, Axios...)
├── server.js                     # Máy chủ chính Express, khởi tạo Cron, API routing (32KB)
├── start.bat                     # File thực thi nhấp đúp 1 chạm để chạy hệ thống trên Windows
├── vercel.json                   # Cấu hình triển khai Serverless trên Vercel
├── api/
│   └── index.js                  # Entry point cho Vercel Serverless Functions
├── data/
│   ├── posts.json                # Cơ sở dữ liệu cục bộ lưu trữ các bài đăng và hàng đợi
│   └── settings.json             # Cấu hình lưu trữ cục bộ các thiết lập hệ thống
├── services/
│   ├── facebook.js               # Logic tương tác Facebook Graph API v21.0, Album photo publishing
│   ├── gemini.js                 # Logic bóc tách cấu hình, lọc tiếng lóng sỉ và viết bài bán lẻ
│   ├── scheduler.js              # Quản lý hàng đợi, tính toán 4 khung giờ vàng, Cron runner
│   ├── telegram.js               # Webhook xử lý Bot Telegram, gom nhóm media group debouncing
│   ├── mailer.js                 # Gửi email cảnh báo và báo cáo qua Gmail SMTP Nodemailer
│   ├── supabase.js               # Đồng bộ hóa dữ liệu với Cloud PostgreSQL & Supabase Storage
│   ├── tableParser.js            # Bóc tách dữ liệu từ các bài đăng dạng bảng thông số
│   └── dataPost.js               # Kho lưu trữ bài mẫu và máy tuần hoàn (Circular Data Engine)
├── utils/
│   └── dedup.js                  # Thuật toán kiểm tra và ngăn chặn trùng lặp nội dung bài đăng
├── extension/                    # Tiện ích Chrome Extension: Laptop Vương Gia Zalo Autopost
│   ├── manifest.json             # Khai báo Manifest V3, quyền chat.zalo.me
│   ├── content.js                # Script chèn nút "Đẩy sang Fanpage" vào giao diện Zalo Web
│   ├── background.js             # Service worker nền tảng xử lý dữ liệu và thông báo
│   ├── popup.html / popup.js     # Giao diện popup cấu hình địa chỉ máy chủ
│   └── styles.css                # Giao diện thông báo Toast Neo-Brutalist trên Zalo
└── public/                       # Giao diện Web Client & Trang quản trị
    ├── index.html                # Bảng điều khiển Web Cockpit chính (Live Preview, Form tạo bài)
    ├── quick-upload.html         # Giao diện tải ảnh nhanh bằng mã QR từ điện thoại
    ├── sw.js / manifest.json     # Cấu hình Progressive Web App (PWA) cài đặt lên điện thoại
    ├── css/                      # Tệp phong cách Warm Neo-Brutalist
    ├── js/                       # Mã nguồn tương tác Frontend
    └── uploads/                  # Thư mục lưu tạm hình ảnh máy tính tải lên nội bộ
```

---

## 7. HƯỚNG DẪN VẬN HÀNH DÀNH CHO KỸ SƯ / PHIÊN CHÁT MỚI (RUNBOOK)

### 7.1. Khởi Chạy Môi Trường Cục Bộ
1. Mở Terminal tại thư mục dự án:
   ```bash
   cd "C:\Users\Admin\.gemini\antigravity\scratch\fb-laptop-autopost"
   npm install
   npm start
   ```
2. Hoặc trên Windows: Nhấp đúp chuột vào tệp `start.bat`.
3. Truy cập vào Bảng điều khiển Web tại trình duyệt: `http://localhost:3000`.

### 7.2. Cài Đặt Tiện Ích Chrome Extension Lên Trình Duyệt
1. Mở trình duyệt Google Chrome, truy cập vào đường dẫn: `chrome://extensions/`.
2. Bật công tắc **"Chế độ dành cho nhà phát triển" (Developer mode)** ở góc trên bên phải.
3. Nhấp vào nút **"Tải tiện ích đã giải nén" (Load unpacked)**.
4. Trỏ đường dẫn đến thư mục: `C:\Users\Admin\.gemini\antigravity\scratch\fb-laptop-autopost\extension`.
5. Đăng nhập vào Zalo Web (`https://chat.zalo.me`), mở bất kỳ nhóm bán laptop nào (như *"CTV - ĐL LAPTOP"*), bạn sẽ thấy nút bấm tiện ích xuất hiện trực tiếp dưới các tin nhắn chứa ảnh và cấu hình.

### 7.3. Cách Hoạt Động Của Quy Trình Bán Hàng Hằng Ngày
1. Khi có hàng mới về trong nhóm Zalo sỉ, người dùng chỉ cần nhấp **"Đẩy sang Fanpage"** từ Zalo Extension (hoặc forward tin nhắn/ảnh vào Bot Telegram).
2. Hệ thống tự động đẩy bài vào hàng đợi, gán lịch đăng vào khung giờ vàng tiếp theo gần nhất (ví dụ `11:45`).
3. Đến đúng giờ, Cron job tự động xuất bản bài viết kèm toàn bộ ảnh HD lên Fanpage Facebook.
4. Hệ thống tự động gửi email thông báo về hộp thư `nguyennhu19022008@gmail.com` kèm link bài viết để người dùng theo dõi phản hồi và chốt đơn khách hàng.

---

## 8. TRẠNG THÁI HIỆN TẠI & LỘ TRÌNH KỸ THUẬT TIẾP THEO (NEXT STEPS BACKLOG)

### 8.1. Các Hạng Mục Đã Hoàn Thành 100%
- [x] Tích hợp thành công Facebook Graph API v21.0 đăng tải bài viết kèm Album ảnh HD.
- [x] Bộ lọc Gemini AI bóc tách cấu hình và loại bỏ sạch tiếng lóng giá sỉ.
- [x] Lập lịch tự động 4 khung giờ vàng với cơ chế tự tìm khe trống.
- [x] Tiện ích Chrome Extension Manifest V3 hoạt động ổn định trên Zalo Web.
- [x] Bot Telegram hỗ trợ nhận album ảnh bằng cơ chế debounce gom nhóm.
- [x] Thông báo email Gmail SMTP qua App Password.
- [x] Cơ chế lưu trữ kép Local JSON kết hợp đồng bộ đám mây Supabase.

### 8.2. Các Gợi Ý Phát Triển Tiếp Theo Cho Phiên Làm Việc Mới
1. **Tự Động Hóa Nhận Diện Khách Hàng (Lead Management):**
   - Lắng nghe bình luận và tin nhắn Messenger của khách hàng trên Fanpage để tự động trả lời báo giá cấu hình theo kịch bản thân thiện.
2. **Mở Rộng Kênh Đăng Bài Tự Động:**
   - Nghiên cứu tích hợp đăng bài chéo tự động lên các Hội nhóm Facebook chuyên về laptop sinh viên (Facebook Groups Automation) và kênh Zalo OA.
3. **Phân Tích Hiệu Quả Tương Tác (Analytics Insights):**
   - Bổ sung biểu đồ thống kê bài viết nào nhận được nhiều tương tác, tin nhắn và tỷ lệ chốt đơn cao nhất theo từng dòng máy (ThinkPad vs Dell vs HP).

---

*Tài liệu này đã bao quát toàn bộ nền tảng kỹ thuật của Hệ thống Tự động hóa Đăng bài Fanpage Laptop Vương Gia. Bất kỳ AI Agent hoặc Lập trình viên nào khi tiếp nhận tài liệu này đều có thể nắm bắt và tiếp tục phát triển dự án ngay lập tức mà không cần tra cứu lại lịch sử hội thoại trước đây.*
