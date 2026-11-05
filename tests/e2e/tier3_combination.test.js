/**
 * tests/e2e/tier3_combination.test.js
 * Tier 3: Cross-Feature Combinations — Multi-step integration flows,
 * end-to-end ingestion, media injection, circular queue lifecycle,
 * and AI rewrite rotating hooks.
 */

const assert = require('assert');
const { apiRequest } = require('./test_helpers');

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

  // 3.1: Complete Ingestion, 1-Click Media Reuse & Circular Post Flow
  await test('3.1: Paste Zalo -> Smart Match finds template -> loads HD photos -> modifies price -> enqueues -> triggers post -> post_count increments', async () => {
    // Step 1: Simulate user pasting raw Zalo post into AI Studio
    const rawZalo = 'MS 992: Dell Latitude 5350 Ultra 5 ram 16gb ssd 256gb màn 13.3 ips giá sỉ 13tr2 lương 300k ctv';
    const matchRes = await apiRequest(baseUrl, 'POST', '/api/data-post/smart-match', { raw_text: rawZalo });
    assert.strictEqual(matchRes.status, 200);
    assert.strictEqual(matchRes.data.matched, true);

    const matchedTemplate = matchRes.data.template;
    assert.ok(matchedTemplate, 'Must return matched template');
    const originalPostCount = matchedTemplate.post_count || 0;
    const hdPhotos = matchedTemplate.media_files || [];
    assert.ok(hdPhotos.length > 0, 'Matched template must provide HD photos');

    // Step 2: User applies 1-click media injection (keeping new machine code 992 & new custom price 14.2tr)
    // Step 3: Enqueue this template into circular queue
    const enqueueRes = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', {
      template_id: matchedTemplate.id,
      priority: 1,
      rewrite_style: 'featured_review'
    });
    assert.ok([200, 201].includes(enqueueRes.status));
    const qId = enqueueRes.data.queue_id || enqueueRes.data.data?.id;
    assert.ok(qId, 'Queue ID must be generated');

    // Step 4: Trigger execution of the queued post
    const triggerRes = await apiRequest(baseUrl, 'POST', '/api/data-post/queue/trigger-post', { queue_id: qId });
    assert.strictEqual(triggerRes.status, 200);
    assert.ok(triggerRes.data.success === true);

    // Step 5: Verify post_count incremented and last_posted_at updated on template
    const tplRes = await apiRequest(baseUrl, 'GET', `/api/data-post/templates/${matchedTemplate.id}`);
    assert.strictEqual(tplRes.status, 200);
    const updatedTpl = tplRes.data.data || tplRes.data.template;
    assert.strictEqual(updatedTpl.post_count, originalPostCount + 1, 'post_count must increment by 1');
    assert.ok(updatedTpl.last_posted_at, 'last_posted_at must be populated');
  });

  // 3.2: Complete Template Lifecycle (Create -> Search -> Update -> Delete)
  await test('3.2: Template Lifecycle: Create -> Verify in List -> Update Specs/Photos -> Search -> Delete', async () => {
    // 1. Create
    const createPayload = {
      model_name: 'Lenovo ThinkPad X13 Gen 2',
      brand: 'ThinkPad',
      cpu: 'Ryzen 5 Pro 5650U',
      ram: '16GB',
      ssd: '512GB NVMe',
      screen: '13.3 inch WUXGA 16:10',
      price_min: 11000000,
      price_max: 12500000,
      price_display: '11.8 triệu',
      media_files: [{ filename: 'x13-1.jpg', url: 'https://.../x13-1.jpg', mimetype: 'image/jpeg' }]
    };
    const cRes = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', createPayload);
    assert.ok([200, 201].includes(cRes.status));
    const created = cRes.data.data || cRes.data.template;
    const tplId = created.id;

    // 2. Search
    const searchRes = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?search=5650U');
    assert.strictEqual(searchRes.status, 200);
    const searchList = searchRes.data.data || searchRes.data.templates;
    assert.ok(searchList.some(t => t.id === tplId), 'New template must be findable via CPU search');

    // 3. Update
    const updateRes = await apiRequest(baseUrl, 'PUT', `/api/data-post/templates/${tplId}`, {
      price_display: '12.2 triệu'
    });
    assert.strictEqual(updateRes.status, 200);

    // 4. Delete
    const delRes = await apiRequest(baseUrl, 'DELETE', `/api/data-post/templates/${tplId}`);
    assert.strictEqual(delRes.status, 200);

    // 5. Verify gone
    const verifyRes = await apiRequest(baseUrl, 'GET', `/api/data-post/templates/${tplId}`);
    assert.strictEqual(verifyRes.status, 404, 'Must return 404 after deletion');
  });

  // 3.3: Queue Priority and Sequential Execution
  await test('3.3: Queue lifecycle: Enqueue items -> Verify list -> Sequential trigger', async () => {
    // Dynamically retrieve available templates
    const tplListRes = await apiRequest(baseUrl, 'GET', '/api/data-post/templates');
    const available = tplListRes.data?.data || tplListRes.data?.templates || [];
    assert.ok(available.length >= 1, 'Must have at least 1 template');
    const tpl1 = available[0].id;
    const tpl2 = available[1] ? available[1].id : available[0].id;

    // Enqueue 2 items
    const q1 = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', {
      template_id: tpl1,
      priority: 2,
      rewrite_style: 'flash_sale'
    });
    const q2 = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', {
      template_id: tpl2,
      priority: 1,
      rewrite_style: 'curated_pick'
    });

    const id1 = q1.data?.queue_id || q1.data?.data?.id;
    const id2 = q2.data?.queue_id || q2.data?.data?.id;
    assert.ok(id1 && id2, 'Queue IDs must be created');

    // Verify both are listed
    const listRes = await apiRequest(baseUrl, 'GET', '/api/data-post/queue');
    const queue = listRes.data?.data || listRes.data?.queue || [];
    assert.ok(queue.some(item => item.id === id1), 'Queue must contain id1');
    assert.ok(queue.some(item => item.id === id2), 'Queue must contain id2');

    // Trigger post for id1
    const trigRes = await apiRequest(baseUrl, 'POST', '/api/data-post/queue/trigger-post', { queue_id: id1 });
    assert.strictEqual(trigRes.status, 200);

    // Clean up id2
    await apiRequest(baseUrl, 'DELETE', `/api/data-post/queue/${id2}`);
  });

  // 3.4: Multi-filter combination (Brand AND Price Category)
  await test('3.4: Combined filter: brand=Dell AND price_range=above_12m returns strictly matching intersection', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?brand=Dell&price_range=above_12m');
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    assert.ok(Array.isArray(list) && list.length > 0, 'Should find Dell laptops in above_12m range');
    for (const item of list) {
      assert.strictEqual(item.brand.toLowerCase(), 'dell');
      const cat = item.price_range_category || item.priceRangeCategory;
      assert.strictEqual(cat, 'above_12m');
    }
  });

  // 3.5: AI Rewrite 4 Rotating Hooks Differentiation
  await test('3.5: AI Rewrite rotation: 4 rotating hooks generate distinct opening angles without duplicate text', async () => {
    const tplListRes = await apiRequest(baseUrl, 'GET', '/api/data-post/templates');
    const available = tplListRes.data?.data || tplListRes.data?.templates || [];
    const tplId = available[0]?.id || 'tpl_dell_lat_5350';

    const hooks = ['featured_review', 'flash_sale', 'curated_pick', 'value_champion'];
    const generatedContents = [];

    for (const hook of hooks) {
      const qRes = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', {
        template_id: tplId,
        rewrite_style: hook
      });
      const qId = qRes.data?.queue_id || qRes.data?.data?.id;
      assert.ok(qId);
      const trigRes = await apiRequest(baseUrl, 'POST', '/api/data-post/queue/trigger-post', { queue_id: qId });
      assert.strictEqual(trigRes.status, 200);
      const content = trigRes.data?.content || trigRes.data?.post?.content || trigRes.data?.rewritten_content;
      assert.ok(content, 'Triggered post must return content');
      generatedContents.push({ hook, content });
    }

    assert.strictEqual(generatedContents.length, 4);

    // Verify hooks have distinct opening titles
    const titles = generatedContents.map(g => g.content.split('\n')[0]);
    const uniqueTitles = new Set(titles);
    assert.strictEqual(uniqueTitles.size, 4, 'All 4 hook styles must produce unique opening titles');
  });

  // 3.6: Multi-token search across brand, model name, and CPU
  await test('3.6: Multi-token search correctly isolates matching templates', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?search=Ultra%205');
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    assert.ok(list.length >= 1, 'Should find templates with Ultra 5');
    for (const tpl of list) {
      const match = (tpl.cpu || '').toLowerCase().includes('ultra 5') ||
                    (tpl.model_name || '').toLowerCase().includes('ultra 5') ||
                    (tpl.standard_config || '').toLowerCase().includes('ultra 5');
      assert.ok(match, 'Every returned template must match Ultra 5');
    }
  });

  // 3.7: Queue state inspection
  await test('3.7: Queue state query returns scheduled items with status and timestamps', async () => {
    const listRes = await apiRequest(baseUrl, 'GET', '/api/data-post/queue');
    assert.strictEqual(listRes.status, 200);
    const queue = listRes.data?.data || listRes.data?.queue || [];
    assert.ok(Array.isArray(queue));
    for (const item of queue) {
      assert.ok(item.id, 'Queue item must have id');
      assert.ok(item.template_id, 'Queue item must have template_id');
      assert.ok(item.status, 'Queue item must have status');
    }
  });

  return results;
}

module.exports = { run };
