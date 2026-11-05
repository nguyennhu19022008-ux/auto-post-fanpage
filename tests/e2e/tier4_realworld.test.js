/**
 * tests/e2e/tier4_realworld.test.js
 * Tier 4: Real-World Scenarios & Production Verification — Simulating
 * Japanese laptop shop owner operations, 4-slot daily circular replenishment,
 * and Slide 0 ("DESIGN BY VUONGGIA") pure monochrome compliance.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  apiRequest,
  calculateJaccardSimilarity,
  inspectSlide0Html
} = require('./test_helpers');

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

  // 4.1: Real-world shop owner managing Japanese laptop fleet
  await test('4.1: Shop owner fleet management: Dell Latitude, ThinkPad, HP Envy inventory & status checks', async () => {
    // 1. Fetch entire catalog
    const catRes = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?status=active');
    assert.strictEqual(catRes.status, 200);
    const catalog = catRes.data.data || catRes.data.templates;
    assert.ok(catalog.length >= 3, 'Must have at least 3 active Japanese laptop models');

    // 2. Verify presence of core Japanese business brands
    const brands = new Set(catalog.map(t => (t.brand || '').toLowerCase()));
    assert.ok(brands.has('dell'), 'Must manage Dell models');
    assert.ok(brands.has('thinkpad'), 'Must manage ThinkPad models');
    assert.ok(brands.has('hp'), 'Must manage HP models');

    // 3. Update shop prices for end-of-year sale
    const thinkpad = catalog.find(t => (t.brand || '').toLowerCase() === 'thinkpad');
    assert.ok(thinkpad, 'Must locate ThinkPad model');

    const updateRes = await apiRequest(baseUrl, 'PUT', `/api/data-post/templates/${thinkpad.id}`, {
      price_display: '6.5 triệu (Xả kho cuối năm)'
    });
    assert.strictEqual(updateRes.status, 200);

    // 4. Verify updated display price appears in catalog
    const verifyRes = await apiRequest(baseUrl, 'GET', `/api/data-post/templates/${thinkpad.id}`);
    assert.strictEqual(verifyRes.status, 200);
    const updated = verifyRes.data.data || verifyRes.data.template;
    assert.ok(updated.price_display.includes('Xả kho'), 'Price display should reflect shop owner update');
  });

  // 4.2: Automated 4-Slot Daily Circular Replenishment Simulation
  await test('4.2: Daily 4-slot circular replenishment (08:30, 11:45, 15:30, 20:00) with anti-duplicate AI rewrite (Jaccard < 55%)', async () => {
    const catRes = await apiRequest(baseUrl, 'GET', '/api/data-post/templates?status=active');
    const catalog = catRes.data?.data || catRes.data?.templates || [];
    assert.ok(catalog.length >= 1, 'Catalog must contain active models');
    const tplA = catalog[0].id;
    const tplB = catalog[1] ? catalog[1].id : catalog[0].id;

    const slots = [
      { time: '08:30:00', hook: 'featured_review', tpl: tplA },
      { time: '11:45:00', hook: 'flash_sale', tpl: tplB },
      { time: '15:30:00', hook: 'curated_pick', tpl: tplA },
      { time: '20:00:00', hook: 'value_champion', tpl: tplB }
    ];

    const publishedPosts = [];

    // Schedule and execute all 4 daily slots
    for (const slot of slots) {
      const qRes = await apiRequest(baseUrl, 'POST', '/api/data-post/queue', {
        template_id: slot.tpl,
        scheduled_time: `2026-11-06T${slot.time}+07:00`,
        rewrite_style: slot.hook
      });
      assert.ok([200, 201].includes(qRes.status));
      const qId = qRes.data?.queue_id || qRes.data?.data?.id;
      assert.ok(qId);

      const trigRes = await apiRequest(baseUrl, 'POST', '/api/data-post/queue/trigger-post', { queue_id: qId });
      assert.strictEqual(trigRes.status, 200);
      const content = trigRes.data?.content || trigRes.data?.post?.content || trigRes.data?.rewritten_content;
      publishedPosts.push({
        slot: slot.time,
        content,
        fbPostId: trigRes.data?.fb_post_id || trigRes.data?.post?.fbPostId
      });
    }

    assert.strictEqual(publishedPosts.length, 4, 'Must execute 4 daily slots');

    // Anti-duplicate content penalty check:
    // Compare slot 1 and slot 3
    const postSlot1 = publishedPosts[0].content;
    const postSlot3 = publishedPosts[2].content;
    const similarity = calculateJaccardSimilarity(postSlot1, postSlot3);

    assert.ok(
      similarity < 0.55,
      `Jaccard token similarity between rotating posts must be < 55% to avoid Facebook duplicate spam penalty (Actual: ${(similarity * 100).toFixed(1)}%)`
    );
  });

  // 4.3: Zero Blind Trust Production Verification: Slide 0 & Aesthetic Rules
  await test('4.3: Zero Blind Trust Production Audit: Slide 0 pure monochrome & Neo-Brutalist design tokens', async () => {
    const htmlPath = path.join(__dirname, '..', '..', 'public', 'index.html');
    const htmlContent = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, 'utf8') : '';

    assert.ok(htmlContent.length > 0, 'public/index.html must exist');

    // 1. Slide 0 / Page 0 Copyright Inspection
    const slide0Inspection = inspectSlide0Html(htmlContent);
    assert.ok(slide0Inspection.checks.hasVuongGiaBrand, 'Must contain DESIGN BY VUONGGIA title');
    assert.ok(slide0Inspection.checks.hasContactEmail, 'Must contain contact email: nguyennhu19022008@gmail.com');
    assert.ok(slide0Inspection.checks.hasHotline, 'Must contain hotline: 0876637806');

    // 2. Check for banned aesthetic patterns across public directory
    assert.ok(slide0Inspection.checks.hasNoPurpleGradients, 'Must not contain purple/violet gradient slop');

    // 3. Confirm Neo-Brutalist Solid Ink Tokens & Hard Drop Shadows
    const cssPath = path.join(__dirname, '..', '..', 'public', 'css', 'style.css');
    const cssContent = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : '';
    if (cssContent) {
      assert.ok(cssContent.includes('#18181B') || cssContent.includes('border'), 'CSS must define solid ink borders');
      assert.ok(!cssContent.includes('bg-gradient-to-r from-purple'), 'CSS must not define purple text gradients');
    }
  });

  return results;
}

module.exports = { run };
