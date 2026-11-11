/**
 * services/dataPost.js
 * Kho Thư Viện Bài Đăng & Model Mẫu / Dữ Liệu Tuần Hoàn (Data Post & Circular Engine)
 * Laptop Vương Gia - Facebook Fanpage Autopost
 */

const fs = require('fs');
const path = require('path');
const { supabase, upsertPostToDb } = require('./supabase');
const {
  getNextAvailableScheduleTime,
  executePost,
  getPosts,
  savePosts
} = require('./scheduler');
const {
  generateCircularPostRewrite,
  fallbackCircularRewrite
} = require('./gemini');

// File paths for local fallbacks
const { dataFile, tmpFile } = require('../utils/runtime');
const LOCAL_TEMPLATES_FILE = dataFile('model_templates.json');
const TMP_TEMPLATES_FILE = tmpFile('model_templates.json');

const LOCAL_QUEUE_FILE = dataFile('circular_queue.json');
const TMP_QUEUE_FILE = tmpFile('circular_queue.json');

/**
 * Remove Vietnamese diacritics and convert to ASCII slug
 */
function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Normalize text for string matching (removes diacritics and lowers case)
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[đĐ]/g, 'd')
    .trim();
}

/**
 * Validate that model_name does not use temporary lot codes (e.g. #101, Lô 5...)
 */
function validatePermanentModelName(modelName) {
  if (!modelName || typeof modelName !== 'string' || !modelName.trim()) {
    throw new Error('Vui lòng cung cấp Tên Model Laptop (model_name).');
  }

  const trimmed = modelName.trim();
  const lower = trimmed.toLowerCase();

  // Pattern detection for temporary codes
  const isLotOnly = /^#?\d+[a-zA-Z]?$/.test(trimmed);
  const startsWithCode = /^(mã|ma|lô|lo|sku|lot)\s*#?\d+/i.test(trimmed);
  const startsWithLaptopCode = /^laptop\s*#?\d+/i.test(trimmed);
  const hasPureHashNumber = /#\d{2,}/.test(trimmed);

  if (isLotOnly || startsWithCode || startsWithLaptopCode || hasPureHashNumber) {
    throw new Error(
      `Tên model không được dùng mã máy hoặc số lô tạm thời (ví dụ: #101, #114B, Lô 5). ` +
      `Định danh Model Template phải dùng tên dòng máy chính xác vĩnh viễn (ví dụ: HP Envy x360 14, Dell Latitude 5350).`
    );
  }
}

/**
 * Generate permanent model_key based on: [Tên Model] + [Cấu hình CPU/RAM/SSD/Màn hình]
 */
function generateModelKey(modelName, cpu, ram, ssd, screen) {
  validatePermanentModelName(modelName);

  const modelSlug = slugify(modelName);
  const cpuSlug = slugify(cpu || 'cpu');
  const ramSlug = slugify(ram || 'ram');
  const ssdSlug = slugify(ssd || 'ssd');
  const screenSlug = screen ? slugify(screen) : '';

  let key = `${modelSlug}__${cpuSlug}__${ramSlug}__${ssdSlug}`;
  if (screenSlug) {
    key += `__${screenSlug}`;
  }
  return key;
}

/**
 * Determine price_range_category from numbers or display text
 */
function categorizePriceRange(priceMin, priceMax, priceDisplay) {
  let min = Number(priceMin) || 0;
  let max = Number(priceMax) || min;

  if (max === 0 && priceDisplay) {
    const numbers = priceDisplay.match(/\d+(\.\d+)?/g);
    if (numbers && numbers.length > 0) {
      const val = parseFloat(numbers[0]) * 1000000;
      min = val;
      max = numbers.length > 1 ? parseFloat(numbers[1]) * 1000000 : val;
    }
  }

  if (max > 0 && max < 5000000) return 'under_5m';
  if ((min >= 5000000 || max <= 8000000) && max <= 8000000) return '5m_8m';
  if (min >= 8000000 && max <= 12000000) return '8m_12m';
  if (min > 12000000 || max > 12000000) return 'above_12m';
  return '5m_8m';
}

/**
 * Read templates from local JSON fallbacks
 */
function readLocalTemplates() {
  try {
    if (fs.existsSync(TMP_TEMPLATES_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_TEMPLATES_FILE, 'utf8') || '[]');
    }
    if (fs.existsSync(LOCAL_TEMPLATES_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_TEMPLATES_FILE, 'utf8') || '[]');
    }
  } catch (err) {
    console.error('[DataPost] Lỗi đọc fallback local templates:', err.message);
  }
  return [];
}

/**
 * Write templates to local JSON fallbacks
 */
function writeLocalTemplates(templates) {
  const content = JSON.stringify(templates, null, 2);
  try {
    const dir = path.dirname(LOCAL_TEMPLATES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_TEMPLATES_FILE, content, 'utf8');
  } catch (e) {
    // Read-only environment like Vercel
  }
  try {
    fs.writeFileSync(TMP_TEMPLATES_FILE, content, 'utf8');
  } catch (e) {}
}

/**
 * Read circular queue from local JSON fallbacks
 */
function readLocalQueue() {
  try {
    if (fs.existsSync(TMP_QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_QUEUE_FILE, 'utf8') || '[]');
    }
    if (fs.existsSync(LOCAL_QUEUE_FILE)) {
      return JSON.parse(fs.readFileSync(LOCAL_QUEUE_FILE, 'utf8') || '[]');
    }
  } catch (err) {
    console.error('[DataPost] Lỗi đọc fallback local queue:', err.message);
  }
  return [];
}

/**
 * Write circular queue to local JSON fallbacks
 */
function writeLocalQueue(queue) {
  const content = JSON.stringify(queue, null, 2);
  try {
    const dir = path.dirname(LOCAL_QUEUE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(LOCAL_QUEUE_FILE, content, 'utf8');
  } catch (e) {}
  try {
    fs.writeFileSync(TMP_QUEUE_FILE, content, 'utf8');
  } catch (e) {}
}

/**
 * Load all model templates (Supabase Cloud with local fallback)
 */
async function loadAllTemplates() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('model_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(row => ({
          id: row.id,
          model_key: row.model_key,
          model_name: row.model_name,
          brand: row.brand,
          cpu: row.cpu,
          ram: row.ram,
          ssd: row.ssd,
          screen: row.screen,
          standard_config: row.standard_config,
          price_min: Number(row.price_min) || 0,
          price_max: Number(row.price_max) || 0,
          price_display: row.price_display,
          price_range_category: row.price_range_category,
          status: row.status || 'active',
          base_ai_prompt: row.base_ai_prompt || '',
          media_files: row.media_files || [],
          tags: row.tags || [],
          post_count: Number(row.post_count) || 0,
          last_posted_at: row.last_posted_at || null,
          created_at: row.created_at,
          updated_at: row.updated_at
        }));
      }
    } catch (err) {
      // Supabase table not created or network glitch, proceed to local fallback
    }
  }
  return readLocalTemplates();
}

/**
 * Save / Upsert single template to Supabase Cloud and local file
 */
async function saveTemplateRecord(tpl) {
  const localList = readLocalTemplates();
  const index = localList.findIndex(t => t.id === tpl.id);
  if (index >= 0) {
    localList[index] = { ...localList[index], ...tpl, updated_at: new Date().toISOString() };
  } else {
    localList.unshift(tpl);
  }
  writeLocalTemplates(localList);

  if (supabase) {
    try {
      const row = {
        id: tpl.id,
        model_key: tpl.model_key,
        model_name: tpl.model_name,
        brand: tpl.brand,
        cpu: tpl.cpu,
        ram: tpl.ram,
        ssd: tpl.ssd,
        screen: tpl.screen,
        standard_config: tpl.standard_config,
        price_min: tpl.price_min || 0,
        price_max: tpl.price_max || 0,
        price_display: tpl.price_display,
        price_range_category: tpl.price_range_category,
        status: tpl.status || 'active',
        base_ai_prompt: tpl.base_ai_prompt || null,
        media_files: tpl.media_files || [],
        tags: tpl.tags || [],
        post_count: tpl.post_count || 0,
        last_posted_at: tpl.last_posted_at || null,
        created_at: tpl.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      await supabase.from('model_templates').upsert(row);
    } catch (e) {}
  }
}

/**
 * Delete template from Supabase Cloud and local fallback
 */
async function deleteTemplateRecord(id) {
  const localList = readLocalTemplates();
  const filtered = localList.filter(t => t.id !== id && t.model_key !== id);
  writeLocalTemplates(filtered);

  if (supabase) {
    try {
      await supabase.from('model_templates').delete().eq('id', id);
    } catch (e) {}
  }
}

/**
 * 1. GET MODEL TEMPLATES with Filters: brand, price_range, status, search
 */
async function getModelTemplates(filters = {}) {
  const templates = await loadAllTemplates();
  const { brand, price_range, priceRange, status, search } = filters;
  const targetPriceRange = price_range || priceRange;

  return templates.filter(item => {
    // 1. Filter by Brand
    if (brand && brand !== 'all' && brand !== 'All') {
      const brandList = Array.isArray(brand)
        ? brand.map(b => String(b).toLowerCase()).filter(b => b !== 'all')
        : [String(brand).toLowerCase()];
      if (brandList.length > 0 && !brandList.includes((item.brand || '').toLowerCase())) {
        return false;
      }
    }

    // 2. Filter by Price Range
    if (targetPriceRange && targetPriceRange !== 'all' && targetPriceRange !== 'All') {
      if (item.price_range_category !== targetPriceRange) {
        return false;
      }
    }

    // 3. Filter by Status
    if (status && status !== 'all' && status !== 'All') {
      if (item.status !== status) {
        return false;
      }
    }

    // 4. Search Keyword across Model Name, Config, CPU, Brand, Tags
    if (search && search.trim()) {
      const q = normalizeText(search);
      const searchTarget = normalizeText(
        `${item.model_name} ${item.standard_config} ${item.cpu} ${item.brand} ${(item.tags || []).join(' ')}`
      );
      if (!searchTarget.includes(q)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * 2. GET MODEL TEMPLATE BY ID OR MODEL_KEY
 */
async function getModelTemplateById(id) {
  if (!id) return null;
  const templates = await loadAllTemplates();
  return templates.find(t => t.id === id || t.model_key === id) || null;
}

/**
 * 3. CREATE MODEL TEMPLATE
 * Generates permanent model_key = [Tên Model] + [Cấu hình], rejects temporary lot codes like #101
 */
async function createModelTemplate(data = {}) {
  const modelName = data.model_name || data.modelName;
  validatePermanentModelName(modelName);

  const brand = data.brand || 'Khác';
  const cpu = data.cpu || data.specs?.cpu || '';
  const ram = data.ram || data.specs?.ram || '';
  const ssd = data.ssd || data.specs?.ssd || '';
  const screen = data.screen || data.specs?.screen || '';

  if (!cpu || !ram) {
    throw new Error('Vui lòng cung cấp cấu hình máy cơ bản (tối thiểu CPU và RAM).');
  }

  const priceMin = Number(data.price_min !== undefined ? data.price_min : (data.priceMin !== undefined ? data.priceMin : 0));
  const priceMax = Number(data.price_max !== undefined ? data.price_max : (data.priceMax !== undefined ? data.priceMax : priceMin));

  if (isNaN(priceMin) || isNaN(priceMax)) {
    throw new Error('Giá máy phải là số hợp lệ.');
  }
  if (priceMin < 0 || priceMax < 0) {
    throw new Error('Giá máy không được là số âm.');
  }
  if (priceMin > 0 && priceMax > 0 && priceMin > priceMax) {
    throw new Error('Giá tối thiểu (price_min) không được lớn hơn giá tối đa (price_max).');
  }

  const modelKey = generateModelKey(modelName, cpu, ram, ssd, screen);

  // Check uniqueness of model_key
  const existing = await loadAllTemplates();
  const duplicate = existing.find(t => t.model_key === modelKey);
  if (duplicate) {
    throw new Error(`Model Template cho dòng máy và cấu hình này đã tồn tại (ID: ${duplicate.id}). Vui lòng cập nhật thay vì tạo mới.`);
  }

  const priceDisplay = data.price_display || data.priceDisplay || (priceMin > 0 ? `${(priceMin / 1e6).toFixed(1)} triệu` : 'Liên hệ');
  const priceRangeCategory = data.price_range_category || data.priceRangeCategory || categorizePriceRange(priceMin, priceMax, priceDisplay);

  const standardConfig = data.standard_config || data.standardConfig || `${cpu} / RAM ${ram} / SSD ${ssd} / Màn ${screen}`.trim();

  const newTemplate = {
    id: data.id || `tpl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    model_key: modelKey,
    model_name: modelName.trim(),
    brand: brand.trim(),
    cpu: cpu.trim(),
    ram: ram.trim(),
    ssd: ssd.trim(),
    screen: screen.trim(),
    standard_config: standardConfig,
    price_min: priceMin,
    price_max: priceMax,
    price_display: priceDisplay.trim(),
    price_range_category: priceRangeCategory,
    status: data.status || 'active',
    base_ai_prompt: data.base_ai_prompt || data.baseAiPrompt || data.baseAiDraft || '',
    media_files: data.media_files || data.mediaFiles || [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    post_count: 0,
    last_posted_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await saveTemplateRecord(newTemplate);
  return newTemplate;
}

/**
 * 4. UPDATE MODEL TEMPLATE
 */
async function updateModelTemplate(id, data = {}) {
  const existing = await getModelTemplateById(id);
  if (!existing) {
    throw new Error(`Không tìm thấy Model Template với ID: ${id}`);
  }

  const newModelName = data.model_name !== undefined ? data.model_name : (data.modelName !== undefined ? data.modelName : existing.model_name);
  if (data.model_name !== undefined || data.modelName !== undefined) {
    validatePermanentModelName(newModelName);
  }

  const newCpu = data.cpu !== undefined ? data.cpu : (data.specs?.cpu || existing.cpu);
  const newRam = data.ram !== undefined ? data.ram : (data.specs?.ram || existing.ram);
  const newSsd = data.ssd !== undefined ? data.ssd : (data.specs?.ssd || existing.ssd);
  const newScreen = data.screen !== undefined ? data.screen : (data.specs?.screen || existing.screen);

  const updatedModelKey = generateModelKey(newModelName, newCpu, newRam, newSsd, newScreen);

  // Check if updatedModelKey already belongs to another existing template
  const allTemplates = await loadAllTemplates();
  const duplicate = allTemplates.find(t => t.model_key === updatedModelKey && t.id !== existing.id && t.id !== id);
  if (duplicate) {
    throw new Error('Đã tồn tại Model Template khác có cùng cấu hình định danh. Không thể cập nhật trùng.');
  }

  const priceMin = data.price_min !== undefined ? Number(data.price_min) : (data.priceMin !== undefined ? Number(data.priceMin) : existing.price_min);
  const priceMax = data.price_max !== undefined ? Number(data.price_max) : (data.priceMax !== undefined ? Number(data.priceMax) : existing.price_max);

  const isPriceProvided = data.price_min !== undefined || data.price_max !== undefined || data.priceMin !== undefined || data.priceMax !== undefined;
  if (isPriceProvided) {
    if (isNaN(priceMin) || isNaN(priceMax)) {
      throw new Error('Giá máy phải là số hợp lệ.');
    }
    if (priceMin < 0 || priceMax < 0) {
      throw new Error('Giá máy không được là số âm.');
    }
    if (priceMin > 0 && priceMax > 0 && priceMin > priceMax) {
      throw new Error('Giá tối thiểu (price_min) không được lớn hơn giá tối đa (price_max).');
    }
  }
  const priceDisplay = data.price_display || data.priceDisplay || existing.price_display;
  const priceRangeCategory = data.price_range_category || data.priceRangeCategory || categorizePriceRange(priceMin, priceMax, priceDisplay);

  const standardConfig = data.standard_config || data.standardConfig || (
    (data.cpu || data.ram || data.ssd || data.screen)
      ? `${newCpu} / RAM ${newRam} / SSD ${newSsd} / Màn ${newScreen}`.trim()
      : existing.standard_config
  );

  const updated = {
    ...existing,
    model_key: updatedModelKey,
    model_name: newModelName.trim(),
    brand: (data.brand || existing.brand).trim(),
    cpu: newCpu.trim(),
    ram: newRam.trim(),
    ssd: newSsd.trim(),
    screen: newScreen.trim(),
    standard_config: standardConfig,
    price_min: priceMin,
    price_max: priceMax,
    price_display: priceDisplay.trim(),
    price_range_category: priceRangeCategory,
    status: data.status !== undefined ? data.status : existing.status,
    base_ai_prompt: data.base_ai_prompt !== undefined ? data.base_ai_prompt : (data.baseAiPrompt !== undefined ? data.baseAiPrompt : (data.baseAiDraft !== undefined ? data.baseAiDraft : existing.base_ai_prompt)),
    media_files: data.media_files !== undefined ? data.media_files : (data.mediaFiles !== undefined ? data.mediaFiles : existing.media_files),
    tags: data.tags !== undefined ? data.tags : existing.tags,
    post_count: data.post_count !== undefined ? Number(data.post_count) : existing.post_count,
    last_posted_at: data.last_posted_at !== undefined ? data.last_posted_at : existing.last_posted_at,
    updated_at: new Date().toISOString()
  };

  await saveTemplateRecord(updated);
  return updated;
}

/**
 * 5. DELETE MODEL TEMPLATE
 */
async function deleteModelTemplate(id) {
  const existing = await getModelTemplateById(id);
  if (!existing) {
    throw new Error(`Không tìm thấy Model Template với ID: ${id}`);
  }
  await deleteTemplateRecord(existing.id);
  return { success: true, id: existing.id, message: 'Đã xóa Model Template thành công!' };
}

/**
 * 6. SMART MATCH TEMPLATE
 * Weighted scoring heuristic:
 * - Brand match: +20
 * - Model number designation match: +35
 * - Model name match: +45
 * - Specs tokens match: +15
 * Threshold: 60
 */
async function smartMatchTemplate(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return {
      matched: false,
      score: 0,
      match_reasons: [],
      template: null
    };
  }

  const cleanRaw = normalizeText(rawText);
  const templates = await loadAllTemplates();

  let bestMatch = null;
  let bestScore = 0;
  let bestReasons = [];

  for (const tpl of templates) {
    let score = 0;
    const reasons = [];

    // 1. Brand Match (+20)
    const brandNorm = normalizeText(tpl.brand);
    if (brandNorm && cleanRaw.includes(brandNorm)) {
      score += 20;
      reasons.push(`Khớp thương hiệu: ${tpl.brand} (+20)`);
    }

    // 2. Model Name Match (+45)
    // Extract series name tokens (e.g., 'envy', 'latitude', 'elitebook', 'probook', 'thinkpad', 'inspiron', 'dynabook')
    const modelNorm = normalizeText(tpl.model_name);
    const seriesKeywords = ['envy', 'latitude', 'elitebook', 'probook', 'thinkpad', 'inspiron', 'dynabook', 'vaio', 'xps', 'vostro'];
    const matchedSeries = seriesKeywords.filter(k => modelNorm.includes(k) && cleanRaw.includes(k));

    if (matchedSeries.length > 0 || (modelNorm.length > 3 && cleanRaw.includes(modelNorm))) {
      score += 45;
      reasons.push(`Khớp dòng máy: ${tpl.model_name} (+45)`);
    }

    // 3. Model Number Designation Match (+35)
    // Extract number designations: e.g. 5350, 5320, 630, 430, 5490, 5500, t480s, t14, x360, g9, g8, g10
    const modelWords = modelNorm.split(/[\s_-]+/);
    const modelDesignations = modelWords.filter(w => /\d/.test(w) || w === 'x360');

    let designationMatched = false;
    for (const d of modelDesignations) {
      if (d.length >= 2 && cleanRaw.includes(d)) {
        designationMatched = true;
        reasons.push(`Khớp định danh model: "${d}" (+35)`);
        break;
      }
    }
    if (designationMatched) {
      score += 35;
    }

    // 4. Specs Match (+15)
    // Check CPU tokens, RAM tokens, screen tokens
    const cpuNorm = normalizeText(tpl.cpu);
    const ramNorm = normalizeText(tpl.ram);
    const specsTokens = ['ultra 5', 'ryzen 5', 'i5', 'i7', '8gb', '16gb', '1235u', '1145g7', '1135g7', 'cam ung', '360'];
    const matchedSpecs = specsTokens.filter(token => (cpuNorm.includes(token) || ramNorm.includes(token)) && cleanRaw.includes(token));

    if (matchedSpecs.length > 0) {
      score += 15;
      reasons.push(`Khớp thông số cấu hình: ${matchedSpecs.join(', ')} (+15)`);
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = tpl;
      bestReasons = reasons;
    }
  }

  const threshold = 60;
  const isMatched = bestScore >= threshold && bestMatch !== null;

  return {
    matched: isMatched,
    score: bestScore,
    threshold,
    match_reasons: isMatched ? bestReasons : [],
    template: isMatched ? bestMatch : null
  };
}

/**
 * Generate rotating AI rewrite copy for circular post (4 rotating hooks)
 */
function generateRotatingRewriteCopy(template, style = 'featured_review') {
  return fallbackCircularRewrite(template, style);
}

/**
 * 7. ENQUEUE CIRCULAR POST
 */
async function enqueueCircularPost(params = {}) {
  const templateId = params.template_id || params.templateId;
  if (!templateId) {
    throw new Error('Vui lòng cung cấp ID của Model Template (template_id).');
  }

  const template = await getModelTemplateById(templateId);
  if (!template) {
    throw new Error(`Không tìm thấy Model Template với ID: ${templateId}`);
  }

  const priority = params.priority !== undefined ? Number(params.priority) : 0;
  const rewriteStyle = params.rewrite_style || params.rewriteStyle || 'featured_review';

  // Determine schedule time: custom or auto-next vacant slot
  let scheduledTime = params.scheduled_at || params.scheduledTime;
  if (!scheduledTime) {
    try {
      scheduledTime = await getNextAvailableScheduleTime();
    } catch (e) {
      // Default to 4 hours from now
      scheduledTime = new Date(Date.now() + 4 * 3600 * 1000).toISOString();
    }
  } else {
    scheduledTime = new Date(scheduledTime).toISOString();
  }

  let rewrittenContent = params.ai_rewritten_content || params.rewritten_content;
  if (!rewrittenContent) {
    try {
      const aiResult = await generateCircularPostRewrite(template, rewriteStyle);
      rewrittenContent = typeof aiResult === 'string' ? aiResult : (aiResult?.content || null);
    } catch (err) {
      console.warn('[DataPost] AI rewrite in enqueue failed, falling back:', err.message);
    }
  }
  if (!rewrittenContent) {
    rewrittenContent = generateRotatingRewriteCopy(template, rewriteStyle);
  }

  const queueItem = {
    id: `cpq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    template_id: template.id,
    model_name: template.model_name,
    scheduled_time: scheduledTime,
    priority,
    rewrite_style: rewriteStyle,
    ai_rewritten_content: rewrittenContent,
    media_files: template.media_files || [],
    status: 'queued',
    post_id: null,
    fb_post_id: null,
    fb_post_url: null,
    execution_log: 'Đã đưa vào hàng đợi tuần hoàn tự động.',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // Save to local queue
  const queue = readLocalQueue();
  queue.push(queueItem);
  writeLocalQueue(queue);

  // Save to Supabase Cloud if available
  if (supabase) {
    try {
      await supabase.from('circular_posts_queue').upsert({
        id: queueItem.id,
        template_id: queueItem.template_id,
        model_name: queueItem.model_name,
        scheduled_time: queueItem.scheduled_time,
        priority: queueItem.priority,
        rewrite_style: queueItem.rewrite_style,
        ai_rewritten_content: queueItem.ai_rewritten_content,
        media_files: queueItem.media_files,
        status: queueItem.status,
        post_id: queueItem.post_id,
        fb_post_id: queueItem.fb_post_id,
        fb_post_url: queueItem.fb_post_url,
        execution_log: queueItem.execution_log,
        created_at: queueItem.created_at,
        updated_at: queueItem.updated_at
      });
    } catch (e) {}
  }

  return {
    success: true,
    queue_id: queueItem.id,
    status: queueItem.status,
    data: queueItem
  };
}

/**
 * 8. GET CIRCULAR QUEUE
 */
async function getCircularQueue() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('circular_posts_queue')
        .select('*')
        .order('scheduled_time', { ascending: true });

      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {}
  }
  const queue = readLocalQueue();
  return queue.sort((a, b) => new Date(a.scheduled_time) - new Date(b.scheduled_time));
}

/**
 * 9. DELETE CIRCULAR QUEUE ITEM
 */
async function deleteCircularQueueItem(id) {
  if (!id) throw new Error('Vui lòng cung cấp ID hàng đợi cần xóa.');

  const queue = readLocalQueue();
  const initialLen = queue.length;
  const filtered = queue.filter(item => item.id !== id);

  writeLocalQueue(filtered);

  if (supabase) {
    try {
      await supabase.from('circular_posts_queue').delete().eq('id', id);
    } catch (e) {}
  }

  if (filtered.length === initialLen) {
    throw new Error(`Không tìm thấy mục hàng đợi với ID: ${id}`);
  }

  return { success: true, id, message: 'Đã xóa bài khỏi hàng đợi tuần hoàn!' };
}

/**
 * 10. TRIGGER CIRCULAR POST
 * Instantly publishes a circular post to Facebook Fanpage & updates stats
 */
async function triggerCircularPost(params = {}) {
  const p = params || {};
  const queueId = p.queue_id || p.queueId;
  const templateId = p.template_id || p.templateId;

  let targetTemplate = null;
  let targetQueueItem = null;

  if (queueId) {
    const queue = await getCircularQueue();
    targetQueueItem = queue.find(q => q.id === queueId);
    if (targetQueueItem) {
      targetTemplate = await getModelTemplateById(targetQueueItem.template_id);
    }
  }

  if (!targetTemplate && templateId) {
    targetTemplate = await getModelTemplateById(templateId);
  }

  // If neither queue_id nor template_id is passed, automatically select the next available
  // circular queue item, or if the queue is empty, select the template with the oldest last_posted_at (or lowest post_count)
  if (!targetTemplate && !queueId && !templateId) {
    const queue = await getCircularQueue();
    targetQueueItem = queue.find(q => q.status === 'queued' || q.status === 'pending') || (queue.length > 0 && queue[0].status !== 'completed' ? queue[0] : null);
    if (targetQueueItem) {
      targetTemplate = await getModelTemplateById(targetQueueItem.template_id);
    }

    if (!targetTemplate) {
      const templates = await getModelTemplates();
      if (Array.isArray(templates) && templates.length > 0) {
        const sortedTemplates = [...templates].sort((a, b) => {
          const aTime = a.last_posted_at ? new Date(a.last_posted_at).getTime() : 0;
          const bTime = b.last_posted_at ? new Date(b.last_posted_at).getTime() : 0;
          if (aTime !== bTime) {
            return aTime - bTime;
          }
          const aCount = Number(a.post_count) || 0;
          const bCount = Number(b.post_count) || 0;
          return aCount - bCount;
        });
        targetTemplate = sortedTemplates[0];
      }
    }
  }

  if (!targetTemplate) {
    throw new Error('Không tìm thấy thông tin Model Template hoặc hàng đợi tương ứng.');
  }

  const rewriteStyle = targetQueueItem?.rewrite_style || 'featured_review';
  
  // Call generateCircularPostRewrite from services/gemini.js with fallback to generateRotatingRewriteCopy
  let content = targetQueueItem?.ai_rewritten_content;
  if (!content) {
    try {
      const rewriteResult = await generateCircularPostRewrite(targetTemplate, rewriteStyle);
      content = typeof rewriteResult === 'string' ? rewriteResult : (rewriteResult?.content || null);
    } catch (err) {
      console.warn('[CircularEngine] Lỗi gọi generateCircularPostRewrite, fallback sang thuật toán:', err.message);
      content = generateRotatingRewriteCopy(targetTemplate, rewriteStyle);
    }
  }
  if (!content) {
    content = generateRotatingRewriteCopy(targetTemplate, rewriteStyle);
  }

  // Construct post for executePost
  const newPost = {
    id: `post_${Date.now()}`,
    machineCode: 'CIRCULAR',
    machineName: targetTemplate.model_name,
    content,
    price: targetTemplate.price_display,
    mediaFiles: (targetQueueItem?.media_files && targetQueueItem.media_files.length > 0)
      ? targetQueueItem.media_files
      : (targetTemplate.media_files || []),
    scheduledTime: new Date().toISOString(),
    status: 'queued',
    createdAt: new Date().toISOString()
  };

  // 1. Save to local posts & DB
  const posts = await getPosts();
  posts.unshift(newPost);
  await savePosts(posts);
  await upsertPostToDb(newPost);

  // 2. Publish to Facebook Fanpage
  console.log(`[CircularEngine] 🚀 Đang kích hoạt xuất bản bài đăng tuần hoàn [${newPost.id}] lên Facebook...`);
  const publishedPost = await executePost(newPost);
  await upsertPostToDb(publishedPost);

  // 3. Update template post_count & last_posted_at
  const currentCount = Number(targetTemplate.post_count) || 0;
  const nowIso = new Date().toISOString();
  targetTemplate.post_count = currentCount + 1;
  targetTemplate.last_posted_at = nowIso;
  await updateModelTemplate(targetTemplate.id, {
    post_count: currentCount + 1,
    last_posted_at: nowIso
  });

  // 4. Update queue item status if triggered from queue
  if (targetQueueItem) {
    const queue = readLocalQueue();
    const qIdx = queue.findIndex(q => q.id === targetQueueItem.id);
    if (qIdx >= 0) {
      queue[qIdx].status = 'completed';
      queue[qIdx].posted_at = new Date().toISOString();
      queue[qIdx].post_id = publishedPost.id;
      queue[qIdx].fb_post_id = publishedPost.fbPostId || null;
      queue[qIdx].fb_post_url = publishedPost.fbPostUrl || null;
      queue[qIdx].execution_log = 'Đã xuất bản thành công bài đăng tuần hoàn lên Facebook Fanpage.';
      queue[qIdx].updated_at = new Date().toISOString();
      writeLocalQueue(queue);
    }

    if (supabase) {
      try {
        await supabase.from('circular_posts_queue').update({
          status: 'completed',
          posted_at: new Date().toISOString(),
          post_id: publishedPost.id,
          fb_post_id: publishedPost.fbPostId || null,
          fb_post_url: publishedPost.fbPostUrl || null,
          execution_log: 'Đã xuất bản thành công lên Facebook Fanpage.',
          updated_at: new Date().toISOString()
        }).eq('id', targetQueueItem.id);
      } catch (e) {}
    }
  }

  return {
    success: true,
    post: publishedPost,
    content: publishedPost.content,
    rewritten_content: publishedPost.content,
    template: targetTemplate,
    post_count: currentCount + 1,
    fbPostUrl: publishedPost.fbPostUrl,
    message: 'Đã xuất bản thành công bài viết tuần hoàn lên Facebook Fanpage!'
  };
}

module.exports = {
  slugify,
  normalizeText,
  validatePermanentModelName,
  generateModelKey,
  categorizePriceRange,
  getModelTemplates,
  getModelTemplateById,
  createModelTemplate,
  updateModelTemplate,
  deleteModelTemplate,
  smartMatchTemplate,
  enqueueCircularPost,
  getCircularQueue,
  deleteCircularQueueItem,
  triggerCircularPost,
  generateRotatingRewriteCopy
};
