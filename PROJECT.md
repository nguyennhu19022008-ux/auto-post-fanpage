# Project: Tái thiết kế toàn diện Slide Trình chiếu "Laptop Vương Gia" (GD KT-PL)

## Architecture
- **Mục tiêu**: Nâng cấp toàn diện tệp `public/slides.html` trở thành bộ slide trình chiếu web tiêu chuẩn học thuật & kinh doanh cấp cao (Swiss-Strategy Hybrid), phục vụ bảo vệ đồ án Kế hoạch Kinh doanh khởi nghiệp môn GD KT-PL trước hội đồng chấm thi với mục tiêu điểm tối đa 20.0/20.0 (Rubric I: 10đ, Rubric II: 10đ).
- **Kiến trúc công nghệ**:
  - Tệp duy nhất tự chứa (Self-contained static HTML): `public/slides.html`.
  - Framework styling: Tailwind CSS CDN (`https://cdn.tailwindcss.com`) kết hợp CSS biến màu mở rộng.
  - Typography: Google Fonts (`Plus Jakarta Sans`, `Be Vietnam Pro`, `JetBrains Mono`, `Anton` cho Slide 0).
  - Biểu tượng: 100% Inline SVG chuẩn Heroicons/Lucide sắc nét, loại bỏ hoàn toàn emoji biểu tượng.
  - Quản lý trạng thái: JavaScript Vanilla với các module chức năng (State, Navigation, Timer 8 phút, Lightbox Modal, Slide Overview, Keyboard & Touch/Swipe Listeners).
  - Môi trường phục vụ: Node.js/Express (`server.js`) và Vercel Serverless (`vercel.json`), cấu hình tiêu đề `Cache-Control: public, max-age=0, must-revalidate` chống ngộ độc cache.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Slide 0: Bản quyền DESIGN BY VUONGGIA | Giao diện đơn sắc OLED black (#000000), 5 hàng marquee nghiêng -32°, bảng kính mờ chứng nhận sở hữu trí tuệ, tech marks, nút đóng X, 2 nút sao chép email/hotline, ẩn hoàn toàn dock/timer | M1 | ORIGINAL_REQUEST & vuonggia-copyright-slide |
| 2 | Loại bỏ AI-Slop & Tím mờ | Xóa bỏ toàn bộ gradient tím mờ, halo glow, `bg-clip-text`, thay thế các class tím còn sót (`text-purple-700`) bằng Sapphire Tech (`#1E40AF` / `#2563EB`) | M1 | ORIGINAL_REQUEST & Explorer 3 Survey |
| 3 | Cardless Open Editorial Grid | Loại bỏ các hộp card bo viền xám lặp lại (anti-card-slop); chuyển sang bố cục thoáng mở, nhịp điệu khoảng trắng tự nhiên và đường gióng thanh mảnh 1px (`#E2E8F0`) | M1 | User Aesthetic Rules & Explorer 3 |
| 4 | Bold & Balanced Typography | Phóng to Action Titles (`text-3xl sm:text-4xl lg:text-5xl`), số liệu tài chính đột phá (`text-6xl` - `text-8xl`), nội dung chính (`text-base` - `text-lg`), cân đối chuẩn 16:9 widescreen | M1 | User Aesthetic Rules & Explorer 3 |
| 5 | Bảo toàn 9 phần Kế hoạch Kinh doanh KT-PL | Tích hợp chi tiết đầy đủ 9 phần: Ý tưởng & Nỗi đau, Khảo sát N=120, Lean Canvas & SMART, 4P Marketing, Vận hành JIT & 15 bước QC, Nhân sự 4 Co-founders, Tài chính $Q=0$ & 92M, Quản trị rủi ro SWOT, Pháp lý KT-PL & Đạo đức môi trường | M1 | BAN_KE_HOACH_KINH_DOANH_CHI_TIET_KTPL.md |
| 6 | Bám sát & Tối đa hóa 2 Rubric KT-PL | Tích hợp đầy đủ 7 tiêu chí Rubric I (10đ) và 5 tiêu chí Rubric II (10đ), kịch bản thuyết trình 8 phút, phân vai 4 thành viên và bộ giáp phản biện 6 câu hỏi giáo viên | M1 | Explorer 1 Survey & Rubric Spec |
| 7 | Tích hợp 10 Minh chứng Thực tế Uncropped | Hiển thị đầy đủ 10 ảnh trong `public/evidence/` (4 biên lai ngân hàng BIDV STK 8883451443, 6 đoạn chat khách hàng) với bố cục chia cụm kiến trúc 5/12 + 7/12, không cắt xén, kèm Lightbox Modal nét cao | M1 | public/evidence/ & Explorer 2 Survey |
| 8 | Hệ thống Điều hướng & Tương tác Hoàn chỉnh | Hỗ trợ phím tắt (`ArrowRight`, `ArrowLeft`, `Space`, `Enter`, `PageDown`, `PageUp`, `Home`, `End`, `F`, `O`, `T`, `Escape`), thanh dock nổi, thanh tiến trình đọc trên cùng (Top Progress Bar) và bổ sung Touch/Swipe vuốt màn hình cho tablet/mobile | M1 | Explorer 2 Survey & User Rules |
| 9 | Calm Mobile Performance & Responsive | Trên màn hình nhỏ (<768px), tắt animation marquee/transition nặng, cho phép cuộn dọc tự nhiên, giữ phản hồi tức thì và không đè chữ vỡ bố cục | M1 | User Aesthetic Rules |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Triển khai Tái thiết kế Toàn diện public/slides.html | Cập nhật trực tiếp `public/slides.html` hoàn thành toàn bộ 9 tính năng trong Feature Inventory (Slide 0, Swiss Grid, Typography, 9 phần KT-PL, 2 Rubric, 10 ảnh minh chứng, điều hướng phím & touch) | none | DONE |
| M2 | Kiểm định & Nghiệm thu Đối kháng Toàn diện | 2 Reviewers độc lập + 2 Challengers kiểm thử tương tác thực tế / phím tắt / tính toàn vẹn minh chứng + 1 Forensic Auditor kiểm định tính xác thực và chống gian lận | M1 | DONE (Gate PASSED) |

## Interface Contracts
### DOM & Navigation State Engine
```javascript
// Biến trạng thái toàn cục
let currentSlide = 0; // 0: Slide 0 bản quyền, 1..9: Các slide nội dung
const totalSlides = 9; // Không tính slide 0 vào tổng số slide trình chiếu chính

// Hợp đồng hàm điều hướng
function showSlide(index, direction);
function nextSlide();
function prevSlide();
function goToSlide(index);
function toggleFullscreen();
function toggleOverviewModal();
function toggleTimer();
function openLightbox(src, title, desc);
function closeLightbox();
function copyToClipboard(text, type);
```

### Display Contract Slide 0 vs Slide 1..9
- `currentSlide === 0`:
  - Ẩn hoàn toàn `#slideDock` (`display: none`)
  - Ẩn hoàn toàn `#timerBar` và các thanh điều khiển trình chiếu
  - Khung hình toàn màn hình `100vw` / `100vh` tĩnh, không cuộn
  - Kích hoạt marquee 5 hàng chữ nghiêng `-32deg`
- `currentSlide >= 1`:
  - Hiển thị `#slideDock` (`display: flex`) với định dạng `SLIDE 0X / 09`
  - Hiển thị thanh tiến trình đọc trên cùng (`#topProgressBar`)
  - Hiển thị đồng hồ đếm ngược 8 phút (`#timerBar`)

## Code Layout
- `public/slides.html`: Tệp nguồn slide trình chiếu duy nhất được phép chỉnh sửa
- `public/evidence/`: Thư mục chứa 10 tệp ảnh minh chứng thực tế (Chỉ đọc)
- `.agents/teamwork/`: Thư mục lưu trữ siêu dữ liệu, báo cáo tiến độ và biên bản kiểm định (Chỉ đọc/ghi metadata)
