/**
 * utils/runtime.js
 * Cấu hình môi trường chạy dùng chung (đường dẫn dữ liệu + chế độ kiểm thử).
 *
 * - VG_TEST_MODE=1  : Chế độ kiểm thử cô lập. Không đăng bài thật lên Facebook,
 *                     không gửi email / Telegram. (Supabase được tắt bởi test runner
 *                     bằng cách xóa SUPABASE_URL trước khi nạp module.)
 * - VG_DATA_DIR     : Thư mục dữ liệu thay thế cho `data/` (test runner trỏ tới
 *                     một bản sao tạm để không làm bẩn dữ liệu production).
 */
const path = require('path');

const IS_TEST_MODE = process.env.VG_TEST_MODE === '1';

const DATA_DIR = process.env.VG_DATA_DIR || path.join(__dirname, '..', 'data');

// Thư mục fallback ghi được trên serverless (Vercel chỉ cho ghi /tmp)
const TMP_DIR = process.env.VG_DATA_DIR ? path.join(process.env.VG_DATA_DIR, '_tmp') : '/tmp';

function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function tmpFile(name) {
  return path.join(TMP_DIR, name);
}

module.exports = { IS_TEST_MODE, DATA_DIR, TMP_DIR, dataFile, tmpFile };
