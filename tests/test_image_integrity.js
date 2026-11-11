/**
 * Image Integrity & Template Verifier
 * Adversarial check on all media URLs in data/model_templates.json
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const templatesPath = path.resolve(__dirname, '..', 'data', 'model_templates.json');
const templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));

console.log('Total templates:', templates.length);

const deletedBadIds = ['1793880993077', '1793880993717'];
let badIdFound = false;

// 1. Check HP EliteBook 630 specifically
const hp630 = templates.find(t => t.model_name && t.model_name.includes('630'));
if (hp630) {
  console.log(`Found HP 630 template (${hp630.id}): ${hp630.media_files ? hp630.media_files.length : 0} media files.`);
} else {
  console.warn('[WARN] HP 630 template not found!');
}

// 2. Check for banned bad IDs across all fields
const rawJson = fs.readFileSync(templatesPath, 'utf8');
deletedBadIds.forEach(badId => {
  if (rawJson.includes(badId)) {
    console.error(`[FAIL] Regression! Found deleted bad URL ID ${badId} in raw model_templates.json!`);
    badIdFound = true;
  }
});

if (!badIdFound) {
  console.log('[PASS] Confirmed: Deleted bad image URLs (1793880993077, 1793880993717) are 100% PURGED from model_templates.json');
}

// 3. Collect all unique media URLs
const uniqueUrls = new Set();
templates.forEach(t => {
  if (Array.isArray(t.media_files)) {
    t.media_files.forEach(m => {
      const u = typeof m === 'string' ? m : m.url;
      if (u) uniqueUrls.add(u);
    });
  }
  if (Array.isArray(t.media_urls)) {
    t.media_urls.forEach(u => {
      if (u) uniqueUrls.add(u);
    });
  }
});

console.log(`Found ${uniqueUrls.size} unique media URLs across all templates.`);

// 4. Verify each URL
function checkUrl(url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.request(parsed, { method: 'HEAD', timeout: 8000 }, (res) => {
        resolve({ url, status: res.statusCode, ok: res.statusCode >= 200 && res.statusCode < 400 });
      });
      req.on('timeout', () => {
        req.destroy();
        resolve({ url, status: 'TIMEOUT', ok: false });
      });
      req.on('error', (err) => {
        resolve({ url, status: err.message, ok: false });
      });
      req.end();
    } catch (e) {
      resolve({ url, status: 'INVALID_URL', ok: false });
    }
  });
}

async function run() {
  const urlList = Array.from(uniqueUrls);
  console.log(`Pinging all ${urlList.length} media URLs to verify HTTP status...`);
  
  let checked = 0;
  let passCount = 0;
  let failCount = 0;
  const failures = [];

  // Batch ping 8 at a time
  for (let i = 0; i < urlList.length; i += 8) {
    const chunk = urlList.slice(i, i + 8);
    const results = await Promise.all(chunk.map(checkUrl));
    results.forEach(r => {
      checked++;
      if (r.ok) {
        passCount++;
      } else {
        failCount++;
        failures.push(r);
        console.error(`  [FAIL] URL error (${r.status}): ${r.url}`);
      }
    });
  }

  console.log(`\nChecked: ${checked}, Pass: ${passCount}, Fail: ${failCount}`);
  if (failures.length > 0 || badIdFound) {
    console.error(`Found ${failures.length} unreachable or error URLs!`);
    process.exit(1);
  } else {
    console.log('[ALL PASS] 100% of model template media URLs return valid HTTP 200/3xx, zero 400 errors, zero bad IDs!');
    process.exit(0);
  }
}

run();
