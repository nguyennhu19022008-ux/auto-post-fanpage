/**
 * tests/adversarial_smart_match_circular.js
 * Adversarial & Empirical Test Harness by Challenger 2 (Milestone M1)
 *
 * Evaluates:
 * 1. Smart Match scoring with noisy Zalo inputs, casing variations, model abbreviations,
 *    false positives (phones, macbooks), and false negatives (valid Japanese laptops).
 * 2. Temporary lot code rejection logic on creation and update.
 * 3. Circular queue anti-spam rewrite variation across all 4 rotating hooks.
 */

const {
  smartMatchTemplate,
  createModelTemplate,
  validatePermanentModelName,
  generateRotatingRewriteCopy,
  loadAllTemplates
} = require('../services/dataPost');

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  cases: []
};

function recordTest(category, name, passed, details = {}) {
  results.total++;
  if (passed) results.passed++;
  else results.failed++;
  results.cases.push({ category, name, passed, details });
  const icon = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`[${icon}] [${category}] ${name}`);
  if (!passed || details.note) {
    console.log(`       Details: ${JSON.stringify(details)}`);
  }
}

async function runAdversarialSuite() {
  console.log('================================================================');
  console.log('🔥 STARTING CHALLENGER 2 EMPIRICAL ADVERSARIAL STRESS TEST SUITE');
  console.log('================================================================\n');

  // ==========================================================================
  // SECTION 1: TEMPORARY LOT CODE REJECTION TESTS
  // ==========================================================================
  console.log('--- SECTION 1: TEMPORARY LOT CODE REJECTION ---');

  const lotCodeTestCases = [
    { name: '#101', shouldReject: true },
    { name: '#636', shouldReject: true },
    { name: 'Lô 5 máy', shouldReject: true },
    { name: 'Mã 881B', shouldReject: true },
    { name: '#114B', shouldReject: true },
    { name: 'Laptop #12', shouldReject: true },
    { name: 'Lo 10 hang Nhat', shouldReject: true },
    { name: 'SKU#992', shouldReject: true },
    { name: 'Lot #55', shouldReject: true },
    { name: 'Mã 99', shouldReject: true },
    { name: 'Dell Latitude 5350 #101', shouldReject: true },
    // Valid permanent names (should pass)
    { name: 'Dell Latitude 5350', shouldReject: false },
    { name: 'ThinkPad T480s', shouldReject: false },
    { name: 'HP Envy x360 14', shouldReject: false },
    { name: 'HP EliteBook 630 G9', shouldReject: false }
  ];

  for (const tc of lotCodeTestCases) {
    let rejected = false;
    let errorMsg = '';
    try {
      validatePermanentModelName(tc.name);
    } catch (err) {
      rejected = true;
      errorMsg = err.message;
    }

    const testPassed = (rejected === tc.shouldReject);
    recordTest(
      'LotCodeRejection',
      `Model name "${tc.name}" -> ${tc.shouldReject ? 'REJECT' : 'ALLOW'}`,
      testPassed,
      { rejected, expectedReject: tc.shouldReject, errorMsg }
    );
  }

  // Also test createModelTemplate rejection via function call
  try {
    let createRejected = false;
    try {
      await createModelTemplate({
        model_name: '#636 Lô Hàng Mới Về',
        brand: 'Dell',
        cpu: 'Intel Core i5',
        ram: '8GB'
      });
    } catch (e) {
      createRejected = true;
    }
    recordTest('LotCodeRejection', 'createModelTemplate with "#636 Lô Hàng Mới Về" throws Error', createRejected);
  } catch (err) {
    recordTest('LotCodeRejection', 'createModelTemplate with lot code', false, { error: err.message });
  }

  // ==========================================================================
  // SECTION 2: SMART MATCH WITH NOISY ZALO WHOLESALE INPUTS
  // ==========================================================================
  console.log('\n--- SECTION 2: SMART MATCH WITH NOISY ZALO WHOLESALE INPUTS ---');

  const noisyZaloWholesale = `
    🔴 THÔNG BÁO NỘI BỘ XẢ KHO GIÁ SỈ:
    Cắt lỗ thu hồi vốn thanh toán tiền lương nhân viên và hoa hồng đại lý 500k/máy!
    Chỉ áp dụng anh em thợ ôm lô hoặc lấy lẻ trừ thẳng lương.
    Thông tin máy:
    Dell Latitude 5350 thế hệ mới, chíp Intel Core Ultra 5 125U mượt mà, RAM 16GB đa nhiệm, SSD 256GB tốc độ cao.
    Màn hình 13.3 inch Full HD IPS sắc nét, máy chuẩn Nhật tuyển chọn zin keng 99%.
    Giá thanh lý nội bộ: 13.xxx triệu. Ai chốt inbox ngay!
  `;

  const noisyRes = await smartMatchTemplate(noisyZaloWholesale);
  recordTest(
    'NoisyZaloMatch',
    'Zalo wholesale text with "lương, hoa hồng, giá sỉ" matches Dell Latitude 5350',
    noisyRes.matched && noisyRes.score >= 60 && noisyRes.template?.model_name === 'Dell Latitude 5350',
    { score: noisyRes.score, matchedModel: noisyRes.template?.model_name, reasons: noisyRes.match_reasons }
  );

  // ==========================================================================
  // SECTION 3: VARIED BRAND CASING TESTS
  // ==========================================================================
  console.log('\n--- SECTION 3: VARIED BRAND CASING ---');

  const casingTests = [
    { text: 'dell latitude 5350 ultra 5 16gb', expectedModel: 'Dell Latitude 5350', desc: 'all lowercase' },
    { text: 'DELL LATITUDE 5350 ULTRA 5 16GB', expectedModel: 'Dell Latitude 5350', desc: 'ALL UPPERCASE' },
    { text: 'dElL lAtItUdE 5350 uLtRa 5 16Gb', expectedModel: 'Dell Latitude 5350', desc: 'mIxEd CaSe' },
    { text: 'thinkpad t480s i5 8gb', expectedModel: 'ThinkPad T480s', desc: 'thinkpad lowercase' },
    { text: 'THINKPAD T480S I5 8GB', expectedModel: 'ThinkPad T480s', desc: 'THINKPAD UPPERCASE' },
    { text: 'tHiNkPaD T480s I5 8Gb', expectedModel: 'ThinkPad T480s', desc: 'tHiNkPaD mixed case' },
    { text: 'hp envy x360 14 i5 16gb', expectedModel: 'HP Envy x360 14', desc: 'hp lowercase' },
    { text: 'HP ENVY X360 14 I5 16GB', expectedModel: 'HP Envy x360 14', desc: 'HP UPPERCASE' }
  ];

  for (const tc of casingTests) {
    const res = await smartMatchTemplate(tc.text);
    const pass = res.matched && res.score >= 60 && res.template?.model_name === tc.expectedModel;
    recordTest(
      'BrandCasing',
      `Brand casing: "${tc.desc}" -> ${tc.expectedModel}`,
      pass,
      { score: res.score, matched: res.matched, matchedModel: res.template?.model_name }
    );
  }

  // ==========================================================================
  // SECTION 4: SLIGHT MODEL NUMBER VARIATIONS & ABBREVIATIONS
  // ==========================================================================
  console.log('\n--- SECTION 4: SLIGHT MODEL NUMBER VARIATIONS ---');

  const variationTests = [
    {
      input: 'Dell Latitude 5350 máy đẹp keng',
      shouldMatch: true,
      expectedModel: 'Dell Latitude 5350',
      desc: 'Full name "Dell Latitude 5350"'
    },
    {
      input: 'Latitude 5350 màn 13.3 inch',
      shouldMatch: true,
      expectedModel: 'Dell Latitude 5350',
      desc: 'Omit brand "Latitude 5350"'
    },
    {
      input: 'Dell 5350 Core Ultra 5 16GB',
      shouldMatch: true,
      expectedModel: 'Dell Latitude 5350',
      desc: 'Omit series "Dell 5350" with specs'
    },
    {
      input: 'Dell 5350',
      shouldMatch: false, // Let us evaluate whether 55 score triggers or not
      expectedModel: 'Dell Latitude 5350',
      desc: '"Dell 5350" alone (Brand 20 + Designation 35 = 55 < 60 threshold)'
    },
    {
      input: 'ThinkPad T480s i5 8GB 256GB',
      shouldMatch: true,
      expectedModel: 'ThinkPad T480s',
      desc: '"ThinkPad T480s" full'
    },
    {
      input: 'T480s hàng nội địa Nhật zin phím êm',
      shouldMatch: false, // Evaluate whether "t480s" alone reaches threshold
      expectedModel: 'ThinkPad T480s',
      desc: '"t480s" alone without brand or series keyword'
    },
    {
      input: 'Dell Lat 5350 Ultra 5 ram 16gb',
      shouldMatch: true,
      expectedModel: 'Dell Latitude 5350',
      desc: 'Abbreviation "Dell Lat 5350" with specs'
    },
    {
      input: 'Lat 5350 máy đẹp pin trâu',
      shouldMatch: false, // Only "5350" matches designation (35 pts)
      expectedModel: 'Dell Latitude 5350',
      desc: '"Lat 5350" alone without brand or full series name'
    },
    {
      input: 'Dell Lat 5350 16gb',
      shouldMatch: true,
      expectedModel: 'Dell Latitude 5350',
      desc: '"Dell Lat 5350 16gb" (Brand 20 + Designation 35 + Specs 15 = 70 >= 60)'
    },
    {
      input: 'Lenovo T480s i5 8gb',
      shouldMatch: false, // Brand is ThinkPad, Lenovo is not mapped -> Designation 35 + Specs 15 = 50 < 60
      expectedModel: 'ThinkPad T480s',
      desc: '"Lenovo T480s i5 8gb" (Missing ThinkPad keyword keeps score at 50 < 60)'
    },
    {
      input: 'Laptop Lenovo ThinkPad T480s i5 8gb',
      shouldMatch: true,
      expectedModel: 'ThinkPad T480s',
      desc: '"Laptop Lenovo ThinkPad T480s i5 8gb" (All tokens match = 115 >= 60)'
    },
    {
      input: 'Bán laptop ThinkPad giá rẻ hàng Nhật',
      shouldMatch: true, // Brand 20 + Series 45 = 65 >= 60 (Edge case: generic ThinkPad matches template)
      expectedModel: 'ThinkPad T480s',
      desc: '"Bán laptop ThinkPad giá rẻ" (ThinkPad triggers both Brand 20 and Series 45 = 65 >= 60)'
    }
  ];

  for (const tc of variationTests) {
    const res = await smartMatchTemplate(tc.input);
    const matchedCorrectModel = res.template?.model_name === tc.expectedModel;
    const pass = (res.matched === tc.shouldMatch) && (!tc.shouldMatch || matchedCorrectModel);
    recordTest(
      'ModelVariations',
      `Input: "${tc.input}" (${tc.desc})`,
      pass,
      {
        score: res.score,
        matched: res.matched,
        threshold: res.threshold,
        expectedMatch: tc.shouldMatch,
        matchedModel: res.template?.model_name,
        reasons: res.match_reasons
      }
    );
  }

  // ==========================================================================
  // SECTION 5: FALSE POSITIVE TESTS (Phones, MacBooks, Non-Laptops)
  // ==========================================================================
  console.log('\n--- SECTION 5: FALSE POSITIVE TESTS (PHONES, MACBOOKS, ACCESSORIES) ---');

  const falsePositiveInputs = [
    'Bán iPhone 15 Pro Max 256GB màu titan tự nhiên pin 100% fullbox bảo hành Apple Care dài',
    'Cần bán MacBook Pro 14 inch chip M3 Pro 18GB 512GB Space Black sạc 15 lần như mới',
    'Thanh lý điện thoại Samsung Galaxy S24 Ultra 512GB màu xám nguyên seal chính hãng',
    'Bán iPad Air 5 chip M1 64GB Wifi màu xanh dương kèm bút Apple Pencil 2',
    'Tai nghe chống ồn Sony WH-1000XM5 chính hãng màu đen bass cực mạnh',
    'Thanh lý xe máy Honda SH 150i ABS đời 2023 chính chủ màu trắng',
    'Bàn phím cơ không dây Logitech MX Mechanical Mini phím gõ êm pin 15 ngày'
  ];

  for (const text of falsePositiveInputs) {
    const res = await smartMatchTemplate(text);
    const pass = !res.matched && res.score < 60;
    recordTest(
      'FalsePositive',
      `Non-laptop text: "${text.substring(0, 45)}..." -> NOT MATCHED`,
      pass,
      { score: res.score, matched: res.matched, matchedModel: res.template?.model_name }
    );
  }

  // ==========================================================================
  // SECTION 6: FALSE NEGATIVE TESTS (Valid Japanese Laptops in standard Vietnamese)
  // ==========================================================================
  console.log('\n--- SECTION 6: FALSE NEGATIVE TESTS (VALID JAPANESE LAPTOPS) ---');

  const validLaptopInputs = [
    {
      text: 'Về thêm chiếc laptop chuẩn zin Nhật: Dell Latitude 5350 màn 13.3 inch Full HD, Core Ultra 5, ram 16gb, ssd 256gb, ngoại hình xuất sắc.',
      expected: 'Dell Latitude 5350'
    },
    {
      text: 'Xả hàng laptop văn phòng siêu bền ThinkPad T480s nhập khẩu nội địa Nhật, chíp Core i5, ram 8gb, ssd 256gb chạy mượt Word Excel.',
      expected: 'ThinkPad T480s'
    },
    {
      text: 'Laptop doanh nhân HP EliteBook 630 G9 thiết kế nhôm sang trọng mỏng nhẹ, Core i5 1235U, ram 16gb, ssd 256gb màn 13.3 inch chống chói.',
      expected: 'HP EliteBook 630 G9'
    },
    {
      text: 'HP Envy x360 14 inch màn hình cảm ứng xoay gập 360 độ, chíp Core i5, ram 16gb, máy like new xách tay Nhật Bản.',
      expected: 'HP Envy x360 14'
    }
  ];

  for (const tc of validLaptopInputs) {
    const res = await smartMatchTemplate(tc.text);
    const pass = res.matched && res.score >= 60 && res.template?.model_name === tc.expected;
    recordTest(
      'FalseNegative',
      `Valid laptop: "${tc.expected}" in natural VN text -> MATCH (>=60)`,
      pass,
      { score: res.score, matched: res.matched, matchedModel: res.template?.model_name, reasons: res.match_reasons }
    );
  }

  // ==========================================================================
  // SECTION 7: CIRCULAR QUEUE & ANTI-SPAM REWRITE VARIATIONS
  // ==========================================================================
  console.log('\n--- SECTION 7: CIRCULAR QUEUE & ANTI-SPAM REWRITE VARIATIONS ---');

  const sampleTemplate = {
    model_name: 'Dell Latitude 5350',
    standard_config: 'Ultra 5 / 16GB / 256GB SSD / 13.3" IPS Chống chói',
    price_display: '13.9 triệu'
  };

  const styles = ['featured_review', 'flash_sale', 'curated_pick', 'value_champion'];
  const generatedCopies = {};

  for (const style of styles) {
    const copy = generateRotatingRewriteCopy(sampleTemplate, style);
    generatedCopies[style] = copy;
  }

  // 7.1 Verify all styles produce non-empty strings
  for (const style of styles) {
    const copy = generatedCopies[style];
    const pass = typeof copy === 'string' && copy.length > 200;
    recordTest('CircularAntiSpam', `Rewrite style "${style}" produces substantial content (>200 chars)`, pass, {
      length: copy?.length
    });
  }

  // 7.2 Verify distinct opening hooks
  const hooks = {
    flash_sale: '🔥 [TIÊU ĐIỂM GIÁ TỐT]',
    curated_pick: '🌟 [HÀNG TUYỂN CHỌN LOẠI A]',
    value_champion: '🏆 [LỰA CHỌN THỰC CHIẾN SỐ 1]',
    featured_review: '✨ [REVIEW CHI TIẾT DÒNG MÁY]'
  };

  for (const [style, hook] of Object.entries(hooks)) {
    const copy = generatedCopies[style];
    const pass = copy.includes(hook);
    recordTest('CircularAntiSpam', `Rewrite style "${style}" contains unique hook "${hook}"`, pass);
  }

  // 7.3 Verify pairwise distinctness across all 4 styles
  let pairwiseDistinct = true;
  for (let i = 0; i < styles.length; i++) {
    for (let j = i + 1; j < styles.length; j++) {
      const copy1 = generatedCopies[styles[i]];
      const copy2 = generatedCopies[styles[j]];
      if (copy1 === copy2) {
        pairwiseDistinct = false;
        console.error(`Collision detected between ${styles[i]} and ${styles[j]}`);
      }
    }
  }
  recordTest('CircularAntiSpam', 'All 4 rewrite styles are pairwise distinct (0% verbatim overlap)', pairwiseDistinct);

  // 7.4 Verify temporary lot codes are NEVER present in circular rewrite
  let noLotCodes = true;
  const lotPatterns = [/#\d+/, /lô\s*\d+/i, /mã\s*máy\s*#?\d+/i];
  for (const style of styles) {
    const copy = generatedCopies[style];
    for (const pat of lotPatterns) {
      if (pat.test(copy)) {
        noLotCodes = false;
        console.error(`Lot pattern ${pat} found in style ${style}!`);
      }
    }
  }
  recordTest('CircularAntiSpam', 'Generated circular copies strictly contain NO temporary lot codes', noLotCodes);

  // ==========================================================================
  // FINAL SUMMARY
  // ==========================================================================
  console.log('\n================================================================');
  console.log(`CHALLENGER 2 TEST SUITE SUMMARY:`);
  console.log(`  Total Test Cases : ${results.total}`);
  console.log(`  Passed           : ${results.passed}`);
  console.log(`  Failed           : ${results.failed}`);
  console.log(`  Pass Rate        : ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    console.log('⚠️ Some tests failed. Review details above.');
    process.exit(1);
  } else {
    console.log('🎉 ALL EMPIRICAL CHALLENGER TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  }
}

runAdversarialSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
