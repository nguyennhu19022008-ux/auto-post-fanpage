/**
 * Master Script: Process 50 Extracted Zalo Posts into Supabase Queue & DATA POST
 * Uploads media to Supabase Storage, creates full Fanpage content, schedules consecutive golden hours.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { uploadToSupabaseStorage, upsertPostToDb } = require('../services/supabase');
const { getPosts, savePosts } = require('../services/scheduler');
const dataPostService = require('../services/dataPost');

// Parse raw price text into numeric and display string
function parsePrice(text) {
  const match = text.match(/Giá\s*[:#]?\s*([0-9.,]+)\s*(tr|triệu|k)?/i) || text.match(/([0-9.,]+)\s*(tr|triệu)/i);
  if (!match) return { priceNum: 0, priceDisplay: 'Liên hệ' };
  const num = parseFloat(match[1].replace(',', '.'));
  const unit = (match[2] || '').toLowerCase();
  let full = num;
  if (unit === 'k') full = num * 1000;
  else full = num * 1000000;
  return {
    priceNum: Math.round(full),
    priceDisplay: `${num} triệu`
  };
}

// Extract model name from text
function parseModelName(text, code) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (/(?:HP|Dell|ThinkPad|Lenovo|Surface|Dynabook|Toshiba|Acer|Asus|Panasonic|MacBook)/i.test(line)) {
      let clean = line
        .replace(/(?:Mã|Lô|Mã số)\s*[:#]?\s*[0-9A-Za-z]+[:\s-]*/i, '')
        .replace(/Win bản quyền[\.\s]*/i, '')
        .replace(/Phân khúc cao cấp[\.\s-]*/i, '')
        .replace(/Thanh\s*Vũ\s*Store[:\s-]*/i, '')
        .replace(/PS:màn có xước nhẹ[\.\s-]*/i, '')
        .replace(/–\s*SANG TRỌNG.*/i, '')
        .trim();
      if (clean.length > 5 && clean.length < 50) return clean;
    }
  }
  return `Laptop #${code}`;
}

// Generate high-converting Facebook post content
function formatFacebookContent(code, modelName, rawText, priceDisplay) {
  // Extract key specs
  const cpuMatch = rawText.match(/(?:Intel|AMD|Core|Ryzen|Ultra)\s*[^,\n\r\.\/]+/i) || rawText.match(/i[3579][-\s][0-9A-Za-z]+/i);
  const ramMatch = rawText.match(/(?:RAM|Bộ nhớ)?\s*[:\s]?\s*([0-9]+)\s*GB/i);
  const ssdMatch = rawText.match(/(?:SSD|Ổ cứng|Lưu trữ)?\s*[:\s]?\s*([0-9]+)\s*(?:GB|TB)\s*(?:SSD|NVMe)?/i);
  const screenMatch = rawText.match(/([0-9.,]+)\s*inch/i);

  const cpu = cpuMatch ? cpuMatch[0].trim() : 'Intel Core mạnh mẽ thế hệ mới';
  const ram = ramMatch ? `${ramMatch[1]}GB` : '16GB';
  const ssd = ssdMatch ? `${ssdMatch[1]}GB SSD NVMe` : '256GB SSD tốc độ cao';
  const screen = screenMatch ? `${screenMatch[1]} inch sắc nét chống chói` : '13.3 - 14.0 inch FHD';

  return `🔥 [SIÊU PHẨM GIÁ TỐT] - MÃ #${code}: ${modelName.toUpperCase()} – CHUẨN NỘI ĐỊA NHẬT BẢN!
────────────────────────────
⚡ ĐẶC ĐIỂM & CẤU HÌNH NỔI BẬT:
• Mã máy định danh: #${code}
• Vi xử lý (CPU): ${cpu} (xử lý đa nhiệm văn phòng, lướt web, đồ họa mượt mà)
• Bộ nhớ RAM: ${ram} (mở hàng chục tab Chrome làm việc không lo giật lag)
• Ổ cứng lưu trữ: ${ssd} (khởi động Windows chỉ trong 3-5 giây)
• Màn hình: ${screen} (hiển thị tươi sáng, dịu mắt làm việc cả ngày)
• Ngoại hình: Vỏ nhôm nguyên khối bền đẹp, gọn gàng tiện bỏ balo mang đi cà phê, công tác
💰 GIÁ CÔNG KHAI HÔM NAY: ${priceDisplay} (Bao giá toàn quốc - Cam kết máy nguyên zin chuẩn Nhật!)
────────────────────────────
🎁 BỘ QUÀ TẶNG KÈM THEO MÁY:
• Tặng túi chống sốc cao cấp 2 ngăn bảo vệ máy
• Tặng chuột không dây thời trang chống ồn
• Kèm sạc zin chính hãng chuẩn theo máy
• Hỗ trợ cài đặt trọn bộ Windows, Office và phần mềm văn phòng miễn phí trọn đời
────────────────────────────
🛡️ CHẾ ĐỘ BẢO HÀNH & HẬU MÃI TẬN TÂM:
• Bao test 7 ngày 1 đổi 1 nếu phát sinh lỗi phần cứng
• Bảo hành kỹ thuật toàn diện 3 tháng yên tâm sử dụng
• Miễn phí giao hàng toàn quốc (Kiểm tra máy chuẩn zin mới thanh toán)
────────────────────────────
🏪 LAPTOP VƯƠNG GIA – CHUYÊN LAPTOP NỘI ĐỊA NHẬT TUYỂN CHỌN
📞 Hotline / Zalo tư vấn 24/7: 0876637806
📍 Hỗ trợ kỹ thuật & Trải nghiệm máy trực tiếp tại cửa hàng
#LaptopVuongGia #LaptopGiaRe #LaptopNhatBan #LaptopVanPhong #DoanhNhan`;
}

// Calculate 50 sequential golden hour slots (08:30, 11:45, 15:30, 20:00)
function generate50ScheduleSlots(startFromTime) {
  const slots = [];
  const hours = [
    { h: 8, m: 30 },
    { h: 11, m: 45 },
    { h: 15, m: 30 },
    { h: 20, m: 0 }
  ];

  let current = new Date(startFromTime);

  while (slots.length < 50) {
    for (const s of hours) {
      const candidate = new Date(current);
      candidate.setHours(s.h, s.m, 0, 0);
      if (candidate.getTime() > startFromTime.getTime()) {
        slots.push(new Date(candidate).toISOString());
        if (slots.length >= 50) break;
      }
    }
    // Move to next day
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);
  }

  return slots;
}

async function run() {
  console.log('===============================================================');
  console.log('🚀 BẮT ĐẦU XỬ LÝ 50 BÀI ĐĂNG ZALO -> SUPABASE QUEUE & STORAGE');
  console.log('===============================================================');

  // 1. Read all 5 batches
  const allItems = [];
  for (let b = 1; b <= 5; b++) {
    const fPath = path.join(__dirname, '..', 'data', `zalo_batch_${b}.json`);
    if (fs.existsSync(fPath)) {
      const batchData = JSON.parse(fs.readFileSync(fPath, 'utf8'));
      allItems.push(...batchData);
      console.log(`✓ Đã nạp batch_${b}.json: ${batchData.length} máy`);
    }
  }

  console.log(`📊 Tổng số máy nạp được: ${allItems.length}`);
  const target50 = allItems.slice(0, 50);

  // 2. Determine start time for scheduling
  const existingPosts = await getPosts();
  const queuedTimes = existingPosts
    .filter(p => p.status === 'queued' && p.scheduledTime)
    .map(p => new Date(p.scheduledTime).getTime())
    .filter(t => !isNaN(t));

  const latestTime = queuedTimes.length > 0 ? Math.max(...queuedTimes) : Date.now();
  const startFrom = new Date(latestTime);
  console.log(`⏰ Điểm bắt đầu lên lịch kế tiếp: ${startFrom.toLocaleString('vi-VN')}`);

  const scheduleSlots = generate50ScheduleSlots(startFrom);
  console.log(`📅 Đã sinh 50 khung giờ vàng từ ${new Date(scheduleSlots[0]).toLocaleString('vi-VN')} đến ${new Date(scheduleSlots[49]).toLocaleString('vi-VN')}`);

  // 3. Process each post
  const newlyCreatedPosts = [];

  for (let idx = 0; idx < target50.length; idx++) {
    const item = target50[idx];
    const code = item.code || `ZG_${idx + 1}`;
    const rawText = item.text || '';
    const images = item.images || [];

    const { priceNum, priceDisplay } = parsePrice(rawText);
    const modelName = parseModelName(rawText, code);
    const content = formatFacebookContent(code, modelName, rawText, priceDisplay);
    const scheduledTime = scheduleSlots[idx];

    console.log(`\n---------------------------------------------------------------`);
    console.log(`[${idx + 1}/50] 💻 Xử lý máy #${code}: ${modelName} (${priceDisplay})`);
    console.log(`📸 Tải lên ${images.length} ảnh lên Supabase Storage bucket 'laptop-media'...`);

    const uploadedMedia = [];
    for (let imgIdx = 0; imgIdx < images.length; imgIdx++) {
      const img = images[imgIdx];
      if (!img.dataUrl) continue;

      try {
        const matches = img.dataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) continue;

        const mimeType = matches[1] || 'image/jpeg';
        const buffer = Buffer.from(matches[2], 'base64');
        const filename = `zalo_code_${code}_${imgIdx + 1}.jpg`;

        const uploaded = await uploadToSupabaseStorage(buffer, filename, mimeType);
        if (uploaded) {
          uploadedMedia.push(uploaded);
          process.stdout.write(`  ✓ Ảnh ${imgIdx + 1}/${images.length} `);
        }
      } catch (err) {
        console.warn(`  ⚠️ Lỗi tải ảnh ${imgIdx + 1}:`, err.message);
      }
    }
    console.log(`\n✅ Hoàn thành ${uploadedMedia.length} ảnh trên Supabase Storage.`);

    const postObj = {
      id: `post_${Date.now()}_${idx}_${code}`,
      machineCode: code,
      machineName: modelName,
      content,
      price: priceDisplay,
      mediaFiles: uploadedMedia,
      scheduledTime,
      status: 'queued',
      mediaReminderSent: false,
      createdAt: new Date().toISOString()
    };

    // Save to Supabase DB & Local posts
    await upsertPostToDb(postObj);
    newlyCreatedPosts.push(postObj);
    console.log(`⏳ Đã đưa vào Hàng đợi: Lúc ${new Date(scheduledTime).toLocaleString('vi-VN')}`);
  }

  // 4. Update local posts.json
  const currentAll = await getPosts();
  // Filter out any duplicates of these codes in queued status
  const newCodes = new Set(newlyCreatedPosts.map(p => p.machineCode));
  const remaining = currentAll.filter(p => !newCodes.has(p.machineCode));
  const finalPosts = [...newlyCreatedPosts, ...remaining];
  await savePosts(finalPosts);

  console.log('===============================================================');
  console.log(`🎉 HOÀN THÀNH 100%! ĐÃ NẠP THÀNH CÔNG 50 MÁY VÀO HÀNG ĐỢI!`);
  console.log(`📁 Tổng số bài trong danh sách hiện tại: ${finalPosts.length}`);
  console.log('===============================================================');
}

run().catch(console.error);
