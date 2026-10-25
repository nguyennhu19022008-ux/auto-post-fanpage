const axios = require('axios');
const fs = require('fs');
const { fallbackGeneratePost, callGeminiWithFallback } = require('./gemini');

// Built-in sample parsed data from the user's uploaded table image
const SAMPLE_TABLE_DATA = [
  {
    stt: 1,
    machineCode: "636",
    machineName: "HP Envy x360 14",
    cpu: "Intel Core Ultra 5 125U",
    ram: "16GB",
    ssd: "512GB",
    screen: "14 inch Cảm ứng",
    isTouch: true,
    price: "32 triệu",
    rawSpecs: "CPU: Intel Core Ultra 5 125U RAM: 16GB SSD 512GB Màn hình: 14 inch Cảm ứng"
  },
  {
    stt: 3,
    machineCode: "742",
    machineName: "HP Envy x360 13.3",
    cpu: "Ryzen 5 3500U",
    ram: "8GB",
    ssd: "256GB",
    screen: "13.3 inch cảm ứng, xoay 360 độ",
    isTouch: true,
    price: "6.5 triệu",
    rawSpecs: "CPU Ryzen 5 3500U, RAM 8Gb SSD 256GB Màn hình 13.3 inch cảm ứng, xoay 360 độ"
  },
  {
    stt: 5,
    machineCode: "781",
    machineName: "Dell Latitude 5350",
    cpu: "Ultra 5",
    ram: "16GB",
    ssd: "256GB",
    screen: "13.3 inch",
    isTouch: false,
    price: "13.9 triệu",
    rawSpecs: "CPU Ultra 5, Ram 16Gb, SSD 256Gb, Màn hình 13.3 inch"
  },
  {
    stt: 7,
    machineCode: "784",
    machineName: "Sony VAIO Pro PJ VJPJ21",
    cpu: "i5-1135G7",
    ram: "8GB",
    ssd: "256GB",
    screen: "13.3 inch",
    isTouch: false,
    price: "6.8 triệu",
    rawSpecs: "CPU i5-1135G7 RAM 8GB SSD 256GB Màn hình 13.3 inch"
  },
  {
    stt: 9,
    machineCode: "795",
    machineName: "Surface Laptop 2",
    cpu: "i5-8ThGen",
    ram: "8GB",
    ssd: "256GB",
    screen: "13.5 inch, cảm ứng",
    isTouch: true,
    price: "5.2 triệu",
    rawSpecs: "CPU i5-8ThGen Ram 8 Ssd 256 Màn 13.5 inch, cảm ứng"
  },
  {
    stt: 11,
    machineCode: "802",
    machineName: "HP EliteBook 630 G9",
    cpu: "i5-1235U",
    ram: "16GB",
    ssd: "256GB",
    screen: "13.3 inch",
    isTouch: false,
    price: "9.1 triệu",
    rawSpecs: "CPU i5-1235U, Ram 16Gb, SSD 256Gb, Màn hình 13.3 inch"
  },
  {
    stt: 13,
    machineCode: "811",
    machineName: "HP Envy x360 13",
    cpu: "AMD Ryzen 3- 4300U",
    ram: "8GB",
    ssd: "256GB",
    screen: "13.3 inch xoay 360 độ cảm ứng",
    isTouch: true,
    price: "7 triệu",
    rawSpecs: "CPU: AMD Ryzen 3- 4300U RAM: 8GB SSD 256GB Màn hình cảm ứng 13.3 inch xoay 360 độ"
  },
  {
    stt: 15,
    machineCode: "831",
    machineName: "Dynabook G83/HS",
    cpu: "i5 1135G7",
    ram: "8GB",
    ssd: "256GB",
    screen: "Màn hình sắc nét",
    isTouch: false,
    price: "5.9 triệu",
    rawSpecs: "CPU i5 1135G7 RAM 8GB SSD 256GB Màn hình sắc nét"
  },
  {
    stt: 17,
    machineCode: "842",
    machineName: "Dell Latitude 5320",
    cpu: "i5 Gen11",
    ram: "8GB",
    ssd: "256GB",
    screen: "13.3 inch",
    isTouch: false,
    price: "5.9 triệu",
    rawSpecs: "CPU i5 Gen11 Ram 8Gb SSD 256Gb Màn hình 13.3 inch"
  },
  {
    stt: 19,
    machineCode: "869",
    machineName: "HP EliteBook 630 G9",
    cpu: "i5-1235U",
    ram: "16GB",
    ssd: "256GB",
    screen: "13.3 inch",
    isTouch: false,
    price: "8.3 triệu",
    rawSpecs: "CPU i5-1235U, Ram 16Gb, SSD 256Gb, Màn hình 13.3 inch"
  },
  {
    stt: 21,
    machineCode: "881",
    machineName: "HP Envy x360 15",
    cpu: "AMD Ryzen 5 4500U",
    ram: "8GB",
    ssd: "256GB",
    screen: "15.6 inch Cảm ứng xoay 360 độ",
    isTouch: true,
    price: "7.5 triệu",
    rawSpecs: "CPU AMD Ryzen 5 4500U RAM: 8 GB SSD 256Gb Màn hình: 15.6 inch Cảm ứng xoay 360 độ"
  },
  {
    stt: 23,
    machineCode: "887",
    machineName: "HP Envy x360 15",
    cpu: "i5-8th",
    ram: "8GB",
    ssd: "256GB",
    screen: "15.6 inch, cảm ứng, xoay 360",
    isTouch: true,
    price: "7.5 triệu",
    rawSpecs: "CPU i5-8th Ram 8 Ssd 256 Màn 15.6 inch, cảm ứng, xoay 360"
  },
  {
    stt: 25,
    machineCode: "904",
    machineName: "HP EliteBook 630 G9",
    cpu: "i5-1235U",
    ram: "16GB",
    ssd: "256GB",
    screen: "13.3 inch",
    isTouch: false,
    price: "8.8 triệu",
    rawSpecs: "CPU i5-1235U, Ram 16Gb, SSD 256Gb, Màn hình 13.3 inch"
  }
];

/**
 * Format raw table data item into a complete sales post using the approved template
 * Directly binds structured specs into the post to preserve 100% precision (e.g. 13.3 inch, i5-12ThGen)
 */
function buildPostFromTableItem(item, userSettings = {}) {
  const machineCode = (item.machineCode || 'MÁY').toUpperCase().replace(/^#+/, '');
  const machineName = item.machineName || 'Laptop Nhật Bãi';
  const cpu = item.cpu || 'Intel Core mạnh mẽ';
  const ram = item.ram || '8GB';
  const ssd = item.ssd || '256GB SSD';
  let screen = item.screen || '14 inch sắc nét, chống chói';
  if (item.isTouch && !/cảm\s*ứng/i.test(screen)) {
    screen += ' (Hỗ trợ cảm ứng vuốt chạm)';
  }
  const price = item.price || 'Liên hệ báo giá tốt nhất';

  const gifts = (userSettings.giftList || [
    'Tặng túi chống sốc cao cấp cho 2 máy trở lên',
    'Tặng chuột không dây thời trang',
    'Sạc zin chuẩn theo máy',
    'Gói cài win trọn đời'
  ]).map(g => `• ${g}`).join('\n');

  const depositLine = userSettings.depositNote 
    ? `✅ ${userSettings.depositNote}` 
    : '✅ Cọc 300k cho đơn đầu tiên, hỗ trợ call video check legit!';

  return `🔥 [SIÊU PHẨM GIÁ TỐT] - MÃ #${machineCode}: ${machineName.toUpperCase()}
────────────────────────────
⚡ ĐẶC ĐIỂM & CẤU HÌNH VƯỢT TRỘI:
🔹 Mã máy: #${machineCode}
🔹 Vi xử lý: ${cpu} (xử lý đa nhiệm mượt mà Office, lướt web, Photoshop 2D)
🔹 Bộ nhớ RAM: ${ram} (mở hàng chục tab Chrome làm việc không lo giật lag)
🔹 Ổ cứng: ${ssd} (khởi động Windows và mở ứng dụng chỉ trong 3 giây)
🔹 Màn hình: ${screen}
🔹 Bàn phím gõ êm, phím nảy tốt, thiết kế cứng cáp chuẩn tiêu chuẩn Nhật
💰 GIÁ ƯU ĐÃI HÔM NAY: ${price} (Giá công khai - Bao giá toàn quốc!)
────────────────────────────
🎁 QUÀ TẶNG KÈM THEO:
${gifts}
🛡️ CHÍNH SÁCH BẢO HÀNH & HẬU MÃI:
✅ ${userSettings.warrantyPolicy || 'Bao test 7 ngày lỗi 1 đổi 1. Bảo hành phần cứng 3 tháng cho máy màn không cảm ứng, và 1 tháng cho máy màn cảm ứng, chu đáo.'}
✅ Kiểm tra máy thoải mái trước khi nhận - Đúng hàng mới thanh toán!
${depositLine}
📲 LIÊN HỆ ĐẶT HÀNG NGAY HÔM NAY:
☎️ Hotline / Zalo: ${userSettings.hotline || '0876637806'}`;
}

/**
 * Parse stock table from image (supports Gemini Vision API for BOTH multi-machine tables and single laptop photos)
 */
async function parseStockTableFromImage(imageBase64, userSettings = {}) {
  const apiKey = userSettings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || !imageBase64) {
    console.log('[TableParser] Yêu cầu nạp dữ liệu mẫu (không có ảnh tải lên).');
    return SAMPLE_TABLE_DATA.map(item => ({
      ...item,
      postContent: buildPostFromTableItem(item, userSettings)
    }));
  }

  const prompt = `
Bạn là chuyên gia phân tích ảnh và bóc tách thông tin laptop cho hệ thống bán lẻ "Laptop Vương Gia".
Ảnh cung cấp có thể là:
- TRƯỜNG HỢP 1: Ảnh chụp BẢNG KHO (nhiều máy) dạng bảng Excel hoặc danh sách Zalo (các cột: STT, Mã máy, Tên máy, Cấu hình, Màn cảm ứng, Giá, Lương, Ghi chú...).
- TRƯỜNG HỢP 2: Ảnh chụp CHỈ CÓ 1 MÁY DUY NHẤT (ví dụ bài đăng Zalo đơn chiếc, ảnh chụp màn hình máy, tem thông số cấu hình, hoặc ảnh laptop thực tế).
- TRƯỜNG HỢP 3: Ảnh cắt 1 dòng duy nhất từ bảng danh sách.

YÊU CẦU BÓC TÁCH BẮT BUỘC:
1. Đọc và nhận diện TẤT CẢ các máy có trong ảnh (dù là 1 máy duy nhất hay nhiều máy).
2. Với mỗi máy, trích xuất object JSON có cấu trúc sau:
   - "stt": số thứ tự (số nguyên, ví dụ 1, 2...)
   - "machineCode": mã nhận diện máy (ví dụ: "046", "636", "742", "781", "001"... Nếu ảnh không ghi rõ mã, hãy tự đặt mã dựa trên tên model ví dụ "DELL-3410", "HP-742")
   - "machineName": tên máy đầy đủ (ví dụ: "Dell Latitude 3410", "HP Envy x360 14", "ThinkPad T14 Gen 1")
   - "cpu": thông số vi xử lý (ví dụ: "Intel Core i5-10210U", "Ryzen 5 3500U", "Core Ultra 5 125U")
   - "ram": dung lượng RAM (ví dụ: "8GB", "16GB")
   - "ssd": dung lượng ổ cứng (ví dụ: "256GB SSD", "512GB SSD")
   - "screen": kích thước và tính năng màn hình (ví dụ: "14 inch FHD", "13.3 inch cảm ứng", "15.6 inch")
   - "isTouch": boolean (true nếu có cảm ứng, false nếu không cảm ứng)
   - "rawSpecs": chuỗi tóm tắt thông số cấu hình
   - "price": giá bán lẻ niêm yết (ví dụ: "5.5 triệu", "6.8 triệu", "13.9 triệu")

3. QUY TẮC BẢO MẬT & ĐỊNH DẠNG GIÁ:
   - XÓA BỎ HOÀN TOÀN thông tin lương CTV, chiết khấu, hoa hồng (ví dụ: lương 500k, lương 300k).
   - Đổi giá dạng viết tắt (32.000k, 5.500k, 6.5tr, 5.5 tr) thành dạng chữ rõ ràng: "32 triệu", "5.5 triệu", "6.5 triệu".
   - Nếu ảnh không có giá, để trống: "".

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC:
Trả về DUY NHẤT một JSON ARRAY chứa các object máy:
[
  {
    "stt": 1,
    "machineCode": "046",
    "machineName": "Dell Latitude 3410",
    "cpu": "Intel Core i5-10210U",
    "ram": "8GB",
    "ssd": "256GB SSD",
    "screen": "14 inch",
    "isTouch": false,
    "rawSpecs": "CPU Intel Core i5-10210U, RAM 8GB, SSD 256GB, Màn 14 inch",
    "price": "5.5 triệu"
  }
]
LƯU Ý QUAN TRỌNG: Dù trong ảnh CHỈ CÓ 1 MÁY DUY NHẤT, vẫn BẮT BUỘC bọc trong mảng [ ... ]. Không thêm bất kỳ lời dẫn hay văn bản giải thích nào ngoài mã JSON.
`;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const contents = [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: cleanBase64
            }
          }
        ]
      }
    ];

    const { text: textOutput } = await callGeminiWithFallback(contents, apiKey);

    // Bulletproof JSON extractor: handle array, wrapped object, or single machine object
    let rawItems = [];
    const arrayMatch = textOutput.match(/\[\s*\{[\s\S]*\}\s*\]/);
    const objectMatch = textOutput.match(/\{[\s\S]*\}/);

    if (arrayMatch) {
      try {
        rawItems = JSON.parse(arrayMatch[0]);
      } catch (err) {
        console.warn('[TableParser] Lỗi parse JSON mảng:', err.message);
      }
    }

    if ((!rawItems || !rawItems.length) && objectMatch) {
      try {
        const parsed = JSON.parse(objectMatch[0]);
        if (Array.isArray(parsed)) {
          rawItems = parsed;
        } else if (parsed.items && Array.isArray(parsed.items)) {
          rawItems = parsed.items;
        } else if (parsed.data && Array.isArray(parsed.data)) {
          rawItems = parsed.data;
        } else if (parsed.machineName || parsed.machineCode || parsed.cpu) {
          rawItems = [parsed]; // Single machine wrapped into array
        }
      } catch (err) {
        console.warn('[TableParser] Lỗi parse JSON object:', err.message);
      }
    }

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new Error('AI không tìm thấy thông tin laptop nào trong ảnh. Vui lòng thử ảnh rõ nét hơn.');
    }

    return rawItems.map((item, idx) => ({
      stt: item.stt || idx + 1,
      machineCode: (item.machineCode || `MAY-${idx + 1}`).toUpperCase().replace(/^#+/, ''),
      machineName: item.machineName || 'Laptop Nhật Bãi',
      cpu: item.cpu || 'Intel Core mạnh mẽ',
      ram: item.ram || '8GB',
      ssd: item.ssd || '256GB SSD',
      screen: item.screen || '14 inch',
      isTouch: !!item.isTouch,
      rawSpecs: item.rawSpecs || `${item.cpu || ''} ${item.ram || ''} ${item.ssd || ''}`.trim(),
      price: item.price || '',
      postContent: buildPostFromTableItem(item, userSettings)
    }));
  } catch (error) {
    console.error('[TableParser Error]', error.message);
    throw new Error(`Bóc tách ảnh không thành công: ${error.message}`);
  }
}

module.exports = {
  SAMPLE_TABLE_DATA,
  buildPostFromTableItem,
  parseStockTableFromImage
};
