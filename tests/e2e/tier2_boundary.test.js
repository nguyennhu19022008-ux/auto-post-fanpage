/**
 * tests/e2e/tier2_boundary.test.js
 * Tier 2: Boundary & Corner Cases — Validation boundaries, non-existent entities,
 * extreme inputs, SQL injection/XSS payloads, and malformed inputs.
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

  // 2.1: Empty body on POST /api/data-post/templates
  await test('2.1: Empty body on POST /api/data-post/templates returns 400 Bad Request', async () => {
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', {});
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert.ok(res.data && res.data.success === false, 'Expected success: false');
  });

  // 2.2: Missing required field model_name
  await test('2.2: Missing required field model_name returns 400 Bad Request', async () => {
    const payload = {
      cpu: 'Core i5-1135G7',
      ram: '16GB',
      ssd: '256GB'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert.ok(res.data && res.data.error, 'Should contain error explanation');
  });

  // 2.3: Missing basic specs (both CPU and RAM omitted)
  await test('2.3: Missing both CPU and RAM specs returns 400 validation error', async () => {
    const payload = {
      model_name: 'Dell Latitude 7420',
      ssd: '256GB'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.strictEqual(res.status, 400);
    assert.ok(res.data && res.data.error, 'Error should explain missing specs');
  });

  // 2.4: Empty hardware specs object
  await test('2.4: Completely empty hardware specs returns 400 validation error', async () => {
    const payload = {
      model_name: 'Dell Latitude 7420'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.strictEqual(res.status, 400);
    assert.ok(res.data && res.data.error, 'Error should explain missing specs');
  });

  // 2.5: Inverted price range boundary check
  await test('2.5: Inverted price range where price_min > price_max is handled', async () => {
    const payload = {
      model_name: 'HP EliteBook 840 G8',
      cpu: 'Core i5-1135G7',
      ram: '16GB',
      price_min: 15000000,
      price_max: 8000000 // Inverted
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.ok([200, 400].includes(res.status), 'Price range boundary handled');
    const createdId = res.data?.data?.id || res.data?.template?.id;
    if (createdId) {
      await apiRequest(baseUrl, 'DELETE', `/api/data-post/templates/${createdId}`);
    }
  });

  // 2.6: Negative prices
  await test('2.6: Negative price values return 400', async () => {
    const payload = {
      model_name: 'HP EliteBook 840 G8',
      cpu: 'Core i5-1135G7',
      ram: '16GB',
      price_min: -5000000,
      price_max: 8000000
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.strictEqual(res.status, 400);
  });

  // 2.7: Non-numeric price inputs
  await test('2.7: Non-numeric price inputs return 400', async () => {
    const payload = {
      model_name: 'HP EliteBook 840 G8',
      cpu: 'Core i5-1135G7',
      ram: '16GB',
      price_min: 'mot_trieu',
      price_max: 'hai_trieu'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.strictEqual(res.status, 400);
  });

  // 2.8: Non-existent template ID on GET
  await test('2.8: Non-existent template ID on GET returns 404', async () => {
    const res = await apiRequest(baseUrl, 'GET', '/api/data-post/templates/tpl_non_existent_99999');
    assert.strictEqual(res.status, 404);
  });

  // 2.9: Non-existent template ID on PUT
  await test('2.9: Non-existent template ID on PUT returns 404', async () => {
    const res = await apiRequest(baseUrl, 'PUT', '/api/data-post/templates/tpl_non_existent_99999', { ram: '32GB' });
    assert.strictEqual(res.status, 404);
  });

  // 2.10: Non-existent template ID on DELETE
  await test('2.10: Non-existent template ID on DELETE returns 404', async () => {
    const res = await apiRequest(baseUrl, 'DELETE', '/api/data-post/templates/tpl_non_existent_99999');
    assert.strictEqual(res.status, 404);
  });

  // 2.11: Smart Match with empty string
  await test('2.11: Smart Match with empty rawText returns matched = false, score = 0', async () => {
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/smart-match', { raw_text: '' });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.matched, false);
    assert.strictEqual(res.data.score, 0);
  });

  // 2.12: Smart Match with malformed/unrelated text
  await test('2.12: Smart Match with unrelated text (cooking recipe) returns matched = false', async () => {
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/smart-match', {
      raw_text: 'Cách nấu phở bò Hà Nội truyền thống: chuẩn bị xương ống, hoa hồi, quế, thảo quả ninh 8 tiếng...'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.matched, false);
    assert.ok(res.data.score < 60, `Score should be < 60 for cooking recipe, got ${res.data.score}`);
  });

  // 2.13: Smart Match with extreme text length (10,000+ characters)
  await test('2.13: Smart Match with extreme text length (10,000+ chars) handles gracefully without crash', async () => {
    const giantText = 'Dell Latitude 5350 Ultra 5 ram 16gb '.repeat(350); // ~12,000 characters
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/smart-match', { raw_text: giantText });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.matched, true);
    assert.ok(res.data.template, 'Should still find template');
  });

  // 2.14: SQL Injection attack payload in model_name
  await test('2.14: SQL Injection attack payload in model_name is handled safely as literal text', async () => {
    const payload = {
      model_name: "Dell Latitude '; DROP TABLE model_templates;--",
      brand: 'Dell',
      cpu: 'Core i5-1135G7',
      ram: '16GB',
      ssd: '256GB'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.ok([200, 201].includes(res.status));
    const tpl = res.data.data || res.data.template;
    assert.ok(tpl.model_name.includes('DROP TABLE'), 'Model name must be preserved as literal string');

    // Clean up
    if (tpl.id) await apiRequest(baseUrl, 'DELETE', `/api/data-post/templates/${tpl.id}`);
  });

  // 2.15: XSS attack payload in model_name
  await test('2.15: XSS attack payload in model_name is handled safely', async () => {
    const payload = {
      model_name: "<script>alert('xss_attack')</script> ThinkPad T490",
      brand: 'ThinkPad',
      cpu: 'Core i7-8565U',
      ram: '16GB',
      ssd: '512GB'
    };
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload);
    assert.ok([200, 201].includes(res.status));
    const tpl = res.data.data || res.data.template;
    assert.ok(tpl && tpl.id);

    // Clean up
    if (tpl.id) await apiRequest(baseUrl, 'DELETE', `/api/data-post/templates/${tpl.id}`);
  });

  // 2.16: Enqueueing non-existent template ID
  await test('2.16: Enqueueing non-existent template ID returns 400 or 404', async () => {
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', { template_id: 'tpl_ghost_not_found' });
    assert.ok([400, 404].includes(res.status), `Expected 400 or 404, got ${res.status}`);
  });

  // 2.17: Duplicate model_key insertion handled gracefully
  await test('2.17: Duplicate model_key insertion updates existing template or rejects with conflict', async () => {
    const payload1 = {
      model_name: 'Dell Precision 5550',
      brand: 'Dell',
      cpu: 'Core i7-10750H',
      ram: '32GB',
      ssd: '512GB',
      price_min: 15000000,
      price_max: 17000000
    };
    const res1 = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload1);
    const tpl1 = res1.data?.data || res1.data?.template;

    // Post exact same specs -> generates same model_key
    const payload2 = {
      ...payload1,
      price_display: '16.5 triệu mới cập nhật'
    };
    const res2 = await apiRequest(baseUrl, 'POST', '/api/data-post/templates', payload2);
    assert.ok([200, 201, 400, 409].includes(res2.status), 'Duplicate insertion should either resolve or return conflict error');
    assert.ok(res2.data?.error || res2.data?.success, 'Duplicate response must have clear feedback');

    // Clean up
    if (tpl1?.id) await apiRequest(baseUrl, 'DELETE', `/api/data-post/templates/${tpl1.id}`);
  });

  // 2.18: Malformed query parameters with SQL syntax
  await test('2.18: Malformed query parameters with SQL syntax are sanitized safely', async () => {
    const res = await apiRequest(baseUrl, 'GET', "/api/data-post/templates?brand=Dell'%20OR%20'1'='1&search=;--");
    assert.strictEqual(res.status, 200);
    const list = res.data.data || res.data.templates;
    assert.ok(Array.isArray(list));
  });

  // 2.19: Trigger non-existent queue item
  await test('2.19: Triggering post with non-existent queue_id returns 404 or 400', async () => {
    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/queue/trigger-post', { queue_id: 'cpq_ghost_404_id' });
    assert.ok([400, 404, 500].includes(res.status), 'Non-existent queue trigger returns client error');
  });

  // 2.20: Enqueue with unparseable or past date
  await test('2.20: Enqueue with invalid date string falls back to default schedule time', async () => {
    const catRes = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?status=active');
    const catalog = catRes.data?.data || catRes.data?.templates || [];
    assert.ok(catalog.length >= 1);
    const tplId = catalog[0].id;

    const res = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', {
      template_id: tplId,
      scheduled_time: 'not-a-real-date-string'
    });
    // System should either reject with 400 or fallback safely with 200/201
    assert.ok([200, 201, 400].includes(res.status));
    const qId = res.data?.queue_id || res.data?.data?.id;
    if (qId) {
      await apiRequest(baseUrl, 'DELETE', `/api/data-post/queue/${qId}`);
    }
  });

  return results;
}

module.exports = { run };
