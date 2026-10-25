const axios = require('axios');

const GEMINI_MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];

/**
 * Reusable Gemini API caller with automatic fallback across reliable models
 */
async function callGeminiWithFallback(contents, apiKey, timeout = 35000) {
  let lastError = null;

  for (const model of GEMINI_MODELS) {
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { contents },
        { headers: { 'Content-Type': 'application/json' }, timeout }
      );

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { text: text.trim(), model };
      }
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message || err.message;
      console.warn(`[Gemini API] Thử model ${model} không thành công (Status: ${status}): ${msg}. Chuyển sang model dự phòng tiếp theo...`);
    }
  }

  throw new Error(`Tất cả các model Gemini đều không phản hồi: ${lastError?.message || 'Không rõ nguyên nhân'}`);
}

/**
 * Clean and filter sensitive wholesale terms from text
 */
function sanitizeRawText(text) {
  if (!text) return '';
  // Remove CTV salary/commission, wholesale references
  return text
    .replace(/(?:lương|luong|hoa hồng|hoa hong|chiết khấu|chiet khau)\s*[:=]?\s*\d+[kKmMtrTrVNĐvnđ]*/gi, '')
    .replace(/giá\s+(?:nhập|sỉ|ctv|buôn)\s*[:=]?\s*\d+[kKmMtrTrVNĐvnđ]*/gi, '')
    .replace(/chỉ\s+(?:trưởng\/phó|admin)\s+cộng\s+đồng[^\n]*/gi, '')
    .replace(/hướng\s+dẫn\s+dán\s+phím\s+cho\s+ctv[^\n]*/gi, '')
    .trim();
}

/**
 * Intelligent regex fallback parser when Gemini API Key is not yet provided
 */
function fallbackGeneratePost(rawText, userSettings, customPrice) {
  const sanitized = sanitizeRawText(rawText);
  
  // Extract Machine Code & Name
  const codeMatch = sanitized.match(/(?:mã|ma)\s*[:=]?\s*([A-Za-z0-9_-]+)/i) || 
                    sanitized.match(/^([A-Za-z0-9_-]{2,10})\b/);
  const machineCode = codeMatch ? codeMatch[1].toUpperCase() : 'VIP';

  // Extract CPU (Dell, HP, ThinkPad, Dynabook, etc.)
  const cpuMatch = sanitized.match(/(?:Intel\s+Core\s+i[3579][\w-]*|Core\s+Ultra\s+\d+\s*\w*|Ultra\s+\d+|Ryzen\s+[3579][\w-]*|i[3579][\s-]+\d{1,5}(?:[A-Za-z0-9]+|ThGen)?|i[3579]\s+\d+th)/i);
  const cpu = cpuMatch ? cpuMatch[0] : 'Intel Core mạnh mẽ';

  // Extract RAM
  const ramMatch = sanitized.match(/(?:RAM|Ram)\s*[:=]?\s*(\d{1,2}\s*GB)/i) ||
                   sanitized.match(/(\d{1,2}\s*GB)\s*RAM/i) ||
                   sanitized.match(/Ram\s*(\d{1,2})/i);
  const ram = ramMatch ? (ramMatch[1] ? (ramMatch[1].toUpperCase().includes('GB') ? ramMatch[1].toUpperCase() : ramMatch[1] + 'GB') : '8GB') : '8GB';

  // Extract SSD
  const ssdMatch = sanitized.match(/(?:SSD|Ssd|Ổ\s*cứng)\s*[:=]?\s*(\d{3,4}\s*GB|\d\s*TB)/i) || 
                   sanitized.match(/(\d{3,4}\s*GB|\d\s*TB)\s*(?:SSD|NVMe)/i) ||
                   sanitized.match(/Ssd\s*(\d{3,4})/i);
  const ssd = ssdMatch ? (ssdMatch[1] ? (ssdMatch[1].toUpperCase().includes('GB') || ssdMatch[1].toUpperCase().includes('TB') ? ssdMatch[1].toUpperCase() : ssdMatch[1] + 'GB SSD') : '256GB SSD') : '256GB SSD siêu tốc';

  // Extract Screen & Features (e.g. Cảm ứng, xoay 360) - preserve decimals like 13.3 inch
  const screenMatch = sanitized.match(/(?:màn\s*hình|màn)\s*[:=]?\s*([0-9.,]+\s*inch[^\n,•]*|[^,\n•]+)/i);
  let screen = screenMatch ? screenMatch[1].trim() : 'Sắc nét, chống chói, góc nhìn rộng';
  if (/cảm\s*ứng/i.test(sanitized) && !/cảm\s*ứng/i.test(screen)) {
    screen += ' (Hỗ trợ cảm ứng vuốt chạm)';
  }
  if (/xoay\s*360/i.test(sanitized) && !/xoay\s*360/i.test(screen)) {
    screen += ' (Bản lề xoay gập 360 độ linh hoạt)';
  }

  // Extract Price from raw text if not custom provided
  let retailPrice = customPrice;
  if (!retailPrice) {
    const priceMatch = rawText.match(/(?:giá|gia)\s*[:=]?\s*([\d.,]+)\s*(?:tr|triệu|k|K|đ|vnđ)/i);
    retailPrice = priceMatch ? `${priceMatch[1]} triệu` : 'Liên hệ báo giá tốt nhất';
  }

  // Extract Title line or fallback (e.g. DELL LATITUDE 3410, HP Envy x360...)
  let firstLine = sanitized.split('\n')[0].replace(/^(?:mã|ma)\s*[A-Za-z0-9_-]+\s*[:–-]?\s*/i, '').trim();
  // If there's a tagline after a dash (– or -), keep only the laptop name for punchy title
  if (firstLine.includes('–')) {
    firstLine = firstLine.split('–')[0].trim();
  } else if (firstLine.includes('-') && !/^\w+-\w+$/.test(firstLine)) {
    firstLine = firstLine.split('-')[0].trim();
  }
  const machineName = (firstLine.length >= 3 && firstLine.length <= 60) ? firstLine : `LAPTOP CHÍNH HÃNG NHẬT BÃI`;

  const gifts = (userSettings.giftList || [
    'Tặng túi chống sốc cao cấp cho 2 máy trở lên',
    'Tặng chuột không dây thời trang',
    'Sạc zin chuẩn theo máy',
    'Gói cài win'
  ]).map(g => `• ${g}`).join('\n');

  const depositLine = userSettings.depositNote 
    ? `✅ ${userSettings.depositNote}` 
    : '✅ Cọc 300k cho đơn đầu tiên, hỗ trợ call video check legit!';

  return `🔥 [SIÊU PHẨM GIÁ TỐT] - MÃ ${machineCode}: ${machineName.toUpperCase()}
────────────────────────────
⚡ ĐẶC ĐIỂM & CẤU HÌNH VƯỢT TRỘI:
🔹 Mã máy: #${machineCode}
🔹 Vi xử lý: ${cpu} (xử lý đa nhiệm mượt mà Office, lướt web, Photoshop 2D)
🔹 Bộ nhớ RAM: ${ram} (mở hàng chục tab Chrome làm việc không lo giật lag)
🔹 Ổ cứng: ${ssd} (khởi động Windows và mở ứng dụng chỉ trong 3 giây)
🔹 Màn hình: ${screen}
🔹 Bàn phím gõ êm, phím nảy tốt, thiết kế cứng cáp chuẩn tiêu chuẩn Nhật
💰 GIÁ ƯU ĐÃI HÔM NAY: ${retailPrice}
────────────────────────────
🎁 QUÀ TẶNG KÈM THEO:
${gifts}
🛡️ CHÍNH SÁCH BẢO HÀNH & HẬU MÃI:
✅ ${userSettings.warrantyPolicy || 'Bao test 7 ngày lỗi 1 đổi 1. Bảo hành phần cứng 3 tháng cho máy màn không cảm ứng, và 1 tháng cho máy màn cảm ứng, chu đáo.'}
✅ Kiểm tra máy thoải mái trước khi nhận - Đúng hàng mới thanh toán!
${depositLine}
📲 LIÊN HỆ ĐẶT HÀNG NGAY HÔM NAY:
☎️ Hotline / Zalo: ${userSettings.hotline || '0876637806'}
💬 Inbox trực tiếp Fanpage để nhận video test máy chi tiết!
🚚 ${userSettings.storeAddress || 'Giao hàng toàn quốc - Đồng kiểm kiểm tra máy trước khi thanh toán.'}
#LaptopCuNhat #LaptopVanPhong #LaptopGiaRe #LaptopGiaVuong #${machineCode}`;
}

/**
 * Generate high-converting Facebook retail post using Gemini API
 */
async function generatePostWithGemini(rawText, userSettings, customPrice, imageBase64 = null) {
  const apiKey = userSettings.geminiApiKey || process.env.GEMINI_API_KEY;

  // If no API key, gracefully fallback to intelligent parser
  if (!apiKey || apiKey.trim() === '') {
    return {
      content: fallbackGeneratePost(rawText, userSettings, customPrice),
      isAIGenerated: false,
      message: 'Đã tạo bài viết bằng bộ lọc mẫu thông minh (Chưa cấu hình Gemini API Key).'
    };
  }

  const prompt = `
Bạn là chuyên gia viết bài bán hàng Facebook (Facebook Content Copywriter) đỉnh cao chuyên về mảng Laptop cũ xách tay Nhật Bản cho cửa hàng của anh Gia Vương.

Dưới đây là thông tin bài viết thô lấy từ nhóm nguồn kho Zalo:
"""
${rawText || 'Hãy phân tích hình ảnh bảng danh sách mã laptop đính kèm.'}
"""

Thông tin cửa hàng của anh Gia Vương:
- Tên cửa hàng/Fanpage: ${userSettings.fanpageName || 'Laptop Nhật Bãi Giá Rẻ'}
- Hotline & Zalo chốt đơn: ${userSettings.hotline || '0876637806'}
- Chính sách bảo hành: ${userSettings.warrantyPolicy || 'Bao test 7 ngày 1 đổi 1, bảo hành phần cứng 3-6 tháng, hỗ trợ trọn đời'}
- Quà tặng kèm: ${(userSettings.giftList || []).join(', ')}
- Địa chỉ/Giao hàng: ${userSettings.storeAddress || 'Giao hàng toàn quốc, kiểm tra máy ưng ý mới thanh toán'}
- Giá bán lẻ mong muốn: ${customPrice ? customPrice : 'Hãy lấy giá trong bài thô và định dạng thành giá bán lẻ hấp dẫn'}

YÊU CẦU NGHIÊM NGẶT VỀ CẤU TRÚC VÀ NỘI DUNG:
1. TUYỆT ĐỐI KHÔNG ĐƯỢC để lộ các từ nhạy cảm như "lương 500k", "lương CTV", "hoa hồng", "giá sỉ", "hướng dẫn dán phím cho CTV", "trưởng/phó cộng đồng". Phải xóa sạch 100%!
2. Bóc tách rõ ràng: Mã máy, Tên hãng/Model (Dell, HP, ThinkPad, Dynabook, Sony Vaio, Surface...), Cấu hình chi tiết (CPU, RAM, SSD, Màn hình, Card đồ họa).
3. Tuân thủ CHÍNH XÁC cấu trúc khung bài bán lẻ sau:
🔥 [SIÊU PHẨM GIÁ TỐT] - MÃ [MÃ MÁY]: [TÊN MÁY]
────────────────────────────
⚡ ĐẶC ĐIỂM & CẤU HÌNH VƯỢT TRỘI:
🔹 Mã máy: #[MÃ MÁY]
🔹 Vi xử lý: [CPU chi tiết] (xử lý đa nhiệm mượt mà Office, lướt web, Photoshop 2D)
🔹 Bộ nhớ RAM: [RAM] (mở hàng chục tab Chrome làm việc không lo giật lag)
🔹 Ổ cứng: [SSD] (khởi động Windows và mở ứng dụng chỉ trong 3 giây)
🔹 Màn hình: [Màn hình chi tiết, ghi rõ có cảm ứng hay xoay 360 nếu có]
🔹 Bàn phím gõ êm, phím nảy tốt, thiết kế cứng cáp chuẩn tiêu chuẩn Nhật
💰 GIÁ ƯU ĐÃI HÔM NAY: [Giá bán lẻ]
────────────────────────────
🎁 QUÀ TẶNG KÈM THEO:
• Tặng túi chống sốc cao cấp cho 2 máy trở lên
• Tặng chuột không dây thời trang
• Sạc zin chuẩn theo máy
• Gói cài win

🛡️ CHÍNH SÁCH BẢO HÀNH & HẬU MÃI:
✅ Bao test 7 ngày lỗi 1 đổi 1. Bảo hành phần cứng 3 tháng cho máy màn không cảm ứng, và 1 tháng cho máy màn cảm ứng, chu đáo.
✅ Kiểm tra máy thoải mái trước khi nhận - Đúng hàng mới thanh toán!
✅ Cọc 300k cho đơn đầu tiên, hỗ trợ call video check legit trực tiếp!

📲 LIÊN HỆ ĐẶT HÀNG NGAY HÔM NAY:
☎️ Hotline / Zalo: ${userSettings.hotline || '0876637806'}
💬 Inbox trực tiếp Fanpage để nhận video test máy chi tiết!
🚚 ${userSettings.storeAddress || 'Giao hàng toàn quốc - Đồng kiểm kiểm tra máy trước khi thanh toán.'}
#LaptopCuNhat #LaptopVanPhong #LaptopGiaRe #LaptopGiaVuong #[MÃ MÁY]

4. Trả về DUY NHẤT nội dung bài viết hoàn chỉnh, không kèm bất kỳ lời giải thích hay code block ngoài.
`;

  try {
    const contents = [];
    const parts = [{ text: prompt }];

    if (imageBase64) {
      // If image base64 provided (from stock list OCR)
      const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: cleanBase64
        }
      });
    }

    contents.push({ role: 'user', parts });

    const result = await callGeminiWithFallback(contents, apiKey);

    return {
      content: result.text,
      isAIGenerated: true,
      modelUsed: result.model,
      message: `Đã sinh bài viết thành công bằng ${result.model}!`
    };
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    // Fallback if API call failed
    return {
      content: fallbackGeneratePost(rawText, userSettings, customPrice),
      isAIGenerated: false,
      message: `Gemini API lỗi (${error.message}). Đã sử dụng bộ mẫu thông minh thay thế.`
    };
  }
}

module.exports = {
  sanitizeRawText,
  fallbackGeneratePost,
  generatePostWithGemini,
  callGeminiWithFallback
};
