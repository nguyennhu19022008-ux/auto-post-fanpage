/**
 * tests/stress_network_test.js
 * Adversarial & Empirical Stress Test Harness for Backend API, Network Endpoints, and Storage Fallback
 * Challenger: challenger_stress_network
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

function getBaseUrl() {
  return process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
}

async function makeRequest(method, urlPath, payload = null, headers = {}) {
  const url = new URL(urlPath, getBaseUrl());
  return new Promise((resolve, reject) => {
    const postData = payload !== null ? (typeof payload === 'string' ? payload : JSON.stringify(payload)) : null;
    const reqHeaders = { ...headers };
    if (postData !== null && !reqHeaders['Content-Type']) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: reqHeaders,
      timeout: 45000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          rawBody: body
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after 45000ms: ${method} ${urlPath}`));
    });

    if (postData !== null) {
      req.write(postData);
    }
    req.end();
  });
}

const testResults = [];

async function runTest(name, fn) {
  const start = performance.now();
  console.log(`\n=======================================================`);
  console.log(`[CHALLENGE] ▶ Running: ${name}`);
  try {
    const details = await fn();
    const duration = (performance.now() - start).toFixed(1);
    console.log(`[PASS] ✓ ${name} (${duration}ms)`);
    testResults.push({ name, passed: true, duration, details });
  } catch (err) {
    const duration = (performance.now() - start).toFixed(1);
    console.error(`[FAIL] ✗ ${name} (${duration}ms)`);
    console.error(`       Error: ${err.message}`);
    testResults.push({ name, passed: false, duration, error: err.message, stack: err.stack });
  }
}

async function main() {
  console.log('Adversarial Stress Test Suite starting against:', getBaseUrl());

  // --------------------------------------------------------------------------
  // GROUP 1: Storage Fallback Stress-Testing
  // --------------------------------------------------------------------------
  await runTest('STORAGE-01: Scheduler getPosts() fallback when Supabase returns empty array []', async () => {
    const supabaseModule = require('../services/supabase');
    const schedulerModule = require('../services/scheduler');
    
    // Read actual data/posts.json
    const postsFilePath = path.join(__dirname, '..', 'data', 'posts.json');
    const expectedLocalPosts = JSON.parse(fs.readFileSync(postsFilePath, 'utf8'));

    // Temporarily mock fetchAllPostsFromDb to simulate empty Supabase table
    const origFetch = supabaseModule.fetchAllPostsFromDb;
    try {
      supabaseModule.fetchAllPostsFromDb = async () => [];
      const posts = await schedulerModule.getPosts();
      assert.ok(Array.isArray(posts), 'Result must be an array');
      assert.ok(posts.length > 0, `Expected posts from local fallback, got length ${posts.length}`);
      assert.strictEqual(posts.length, expectedLocalPosts.length, 'Fallback should return all items from data/posts.json');
      return { localPostCount: expectedLocalPosts.length, fallbackCount: posts.length };
    } finally {
      supabaseModule.fetchAllPostsFromDb = origFetch;
    }
  });

  await runTest('STORAGE-02: Scheduler getPosts() fallback when Supabase throws network error', async () => {
    const supabaseModule = require('../services/supabase');
    const schedulerModule = require('../services/scheduler');
    
    const postsFilePath = path.join(__dirname, '..', 'data', 'posts.json');
    const expectedLocalPosts = JSON.parse(fs.readFileSync(postsFilePath, 'utf8'));

    const origFetch = supabaseModule.fetchAllPostsFromDb;
    try {
      supabaseModule.fetchAllPostsFromDb = async () => {
        throw new Error('ECONNREFUSED: Connection refused to Supabase Postgres Cloud');
      };
      const posts = await schedulerModule.getPosts();
      assert.ok(Array.isArray(posts), 'Result must be an array');
      assert.strictEqual(posts.length, expectedLocalPosts.length, 'Should cleanly fallback to data/posts.json on exception');
      return { fallbackCount: posts.length };
    } finally {
      supabaseModule.fetchAllPostsFromDb = origFetch;
    }
  });

  // --------------------------------------------------------------------------
  // GROUP 2: Endpoint /api/data-post/trigger-circular
  // --------------------------------------------------------------------------
  await runTest('CIRCULAR-01: POST /api/data-post/trigger-circular with empty body {} auto-replenishes template', async () => {
    const res = await makeRequest('POST', '/api/data-post/trigger-circular', {});
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.success, true, 'Response must have success: true');
    assert.ok(res.data.post, 'Must return created post object');
    assert.ok(res.data.template, 'Must return auto-selected template object');
    assert.ok(res.data.post_count !== undefined, 'Must return updated post_count');
    assert.ok(res.data.content, 'Must return circular post content');
    return {
      templateModel: res.data.template.model_name,
      postCount: res.data.post_count,
      postId: res.data.post.id,
      fbPostUrl: res.data.fbPostUrl || res.data.post.fbPostUrl
    };
  });

  await runTest('CIRCULAR-02: POST /api/data-post/trigger-circular with specific template_id', async () => {
    const templateId = 'tpl_dell_lat_5350';
    const res = await makeRequest('POST', '/api/data-post/trigger-circular', { template_id: templateId });
    assert.strictEqual(res.status, 200, `Expected 200 OK, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.template?.id || res.data.template_id, templateId, 'Template ID must match requested');
    assert.ok(res.data.content, 'Must contain rewritten content');
    return {
      templateId,
      modelName: res.data.template?.model_name,
      fbPostUrl: res.data.fbPostUrl || res.data.post?.fbPostUrl
    };
  });

  await runTest('CIRCULAR-03: POST /api/data-post/trigger-circular with specific queue_id', async () => {
    // First, enqueue a template to obtain a real queue_id
    const eqRes = await makeRequest('POST', '/api/data-post/queue', {
      template_id: 'tpl_thinkpad_t480s',
      priority: 3,
      rewrite_style: 'featured_review'
    });
    assert.ok([200, 201].includes(eqRes.status), `Enqueue failed: ${JSON.stringify(eqRes.data)}`);
    const queueId = eqRes.data.queue_id || eqRes.data.data?.id;
    assert.ok(queueId, 'Must have queue_id');

    // Trigger circular with this specific queue_id
    const trigRes = await makeRequest('POST', '/api/data-post/trigger-circular', { queue_id: queueId });
    assert.strictEqual(trigRes.status, 200, `Trigger failed: ${JSON.stringify(trigRes.data)}`);
    assert.strictEqual(trigRes.data.success, true);
    assert.ok(trigRes.data.post, 'Must have post object');
    assert.ok(trigRes.data.content, 'Must have AI content');
    return { queueId, postCount: trigRes.data.post_count, fbPostUrl: trigRes.data.fbPostUrl };
  });

  await runTest('CIRCULAR-04: POST /api/data-post/trigger-circular with non-existent template_id returns 400', async () => {
    const res = await makeRequest('POST', '/api/data-post/trigger-circular', { template_id: 'tpl_non_existent_999999' });
    assert.ok([400, 404].includes(res.status), `Expected 400 or 404, got ${res.status}`);
    assert.strictEqual(res.data.success, false, 'Expected success: false');
    assert.ok(res.data.error, 'Must contain error message');
    return { status: res.status, error: res.data.error };
  });

  // --------------------------------------------------------------------------
  // GROUP 3: Endpoint /api/posts/:id/publish-now
  // --------------------------------------------------------------------------
  await runTest('PUBLISH-NOW-01: POST /api/posts/:id/publish-now with invalid ID returns HTTP 404', async () => {
    const res = await makeRequest('POST', '/api/posts/post_invalid_nonexistent_id_404/publish-now');
    assert.strictEqual(res.status, 404, `Expected HTTP 404, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error.includes('Không tìm thấy'), `Unexpected error message: ${res.data.error}`);
    return { status: res.status, error: res.data.error };
  });

  await runTest('PUBLISH-NOW-02: POST /api/posts/:id/publish-now with valid post ID returns root facebookPostUrl', async () => {
    // 1. Create a real queued post via API
    const pushRes = await makeRequest('POST', '/api/extension/push-post', {
      rawText: 'Dell Latitude 7320 i5-1145G7 16GB 256GB màn 13.3 FHD test publish-now',
      customPrice: '8.2 triệu',
      target: 'fanpage',
      publishImmediately: false,
      mediaUrls: []
    });
    assert.strictEqual(pushRes.status, 200, `Failed to create test post: ${JSON.stringify(pushRes.data)}`);
    const testPostId = pushRes.data.post.id;
    assert.ok(testPostId, 'Must have created post ID');

    try {
      const res = await makeRequest('POST', `/api/posts/${testPostId}/publish-now`);
      assert.ok([200, 500].includes(res.status), `Expected 200 or 500, got ${res.status}: ${JSON.stringify(res.data)}`);
      if (res.status === 200) {
        assert.strictEqual(res.data.success, true);
        assert.ok('facebookPostUrl' in res.data, 'Root response MUST have property facebookPostUrl (GAP-02 contract)');
        assert.ok(res.data.facebookPostUrl, 'facebookPostUrl must not be empty');
        return { status: res.status, facebookPostUrl: res.data.facebookPostUrl };
      } else {
        assert.strictEqual(res.data.success, false);
        assert.ok(res.data.error, 'Failed response must include error message');
        return { status: res.status, error: res.data.error };
      }
    } finally {
      // Clean up test post via DELETE endpoint
      await makeRequest('DELETE', `/api/posts/${testPostId}`);
    }
  });

  // --------------------------------------------------------------------------
  // GROUP 4: Endpoint /api/extension/push-post
  // --------------------------------------------------------------------------
  await runTest('PUSH-POST-01: POST /api/extension/push-post with target=personal creates personal_draft', async () => {
    const payload = {
      rawText: 'Dell Latitude 7420 i7-1185G7 16GB 512GB màn FHD IPS pin tốt sạc zin giá 8.5tr',
      customPrice: '8.5 triệu',
      target: 'personal',
      publishImmediately: false,
      mediaUrls: []
    };
    const res = await makeRequest('POST', '/api/extension/push-post', payload);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.target, 'personal');
    assert.ok(res.data.post, 'Must return post object');
    assert.strictEqual(res.data.post.status, 'personal_draft', 'Post status must be personal_draft');
    assert.strictEqual(res.data.post.targetChannel, 'personal', 'targetChannel must be personal');
    return {
      postId: res.data.post.id,
      status: res.data.post.status,
      machineCode: res.data.post.machineCode
    };
  });

  await runTest('PUSH-POST-02: POST /api/extension/push-post with target=fanpage schedules post', async () => {
    const payload = {
      rawText: 'ThinkPad T14 Gen 1 Ryzen 5 Pro 16GB 256GB máy đẹp keng giá 7.9tr',
      customPrice: '7.9 triệu',
      target: 'fanpage',
      publishImmediately: false,
      mediaUrls: []
    };
    const res = await makeRequest('POST', '/api/extension/push-post', payload);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.data)}`);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.target, 'fanpage');
    assert.ok(res.data.post, 'Must return post object');
    assert.strictEqual(res.data.post.targetChannel, 'fanpage');
    assert.ok(['queued', 'pending_media'].includes(res.data.post.status));
    return {
      postId: res.data.post.id,
      targetChannel: res.data.post.targetChannel,
      scheduledTime: res.data.post.scheduledTime
    };
  });

  await runTest('PUSH-POST-03: POST /api/extension/push-post with target=both executes dual publication', async () => {
    const payload = {
      rawText: 'HP EliteBook 840 G8 i5-1135G7 16GB 256GB màn đẹp phím LED giá 9.2tr',
      customPrice: '9.2 triệu',
      target: 'both',
      publishImmediately: true,
      mediaUrls: []
    };
    const res = await makeRequest('POST', '/api/extension/push-post', payload);
    assert.ok([200, 500].includes(res.status), `Expected 200 or 500, got ${res.status}: ${JSON.stringify(res.data)}`);
    if (res.status === 200) {
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.target, 'both');
      assert.ok(res.data.post, 'Must return post object');
      assert.ok(res.data.fbPostUrl, 'Must return fbPostUrl');
      assert.ok(res.data.shareUrl, 'Must return shareUrl for personal sharing');
      assert.ok(res.data.shareUrl.includes('sharer/sharer.php'), 'shareUrl must be Facebook sharer URL');
      return { status: 200, fbPostUrl: res.data.fbPostUrl, shareUrl: res.data.shareUrl };
    } else {
      // If Facebook token/rate-limit fails, GAP-03 asserts that status 500 is returned with success: false
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.target, 'both');
      assert.ok(res.data.error, 'Must contain error description');
      return { status: 500, error: res.data.error };
    }
  });

  await runTest('PUSH-POST-04: POST /api/extension/push-post with empty text and no media returns HTTP 400', async () => {
    const payload = {
      rawText: '',
      mediaUrls: []
    };
    const res = await makeRequest('POST', '/api/extension/push-post', payload);
    assert.strictEqual(res.status, 400, `Expected 400, got ${res.status}`);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.error.includes('Thiếu nội dung'), 'Error message must state missing content');
    return { status: res.status, error: res.data.error };
  });

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n=======================================================');
  console.log('Adversarial Stress Test Suite Finished!');
  const passedCount = testResults.filter(t => t.passed).length;
  const failedCount = testResults.filter(t => !t.passed).length;
  console.log(`Passed: ${passedCount} / ${testResults.length}`);
  console.log(`Failed: ${failedCount} / ${testResults.length}`);
  console.log('=======================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal stress test suite error:', err);
    process.exit(1);
  });
}

module.exports = { main, testResults };
