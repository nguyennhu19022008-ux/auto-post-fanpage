const fs = require('fs');
const axios = require('axios');

async function main() {
  const logPath = 'C:/Users/Admin/.gemini/antigravity/brain/5a092a21-7201-40c8-b61d-cd39f5be7822/.system_generated/steps/461/output.txt';
  const logContent = fs.readFileSync(logPath, 'utf8');
  
  // Extract json object
  const startIdx = logContent.indexOf('{');
  const endIdx = logContent.lastIndexOf('}');
  if (startIdx === -1 || endIdx === -1) {
    throw new Error('Không tìm thấy JSON hợp lệ trong file');
  }

  const jsonStr = logContent.slice(startIdx, endIdx + 1);
  const data = JSON.parse(jsonStr);

  console.log('--- BẮT ĐẦU QUY TRÌNH LÊN LỊCH BÀI ĐĂNG TỪ ZALO WEB ---');
  console.log('Tiêu đề thô:', data.rawText);
  console.log('Số lượng ảnh trích xuất thật từ RAM Zalo:', data.images ? data.images.length : 0);

  console.log('🚀 Đang gửi dữ liệu tới máy chủ để bóc tách AI và XẾP LỊCH...');
  const res = await axios.post('http://localhost:3000/api/extension/push-post', {
    rawText: data.rawText,
    mediaUrls: data.images,
    publishImmediately: false
  }, { timeout: 60000 });

  const post = res.data.post || {};
  console.log('\n✅ KẾT QUẢ XẾP LỊCH THÀNH CÔNG:');
  console.log('Status HTTP:', res.status);
  console.log('Thành công:', res.data.success);
  console.log('Post ID:', post.id);
  console.log('Mã máy chuẩn:', post.machineCode);
  console.log('Trạng thái:', post.status);
  console.log('Thời gian lên lịch (Scheduled Time):', post.scheduledTime);
  console.log('Thời gian hiển thị VN:', new Date(post.scheduledTime).toLocaleString('vi-VN'));
  console.log('Số lượng ảnh đã upload lên Supabase Cloud:', (post.mediaFiles || []).length);
  
  if (post.mediaFiles && post.mediaFiles.length > 0) {
    post.mediaFiles.forEach((m, idx) => {
      console.log(`  + Ảnh #${idx + 1}: ${m.url}`);
    });
  }

  console.log('\n--- NỘI DUNG BÀI ĐĂNG BÁN LẺ ĐÃ LÊN LỊCH ---');
  console.log(post.content);
}

main().catch(err => {
  console.error('Lỗi quy trình lên lịch:', err.response ? err.response.data : err.message);
});
