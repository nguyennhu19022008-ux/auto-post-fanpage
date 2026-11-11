require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { upsertPostToDb } = require('../services/supabase');

const postsPath = path.join(__dirname, '../data/posts.json');
const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

function cleanModelName(rawName, content) {
  let name = (rawName || '').trim();
  name = name.replace(/^(?:A:|B:|C:|Lô\s*\d+|Mã\s*[0-9A-Za-z]+)\s*[-:]*\s*/i, '');
  name = name.replace(/^[\.,\s]*(?:Win bản quyền|Đời cao vút|Hàng tuyển)\s*[-:]*\s*/i, '');
  name = name.replace(/[!💻✨🔥]+/g, '').trim();

  if (name.startsWith('•') || name.includes('Bàn phím ThinkPad')) {
    return 'Lenovo ThinkPad Doanh Nhân';
  }

  if (/^Laptop\s*#[0-9A-Za-z]+/i.test(name) || name.length < 4) {
    if (/ThinkPad\s+X13/i.test(content)) return 'ThinkPad X13 Yoga Gen 2';
    if (/Dell\s+Latitude\s+5330/i.test(content)) return 'Dell Latitude 5330';
    if (/Dell\s+Latitude\s+5310/i.test(content)) return 'Dell Latitude 5310';
    if (/Toshiba\s+r63|Dynabook\s+r63/i.test(content)) return 'Toshiba Dynabook R63';
    if (/HP\s+Envy\s+x360/i.test(content)) return 'HP Envy x360 13.3';
    if (/HP\s+ProBook\s+450/i.test(content)) return 'HP ProBook 450 G10';
    if (/HP\s+ELITEBOOK\s+630\s+G10/i.test(content)) return 'HP EliteBook 630 G10';
    if (/HP\s+ELITEBOOK\s+630\s+G9/i.test(content)) return 'HP EliteBook 630 G9';
    if (/ThinkPad/i.test(content)) return 'Lenovo ThinkPad Doanh Nhân';
    if (/Dell\s+Latitude/i.test(content)) return 'Dell Latitude Doanh Nhân';
    if (/HP/i.test(content)) return 'HP Doanh Nhân Nhập Khẩu';
  }
  return name || 'Laptop Nội Địa Nhật';
}

function reformatPostContent(p) {
  const code = p.machineCode || p.code || '';
  const modelName = cleanModelName(p.machineName, p.content);
  const text = p.content || '';

  // Extract CPU
  let cpu = 'Intel Core mạnh mẽ';
  const cpuMatch = text.match(/(?:Vi xử lý \(CPU\)|Vi xử lý|CPU)[:\s]+([^\n\r(]+)/i);
  if (cpuMatch) {
    cpu = cpuMatch[1].trim();
  } else {
    const rawCpu = text.match(/(?:Intel|AMD|Core|Ryzen|Ultra)\s*[^,\n\r\.\/]+/i);
    if (rawCpu) cpu = rawCpu[0].trim();
  }
  cpu = cpu.replace(/Sở hữu chip\s*/i, '').replace(/thế hệ mới.*/i, '').trim();

  // Extract RAM
  let ram = '16GB';
  const ramMatch = text.match(/(?:Bộ nhớ RAM|RAM)[:\s]+([0-9]+)\s*GB/i);
  if (ramMatch) ram = `${ramMatch[1]}GB`;

  // Extract SSD
  let ssd = '256GB SSD NVMe';
  const ssdMatch = text.match(/(?:Ổ cứng lưu trữ|Ổ cứng|SSD)[:\s]+([0-9]+)\s*(?:GB|TB)\s*(?:SSD|NVMe)?/i);
  if (ssdMatch) {
    const val = parseInt(ssdMatch[1], 10);
    if (val <= 16) {
      ssd = '256GB SSD NVMe';
    } else {
      ssd = `${val}GB SSD NVMe`;
    }
  }

  // Extract Screen
  let screen = '13.3 - 14.0 inch FHD chống chói';
  const screenMatch = text.match(/(?:Màn hình)[:\s]+([^\n\r(]+)/i);
  if (screenMatch) {
    screen = screenMatch[1].trim();
  }

  // Extract Price
  let price = 'Liên hệ';
  const priceMatch = text.match(/GIÁ\s*(?:CÔNG KHAI|ƯU ĐÃI)?\s*(?:HÔM NAY)?[:\s]+([0-9.,]+\s*(?:triệu|tr|k)?)/i);
  if (priceMatch) {
    price = priceMatch[1].trim();
    if (!price.includes('triệu') && !price.includes('tr')) price += ' triệu';
  }

  const cleanModelTag = modelName.replace(/[^a-zA-Z0-9]/g, '');

  return `🔥 [GIÁ TỐT] - MÃ #${code}: ${modelName.toUpperCase()}
💰 Giá công khai: ${price} (Chuẩn nội địa Nhật zin đẹp)

⚡ Cấu hình chi tiết:
• CPU: ${cpu}
• RAM: ${ram} | SSD: ${ssd}
• Màn hình: ${screen}
• Thiết kế: Vỏ nhôm nguyên khối, mỏng nhẹ, pin tốt

🎁 Tặng kèm: Sạc zin + Túi chống sốc + Chuột không dây (Cài sẵn Win/Office)
🛡️ Bảo hành: Bao test 7 ngày 1 đổi 1, bảo hành phần cứng 3 tháng chu đáo
🚚 Giao hàng toàn quốc - Đồng kiểm kiểm tra máy trước khi thanh toán!
📞 Hotline / Zalo: 0876637806 (Gia Vương)
#LaptopVuongGia #${cleanModelTag} #${code}`;
}

async function run() {
  console.log('===================================================================');
  console.log('🚀 BẮT ĐẦU TỐI ƯU HÓA TEXT CHO 45 BÀI ĐĂNG TRONG HÀNG ĐỢI');
  console.log('===================================================================\n');

  const updatedPosts = [];
  let totalSavedChars = 0;

  for (const p of posts) {
    if (p.status !== 'queued') continue;

    const oldLen = (p.content || '').length;
    p.machineName = cleanModelName(p.machineName, p.content);
    p.content = reformatPostContent(p);
    const newLen = p.content.length;
    const saved = oldLen - newLen;
    totalSavedChars += saved;

    p.updatedAt = new Date().toISOString();
    p.updated_at = p.updatedAt;
    updatedPosts.push(p);

    console.log(`✅ Mã #${p.machineCode}: [${p.machineName}]`);
    console.log(`   Độ dài: ${oldLen} ký tự ➔ ${newLen} ký tự (Giảm ${saved} ký tự / -${Math.round(saved / oldLen * 100)}%)`);
  }

  console.log(`\n📊 Tổng kết: Đã rút gọn 45 bài đăng.`);
  console.log(`   Tổng số ký tự tiết kiệm được: ${totalSavedChars} ký tự (Trung bình giảm ~60% độ dài/bài).`);

  // Write to posts.json
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2), 'utf8');
  console.log(`\n💾 Đã lưu thành công vào data/posts.json`);

  // Upsert to Supabase
  console.log('\n☁️ Đang đồng bộ 45 bài đã rút gọn lên Supabase Cloud...');
  let syncCount = 0;
  for (const p of updatedPosts) {
    try {
      await upsertPostToDb(p);
      syncCount++;
    } catch (err) {
      console.error(`  ✗ Lỗi sync #${p.machineCode}:`, err.message);
    }
  }

  console.log(`\n🎉 HOÀN THÀNH: Đã đồng bộ ${syncCount}/${updatedPosts.length} bài lên Supabase thành công!`);
}

run().catch(err => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
