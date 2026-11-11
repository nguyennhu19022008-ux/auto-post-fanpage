# Project: Rà soát & Khắc phục Toàn diện Hệ thống Autopost Laptop Zalo -> Facebook (Production Ready)

## Architecture
- **Mục tiêu**: Hoàn thiện toàn diện, khắc phục 100% lỗi phát hiện và đưa Hệ thống Autopost Laptop từ Zalo sang Facebook (Fanpage + Trang Cá Nhân) vào trạng thái vận hành hoàn hảo, không lỗi, sẵn sàng production.
- **Kiến trúc công nghệ**:
  - **Web Dashboard**: Vanilla JS + Tailwind CSS CDN, kiến trúc SPA không build tool, phục vụ qua Express / Vercel Serverless. Tuân thủ nghiêm ngặt quy tắc Slide 0 ("DESIGN BY VUONGGIA") Monochrome OLED, chống card-slop, solid ink typography.
  - **Backend & API**: Node.js/Express (`server.js`), Vercel Serverless Functions (`api/index.js`), tích hợp Meta Facebook Graph API v21.0 và Supabase Cloud (Storage `laptop-media` + PostgreSQL DB) với cơ chế fallback đọc/ghi tệp cục bộ (`data/*.json`).
  - **Chrome Extension**: Chuẩn Manifest V3 (`extension/manifest.json`), Background Service Worker (`background.js`), Content Script trích xuất bài đăng Zalo Web (`content.js`), Robot tự động đăng Facebook Cá Nhân (`fb_robot.js`), Popup Mini-App (`popup.html`/`popup.js`), Web Bridge tương tác Dashboard (`web_bridge.js`).
  - **E2E Testing Suite**: Bộ kiểm thử tự động độc lập 4-tier (`tests/e2e/test_runner.js`), bao phủ toàn diện Syntax, API status, Data schema, Facebook publishing và Chrome Extension DOM logic.

## Feature Inventory
| # | Feature / Defect | Description | Milestone | Source |
|---|------------------|-------------|-----------|--------|
| 1 | GAP-01: Endpoint Tuần Hoàn | Thêm route `POST /api/data-post/trigger-circular` trong `server.js` và logic tự chọn template/queue trong `services/dataPost.js` khi không có tham số | M1 | explorer_survey_backend |
| 2 | GAP-02: Status Publish-Now | Bắt `updatedPost.status === 'failed'` trả về HTTP 500 `{ success: false, error }`, trả về `facebookPostUrl: updatedPost.fbPostUrl` ở root response | M1 | explorer_survey_backend |
| 3 | GAP-03: Status Push-Post | Kiểm tra `published.status === 'failed'` trước khi phản hồi `{ success: true }` cho target `both` và `fanpage` | M1 | explorer_survey_backend |
| 4 | GAP-04: Fallback Fanpage ID | Bổ sung fallback `process.env.FANPAGE_ID || '1154184381110692'` tại `services/facebook.js:116` | M1 | explorer_survey_backend |
| 5 | GAP-05: Fallback Scheduler | Sửa logic chết tại `services/scheduler.js:30-32` để đảm bảo fallback xuống `data/posts.json` khi Supabase rỗng | M1 | explorer_survey_backend |
| 6 | DEF-EXT-01: Zalo Extract ReferenceError | Sửa lỗi `ReferenceError: text is not defined` tại `extension/content.js:289` trả về `{ text: finalFormattedText, mediaUrls }` | M2 | explorer_survey_extension |
| 7 | DEF-EXT-02: Zalo CDN Photos Discarded | Loại bỏ `src.includes('zadn.vn')` khỏi `isJunkIcon` trong `extension/content.js:178` để giữ nguyên toàn bộ ảnh laptop từ CDN Zalo | M2 | explorer_survey_extension |
| 8 | DEF-EXT-03: FB Robot HTTP Image Support | Cải tiến `urlToFile()` trong `extension/fb_robot.js` hỗ trợ cả Base64 Data URL lẫn HTTP/HTTPS/Blob URL từ Dashboard/Supabase | M2 | explorer_survey_extension |
| 9 | DEF-EXT-04: FB Robot aria-disabled Check | Kiểm tra `aria-disabled !== 'true'` trên nút Đăng Facebook tại `extension/fb_robot.js:280` trước khi click xuất bản | M2 | explorer_survey_extension |
| 10 | DEF-EXT-05: Popup Fanpage Immediate Flag | Bổ sung `publishImmediately: (target === 'fanpage' \|\| target === 'both')` trong `extension/popup.js:151-156` | M2 | explorer_survey_extension |
| 11 | DEF-EXT-06: Popup Link Property Fix | Sửa đọc `fbPostUrl` thay vì `facebookPostUrl` trong `extension/popup.js:175, 207` | M2 | explorer_survey_extension |
| 12 | DEF-EXT-07: Extension Host Permissions | Thêm `"https://*.supabase.co/*"` và `"http://127.0.0.1:3000/*"` vào `host_permissions` trong `manifest.json` | M2 | explorer_survey_extension |
| 13 | D1: Cockpit Preview ReferenceError | Khai báo alias toàn cục `window.openPostPreviewModal = viewQueuedPostContent;` trong `public/js/app.js` | M3 | explorer_survey_dashboard |
| 14 | D2: Cockpit Next Post "👤 Cá Nhân" Button | Bổ sung nút "👤 Cá Nhân" (`#cockpitPublishPersonalBtn`) trong Thẻ Bài kế tiếp (`index.html` & `app.js`) | M3 | explorer_survey_dashboard |
| 15 | D3: Cockpit Timeline "👤 Cá Nhân" Button | Bổ sung nút `👤 Cá Nhân` trong dòng thời gian Cockpit (`app.js:347-353`) | M3 | explorer_survey_dashboard |
| 16 | D4: Compose Modal "👤 ĐĂNG CÁ NHÂN" Button | Bổ sung nút "👤 ĐĂNG CÁ NHÂN" trong Modal Soạn bài lẻ và ngăn gọi Fanpage Graph API khi `target === 'personal'` | M3 | explorer_survey_dashboard |
| 17 | D5: Xóa 2 URL Ảnh Hỏng HP EliteBook 630 | Xóa 2 URL ảnh lỗi HTTP 400 (`1793880993077` và `1793880993717`) trong `data/model_templates.json` | M3 | explorer_survey_dashboard |
| 18 | D6: Vị trí Thẻ `<script>` Chuẩn | Di chuyển thẻ `<script src="/js/app.js">` trong `index.html` & `app.html` xuống trước thẻ đóng `</body>` kèm `defer` | M3 | explorer_survey_dashboard |
| 19 | D7: Đồng bộ Cache Service Worker v16 | Cập nhật `CACHE_NAME = 'vg-laptop-app-v16'` và query `v=20261111_v16_dual_personal_robot` trong `public/sw.js` | M3 | explorer_survey_dashboard |
| 20 | D8: Slide 0 Pure Monochrome Polish | Đổi `text-amber-400` thành `text-white font-bold`, nút copy feedback đổi sang đen/trắng thuần khiết | M3 | explorer_survey_dashboard |
| 21 | E2E-01: Bộ Kiểm thử Tự động Toàn diện | Xây dựng và thực thi bộ test E2E 4-tier chứng nhận 100% tính năng hoạt động không lỗi | M4 | ORIGINAL_REQUEST |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Backend & API Remediation | Sửa lỗi `server.js`, `services/dataPost.js`, `services/facebook.js`, `services/scheduler.js` (GAP-01 đến GAP-05) | none | DONE |
| M2 | Chrome Extension MV3 Remediation | Sửa lỗi `extension/content.js`, `extension/fb_robot.js`, `extension/popup.js`, `extension/manifest.json` (DEF-EXT-01 đến DEF-EXT-07) | none | DONE |
| M3 | Web Dashboard & Client Remediation | Sửa lỗi `public/index.html`, `public/app.html`, `public/js/app.js`, `public/sw.js`, `data/model_templates.json` (D1 đến D8) | M1 | DONE |
| M4 | Final E2E Automated Verification & Quality Gate Audit | Chạy 100% test suite, Syntax check toàn dự án, HTTP status check, Reviewers, Challengers, Forensic Auditor (Clean pass) | M1, M2, M3 | IN_PROGRESS |

## Interface Contracts
### API Endpoint `/api/data-post/trigger-circular`
- **Method**: `POST`
- **Payload**: `{ queue_id?: string, template_id?: string }` (tùy chọn; nếu rỗng, server tự động lấy queue item đầu tiên đang chờ hoặc template cũ nhất để bù slot)
- **Response**: `{ success: true, message: string, post: object }` (HTTP 200) hoặc `{ success: false, error: string }` (HTTP 400/500)

### API Endpoint `/api/posts/:id/publish-now`
- **Method**: `POST`
- **Response Success**: `{ success: true, message: string, post: object, facebookPostUrl: string }` (HTTP 200)
- **Response Failure**: `{ success: false, error: string, post: object }` (HTTP 500)

### Extension <-> Dashboard Message Contract (`VG_TRIGGER_PERSONAL_POST`)
```javascript
window.postMessage({
  type: 'VG_TRIGGER_PERSONAL_POST',
  postData: {
    title: string,
    content: string,
    price: string,
    mediaUrls: string[], // URLs can be base64 Data URL, Blob URL, or HTTP/HTTPS Supabase URLs
    machineCode: string
  }
}, '*');
```

## Code Layout
- `server.js`: Express server & API routes (Owned by M1)
- `services/dataPost.js`: Circular Engine & Model templates logic (Owned by M1)
- `services/facebook.js`: Meta Graph API v21.0 integration (Owned by M1)
- `services/scheduler.js`: Post execution & storage fallback (Owned by M1)
- `extension/content.js`: Zalo Web content script (Owned by M2)
- `extension/fb_robot.js`: Facebook personal robot automation (Owned by M2)
- `extension/popup.js`: Extension mini-app logic (Owned by M2)
- `extension/manifest.json`: Manifest V3 declaration (Owned by M2)
- `public/index.html` & `public/app.html`: Dashboard UI DOM & modals (Owned by M3)
- `public/js/app.js`: Dashboard client-side application logic (Owned by M3)
- `public/sw.js`: Service worker & offline cache (Owned by M3)
- `data/model_templates.json`: Model templates data (Owned by M3)
- `tests/e2e/`: Independent E2E test runner & suites (Owned by E2E Testing Track / M4)
