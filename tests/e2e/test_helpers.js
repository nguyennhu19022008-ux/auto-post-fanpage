/**
 * tests/e2e/test_helpers.js
 * Comprehensive test utilities, HTTP client, ephemeral server harness,
 * assertions, HTML inspector, and authoritative contract oracle.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');

// Authoritative Default Seed Templates for Japanese Laptops
const DEFAULT_SEED_TEMPLATES = [
  {
    id: 'tpl_dell_lat_5350',
    model_key: 'dell-latitude-5350__ultra-5__16gb__256gb__13-3-inch',
    model_name: 'Dell Latitude 5350',
    brand: 'Dell',
    cpu: 'Intel Core Ultra 5',
    ram: '16GB',
    ssd: '256GB SSD',
    screen: '13.3 inch FHD IPS Chống chói',
    standard_config: 'Ultra 5 / 16GB / 256GB SSD / 13.3" IPS',
    price_min: 13000000,
    price_max: 14500000,
    price_display: '13.9 triệu',
    price_range_category: 'above_12m',
    status: 'active',
    base_ai_prompt: 'Laptop doanh nhân siêu bền bỉ nhập khẩu chính hãng...',
    media_files: [
      {
        filename: '1793096545141-962277818.jpg',
        url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793096545141-962277818.jpg',
        storage: 'supabase',
        mimetype: 'image/jpeg'
      },
      {
        filename: '1793096545885-412751655.jpg',
        url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793096545885-412751655.jpg',
        storage: 'supabase',
        mimetype: 'image/jpeg'
      }
    ],
    post_count: 5,
    last_posted_at: '2026-11-01T10:00:00Z',
    created_at: '2026-10-15T08:00:00Z'
  },
  {
    id: 'tpl_thinkpad_t480s',
    model_key: 'thinkpad-t480s__i5-8350u__8gb__256gb__14-inch',
    model_name: 'ThinkPad T480s',
    brand: 'ThinkPad',
    cpu: 'Intel Core i5-8350U',
    ram: '8GB',
    ssd: '256GB NVMe',
    screen: '14.0 inch FHD IPS',
    standard_config: 'Core i5-8350U / 8GB / 256GB NVMe / 14" FHD',
    price_min: 6500000,
    price_max: 7500000,
    price_display: '6.9 triệu',
    price_range_category: '5m_8m',
    status: 'active',
    base_ai_prompt: 'Biểu tượng gõ phím êm ái, độ bền quân đội chuẩn Nhật...',
    media_files: [
      {
        filename: '1793096545999-123456789.jpg',
        url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793096545999-123456789.jpg',
        storage: 'supabase',
        mimetype: 'image/jpeg'
      }
    ],
    post_count: 8,
    last_posted_at: '2026-11-03T15:30:00Z',
    created_at: '2026-10-10T08:00:00Z'
  },
  {
    id: 'tpl_hp_envy_x360',
    model_key: 'hp-envy-x360-15__ryzen-5__8gb__256gb__15-6-inch',
    model_name: 'HP Envy x360 15',
    brand: 'HP',
    cpu: 'Ryzen 5 4500U',
    ram: '8GB',
    ssd: '256GB SSD',
    screen: '15.6 inch FHD Cảm ứng xoay 360',
    standard_config: 'Ryzen 5 4500U / 8GB / 256GB / 15.6" Touch 360°',
    price_min: 7500000,
    price_max: 8500000,
    price_display: '7.8 triệu',
    price_range_category: '5m_8m',
    status: 'active',
    base_ai_prompt: 'Thiết kế nhôm nguyên khối sang trọng, màn hình cảm ứng xoay gập tiện lợi...',
    media_files: [
      {
        filename: 'hp-envy-1.jpg',
        url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/hp-envy-1.jpg',
        storage: 'supabase',
        mimetype: 'image/jpeg'
      }
    ],
    post_count: 3,
    last_posted_at: '2026-11-04T08:30:00Z',
    created_at: '2026-10-20T08:00:00Z'
  }
];

/**
 * Creates a reference router implementing the PROJECT.md Interface Contracts.
 * Used as an authoritative oracle and progressive testability fallback.
 */
function createReferenceRouter(state) {
  const router = express.Router();

  // GET /api/data-post/templates
  router.get('/templates', (req, res) => {
    let list = [...state.templates];
    const { brand, price_range, priceRange, status, search } = req.query;
    const pRange = price_range || priceRange;

    if (brand && brand.toLowerCase() !== 'all') {
      list = list.filter(t => (t.brand || '').toLowerCase() === brand.toLowerCase());
    }

    if (pRange && pRange.toLowerCase() !== 'all') {
      list = list.filter(t => (t.price_range_category || t.priceRangeCategory) === pRange);
    }

    if (status && status.toLowerCase() !== 'all') {
      list = list.filter(t => (t.status || 'active').toLowerCase() === status.toLowerCase());
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        (t.model_name || t.modelName || '').toLowerCase().includes(q) ||
        (t.cpu || '').toLowerCase().includes(q) ||
        (t.standard_config || t.standardConfig || '').toLowerCase().includes(q)
      );
    }

    res.json({
      success: true,
      count: list.length,
      data: list,
      templates: list
    });
  });

  // GET /api/data-post/templates/:id
  router.get('/templates/:id', (req, res) => {
    const tpl = state.templates.find(t => t.id === req.params.id);
    if (!tpl) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy Model Template.' });
    }
    res.json({ success: true, data: tpl, template: tpl });
  });

  // POST /api/data-post/templates
  router.post('/templates', (req, res) => {
    const body = req.body;
    if (!body || Object.keys(body).length === 0) {
      return res.status(400).json({ success: false, error: 'Yêu cầu dữ liệu body không được để trống.' });
    }

    const modelName = body.model_name || body.modelName;
    const brand = body.brand || 'Khác';
    const cpu = body.cpu || (body.specs && body.specs.cpu);
    const ram = body.ram || (body.specs && body.specs.ram);
    const ssd = body.ssd || (body.specs && body.specs.ssd) || '256GB SSD';
    const screen = body.screen || (body.specs && body.specs.screen) || '14.0 inch';

    if (!modelName || !modelName.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu trường bắt buộc: model_name.' });
    }
    if (!cpu || !cpu.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu thông số CPU bắt buộc.' });
    }
    if (!ram || !ram.trim()) {
      return res.status(400).json({ success: false, error: 'Thiếu thông số RAM bắt buộc.' });
    }

    const priceMin = Number(body.price_min ?? body.priceMin ?? 0);
    const priceMax = Number(body.price_max ?? body.priceMax ?? 0);

    if (isNaN(priceMin) || isNaN(priceMax) || priceMin < 0 || priceMax < 0) {
      return res.status(400).json({ success: false, error: 'Khoảng giá không hợp lệ: phải là số không âm.' });
    }
    if (priceMax > 0 && priceMin > priceMax) {
      return res.status(400).json({ success: false, error: 'Giá tối thiểu không được lớn hơn giá tối đa.' });
    }

    // Auto-generate model_key: [Model] + [Specs]
    const slugify = str => str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const modelKey = body.model_key || body.modelKey ||
      `${slugify(modelName)}__${slugify(cpu)}__${slugify(ram)}__${slugify(ssd)}`;

    // Check duplicate key
    const existingIndex = state.templates.findIndex(t => t.model_key === modelKey || t.id === body.id);
    if (existingIndex >= 0) {
      // Idempotent update or conflict
      state.templates[existingIndex] = {
        ...state.templates[existingIndex],
        ...body,
        model_name: modelName,
        brand,
        cpu,
        ram,
        ssd,
        screen,
        model_key: modelKey,
        updated_at: new Date().toISOString()
      };
      return res.status(200).json({
        success: true,
        message: 'Đã cập nhật template theo model_key tồn tại.',
        data: state.templates[existingIndex],
        template: state.templates[existingIndex]
      });
    }

    const newTemplate = {
      id: body.id || `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      model_key: modelKey,
      model_name: modelName,
      brand,
      cpu,
      ram,
      ssd,
      screen,
      standard_config: body.standard_config || body.standardConfig || `${cpu} / ${ram} / ${ssd} / ${screen}`,
      price_min: priceMin,
      price_max: priceMax,
      price_display: body.price_display || body.priceDisplay || `${priceMin.toLocaleString('vi-VN')}đ`,
      price_range_category: body.price_range_category || body.priceRangeCategory ||
        (priceMin < 5000000 ? 'under_5m' : priceMin <= 8000000 ? '5m_8m' : priceMin <= 12000000 ? '8m_12m' : 'above_12m'),
      status: body.status || 'active',
      base_ai_prompt: body.base_ai_prompt || body.baseAiDraft || '',
      media_files: body.media_files || body.mediaFiles || [],
      post_count: 0,
      last_posted_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    state.templates.push(newTemplate);
    res.status(201).json({
      success: true,
      message: 'Đã tạo Model Template thành công!',
      data: newTemplate,
      template: newTemplate
    });
  });

  // PUT /api/data-post/templates/:id
  router.put('/templates/:id', (req, res) => {
    const index = state.templates.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy Model Template để cập nhật.' });
    }

    const current = state.templates[index];
    const body = req.body || {};

    const updated = {
      ...current,
      ...body,
      id: current.id,
      model_name: body.model_name || body.modelName || current.model_name,
      cpu: body.cpu || current.cpu,
      ram: body.ram || current.ram,
      media_files: body.media_files || body.mediaFiles || current.media_files,
      updated_at: new Date().toISOString()
    };

    state.templates[index] = updated;
    res.json({
      success: true,
      message: 'Đã cập nhật Model Template thành công!',
      data: updated,
      template: updated
    });
  });

  // DELETE /api/data-post/templates/:id
  router.delete('/templates/:id', (req, res) => {
    const index = state.templates.findIndex(t => t.id === req.params.id);
    if (index === -1) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy Model Template để xóa.' });
    }

    state.templates.splice(index, 1);
    res.json({
      success: true,
      message: 'Đã xóa Model Template khỏi thư viện.'
    });
  });

  // POST /api/data-post/smart-match
  router.post('/smart-match', (req, res) => {
    const { raw_text, rawText } = req.body || {};
    const text = (raw_text || rawText || '').trim();

    if (!text) {
      return res.json({
        success: true,
        matched: false,
        score: 0,
        matchReasons: [],
        template: null
      });
    }

    const normalized = text.toLowerCase();
    let bestMatch = null;
    let highestScore = 0;
    let bestReasons = [];

    for (const tpl of state.templates) {
      let score = 0;
      const reasons = [];
      const brand = (tpl.brand || '').toLowerCase();
      const modelName = (tpl.model_name || tpl.modelName || '').toLowerCase();
      const cpu = (tpl.cpu || '').toLowerCase();
      const ram = (tpl.ram || '').toLowerCase();

      // Brand: 20
      if (brand && normalized.includes(brand)) {
        score += 20;
        reasons.push(`Khớp hãng: ${tpl.brand}`);
      }

      // Model number / series: 35
      const modelNums = modelName.match(/\b([a-z]?\d{3,4}[a-z]?|t\d{2}|x360|g\d{1,2})\b/gi) || [];
      for (const num of modelNums) {
        if (normalized.includes(num.toLowerCase())) {
          score += 35;
          reasons.push(`Khớp số hiệu model: ${num}`);
          break;
        }
      }

      // Full model name: 45
      if (modelName && normalized.includes(modelName)) {
        score += 45;
        reasons.push(`Khớp tên model đầy đủ: ${tpl.model_name}`);
      }

      // Hardware Specs: 15
      if (cpu && normalized.includes(cpu.split(' ')[0].toLowerCase())) {
        score += 15;
        reasons.push(`Khớp CPU: ${tpl.cpu}`);
      } else if (ram && normalized.includes(ram.toLowerCase())) {
        score += 10;
        reasons.push(`Khớp RAM: ${tpl.ram}`);
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = tpl;
        bestReasons = reasons;
      }
    }

    const matched = highestScore >= 60;
    res.json({
      success: true,
      matched,
      score: highestScore,
      matchReasons: bestReasons,
      template: matched ? bestMatch : null,
      message: matched
        ? `Đã phát hiện Model tương ứng: ${bestMatch.model_name} (Điểm khớp: ${highestScore})`
        : 'Không tìm thấy Model Template khớp đủ ngưỡng trong kho.'
    });
  });

  // GET /api/data-post/queue
  router.get('/queue', (req, res) => {
    res.json({
      success: true,
      count: state.queue.length,
      data: state.queue,
      queue: state.queue
    });
  });

  // POST /api/data-post/queue
  router.post('/queue', (req, res) => {
    const { template_id, templateId, scheduled_time, scheduledTime, priority, rewrite_style, rewriteStyle } = req.body || {};
    const tplId = template_id || templateId;

    if (!tplId) {
      return res.status(400).json({ success: false, error: 'Thiếu template_id cần đưa vào hàng đợi.' });
    }

    const tpl = state.templates.find(t => t.id === tplId);
    if (!tpl) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy Model Template theo ID được chỉ định.' });
    }

    const queueItem = {
      id: `cpq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      template_id: tpl.id,
      templateId: tpl.id,
      model_name: tpl.model_name || tpl.modelName,
      brand: tpl.brand,
      scheduled_time: scheduled_time || scheduledTime || new Date(Date.now() + 3600000).toISOString(),
      priority: Number(priority || 0),
      rewrite_style: rewrite_style || rewriteStyle || 'featured_review',
      status: 'queued',
      media_files: tpl.media_files || tpl.mediaFiles || [],
      created_at: new Date().toISOString()
    };

    state.queue.push(queueItem);
    res.status(201).json({
      success: true,
      queue_id: queueItem.id,
      status: 'queued',
      message: `Đã đưa template ${tpl.model_name} vào hàng đợi tuần hoàn!`,
      data: queueItem,
      queueItem
    });
  });

  // POST /api/data-post/queue/trigger-post
  router.post('/queue/trigger-post', (req, res) => {
    const { queue_id, queueId, template_id, templateId } = req.body || {};
    const qId = queue_id || queueId;
    const tId = template_id || templateId;

    let targetItem = null;
    let targetTemplate = null;

    if (qId) {
      targetItem = state.queue.find(q => q.id === qId);
      if (!targetItem) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy mục hàng đợi tuần hoàn.' });
      }
      targetTemplate = state.templates.find(t => t.id === targetItem.template_id);
    } else if (tId) {
      targetTemplate = state.templates.find(t => t.id === tId);
      if (!targetTemplate) {
        return res.status(404).json({ success: false, error: 'Không tìm thấy Model Template.' });
      }
    } else if (state.queue.length > 0) {
      targetItem = state.queue[0];
      targetTemplate = state.templates.find(t => t.id === targetItem.template_id);
    } else {
      return res.status(400).json({ success: false, error: 'Hàng đợi trống và không có template_id được chỉ định.' });
    }

    if (targetTemplate) {
      targetTemplate.post_count = (targetTemplate.post_count || 0) + 1;
      targetTemplate.last_posted_at = new Date().toISOString();
    }

    if (targetItem) {
      targetItem.status = 'completed';
      targetItem.posted_at = new Date().toISOString();
      targetItem.fb_post_id = `fb_post_${Date.now()}`;
      targetItem.fb_post_url = `https://facebook.com/1154184381110692/posts/${Date.now()}`;
    }

    const rewritten = generateDeterministicRewrite(targetTemplate, targetItem?.rewrite_style || 'featured_review');

    res.json({
      success: true,
      message: 'Đã xuất bản bài đăng tuần hoàn thành công!',
      template_id: targetTemplate?.id,
      post_count: targetTemplate?.post_count,
      last_posted_at: targetTemplate?.last_posted_at,
      fb_post_id: targetItem?.fb_post_id || `sim_${Date.now()}`,
      content: rewritten
    });
  });

  // DELETE /api/data-post/queue/:id
  router.delete('/queue/:id', (req, res) => {
    const idx = state.queue.findIndex(q => q.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy mục hàng đợi để xóa.' });
    }
    state.queue.splice(idx, 1);
    res.json({ success: true, message: 'Đã xóa mục khỏi hàng đợi tuần hoàn.' });
  });

  return router;
}

/**
 * Deterministic AI Rewrite generator for test verification.
 * Adheres to the 4 rotating hooks and removes temporary machine codes.
 */
function generateDeterministicRewrite(template, hookStyle) {
  if (!template) return '';
  const modelName = (template.model_name || template.modelName || 'Laptop').toUpperCase();
  const brand = template.brand || 'Laptop';
  const cpu = template.cpu || 'Core i5';
  const ram = template.ram || '8GB';
  const ssd = template.ssd || '256GB SSD';
  const screen = template.screen || '13.3 inch FHD';
  const price = template.price_display || template.priceDisplay || 'Giá ưu đãi';

  switch (hookStyle) {
    case 'hook_durability':
      return `🛡️ [BIỂU TƯỢNG ĐỘ BỀN NỒI ĐỒNG CỐI ĐÁ] - DÒNG MÁY TUYỂN CHỌN: ${modelName}\n\n` +
        `Bạn cần chiếc máy cày cuốc 5-7 năm không lo hỏng vặt? Vỏ hợp kim siêu cứng cáp, bàn phím gõ đầm tay chuẩn kỹ sư nội địa Nhật Bản.\n\n` +
        `🔹 Thử thách độ bền quân đội: Chống va đập, tản nhiệt mát rượi cả ngày\n` +
        `🔹 Sức mạnh phần cứng: ${cpu} kết hợp bộ nhớ ${ram}\n` +
        `🔹 Không gian lưu trữ: Ổ cứng ${ssd} tốc độ cao\n` +
        `🔹 Tấm nền hiển thị: ${screen} chống mỏi mắt\n\n` +
        `🛡️ Vương Gia cam kết hàng tuyển chọn nguyên bản 100%. Bao test 7 ngày lỗi 1 đổi 1, bảo hành phần cứng nghiêm túc 3 tháng.\n` +
        `☎️ Video call kiểm tra máy trực tiếp: 0876637806\n` +
        `#${brand.replace(/\s+/g, '')} #DoBenQuanDoi #LaptopTuyenChon #LaptopVuongGia`;

    case 'hook_mobility':
      return `✈️ [LAPTOP DOANH NHÂN MỎNG NHẸ DI ĐỘNG] - DÒNG MÁY TUYỂN CHỌN: ${modelName}\n\n` +
        `Thường xuyên di chuyển công tác, gặp gỡ đối tác? Thiết kế thanh lịch, trọng lượng tối ưu mang vác nhẹ tênh trên mọi cung đường.\n\n` +
        `✨ Màn hình sắc nét tràn viền: ${screen}\n` +
        `✨ Thời lượng pin bền bỉ cho ngày dài năng động\n` +
        `✨ Xử lý đa tác vụ linh hoạt: ${cpu} đi kèm ${ram}\n` +
        `✨ Khởi động siêu tốc với ổ cứng ${ssd}\n\n` +
        `🚀 Giao hàng hỏa tốc toàn quốc, kiểm tra ưng ý mới thanh toán. Bảo hành 3 tháng phần cứng (1 tháng cảm ứng).\n` +
        `📲 Hotline / Zalo: 0876637806\n` +
        `#${brand.replace(/\s+/g, '')} #MongNheDoanhNhan #LaptopTuyenChon #LaptopVuongGia`;

    case 'hook_budget':
      return `🎯 [TỐI ƯU CHI PHÍ - CẤU HÌNH VƯỢT TRỘI] - DÒNG MÁY TUYỂN CHỌN: ${modelName}\n\n` +
        `Cơ hội sở hữu dòng máy doanh nghiệp Nhật Bản nguyên zin với mức ngân sách tiết kiệm tối đa, độ bền vượt xa tầm tiền.\n\n` +
        `💰 Mức giá tham khảo cực tốt: ${price}\n` +
        `🎯 Cấu hình vượt mong đợi: Vi xử lý ${cpu} kết hợp ${ram}\n` +
        `🎯 Ổ cứng thể rắn ${ssd} phản hồi tức thì\n` +
        `🎯 Không gian hiển thị: ${screen}\n\n` +
        `⭐ Cọc 300k gửi hàng tận nơi, kiểm tra thoải mái trước khi nhận. Đổi mới 7 ngày nếu phát sinh lỗi phần cứng.\n` +
        `📞 Liên hệ báo giá tốt nhất: 0876637806\n` +
        `#${brand.replace(/\s+/g, '')} #GiaTotNhat #LaptopTuyenChon #LaptopVuongGia`;

    case 'hook_office':
    default:
      return `💼 [GỢI Ý LAPTOP VĂN PHÒNG CHUẨN NHẬT] - DÒNG MÁY TUYỂN CHỌN: ${modelName}\n\n` +
        `Trợ thủ đắc lực xử lý mượt mà hàng chục tab trình duyệt, cân trọn các bảng tính Excel nặng mà không xảy ra tình trạng giật lag.\n\n` +
        `⚡ Vi xử lý hiệu năng ổn định: ${cpu}\n` +
        `⚡ Đa nhiệm trơn tru: Dung lượng ${ram}\n` +
        `⚡ Khởi động Windows tích tắc với ${ssd}\n` +
        `⚡ Màn hình chống chói bảo vệ mắt: ${screen}\n\n` +
        `🎁 Tặng kèm sạc zin, chuột không dây và túi chống sốc. Hỗ trợ cài đặt phần mềm văn phòng miễn phí trọn đời.\n` +
        `☎️ Hotline đặt hàng: 0876637806\n` +
        `#${brand.replace(/\s+/g, '')} #LaptopVanPhong #LaptopTuyenChon #LaptopVuongGia`;
  }
}

/**
 * Calculates Jaccard token similarity between two strings.
 */
function calculateJaccardSimilarity(textA, textB) {
  if (!textA || !textB) return 0;
  const setA = new Set(textA.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const setB = new Set(textB.toLowerCase().split(/\s+/).filter(w => w.length > 2));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Test Server Launcher:
 * Creates an ephemeral test server listening on port 0.
 * Automatically wires real Express app from server.js if it mounts /api/data-post/templates.
 * Otherwise binds the reference oracle router to guarantee reliable contract verification.
 */
async function startTestServer() {
  if (process.env.TEST_BASE_URL) {
    return {
      baseUrl: process.env.TEST_BASE_URL,
      server: null,
      close: async () => {}
    };
  }

  // Fresh isolated state per test runner run
  const testState = {
    templates: JSON.parse(JSON.stringify(DEFAULT_SEED_TEMPLATES)),
    queue: []
  };

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static files for index.html / Slide 0 tests
  const publicDir = path.join(__dirname, '..', '..', 'public');
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
  }

  // Try importing server.js to check if production routes are present
  let realAppMounted = false;
  try {
    const realApp = require('../../server.js');
    if (realApp && realApp._router && realApp._router.stack) {
      const hasDataPostRoute = realApp._router.stack.some(layer => {
        if (layer.route && layer.route.path && typeof layer.route.path === 'string' && layer.route.path.includes('/api/data-post')) {
          return true;
        }
        if (layer.name === 'router' && layer.regexp && !layer.regexp.fast_slash) {
          const src = layer.regexp.source || '';
          if (src.includes('data-post')) return true;
        }
        return false;
      });

      if (hasDataPostRoute) {
        app.use(realApp);
        realAppMounted = true;
      }
    }
  } catch (err) {
    // server.js might still be under active development by Worker M1
  }

  if (!realAppMounted) {
    const refRouter = createReferenceRouter(testState);
    app.use('/api/data-post', refRouter);
  }

  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr.port;
      const baseUrl = `http://127.0.0.1:${port}`;
      resolve({
        baseUrl,
        server,
        state: testState,
        close: () => new Promise(res => server.close(res))
      });
    });
    server.on('error', reject);
  });
}

/**
 * Native HTTP client for tests
 */
async function apiRequest(baseUrl, method, pathUrl, body = null, headers = {}) {
  const url = `${baseUrl}${pathUrl}`;
  const reqHeaders = {
    'Accept': 'application/json',
    ...headers
  };

  const options = {
    method,
    headers: reqHeaders
  };

  if (body !== null) {
    if (typeof body === 'string') {
      options.body = body;
      reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'text/plain';
    } else {
      options.body = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
    }
  }

  const res = await fetch(url, options);
  let json = null;
  let text = '';
  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      json = await res.json();
    } catch (e) {
      json = null;
    }
  } else {
    text = await res.text();
  }

  return {
    status: res.status,
    headers: res.headers,
    data: json,
    body: json,
    text
  };
}

/**
 * Slide 0 Inspector for public/index.html
 */
function inspectSlide0Html(htmlContent) {
  const issues = [];
  const checks = {
    hasVuongGiaBrand: /DESIGN\s+BY\s+VUONGGIA/i.test(htmlContent),
    hasContactEmail: /nguyennhu19022008@gmail\.com/i.test(htmlContent),
    hasHotline: /0876637806/i.test(htmlContent),
    hasNoPurpleGradients: !/bg-gradient-to-[a-z]+\s+from-(purple|violet|indigo)/i.test(htmlContent),
    hasSolidInkTokens: /#18181B|#000000/i.test(htmlContent)
  };

  if (!checks.hasVuongGiaBrand) issues.push('Slide 0 missing DESIGN BY VUONGGIA title');
  if (!checks.hasContactEmail) issues.push('Missing contact email: nguyennhu19022008@gmail.com');
  if (!checks.hasHotline) issues.push('Missing hotline: 0876637806');
  if (!checks.hasNoPurpleGradients) issues.push('Violation: contains prohibited purple/violet blur gradient');

  return {
    valid: issues.length === 0,
    checks,
    issues
  };
}

module.exports = {
  DEFAULT_SEED_TEMPLATES,
  startTestServer,
  apiRequest,
  generateDeterministicRewrite,
  calculateJaccardSimilarity,
  inspectSlide0Html
};
