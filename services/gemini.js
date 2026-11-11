const axios = require('axios');
require('dotenv').config();

// Danh sách model chính thức hiện hành (theo tài liệu Gemini API).
// Free Tier tính hạn mức theo TỪNG model, nên nhiều model fallback = nhiều hạn mức hơn.
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash-lite'];

// Model đã hết hạn mức ngày (429) được tạm gác lại để không tốn thời gian gọi lại liên tục
const exhaustedUntil = new Map();
const EXHAUSTED_COOLDOWN_MS = 60 * 60 * 1000; // 1 giờ

/**
 * Reusable Gemini API caller with automatic fallback across reliable models
 */
async function callGeminiWithFallback(contents, apiKey, timeout = 35000) {
  if (require('../utils/runtime').IS_TEST_MODE) {
    // Bộ test không được tiêu tốn hạn mức Gemini thật -> ép dùng fallback nội bộ
    throw new Error('VG_TEST_MODE: bỏ qua Gemini API, dùng bộ viết bài dự phòng.');
  }

  let lastError = null;
  const now = Date.now();
  const available = GEMINI_MODELS.filter((m) => (exhaustedUntil.get(m) || 0) <= now);
  const candidates = available.length > 0 ? available : GEMINI_MODELS;

  for (const model of candidates) {
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
      if (status === 429) {
        exhaustedUntil.set(model, Date.now() + EXHAUSTED_COOLDOWN_MS);
        console.warn(`[Gemini API] ${model} hết hạn mức (429). Tạm gác 1 giờ, chuyển model dự phòng...`);
      } else {
        console.warn(`[Gemini API] Thử model ${model} không thành công (Status: ${status}): ${String(msg).slice(0, 200)}. Chuyển sang model dự phòng tiếp theo...`);
      }
    }
  }

  throw new Error(`Tất cả các model Gemini đều không phản hồi: ${lastError?.message || 'Không rõ nguyên nhân'}`);
}

/**
 * Clean and filter sensitive wholesale terms from text
 */
function sanitizeRawText(text) {
  if (!text) return '';
  return text
    // Remove CTV salaries, commissions, discounts
    .replace(/(?:lương|luong|hoa hồng|hoa hong|chiết khấu|chiet khau)\s*[:=]?\s*\d+[kKmMtrTrVNĐvnđ]*/gi, '')
    // Remove wholesale prices, import prices, "giá sỉ ae ib", "giá ib", "sỉ ib riêng", "win ae tự cài"
    .replace(/giá\s+(?:nhập|sỉ|ctv|buôn)\s*[:=]?\s*[\d.,]*[kKmMtrTrVNĐvnđ]*/gi, '')
    .replace(/(?:giá\s+sỉ|sỉ|giá)\s*(?:ae|anh em)?\s*(?:ib|inbox)(?:\s*riêng)?/gi, '')
    .replace(/win\s+(?:ae|anh em)?\s*tự\s+cài[^\n.]*/gi, '')
    .replace(/\b(?:ib|inbox)\s+(?:lấy\s+)?giá\b/gi, '')
    // Remove community admin banners & guideline texts
    .replace(/chỉ\s+(?:trưởng\/phó|admin)\s+cộng\s+đồng[^\n]*/gi, '')
    .replace(/hướng\s+dẫn\s+dán\s+phím\s+cho\s+ctv[^\n]*/gi, '')
    .replace(/thông\s+tin\s+chính\s+sách\s+nhóm[^\n]*/gi, '')
    .replace(/khách\s+sỉ\s*\([^)]*\)[^\n]*/gi, '')
    .replace(/trợ\s+giá\s+sỉ[^\n]*/gi, '')
    .replace(/đối\s+với\s+cộng\s+tác\s+viên[^\n]*/gi, '')
    // Remove "Chốt" comments
    .replace(/^(?:chốt|chot)(?:\s+máy|\s+đơn)?$/gim, '')
    // Remove wholesaler phone numbers (e.g. 0982.732.678)
    .replace(/(?:sđt|sdt|hotline|zalo|lh|liên hệ)?\s*[:=]?\s*(?:0\d{1,3}[.\s-]?\d{3}[.\s-]?\d{3,4})/gi, '')
    .trim();
}

/**
 * Extract exact machine code from raw text (handles "Mã 129", "Lô 09", "Mã 056B", "Mã 117 A", "Lô 08"...)
 */
function extractExplicitMachineCode(text) {
  if (!text) return 'VIP';
  // 1. Matches "Mã 129", "Mã: 056B", "Mã 117 A", "Mã #118B"
  const maMatch = text.match(/(?:mã|ma|ms|code|#)\s*[:=.-]?\s*([A-Za-z0-9]+(?:\s*[A-Za-z])?)/i);
  if (maMatch) {
    return maMatch[1].replace(/\s+/g, '').toUpperCase();
  }

  // 2. Matches "Lô 09", "Lô: 08", "Lô 08."
  const loMatch = text.match(/(?:lô|lo)\s*[:=.-]?\s*([A-Za-z0-9]+)/i);
  if (loMatch) {
    return loMatch[1].toUpperCase();
  }

  // 3. First standalone token e.g. "129:" or "#129"
  const startMatch = text.match(/^(?:#)?([A-Za-z0-9]{2,8})\b[:.-]/);
  if (startMatch) {
    return startMatch[1].toUpperCase();
  }

  return 'VIP';
}

/**
 * Intelligent regex fallback parser when Gemini API Key is not yet provided
 */
function fallbackGeneratePost(rawText, userSettings, customPrice) {
  const sanitized = sanitizeRawText(rawText);
  const machineCode = extractExplicitMachineCode(rawText);

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
    if (priceMatch) {
      retailPrice = `${priceMatch[1]} triệu`;
    } else if (/giá\s*[\d.,xX]+\s*(?:tr|triệu)/i.test(rawText)) {
      const matchX = rawText.match(/giá\s*([\d.,xX]+\s*(?:tr|triệu))/i);
      retailPrice = matchX ? `${matchX[1]} (Ưu đãi học sinh - sinh viên)` : 'Inbox nhận giá tốt nhất';
    } else {
      retailPrice = 'Inbox Fanpage hoặc Zalo: 0876637806 để nhận giá ưu đãi tốt nhất';
    }
  }

  // Extract Title line or fallback (e.g. DELL LATITUDE 3410, HP Envy x360...)
  let firstLine = sanitized.split('\n')[0].replace(/^(?:mã|ma|lô|lo)\s*[A-Za-z0-9_.-]+\s*[:–-]?\s*/i, '').trim();
  // Clean up "4 máy", "4 em", "8 máy" from lot titles
  firstLine = firstLine.replace(/^\d+\s*(?:máy|em|chiếc)\s+/i, '').trim();
  // If there's a tagline after a dash (– or -), keep only the laptop name for punchy title
  if (firstLine.includes('–')) {
    firstLine = firstLine.split('–')[0].trim();
  } else if (firstLine.includes('-') && !/^\w+-\w+$/.test(firstLine)) {
    firstLine = firstLine.split('-')[0].trim();
  }
  const machineName = (firstLine.length >= 3 && firstLine.length <= 60) ? firstLine : `LAPTOP CHÍNH HÃNG NHẬT BÃI`;
  const cleanModelTag = machineName.replace(/[^a-zA-Z0-9]/g, '');
  const hotline = userSettings.hotline || '0876637806';

  return `🔥 [GIÁ TỐT] - MÃ #${machineCode}: ${machineName.toUpperCase()}
💰 Giá công khai: ${retailPrice} (Chuẩn nội địa Nhật zin đẹp)

⚡ Cấu hình chi tiết:
• CPU: ${cpu}
• RAM: ${ram} | SSD: ${ssd}
• Màn hình: ${screen}
• Thiết kế: Vỏ nhôm nguyên khối, mỏng nhẹ, pin tốt

🎁 Tặng kèm: Sạc zin + Túi chống sốc + Chuột không dây (Cài sẵn Win/Office)
🛡️ Bảo hành: Bao test 7 ngày 1 đổi 1, bảo hành phần cứng 3 tháng chu đáo
🚚 Giao hàng toàn quốc - Đồng kiểm kiểm tra máy trước khi thanh toán!
📞 Hotline / Zalo: ${hotline} (Gia Vương)
#LaptopVuongGia #${cleanModelTag} #${machineCode}`;
}

/**
 * Generate high-converting Facebook retail post using Gemini API
 */
async function generatePostWithGemini(rawText, userSettings, customPrice, imageBase64 = null) {
  const apiKey = userSettings.geminiApiKey || process.env.GEMINI_API_KEY;
  const detectedCode = extractExplicitMachineCode(rawText);

  // If no API key, gracefully fallback to intelligent parser
  if (!apiKey || apiKey.trim() === '') {
    return {
      content: fallbackGeneratePost(rawText, userSettings, customPrice),
      machineCode: detectedCode,
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
- Chính sách bảo hành: ${userSettings.warrantyPolicy || 'Bao test 7 ngày 1 đổi 1, bảo hành phần cứng 3 tháng chu đáo'}
- Quà tặng kèm: Sạc zin + Túi chống sốc + Chuột không dây (Cài sẵn Win/Office)
- Địa chỉ/Giao hàng: ${userSettings.storeAddress || 'Giao hàng toàn quốc - Đồng kiểm kiểm tra máy trước khi thanh toán!'}
- Giá bán lẻ mong muốn: ${customPrice ? customPrice : 'Hãy lấy giá trong bài thô và định dạng thành giá bán lẻ hấp dẫn'}

YÊU CẦU NGHIÊM NGẶT VỀ ĐỘ DÀI VÀ CẤU TRÚC (TINH GỌN, KHÔNG DÀI DÒNG):
1. BÀI VIẾT PHẢI TINH GỌN (KHOẢNG 400 - 520 KÝ TỰ, 10-12 DÒNG): Tuyệt đối không viết lan man, không dùng các đường kẻ ngang dài ngoằng (────────────────────────────), không giải thích rườm rà trong ngoặc đơn. Khách hàng lướt Facebook cần nắm bắt Mã máy, Tên máy, Giá và Cấu hình chỉ trong 5 giây!
2. TUYỆT ĐỐI XÓA SẠCH từ ngữ nhạy cảm của bên sỉ: "lương 500k", "lương CTV", "hoa hồng", "giá sỉ", "sỉ ib riêng", "win ae tự cài", "chốt", v.v.
3. BẢO TOÀN SỐ ĐIỆN THOẠI DUY NHẤT: Bắt buộc Hotline/Zalo là 0876637806 (Gia Vương). Tuyệt đối không để lọt số điện thoại của bên sỉ hay số nào khác.
4. ĐỊNH DANH MÃ MÁY CHUẨN XÁC: Mã máy là "${detectedCode}".
5. TUÂN THỦ CHÍNH XÁC CẤU TRÚC KHUNG BÀI BÁN LẺ TINH GỌN SAU ĐÂY:
🔥 [GIÁ TỐT] - MÃ #${detectedCode}: [TÊN MÁY VIẾT HOA]
💰 Giá công khai: [Giá bán lẻ, ví dụ 8.3 triệu] (Chuẩn nội địa Nhật zin đẹp)

⚡ Cấu hình chi tiết:
• CPU: [Tên CPU ngắn gọn]
• RAM: [Dung lượng RAM] | SSD: [Dung lượng SSD siêu tốc]
• Màn hình: [Kích thước và độ phân giải màn hình]
• Thiết kế: Vỏ nhôm nguyên khối, mỏng nhẹ, pin tốt

🎁 Tặng kèm: Sạc zin + Túi chống sốc + Chuột không dây (Cài sẵn Win & Office)
🛡️ Bảo hành: Bao test 7 ngày 1 đổi 1, bảo hành phần cứng 3 tháng chu đáo
🚚 Giao hàng toàn quốc - Đồng kiểm kiểm tra máy trước khi thanh toán!
📞 Hotline / Zalo: 0876637806 (Gia Vương)
#LaptopVuongGia #[TenModelVietLien] #${detectedCode}

6. Trả về DUY NHẤT nội dung bài viết hoàn chỉnh, không kèm bất kỳ lời giải thích hay code block ngoài.
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
      machineCode: detectedCode,
      isAIGenerated: true,
      modelUsed: result.model,
      message: `Đã sinh bài viết thành công bằng ${result.model}!`
    };
  } catch (error) {
    console.error('Gemini API Error:', error.response?.data || error.message);
    // Fallback if API call failed
    return {
      content: fallbackGeneratePost(rawText, userSettings, customPrice),
      machineCode: detectedCode,
      isAIGenerated: false,
      message: `Gemini API lỗi (${error.message}). Đã sử dụng bộ mẫu thông minh thay thế.`
    };
  }
}

/**
 * Algorithmic fallback rewrite for circular posts (4 rotating themes)
 * Converts single-machine lot post into curated model showcase post ("Laptop tuyển chọn Nhật Bản")
 * with reordered specs, fresh opening hooks, varied emojis, and hashtags.
 */
function fallbackCircularRewrite(template, style = 'featured_review') {
  if (!template) return '';
  const model = template.model_name || 'Laptop Tuyển Chọn Nhật Bản';
  const brand = template.brand || 'Nhật Bản';
  const cpu = template.cpu || 'Intel Core mạnh mẽ';
  const ram = template.ram || '8GB';
  const ssd = template.ssd || '256GB SSD';
  const screen = template.screen || 'Màn hình sắc nét chuẩn HD/FHD';
  const config = template.standard_config || `${cpu} / RAM ${ram} / SSD ${ssd} / Màn ${screen}`;
  const price = template.price_display || (template.price_min ? `${(template.price_min / 1e6).toFixed(1)} triệu` : 'Liên hệ báo giá tốt nhất');
  const modelTag = (template.model_name || 'Laptop').replace(/[^a-zA-Z0-9]/g, '');

  const normStyle = String(style || 'featured_review').toLowerCase();

  // 1. Theme: Flash Sale / Budget Value (flash_sale, hook_budget, budget, deal)
  if (normStyle.includes('flash') || normStyle.includes('sale') || normStyle.includes('budget') || normStyle === 'deal') {
    return `🔥 [TIÊU ĐIỂM GIÁ TỐT] — ${model.toUpperCase()}
💰 Giá ưu đãi: ${price} (Chuẩn nội địa Nhật)

⚡ Cấu hình nổi bật:
• CPU: ${cpu} | RAM: ${ram}
• Ổ cứng: ${ssd} siêu tốc
• Màn hình: ${screen} chống lóa dịu mắt
• Khung vỏ cứng cáp, vượt qua bài test nội địa Nhật

🎁 Tặng: Túi chống sốc + Chuột không dây + Sạc zin (Cài Win/Office trọn đời)
🛡️ Bao test 7 ngày lỗi 1 đổi 1, bảo hành chu đáo 1 - 3 tháng
🚚 Đồng kiểm tận tay - Đúng máy chuẩn zin mới thanh toán!
📞 Hotline / Zalo đặt hàng: 0876637806 (Gia Vương)
#LaptopGiaRe #LaptopVuongGia #${modelTag}`;
  }

  // 2. Theme: Military Durability / Curated Japanese Pick (curated_pick, hook_durability, durability, military)
  if (normStyle.includes('curated') || normStyle.includes('durability') || normStyle.includes('pick') || normStyle.includes('military')) {
    return `🌟 [HÀNG TUYỂN CHỌN LOẠI A] — ${model.toUpperCase()}
💰 Giá đầu tư: ${price} (Zin nguyên bản 100%)

✨ Điểm mạnh nổi bật:
• Khung vỏ hợp kim bền bỉ chuẩn quân đội, bàn phím gõ êm
• Vi xử lý: ${cpu} | Bộ nhớ: RAM ${ram}
• Lưu trữ: ${ssd} | Màn hình hiển thị: ${screen}
• Linh kiện tuyển chọn khắt khe, pin bền bỉ qua năm tháng

🎁 Trọn bộ: Túi thời trang + Chuột quang + Sạc xịn (Tra keo vệ sinh trọn đời)
🛡️ Cam kết vàng: Bao test 7 ngày 1 đổi 1, bảo hành trách nhiệm 1 - 3 tháng
📞 Hotline tư vấn trực tiếp: 0876637806 (Gia Vương)
#HangTuyenChon #DoBenChuanNhat #LaptopVuongGia #${modelTag}`;
  }

  // 3. Theme: Lightweight Mobility & Practical Value (value_champion, hook_mobility, mobility, champion)
  if (normStyle.includes('value') || normStyle.includes('champion') || normStyle.includes('mobility')) {
    return `🏆 [LỰA CHỌN THỰC CHIẾN] — ${model.toUpperCase()}
💰 Tầm giá hợp lý: ${price} (Mỏng nhẹ tối ưu)

💻 Cấu hình thực chiến:
• Cấu hình: ${config}
• Trọng lượng nhẹ, thiết kế tinh gọn tiện bỏ balo di chuyển
• Xử lý mượt Word, Excel nặng, đa nhiệm Chrome không độ trễ

🎁 Phụ kiện kèm máy: Túi chống sốc + Chuột không dây + Sạc zin chuẩn dòng
🛡️ 1 đổi 1 trong 7 ngày nếu lỗi phần cứng, bảo hành chu đáo 1 - 3 tháng
🚚 Giao hàng toàn quốc - Kiểm tra ưng ý mới thanh toán!
📞 Hotline / Zalo: 0876637806
#LaptopVanPhong #LaptopDiDong #LaptopVuongGia #${modelTag}`;
  }

  // 4. Theme: Office Productivity & Detailed Review (featured_review, hook_office, office, default)
  return `✨ [REVIEW DÒNG MÁY] — ${model.toUpperCase()}
💰 Khoảng giá ưu đãi: ${price} (Top bán chạy chuẩn Nhật)

⚡ Đánh giá chi tiết:
• CPU: ${cpu} | RAM: ${ram} chuyển đổi cửa sổ trơn tru
• SSD: ${ssd} mở ứng dụng trong vài giây
• Màn hình: ${screen} hiển thị sắc nét, góc nhìn rộng
• Thiết kế thanh lịch, phím gõ êm phong cách doanh nhân

🎁 Đầy đủ phụ kiện: Sạc zin theo máy + Túi 2 ngăn + Chuột thời trang
🛡️ Bao test 7 ngày lỗi 1 đổi 1, bảo hành phần cứng 1 - 3 tháng
🚚 Đồng kiểm toàn quốc, cọc 300k gọi video call xem máy thực tế
📞 Hotline / Zalo: 0876637806 (Gia Vương)
#ReviewLaptop #LaptopDoanhNhan #LaptopVuongGia #${modelTag}`;
}

/**
 * Generate circular post rewrite with Gemini API (4 rotating themes)
 * Converts single-machine lot post into curated model showcase post with reordered specs,
 * fresh opening hooks, varied emojis, and hashtags.
 */
async function generateCircularPostRewrite(template, style = 'featured_review') {
  if (!template) {
    throw new Error('Vui lòng cung cấp dữ liệu Model Template.');
  }

  const apiKey = process.env.GEMINI_API_KEY;

  // Fallback immediately if no API key configured
  if (!apiKey || apiKey.trim() === '') {
    const fallbackContent = fallbackCircularRewrite(template, style);
    const resultObj = {
      content: fallbackContent,
      isAIGenerated: false,
      modelUsed: 'algorithmic_fallback',
      message: 'Đã tạo bài viết tuần hoàn bằng bộ mẫu thuật toán (Chưa cấu hình GEMINI_API_KEY).'
    };
    resultObj.toString = function() { return this.content; };
    return resultObj;
  }

  const model = template.model_name || 'Laptop Nhật Bãi';
  const brand = template.brand || 'Nhật Bản';
  const cpu = template.cpu || 'Intel Core mạnh mẽ';
  const ram = template.ram || '8GB';
  const ssd = template.ssd || '256GB SSD';
  const screen = template.screen || 'Màn hình sắc nét';
  const price = template.price_display || (template.price_min ? `${(template.price_min / 1e6).toFixed(1)} triệu` : 'Liên hệ báo giá tốt nhất');
  const modelTag = (template.model_name || 'Laptop').replace(/[^a-zA-Z0-9]/g, '');

  const normStyle = String(style || 'featured_review').toLowerCase();
  let themeName = 'Hiệu Năng & Văn Phòng Thực Chiến (Office Productivity)';
  let themeGuide = 'Nhấn mạnh hiệu năng CPU & RAM, làm việc văn phòng đa nhiệm Excel/Word mượt mà, gõ phím êm ái cả ngày không mỏi tay.';
  let requiredTitle = `✨ [REVIEW CHI TIẾT DÒNG MÁY] — ${model.toUpperCase()}`;
  let specEmphasis = 'Đưa thông số CPU và RAM lên đầu, tiếp theo là SSD và Màn hình';
  let themeEmojis = '✨, 💼, ⚡, 🔹, 💰, 🎁, 🛡️, 📲, 💬';
  let hashtags = `#LaptopDoanhNhan #LaptopVuongGia #ReviewLaptop #LaptopVanPhong #${modelTag}`;

  if (normStyle.includes('flash') || normStyle.includes('sale') || normStyle.includes('budget') || normStyle === 'deal') {
    themeName = 'Tối Ưu Ngân Sách & Giá Trị Vượt Giá Tiền (Budget Value)';
    themeGuide = 'Nhấn mạnh mức giá ưu đãi, cấu hình vượt trội trong tầm giá, tối ưu chi phí đầu tư cho doanh nghiệp và cá nhân.';
    requiredTitle = `🔥 [TIÊU ĐIỂM GIÁ TỐT] — ${model.toUpperCase()} CHUẨN NỘI ĐIA NHẬT`;
    specEmphasis = 'Đưa mức giá ưu đãi và ổ cứng SSD siêu tốc lên đầu, tiếp theo là CPU, RAM, Màn hình';
    themeEmojis = '🔥, ⚡, 🚀, 🔹, 💰, 🎁, 🛡️, 📲, 💬';
    hashtags = `#LaptopGiaRe #LaptopTuyenChon #GiaUuDai #LaptopVuongGia #${modelTag}`;
  } else if (normStyle.includes('curated') || normStyle.includes('durability') || normStyle.includes('pick') || normStyle.includes('military')) {
    themeName = 'Độ Bền Chuẩn Quân Đội & Tuyển Chọn Nhật Bản (Military Durability)';
    themeGuide = 'Nhấn mạnh khung hợp kim cứng cáp, bàn phím chống tràn, độ bền nồi đồng cối đá đạt chuẩn quân sự, máy nguyên zin 100%.';
    requiredTitle = `🌟 [HÀNG TUYỂN CHỌN LOẠI A] — ${model.toUpperCase()}`;
    specEmphasis = 'Đưa tiêu chuẩn độ bền khung vỏ và bàn phím chống tràn lên đầu, tiếp theo là màn hình chống chói, CPU và RAM';
    themeEmojis = '🌟, 💎, 🛡️, 🔹, 💰, 🎁, ✅, ☎️';
    hashtags = `#LaptopChuanZin #HangTuyenChon #LaptopDoanhNhan #DoBenChuanNhat #LaptopVuongGia #${modelTag}`;
  } else if (normStyle.includes('value') || normStyle.includes('champion') || normStyle.includes('mobility')) {
    themeName = 'Gọn Nhẹ, Di Chuyển & Thời Lượng Pin (Lightweight Mobility)';
    themeGuide = 'Nhấn mạnh thiết kế mỏng nhẹ, pin khỏe, tối ưu cho người hay di chuyển, công tác, học tập thực chiến.';
    requiredTitle = `🏆 [LỰA CHỌN THỰC CHIẾN SỐ 1] — ${model.toUpperCase()}`;
    specEmphasis = 'Đưa thiết kế gọn nhẹ, pin bền bỉ lên đầu, tiếp theo là cấu hình thực chiến CPU/RAM/SSD';
    themeEmojis = '🏆, 💻, 🎯, 🔹, 💰, 🎁, 🛡️, 📲';
    hashtags = `#LaptopBenBi #LaptopVanPhong #LaptopGiaTot #LaptopDiDong #LaptopVuongGia #${modelTag}`;
  }

  const prompt = `
Bạn là chuyên gia sáng tạo nội dung bán lẻ Facebook Fanpage của "Laptop Vương Gia".
Nhiệm vụ: Viết lại bài đăng bán hàng hoàn toàn mới cho dòng laptop dưới đây theo phong cách "GIỚI THIỆU DÒNG MÁY TUYỂN CHỌN NHẬT BẢN".

THÔNG TIN DÒNG MÁY GỐC:
- Tên Model: ${model}
- Hãng: ${brand}
- Cấu hình chuẩn: CPU ${cpu}, RAM ${ram}, Ổ cứng SSD ${ssd}, Màn hình ${screen}
- Giá bán tham khảo: ${price}

CHỦ ĐỀ BÀI VIẾT YÊU CẦU: "${themeName}"
GÓC NHÌN ĐẶC TRƯNG: ${themeGuide}

DÒNG TIÊU ĐỀ ĐẦU TIÊN BẮT BUỘC (PHẢI BẮT ĐẦU CHÍNH XÁC BẰNG DÒNG NÀY):
${requiredTitle}

QUY TẮC BẮT BUỘC ĐỂ TRÁNH TRÙNG LẶP FACEBOOK (CHỐNG DUPLICATE SPAM):
1. BÀI VIẾT PHẢI TINH GỌN (KHOẢNG 450 - 550 KÝ TỰ, 12-14 DÒNG): Không viết lan man, không dùng các đường kẻ ngang dài ngoằng (────────────────────────────). Khách hàng lướt mạng xã hội cần nắm bắt thông tin nhanh gọn!
2. TUYỆT ĐỐI KHÔNG dùng mã máy đơn lẻ tạm thời dạng #101, #046, Lô 5. Chuyển thành bài giới thiệu dòng máy tuyển chọn: "${model.toUpperCase()}".
3. ĐẢO THỨ TỰ TRÌNH BÀY THÔNG SỐ: ${specEmphasis}.
4. BIẾN THIÊN EMOJI & ICON: Sử dụng bộ icon đa dạng [${themeEmojis}] phù hợp phong cách.
5. CAM KẾT & QUÀ TẶNG (TINH GỌN 2-3 DÒNG):
   - Quà tặng: Sạc zin + Túi chống sốc + Chuột không dây (Cài sẵn Win/Office trọn đời).
   - Bảo hành: Bao test 7 ngày lỗi 1 đổi 1, bảo hành phần cứng chu đáo từ 1 - 3 tháng.
   - Hotline / Zalo: 0876637806 (Gia Vương).
6. HASHTAGS BẮT BUỘC Ở CUỐI BÀI:
   ${hashtags}

ĐẦU RA: Trả về DUY NHẤT nội dung bài viết Facebook hoàn chỉnh, không có markdown code block (\`\`\`), không có lời giải thích bên ngoài.
`;

  try {
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    const result = await callGeminiWithFallback(contents, apiKey);

    // Strip markdown code fences if Gemini wrapped it
    let cleanText = result.text.trim();
    if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
    }

    // Ensure first line has the required unique title to guarantee test 3.5 & 4.2 compliance
    if (!cleanText.startsWith(requiredTitle.split(' — ')[0])) {
      cleanText = `${requiredTitle}\n\n${cleanText}`;
    }

    const resultObj = {
      content: cleanText,
      isAIGenerated: true,
      modelUsed: result.model,
      style: normStyle,
      message: `Đã sinh bài viết tuần hoàn thành công bằng ${result.model}!`
    };
    resultObj.toString = function() { return this.content; };
    return resultObj;
  } catch (error) {
    console.warn(`[Gemini API] Lỗi sinh bài viết tuần hoàn (${error.message}). Tự động kích hoạt fallback thuật toán...`);
    const fallbackContent = fallbackCircularRewrite(template, style);
    const resultObj = {
      content: fallbackContent,
      isAIGenerated: false,
      modelUsed: 'algorithmic_fallback',
      style: normStyle,
      message: `Gemini API lỗi (${error.message}). Đã sử dụng bộ tạo bài tuần hoàn thuật toán thay thế.`
    };
    resultObj.toString = function() { return this.content; };
    return resultObj;
  }
}

module.exports = {
  sanitizeRawText,
  extractExplicitMachineCode,
  fallbackGeneratePost,
  generatePostWithGemini,
  callGeminiWithFallback,
  generateCircularPostRewrite,
  fallbackCircularRewrite
};
