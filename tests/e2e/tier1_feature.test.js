/**
 * tests/e2e/tier1_feature.test.js
 * Tier 1: Feature Coverage — Isolated feature verification for Tab DATA POST
 * and Circular Post Engine according to PROJECT.md & ORIGINAL_REQUEST.md.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { apiRequest, inspectSlide0Html } = require('./test_helpers');

async function run(baseUrl) {
  const results = [];

  async function test(name, fn) {
    const start = performance.now();
    try {
      await fn();
      results.push({ name, passed: true, duration: (performance.now() - start).toFixed(1) });
    } catch (err) {
      results.push({ name, passed: false, duration: (performance.now() - start).toFixed(1), error: err.message });
    }
  }

  // 1.1: Template CRUD - GET /api/data-post/templates
  await test('1.1: Template CRUD - GET /api/data-post/templates returns 200 and list', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates');
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    const data = res.data;
    assert.ok(data && data.success === true, 'Response must have success: true');
    const list = data.data || data.templates;
    assert.ok(Array.isArray(list), 'Response must contain an array of templates');
    assert.ok(list.length >= 1, 'Default list must contain at least 1 template');
  });

  // 1.2: Template CRUD - POST /api/data-post/templates
  let createdTemplateId = null;
  await test('1.2: Template CRUD - POST /api/data-post/templates creates template with model_key', async () => {
    const payload = {
      model_name: 'Dynabook Portege X30L',
      brand: 'Dynabook',
      cpu: 'Core i7-1165G7',
      ram: '16GB LPDDR4x',
      ssd: '512GB NVMe',
      screen: '13.3 inch IGZO FHD',
      price_min: 9500000,
      price_max: 10500000,
      price_display: '9.9 triệu',
      base_ai_prompt: 'Siêu phẩm siêu nhẹ 900g chuẩn độ bền quân đội Nhật...',
      media_files: [
        { filename: 'dyna-1.jpg', url: 'https://.../laptop-media/dyna-1.jpg', mimetype: 'image/jpeg' }
      ]
    };

    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.ok([200, 201].includes(res.status), `Expected 201 Created or 200 OK, got ${res.status}`);
    assert.ok(res.data && res.data.success === true, 'Expected success: true');
    const tpl = res.data.data || res.data.template;
    assert.ok(tpl && tpl.id, 'Template must be created with an ID');
    createdTemplateId = tpl.id;
    assert.ok(tpl.model_key, 'Template must have an auto-generated model_key');
    assert.ok(tpl.model_key.includes('dynabook') || tpl.model_key.includes('x30l'), 'model_key must contain model slug');
  });

  // 1.3: Template CRUD - PUT /api/data-post/templates/:id
  await test('1.3: Template CRUD - PUT /api/data-post/templates/:id updates specs and price', async () => {
    assert.ok(createdTemplateId, 'Must have a created template ID');
    const updatePayload = {
      price_min: 10000000,
      price_max: 11000000,
      price_display: '10.5 triệu',
      ram: '32GB LPDDR4x'
    };

    const res = await apiRequest(baseUrl, 'PUT', `/api/data-post/templates/${createdTemplateId}`, updatePayload);
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.ok(res.data && res.data.success === true, 'Expected success: true');
    const tpl = res.data.data || res.data.template;
    assert.strictEqual(tpl.ram, '32GB LPDDR4x', 'RAM should be updated to 32GB LPDDR4x');
    assert.strictEqual(tpl.price_display, '10.5 triệu', 'Price display should be updated');
  });

  // 1.4: Template CRUD - DELETE /api/data-post/templates/:id
  await test('1.4: Template CRUD - DELETE /api/data-post/templates/:id removes template', async () => {
    assert.ok(createdTemplateId, 'Must have a created template ID');
    const res = await apiRequest(baseUrl, 'DELETE', `/api/data-post/templates/${createdTemplateId}`);
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}`);
    assert.ok(res.data && res.data.success === true, 'Expected success: true');

    // Confirm it cannot be found
    const getRes = await apiRequest(baseUrl, 'GET', `/api/data-post/templates/${createdTemplateId}`);
    assert.strictEqual(getRes.status, 404, 'Deleted template must return 404 on GET');
  });

  // 1.5: Filtering - Filter by brand
  await test('1.5: Filtering - Filter by brand=Dell returns only Dell laptops', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?brand=Dell');
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    assert.ok(Array.isArray(list) && list.length > 0, 'Should find at least 1 Dell laptop');
    for (const item of list) {
      assert.strictEqual(item.brand.toLowerCase(), 'dell', `Item ${item.model_name} should be brand Dell`);
    }
  });

  // 1.6: Filtering - Filter by price_range
  await test('1.6: Filtering - Filter by price_range=5m_8m returns templates in 5-8M range', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?price_range=5m_8m');
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    assert.ok(Array.isArray(list) && list.length > 0, 'Should find templates in 5m_8m range');
    for (const item of list) {
      const cat = item.price_range_category || item.priceRangeCategory;
      assert.strictEqual(cat, '5m_8m', `Item ${item.model_name} should be categorized as 5m_8m`);
    }
  });

  // 1.7: Filtering - Filter by status
  await test('1.7: Filtering - Filter by status=active returns active templates', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?status=active');
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    for (const item of list) {
      assert.strictEqual(item.status || 'active', 'active', 'Item status must be active');
    }
  });

  // 1.8: Search - Instant search query
  await test('1.8: Search - Instant search query matching model or CPU substring', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?search=5350');
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    assert.ok(list.length >= 1, 'Search for "5350" should return Dell Latitude 5350');
    assert.ok(list[0].model_name.includes('5350'), 'Model name must include 5350');
  });

  // 1.9: Smart Match - Scoring brand + model number
  await test('1.9: Smart Match - Scoring Zalo text detects Dell Latitude 5350 (score >= 60)', async () => {
    const zaloInput = {
      raw_text: 'Mã 781: Dell Latitude 5350 Ultra 5 ram 16gb ssd 256gb màn 13.3 đẹp keng giá sỉ 13tr5'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/smart-match', zaloInput);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data && res.data.success === true, 'Expected success: true');
    assert.strictEqual(res.data.matched, true, 'Expected matched: true');
    assert.ok(res.data.score >= 60, `Score must be >= 60, got ${res.data.score}`);
    assert.ok(res.data.template, 'Matched response must include template');
    assert.ok(res.data.template.model_name.includes('5350'), 'Matched template should be 5350');
  });

  // 1.10: Smart Match - Returns associated template and HD media_files
  await test('1.10: Smart Match - Returns HD media_files from matched template', async () => {
    const zaloInput = {
      raw_text: 'Mã 881: ThinkPad T480s i5-8350u 8gb 256gb màn 14 fhd phím led giá 6tr8'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/smart-match', zaloInput);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.matched, true);
    const tpl = res.data.template;
    assert.ok(Array.isArray(tpl.media_files), 'Template must include media_files array');
    assert.ok(tpl.media_files.length >= 1, 'Template must contain at least 1 HD photo');
  });

  // 1.11: Circular Queue - GET /api/data-post/queue
  await test('1.11: Circular Queue - GET /api/data-post/queue lists queued items', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/queue');
    assert.strictEqual(res.status, 200);
    assert.ok(res.data && res.data.success === true);
    const qList = res.data.data || res.data.queue;
    assert.ok(Array.isArray(qList), 'Queue must be an array');
  });

  // 1.12: Circular Queue - POST /api/data-post/queue
  let createdQueueId = null;
  await test('1.12: Circular Queue - POST /api/data-post/queue enqueues template', async () => {
    const enqueuePayload = {
      template_id: 'tpl_dell_lat_5350',
      scheduled_time: '2026-11-06T15:30:00+07:00',
      priority: 1,
      rewrite_style: 'featured_review'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', enqueuePayload);
    assert.ok([200, 201].includes(res.status), `Expected 201 Created or 200, got ${res.status}`);
    assert.ok(res.data && res.data.success === true);
    createdQueueId = res.data.queue_id || (res.data.data && res.data.data.id) || (res.data.queueItem && res.data.queueItem.id);
    assert.ok(createdQueueId, 'Queue response must contain queue_id');
  });

  // 1.13: Circular Queue - POST /api/data-post/queue/trigger-post
  await test('1.13: Circular Queue - POST /api/data-post/queue/trigger-post executes post', async () => {
    assert.ok(createdQueueId, 'Need queue ID to trigger');
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/queue/trigger-post', { queue_id: createdQueueId });
    assert.strictEqual(res.status, 200);
    assert.ok(res.data && res.data.success === true);
    const postCount = res.data.post_count ?? res.data.template?.post_count ?? res.data.post?.post_count;
    assert.ok(postCount !== undefined, 'Response must return updated post_count');
    const content = res.data.content || res.data.post?.content || res.data.rewritten_content;
    assert.ok(content, 'Response must return AI rewritten content');
    assert.ok(!content.includes('#101'), 'Rewritten content must not contain temporary machine codes');
  });

  // 1.14: Circular Queue - DELETE /api/data-post/queue/:id
  await test('1.14: Circular Queue - DELETE /api/data-post/queue/:id removes item', async () => {
    // Add temporary item to remove
    const addRes = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', { template_id: 'tpl_thinkpad_t480s' });
    const qId = addRes.data.queue_id || addRes.data.data?.id;
    assert.ok(qId);

    const delRes = await apiRequest(baseUrl, 'DELETE', `/api/data-post/queue/${qId}`);
    assert.strictEqual(delRes.status, 200);
    assert.ok(delRes.data && delRes.data.success === true);
  });

  // 1.15 - 1.19: HTML & UI Checks
  const htmlPath = path.join(__dirname, '..', '..', 'public', 'index.html');
  const htmlContent = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';

  await test('1.15: HTML Structure - Navigation tabs container readiness', async () => {
    assert.ok(htmlContent.length > 0, 'public/index.html must exist');
    assert.ok(htmlContent.includes('switchTab'), 'Navigation tabs must use switchTab function');
    assert.ok(htmlContent.includes('tabBtn-studio') || htmlContent.includes('tabBtn-datapost'), 'Nav tabs must be present');
  });

  await test('1.16: HTML Structure - Main application container and Neo-Brutalist cards', async () => {
    assert.ok(htmlContent.includes('id="mainApp"'), 'Must contain #mainApp');
    assert.ok(htmlContent.includes('neo-card') || htmlContent.includes('border-2'), 'Must use Neo-Brutalist border styling');
  });

  await test('1.17: HTML Structure - Mobile navigation dock', async () => {
    assert.ok(htmlContent.includes('mobile-app-dock') || htmlContent.includes('mobileAppDock'), 'Mobile dock must exist');
  });

  await test('1.18: HTML Structure - Absence of forbidden AI-slop purple gradients', async () => {
    const inspection = inspectSlide0Html(htmlContent);
    assert.ok(inspection.checks.hasNoPurpleGradients, 'HTML must not contain forbidden purple/violet radial gradients');
  });

  // 1.20: Slide 0 Non-Interference
  await test('1.20: Slide 0 Non-Interference - DESIGN BY VUONGGIA copyright and contacts intact', async () => {
    const inspection = inspectSlide0Html(htmlContent);
    assert.ok(inspection.checks.hasVuongGiaBrand, 'Must contain DESIGN BY VUONGGIA');
    assert.ok(inspection.checks.hasContactEmail, 'Must contain nguyennhu19022008@gmail.com');
    assert.ok(inspection.checks.hasHotline, 'Must contain 0876637806');
  });

  // 1.21: Search - Empty results
  await test('1.21: Search - Unmatched search query returns empty list with 200 OK', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?search=QuantumComputer2099XYZ');
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    assert.strictEqual(list.length, 0, 'Unmatched search should return 0 templates');
  });

  // 1.22: Smart Match - Low scoring text below threshold
  await test('1.22: Smart Match - Generic single keyword text below threshold returns matched = false', async () => {
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/smart-match', { raw_text: 'laptop xách tay' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.matched, false);
    assert.strictEqual(res.data.template, null);
  });

  // 1.23: Brand filter - Unknown brand
  await test('1.23: Brand filter - Non-existent brand returns empty list with 200 OK', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?brand=AlienwareMars');
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    assert.strictEqual(list.length, 0);
  });

  return results;
}

module.exports = { run };
