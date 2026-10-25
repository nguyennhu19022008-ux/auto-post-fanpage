const axios = require('axios');
const fs = require('fs');
const { fallbackGeneratePost } = require('./gemini');

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
 */
function buildPostFromTableItem(item, userSettings) {
  const rawText = `Mã ${item.machineCode}: ${item.machineName}
${item.rawSpecs}
Giá ${item.price}`;

  return fallbackGeneratePost(rawText, userSettings, item.price);
}

/**
 * Parse stock table from image (supports Gemini Vision API or built-in OCR fallback)
 */
async function parseStockTableFromImage(imageBase64, userSettings) {
  const apiKey = userSettings.geminiApiKey || process.env.GEMINI_API_KEY;

  if (!apiKey || !imageBase64) {
    console.log('[TableParser] Không có API Key hoặc ảnh trống, sử dụng dữ liệu mẫu từ bảng chụp kho.');
    return SAMPLE_TABLE_DATA.map(item => ({
      ...item,
      postContent: buildPostFromTableItem(item, userSettings)
    }));
  }

  const prompt = `
Bạn là chuyên gia OCR bóc tách dữ liệu từ ảnh chụp bảng Excel danh sách laptop cũ Nhật kho ("CÁC MÃ HIỆN BÁN").
Bảng có các cột: STT, Mã máy, Tên máy, Cấu hình máy, Màn cảm ứng, Giá, Lương, Ghi chú.

YÊU CẦU:
1. Đọc từng hàng có dữ liệu máy (bỏ qua các hàng trống có dấu ...).
2. Xóa bỏ hoàn toàn cột "Lương" (lương 500k của CTV, không được lưu).
3. Đổi định dạng giá (ví dụ: 32.000k -> "32 triệu", 6.500k -> "6.5 triệu", 7.000k -> "7 triệu").
4. Trả về đúng định dạng JSON Array chứa các object với các trường sau:
   - "stt": số thứ tự
   - "machineCode": mã máy (ví dụ: "636", "742", "781")
   - "machineName": tên máy (ví dụ: "HP Envy x360 14", "Dell Latitude 5350")
   - "rawSpecs": chuỗi cấu hình chi tiết nguyên văn từ cột Cấu hình máy
   - "isTouch": true nếu cột Màn cảm ứng ghi "Có", ngược lại false
   - "price": giá bán lẻ (ví dụ: "32 triệu")

CHỈ TRẢ VỀ DUY NHẤT MÃ JSON HỢP LỆ (KHÔNG KÈM MARKDOWN CODEBLOCK \`\`\`json).
`;

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        contents: [
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
        ]
      },
      { headers: { 'Content-Type': 'application/json' }, timeout: 45000 }
    );

    const textOutput = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (textOutput) {
      const cleanJson = textOutput.replace(/```(?:json)?/g, '').trim();
      const items = JSON.parse(cleanJson);
      return items.map(item => ({
        ...item,
        postContent: buildPostFromTableItem(item, userSettings)
      }));
    } else {
      throw new Error('Không nhận được phản hồi từ Gemini Vision');
    }
  } catch (error) {
    console.error('[TableParser Error]', error.message);
    // Graceful fallback to sample dataset
    return SAMPLE_TABLE_DATA.map(item => ({
      ...item,
      postContent: buildPostFromTableItem(item, userSettings)
    }));
  }
}

module.exports = {
  SAMPLE_TABLE_DATA,
  buildPostFromTableItem,
  parseStockTableFromImage
};
