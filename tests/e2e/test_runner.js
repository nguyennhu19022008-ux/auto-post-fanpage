#!/usr/bin/env node
/**
 * tests/e2e/test_runner.js
 * Central Automated E2E Test Runner for Tab "DATA POST" & Circular Post Engine.
 * Executes Tiers 1-4, reports detailed per-test status, and returns proper exit codes.
 */

// ============ CÔ LẬP MÔI TRƯỜNG KIỂM THỬ (phải chạy TRƯỚC khi nạp bất kỳ service nào) ============
// Mục tiêu: chạy test KHÔNG BAO GIỜ đăng bài thật lên Fanpage, ghi Supabase Cloud,
// gửi email/Telegram, tiêu hạn mức Gemini, hay làm bẩn thư mục data/ production.
(function isolateTestEnvironment() {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');

  process.env.VG_TEST_MODE = '1';
  // dotenv không ghi đè biến đã tồn tại -> chuỗi rỗng = vô hiệu hóa Supabase Cloud
  process.env.SUPABASE_URL = '';
  process.env.SUPABASE_KEY = '';
  process.env.SUPABASE_ANON_KEY = '';

  const sourceDataDir = path.join(__dirname, '..', '..', 'data');
  const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vg-e2e-data-'));
  if (fs.existsSync(sourceDataDir)) {
    for (const file of fs.readdirSync(sourceDataDir)) {
      const src = path.join(sourceDataDir, file);
      if (fs.statSync(src).isFile()) fs.copyFileSync(src, path.join(sandboxDir, file));
    }
  }
  fs.mkdirSync(path.join(sandboxDir, '_tmp'), { recursive: true });
  process.env.VG_DATA_DIR = sandboxDir;

  process.on('exit', () => {
    try { fs.rmSync(sandboxDir, { recursive: true, force: true }); } catch (e) {}
  });
  console.log(`[Harness] 🔒 Test sandbox: ${sandboxDir} (Facebook/Supabase/Email/Telegram/Gemini đã bị cô lập)`);
})();

const { startTestServer } = require('./test_helpers');
const tier1 = require('./tier1_feature.test');
const tier2 = require('./tier2_boundary.test');
const tier3 = require('./tier3_combination.test');
const tier4 = require('./tier4_realworld.test');

async function main() {
  const args = process.argv.slice(2).map(a => a.toLowerCase());
  const selectedTier = args[0] || 'all';

  console.log(`=======================================================`);
  console.log(`🧪 E2E Test Suite: Tab DATA POST & Circular Post Engine`);
  console.log(`   Scope: ${selectedTier.toUpperCase()} | Node: ${process.version}`);
  console.log(`=======================================================\n`);

  const serverHarness = await startTestServer();
  const baseUrl = serverHarness.baseUrl;
  console.log(`[Harness] 🚀 Test server active at: ${baseUrl}\n`);

  const totalResults = [];
  const startTime = performance.now();

  try {
    // Tier 1
    if (selectedTier === 'all' || selectedTier === 'tier1' || selectedTier === '1') {
      console.log(`▶ Running Tier 1: Feature Coverage...`);
      const t1Results = await tier1.run(baseUrl);
      printTierResults('Tier 1', t1Results);
      totalResults.push(...t1Results);
    }

    // Tier 2
    if (selectedTier === 'all' || selectedTier === 'tier2' || selectedTier === '2') {
      console.log(`\n▶ Running Tier 2: Boundary & Corner Cases...`);
      const t2Results = await tier2.run(baseUrl);
      printTierResults('Tier 2', t2Results);
      totalResults.push(...t2Results);
    }

    // Tier 3
    if (selectedTier === 'all' || selectedTier === 'tier3' || selectedTier === '3') {
      console.log(`\n▶ Running Tier 3: Cross-Feature Combinations...`);
      const t3Results = await tier3.run(baseUrl);
      printTierResults('Tier 3', t3Results);
      totalResults.push(...t3Results);
    }

    // Tier 4
    if (selectedTier === 'all' || selectedTier === 'tier4' || selectedTier === '4') {
      console.log(`\n▶ Running Tier 4: Real-World Scenarios & Slide 0 Audit...`);
      const t4Results = await tier4.run(baseUrl);
      printTierResults('Tier 4', t4Results);
      totalResults.push(...t4Results);
    }
  } finally {
    await serverHarness.close();
    console.log(`\n[Harness] 🛑 Test server shut down cleanly.`);
  }

  const durationMs = (performance.now() - startTime).toFixed(0);
  const total = totalResults.length;
  const passed = totalResults.filter(r => r.passed).length;
  const failed = totalResults.filter(r => !r.passed).length;

  console.log(`\n=======================================================`);
  console.log(`E2E Test Execution Summary:`);
  console.log(`  Total Tests : ${total}`);
  console.log(`  Passed      : ${passed}`);
  console.log(`  Failed      : ${failed}`);
  console.log(`  Duration    : ${durationMs}ms`);
  console.log(`=======================================================`);

  if (failed > 0) {
    console.error(`❌ STATUS: ${failed} TEST(S) FAILED. Exiting with code 1.\n`);
    process.exit(1);
  } else {
    console.log(`✅ STATUS: ALL ${passed} TESTS PASSED SUCCESSFULLY! Exiting with code 0.\n`);
    process.exit(0);
  }
}

function printTierResults(tierName, results) {
  for (const r of results) {
    if (r.passed) {
      console.log(`  ✓ [PASS] [${tierName}] ${r.name} (${r.duration}ms)`);
    } else {
      console.error(`  ✗ [FAIL] [${tierName}] ${r.name} (${r.duration}ms)`);
      if (r.error) {
        console.error(`      Error: ${r.error}`);
      }
    }
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(`Fatal test runner error:`, err);
    process.exit(1);
  });
}
