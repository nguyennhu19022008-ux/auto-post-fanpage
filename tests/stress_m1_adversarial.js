/**
 * tests/stress_m1_adversarial.js
 * Adversarial & Empirical Stress Harness for Milestone M1
 * Data Post & Circular Engine Backend Services
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const app = require('../server');

const TEST_PORT = 4567;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Paths for backup and restoration
const TEMPLATES_FILE = path.join(__dirname, '..', 'data', 'model_templates.json');
const QUEUE_FILE = path.join(__dirname, '..', 'data', 'circular_queue.json');

let backupTemplates = null;
let backupQueue = null;
let serverInstance = null;

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  findings: []
};

function backupData() {
  if (fs.existsSync(TEMPLATES_FILE)) {
    backupTemplates = fs.readFileSync(TEMPLATES_FILE, 'utf8');
  }
  if (fs.existsSync(QUEUE_FILE)) {
    backupQueue = fs.readFileSync(QUEUE_FILE, 'utf8');
  }
}

function restoreData() {
  if (backupTemplates !== null && fs.existsSync(TEMPLATES_FILE)) {
    fs.writeFileSync(TEMPLATES_FILE, backupTemplates, 'utf8');
  }
  if (backupQueue !== null && fs.existsSync(QUEUE_FILE)) {
    fs.writeFileSync(QUEUE_FILE, backupQueue, 'utf8');
  }
  if (fs.existsSync('/tmp/model_templates.json') && backupTemplates !== null) {
    try { fs.writeFileSync('/tmp/model_templates.json', backupTemplates, 'utf8'); } catch(e) {}
  }
  if (fs.existsSync('/tmp/circular_queue.json') && backupQueue !== null) {
    try { fs.writeFileSync('/tmp/circular_queue.json', backupQueue, 'utf8'); } catch(e) {}
  }
}

function request(method, reqPath, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const isJson = body && typeof body === 'object';
    const payload = isJson ? JSON.stringify(body) : (body || '');

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers
    };
    if (payload) {
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const options = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: reqPath,
      method: method,
      headers: reqHeaders,
      agent: false,
      timeout: 10000
    };

    const startTime = Date.now();
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        const duration = Date.now() - startTime;
        let parsed = data;
        try {
          parsed = JSON.parse(data);
        } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: data,
          duration
        });
      });
    });

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out after 10000ms'));
    });

    req.on('error', (err) => reject(err));

    if (payload) {
      req.write(payload);
    }
    req.end();
  });
}

function recordResult(testName, passed, details = {}) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`  [PASS] ${testName} (${details.duration || 0}ms)`);
  } else {
    testResults.failed++;
    console.log(`  [FAIL] ${testName}`);
    console.log(`         Expected: ${details.expected}`);
    console.log(`         Actual  : ${details.actual}`);
    testResults.findings.push({
      testName,
      ...details
    });
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🚀 STARTING EMPIRICAL ADVERSARIAL STRESS TEST SUITE (M1)');
  console.log('===============================================================\n');

  backupData();

  await new Promise((resolve) => {
    serverInstance = app.listen(TEST_PORT, () => {
      console.log(`[TestHarness] Ephemeral server listening on ${BASE_URL}\n`);
      resolve();
    });
  });

  try {
    // ==============================================================
    // SUITE 1: MALFORMED PAYLOADS & INPUT VALIDATION
    // ==============================================================
    console.log('--- SUITE 1: MALFORMED PAYLOADS & INPUT VALIDATION ---');

    // 1.1 Empty body on template creation
    {
      const res = await request('POST', '/api/data-post/templates', {});
      const passed = res.status === 400 && res.body?.success === false;
      recordResult('1.1 POST /api/data-post/templates with empty body {}', passed, {
        duration: res.duration,
        expected: 'Status 400 with success: false',
        actual: `Status ${res.status}, body: ${JSON.stringify(res.body)}`
      });
    }

    // 1.2 Missing model_name
    {
      const res = await request('POST', '/api/data-post/templates', {
        cpu: 'Intel Core i5',
        ram: '16GB'
      });
      const passed = res.status === 400 && res.body?.success === false;
      recordResult('1.2 POST /api/data-post/templates missing model_name', passed, {
        duration: res.duration,
        expected: 'Status 400 with error',
        actual: `Status ${res.status}, error: ${res.body?.error}`
      });
    }

    // 1.3 Non-string model_name types
    const invalidModelTypes = [
      { type: 'number', val: 12345 },
      { type: 'null', val: null },
      { type: 'array', val: ['HP', 'Envy'] },
      { type: 'boolean', val: true },
      { type: 'object', val: { name: 'Dell' } }
    ];

    for (const item of invalidModelTypes) {
      const res = await request('POST', '/api/data-post/templates', {
        model_name: item.val,
        cpu: 'i5',
        ram: '8GB'
      });
      const passed = res.status === 400 && res.body?.success === false;
      recordResult(`1.3 POST template with model_name type: ${item.type}`, passed, {
        duration: res.duration,
        expected: 'Status 400',
        actual: `Status ${res.status}, error: ${res.body?.error}`
      });
    }

    // 1.4 Whitespace-only model_name
    {
      const res = await request('POST', '/api/data-post/templates', {
        model_name: '     ',
        cpu: 'i5',
        ram: '8GB'
      });
      const passed = res.status === 400;
      recordResult('1.4 POST template with whitespace-only model_name', passed, {
        duration: res.duration,
        expected: 'Status 400',
        actual: `Status ${res.status}, error: ${res.body?.error}`
      });
    }

    // 1.5 Missing both CPU and RAM specs
    {
      const res = await request('POST', '/api/data-post/templates', {
        model_name: 'Dell Latitude 5420',
        brand: 'Dell'
      });
      const passed = res.status === 400 && /cấu hình/i.test(res.body?.error || '');
      recordResult('1.5 POST template missing both CPU and RAM', passed, {
        duration: res.duration,
        expected: 'Status 400 mentioning specs',
        actual: `Status ${res.status}, error: ${res.body?.error}`
      });
    }

    // 1.6 Non-string types in specs (numbers/objects in brand, cpu, ram)
    {
      const res = await request('POST', '/api/data-post/templates', {
        model_name: 'Dell Latitude 5420 Special',
        brand: 9999,
        cpu: 1234,
        ram: 5678
      });
      const is500Crash = res.status === 500;
      recordResult('1.6 POST template with numeric specs (brand, cpu, ram)', !is500Crash, {
        duration: res.duration,
        expected: 'Status 400 or 201 (safe handling, no 500 crash)',
        actual: `Status ${res.status}, error: ${res.body?.error}`
      });
    }

    // 1.7 Price handling: negative, inverted, non-numeric
    {
      // Negative price
      const resNeg = await request('POST', '/api/data-post/templates', {
        model_name: 'HP EliteBook 840 G8 NegPrice',
        brand: 'HP',
        cpu: 'i5-1135G7',
        ram: '16GB',
        price_min: -5000000,
        price_max: -100
      });
      recordResult('1.7a Negative price submission handling', resNeg.status === 400, {
        duration: resNeg.duration,
        expected: 'Status 400 (rejection of negative prices)',
        actual: `Status ${resNeg.status}, created price_min: ${resNeg.body?.data?.price_min}`
      });

      // Inverted price (price_min > price_max)
      const resInv = await request('POST', '/api/data-post/templates', {
        model_name: 'ThinkPad T14s Gen 2 InvPrice',
        brand: 'ThinkPad',
        cpu: 'i7-1165G7',
        ram: '16GB',
        price_min: 15000000,
        price_max: 8000000
      });
      recordResult('1.7b Inverted price submission (price_min > price_max)', resInv.status === 400, {
        duration: resInv.duration,
        expected: 'Status 400 (rejection of inverted prices where min > max)',
        actual: `Status ${resInv.status}, min: ${resInv.body?.data?.price_min}, max: ${resInv.body?.data?.price_max}`
      });
    }

    // 1.8 Extremely long payloads (>10,000 characters) - ReDoS & memory bloat test
    {
      const hugePrompt = 'A'.repeat(25000);
      const resHuge = await request('POST', '/api/data-post/templates', {
        model_name: 'Dell Latitude 7320 Ultralight Huge',
        brand: 'Dell',
        cpu: 'Core i7',
        ram: '32GB',
        base_ai_prompt: hugePrompt
      });
      const passed = resHuge.status === 201 && resHuge.duration < 1000;
      recordResult('1.8a Extremely large base_ai_prompt (25,000 chars)', passed, {
        duration: resHuge.duration,
        expected: 'Status 201 within < 1000ms',
        actual: `Status ${resHuge.status}, took ${resHuge.duration}ms`
      });

      // Extremely large Smart Match text (50,000 chars)
      const hugeZaloText = 'Bán laptop Dell Latitude 5350 Ultra 5 ram 16gb '.repeat(1000);
      const resMatch = await request('POST', '/api/data-post/smart-match', {
        raw_text: hugeZaloText
      });
      const matchPassed = resMatch.status === 200 && resMatch.duration < 2000;
      recordResult('1.8b Smart Match against 50,000 character payload', matchPassed, {
        duration: resMatch.duration,
        expected: 'Status 200 within < 2000ms (no ReDoS or freeze)',
        actual: `Status ${resMatch.status}, score: ${resMatch.body?.score}, took ${resMatch.duration}ms`
      });
    }

    // 1.9 Smart Match with empty / non-string payloads
    {
      const emptyMatch = await request('POST', '/api/data-post/smart-match', {});
      const emptyPassed = emptyMatch.status === 200 && emptyMatch.body?.matched === false && emptyMatch.body?.score === 0;
      recordResult('1.9a Smart Match with empty body {}', emptyPassed, {
        duration: emptyMatch.duration,
        expected: 'Status 200 with matched: false, score: 0',
        actual: `Status ${emptyMatch.status}, body: ${JSON.stringify(emptyMatch.body)}`
      });

      const numMatch = await request('POST', '/api/data-post/smart-match', { raw_text: 12345678 });
      const numPassed = numMatch.status === 200 && numMatch.body?.matched === false;
      recordResult('1.9b Smart Match with non-string raw_text (number)', numPassed, {
        duration: numMatch.duration,
        expected: 'Status 200 with matched: false',
        actual: `Status ${numMatch.status}, body: ${JSON.stringify(numMatch.body)}`
      });
    }

    // 1.10 Enqueue with missing or invalid parameters
    {
      const resNoTpl = await request('POST', '/api/data-post/queue', {});
      const passedNoTpl = resNoTpl.status === 400 && /template_id/i.test(resNoTpl.body?.error || '');
      recordResult('1.10a Enqueue without template_id', passedNoTpl, {
        duration: resNoTpl.duration,
        expected: 'Status 400 mentioning template_id',
        actual: `Status ${resNoTpl.status}, error: ${resNoTpl.body?.error}`
      });

      const resBadTpl = await request('POST', '/api/data-post/queue', {
        template_id: 'non_existent_tpl_uuid_99999'
      });
      const passedBadTpl = resBadTpl.status === 400 || resBadTpl.status === 404;
      recordResult('1.10b Enqueue with non-existent template_id', passedBadTpl, {
        duration: resBadTpl.duration,
        expected: 'Status 400 or 404',
        actual: `Status ${resBadTpl.status}, error: ${resBadTpl.body?.error}`
      });
    }

    // 1.11 Trigger-Post with empty / missing parameters (HTTP 4xx vs 500)
    {
      const resEmptyTrigger = await request('POST', '/api/data-post/queue/trigger-post', {});
      const passed = resEmptyTrigger.status === 400 || resEmptyTrigger.status === 404;
      recordResult('1.11 Trigger-post with missing template_id/queue_id', passed, {
        duration: resEmptyTrigger.duration,
        expected: 'Status 400 or 404 (client error for missing target)',
        actual: `Status ${resEmptyTrigger.status}, error: ${resEmptyTrigger.body?.error}`
      });
    }

    // ==============================================================
    // SUITE 2: BOUNDARY & CORNER CASES
    // ==============================================================
    console.log('\n--- SUITE 2: BOUNDARY & CORNER CASES ---');

    // 2.1 Non-existent template ID queries
    {
      const res = await request('GET', '/api/data-post/templates/tpl_does_not_exist_xyz');
      const passed = res.status === 404 && res.body?.success === false;
      recordResult('2.1 GET non-existent template ID returns 404', passed, {
        duration: res.duration,
        expected: 'Status 404',
        actual: `Status ${res.status}`
      });
    }

    // 2.2 Updating non-existent template ID
    {
      const res = await request('PUT', '/api/data-post/templates/tpl_does_not_exist_xyz', {
        price_display: '9.9 triệu'
      });
      const passed = res.status === 404 && res.body?.success === false;
      recordResult('2.2 PUT non-existent template ID returns 404', passed, {
        duration: res.duration,
        expected: 'Status 404',
        actual: `Status ${res.status}`
      });
    }

    // 2.3 Deleting non-existent template ID
    {
      const res = await request('DELETE', '/api/data-post/templates/tpl_does_not_exist_xyz');
      const passed = res.status === 404 && res.body?.success === false;
      recordResult('2.3 DELETE non-existent template ID returns 404', passed, {
        duration: res.duration,
        expected: 'Status 404',
        actual: `Status ${res.status}`
      });
    }

    // 2.4 Double deletion boundary
    {
      const cr = await request('POST', '/api/data-post/templates', {
        model_name: 'Fujitsu Lifebook U9311 DoubleDel',
        brand: 'Fujitsu',
        cpu: 'Core i5-1135G7',
        ram: '16GB'
      });
      const tempId = cr.body?.data?.id;

      const del1 = await request('DELETE', `/api/data-post/templates/${tempId}`);
      const del2 = await request('DELETE', `/api/data-post/templates/${tempId}`);

      const passed = del1.status === 200 && del2.status === 404;
      recordResult('2.4 Double DELETE template (second attempt returns 404)', passed, {
        duration: del2.duration,
        expected: 'First 200, Second 404',
        actual: `First: ${del1.status}, Second: ${del2.status}`
      });
    }

    // 2.5 Deleting non-existent queue item
    {
      const res = await request('DELETE', '/api/data-post/queue/non_existent_queue_item_123');
      const passed = res.status === 404 && res.body?.success === false;
      recordResult('2.5 DELETE non-existent queue item returns 404', passed, {
        duration: res.duration,
        expected: 'Status 404',
        actual: `Status ${res.status}`
      });
    }

    // 2.6 Multi-value query parameters (e.g. ?brand=Dell&brand=HP)
    {
      const res = await request('GET', '/api/data-post/templates?brand=Dell&brand=HP');
      const passed = res.status === 200 && res.body?.success === true;
      recordResult('2.6 GET templates with array query param (?brand=Dell&brand=HP)', passed, {
        duration: res.duration,
        expected: 'Status 200 (handled gracefully without 500 error)',
        actual: `Status ${res.status}, error: ${res.body?.error}`
      });
    }

    // 2.7 Search filter with regex metacharacters
    {
      const regexSearch = '.*+?^${}()|[]\\';
      const res = await request('GET', `/api/data-post/templates?search=${encodeURIComponent(regexSearch)}`);
      const passed = res.status === 200 && res.body?.success === true;
      recordResult('2.7 GET templates search with regex metacharacters', passed, {
        duration: res.duration,
        expected: 'Status 200 (no crash or unhandled regex syntax error)',
        actual: `Status ${res.status}, count: ${res.body?.count}`
      });
    }

    // 2.8 Search filter with non-existent brand and non-existent status
    {
      const res = await request('GET', '/api/data-post/templates?brand=NonExistentBrand9999&status=non_existent_status');
      const passed = res.status === 200 && res.body?.count === 0 && Array.isArray(res.body?.data);
      recordResult('2.8 GET templates with non-matching filters returns empty list', passed, {
        duration: res.duration,
        expected: 'Status 200 with count: 0, data: []',
        actual: `Status ${res.status}, count: ${res.body?.count}`
      });
    }

    // 2.9 Duplicate key collision on PUT update (Data destruction test)
    {
      // Create template Alpha and Beta
      const crA = await request('POST', '/api/data-post/templates', {
        model_name: 'Lap Collision Alpha',
        brand: 'Dell',
        cpu: 'Core i5',
        ram: '8GB'
      });
      const crB = await request('POST', '/api/data-post/templates', {
        model_name: 'Lap Collision Beta',
        brand: 'Dell',
        cpu: 'Core i7',
        ram: '16GB'
      });

      const idA = crA.body?.data?.id;
      const idB = crB.body?.data?.id;

      // Update Alpha to collide with Beta
      const putRes = await request('PUT', `/api/data-post/templates/${idA}`, {
        model_name: 'Lap Collision Beta',
        cpu: 'Core i7',
        ram: '16GB'
      });

      // Verify if Beta still exists or if it was overwritten/erased
      const getB = await request('GET', `/api/data-post/templates/${idB}`);
      const bSurvived = getB.status === 200 && getB.body?.data?.id === idB;

      // Clean up
      await request('DELETE', `/api/data-post/templates/${idA}`).catch(()=>{});
      if (bSurvived) await request('DELETE', `/api/data-post/templates/${idB}`).catch(()=>{});

      recordResult('2.9 PUT update with colliding model_key must not overwrite another template', bSurvived && putRes.status === 400, {
        duration: putRes.duration,
        expected: 'PUT returns 400 (rejection of duplicate key) and template Beta is preserved',
        actual: `PUT status: ${putRes.status}, Beta found: ${bSurvived ? 'Yes' : 'NO (DESTROYED!)'}`
      });
    }

    // ==============================================================
    // SUITE 3: CONCURRENCY & RACE CONDITIONS
    // ==============================================================
    console.log('\n--- SUITE 3: CONCURRENCY & RACE CONDITIONS ---');

    // 3.1 Concurrent creation of identical model templates
    {
      const concurrentPayload = {
        model_name: 'Dynabook Portege X30L-J Concurrent',
        brand: 'Dynabook',
        cpu: 'Core i5-1135G7',
        ram: '16GB',
        ssd: '256GB SSD',
        screen: '13.3 inch FHD IGZO'
      };

      const promises = Array.from({ length: 10 }, () =>
        request('POST', '/api/data-post/templates', concurrentPayload)
      );

      const responses = await Promise.all(promises);
      const statuses = responses.map(r => r.status);
      const createdCount = statuses.filter(s => s === 201).length;
      const rejectedCount = statuses.filter(s => s === 400).length;

      const listRes = await request('GET', '/api/data-post/templates?search=X30L-J');
      const matchingCount = listRes.body?.count || 0;

      const passed = matchingCount === 1 && createdCount === 1 && rejectedCount === 9;
      recordResult('3.1 Concurrent identical template creations (Duplicate Prevention)', passed, {
        expected: 'Exactly 1 template created (201), 9 rejected as duplicate (400)',
        actual: `Created 201: ${createdCount}, Rejected 400: ${rejectedCount}, Stored items: ${matchingCount}`
      });
    }

    // 3.2 Concurrent enqueuing into circular queue
    {
      const enqueuePromises = Array.from({ length: 10 }, (_, i) =>
        request('POST', '/api/data-post/queue', {
          template_id: 'tpl_dell_lat_5350',
          priority: i,
          rewrite_style: i % 2 === 0 ? 'flash_sale' : 'curated_pick'
        })
      );

      const enqueueResponses = await Promise.all(enqueuePromises);
      const successEnqueue = enqueueResponses.filter(r => r.status === 201).length;

      const queueList = await request('GET', '/api/data-post/queue');
      const dellQueuedItems = (queueList.body?.data || []).filter(q => q.template_id === 'tpl_dell_lat_5350');

      const passed = successEnqueue === 10 && dellQueuedItems.length >= 10;
      recordResult('3.2 Concurrent circular queue enqueue (Storage Consistency)', passed, {
        expected: 'All 10 enqueued successfully (201) without file corruption',
        actual: `Enqueued: ${successEnqueue}/10, Stored in queue: ${dellQueuedItems.length}`
      });
    }

    // ==============================================================
    // SUITE 4: SECURITY PAYLOADS & INJECTION RESILIENCE
    // ==============================================================
    console.log('\n--- SUITE 4: SECURITY PAYLOADS & INJECTION RESILIENCE ---');

    // 4.1 SQL Injection payload in model_name and search
    {
      const sqliPayload = "Dell Latitude 5350'; DROP TABLE model_templates;--";
      const res = await request('POST', '/api/data-post/templates', {
        model_name: sqliPayload,
        brand: 'Dell',
        cpu: 'Core i5',
        ram: '16GB'
      });

      const checkRes = await request('GET', '/api/data-post/templates');
      const tableIntact = checkRes.status === 200 && checkRes.body?.count > 0;

      recordResult('4.1 SQL Injection in model_name does not corrupt or drop storage', tableIntact, {
        duration: res.duration,
        expected: 'Storage remains intact, subsequent GET returns 200 with data',
        actual: `GET status: ${checkRes.status}, count: ${checkRes.body?.count}`
      });
    }

    // 4.2 Cross-Site Scripting (XSS) in model_name & specs
    {
      const xssPayload = "<script>alert('XSS_PAYLOAD_EXECUTION')</script> Panasonic Let's Note SV8";
      const res = await request('POST', '/api/data-post/templates', {
        model_name: xssPayload,
        brand: 'Panasonic',
        cpu: '<img src=x onerror=alert(1)> Core i5',
        ram: '8GB'
      });

      const xssId = res.body?.data?.id;
      let safeHandling = false;

      if (res.status === 201 && xssId) {
        const getRes = await request('GET', `/api/data-post/templates/${xssId}`);
        safeHandling = getRes.status === 200 && typeof getRes.body?.data?.model_name === 'string';
      }

      recordResult('4.2 XSS payload in model_name handled safely without JSON corruption', safeHandling, {
        duration: res.duration,
        expected: 'Status 201/200 with clean string handling',
        actual: `POST status: ${res.status}, stored model_name: ${res.body?.data?.model_name}`
      });
    }

    // 4.3 Prototype Pollution payload in body
    {
      const protoPayload = JSON.parse('{"model_name": "VAIO Pro PG", "brand": "VAIO", "cpu": "i5", "ram": "8GB", "__proto__": {"polluted": true}}');
      const res = await request('POST', '/api/data-post/templates', protoPayload);
      const isPolluted = ({}).polluted === true;

      recordResult('4.3 Prototype Pollution payload (__proto__) does not pollute Object prototype', !isPolluted, {
        duration: res.duration,
        expected: '({}).polluted === undefined',
        actual: `({}).polluted === ${({}).polluted}`
      });
    }

    // 4.4 Path traversal attempt in template ID
    {
      const res = await request('GET', '/api/data-post/templates/..%2f..%2fpackage.json');
      const passed = res.status === 404 || res.status === 400;
      recordResult('4.4 Path traversal in template ID (..%2f..%2fpackage.json)', passed, {
        duration: res.duration,
        expected: 'Status 404 or 400 (not exposing package.json or crashing)',
        actual: `Status ${res.status}`
      });
    }

    // ==============================================================
    // SUITE 5: BUSINESS LOGIC & PERMANENT MODEL IDENTITY ENFORCEMENT
    // ==============================================================
    console.log('\n--- SUITE 5: BUSINESS LOGIC & PERMANENT MODEL IDENTITY ---');

    // 5.1 Temporary lot code detection accuracy
    const temporaryLotSamples = [
      { code: '#101', name: '#101', shouldReject: true },
      { code: 'Lô 5', name: 'Lô 5 Laptop Dell', shouldReject: true },
      { code: 'Mã 981', name: 'Mã 981 Dell Latitude 5350', shouldReject: true },
      { code: 'Laptop #114B', name: 'Laptop #114B', shouldReject: true },
      { code: '#636', name: '#636 ThinkPad T480s', shouldReject: true },
      { code: 'Valid ThinkPad', name: 'ThinkPad X1 Carbon Gen 9 LotCheck', shouldReject: false },
      { code: 'Valid Dell', name: 'Dell Latitude 7420 Carbon LotCheck', shouldReject: false },
      { code: 'Valid HP', name: 'HP EliteBook x360 1040 G8 LotCheck', shouldReject: false }
    ];

    for (const sample of temporaryLotSamples) {
      const res = await request('POST', '/api/data-post/templates', {
        model_name: sample.name,
        brand: 'Khác',
        cpu: 'Core i5',
        ram: '8GB'
      });

      const rejected = res.status === 400;
      const correctlyHandled = sample.shouldReject ? rejected : (res.status === 201 || (res.status === 400 && res.body?.error?.includes('tồn tại')));

      recordResult(`5.1 Permanent identity validation: "${sample.name}"`, correctlyHandled, {
        duration: res.duration,
        expected: sample.shouldReject ? 'Reject with 400' : 'Accept with 201',
        actual: `HTTP ${res.status}, error: ${res.body?.error}`
      });
    }

    // 5.2 Smart Match scoring threshold verification
    {
      const strongMatch = await request('POST', '/api/data-post/smart-match', {
        raw_text: 'Về thêm lô Dell Latitude 5350 Ultra 5 ram 16gb máy cực đẹp'
      });
      const strongPassed = strongMatch.status === 200 && strongMatch.body?.matched === true && strongMatch.body?.score >= 60;
      recordResult('5.2a Smart Match: High relevance input matches correctly', strongPassed, {
        duration: strongMatch.duration,
        expected: 'matched: true, score >= 60',
        actual: `matched: ${strongMatch.body?.matched}, score: ${strongMatch.body?.score}`
      });

      const brandOnlyMatch = await request('POST', '/api/data-post/smart-match', {
        raw_text: 'Bán laptop Dell giá rẻ'
      });
      const brandOnlyPassed = brandOnlyMatch.status === 200 && brandOnlyMatch.body?.matched === false && brandOnlyMatch.body?.score < 60;
      recordResult('5.2b Smart Match: Brand-only input does not trigger match (<60)', brandOnlyPassed, {
        duration: brandOnlyMatch.duration,
        expected: 'matched: false, score < 60',
        actual: `matched: ${brandOnlyMatch.body?.matched}, score: ${brandOnlyMatch.body?.score}`
      });

      const unrelatedMatch = await request('POST', '/api/data-post/smart-match', {
        raw_text: 'Cơm tấm sườn bì chả Nguyễn Trãi ngon nhất Sài Gòn'
      });
      const unrelatedPassed = unrelatedMatch.status === 200 && unrelatedMatch.body?.matched === false && unrelatedMatch.body?.score === 0;
      recordResult('5.2c Smart Match: Unrelated text returns score 0', unrelatedPassed, {
        duration: unrelatedMatch.duration,
        expected: 'matched: false, score 0',
        actual: `matched: ${unrelatedMatch.body?.matched}, score: ${unrelatedMatch.body?.score}`
      });
    }

    // 5.3 Circular rewrite styles rotating hooks
    {
      const styles = ['flash_sale', 'curated_pick', 'value_champion', 'featured_review'];
      const rewritePasses = [];

      for (const st of styles) {
        const enq = await request('POST', '/api/data-post/queue', {
          template_id: 'tpl_dell_lat_5350',
          rewrite_style: st
        });
        const content = enq.body?.data?.ai_rewritten_content || '';
        const hasContact = content.includes('0876637806');
        const hasModelInContent = content.toLowerCase().includes('latitude 5350');
        const noTempCode = !content.includes('#101') && !content.includes('#999');

        rewritePasses.push(enq.status === 201 && hasContact && hasModelInContent && noTempCode);
      }

      const allRewritePassed = rewritePasses.every(Boolean);
      recordResult('5.3 Circular AI rewrite rotates across 4 distinct styles cleanly', allRewritePassed, {
        expected: 'All 4 styles generated with phone 0876637806, model name in body, and zero temporary codes',
        actual: `Pass counts: ${rewritePasses.filter(Boolean).length}/4`
      });
    }

  } catch (err) {
    console.error('CRITICAL TEST RUNNER EXCEPTION:', err);
  } finally {
    console.log('\n[TestHarness] Restoring original storage files...');
    restoreData();

    if (serverInstance) {
      serverInstance.close(() => {
        console.log('[TestHarness] Ephemeral server closed.');
      });
    }
  }

  console.log('\n===============================================================');
  console.log('📊 EMPIRICAL STRESS TEST EXECUTION SUMMARY');
  console.log('===============================================================');
  console.log(`Total Test Vectors Executed : ${testResults.total}`);
  console.log(`Passed                      : ${testResults.passed}`);
  console.log(`Failed / Anomalies Detected : ${testResults.failed}`);
  console.log('===============================================================\n');

  if (testResults.findings.length > 0) {
    console.log('⚠️ ANOMALIES & POTENTIAL VULNERABILITIES DETECTED:');
    testResults.findings.forEach((f, idx) => {
      console.log(`\n[Anomaly ${idx + 1}] ${f.testName}`);
      console.log(`  Expected: ${f.expected}`);
      console.log(`  Actual  : ${f.actual}`);
    });
  }

  return testResults;
}

if (require.main === module) {
  runTestSuite().then(results => {
    process.exit(results.failed > 0 ? 1 : 0);
  });
}

module.exports = { runTestSuite };
