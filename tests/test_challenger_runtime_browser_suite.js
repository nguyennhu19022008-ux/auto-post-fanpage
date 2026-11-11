/**
 * Challenger 1 (challenger_runtime_browser)
 * Comprehensive Adversarial & Empirical Test Suite
 * Target: Web Dashboard client runtime, Slide 0 lifecycle, Cockpit interactions, Multi-channel buttons, Image integrity
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_HTML_PATH = path.join(ROOT_DIR, 'public', 'index.html');
const APP_HTML_PATH = path.join(ROOT_DIR, 'public', 'app.html');
const APP_JS_PATH = path.join(ROOT_DIR, 'public', 'js', 'app.js');
const STYLE_CSS_PATH = path.join(ROOT_DIR, 'public', 'css', 'style.css');
const SW_JS_PATH = path.join(ROOT_DIR, 'public', 'sw.js');
const TEMPLATES_JSON_PATH = path.join(ROOT_DIR, 'data', 'model_templates.json');

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  suites: []
};

function assert(condition, testName, details = '') {
  testResults.total++;
  if (condition) {
    testResults.passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    testResults.failed++;
    console.error(`  [FAIL] ${testName} ${details ? '(' + details + ')' : ''}`);
  }
}

function startSuite(suiteName) {
  console.log(`\n======================================================`);
  console.log(`SUITE: ${suiteName}`);
  console.log(`======================================================`);
}

async function runAllTests() {
  const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');
  const appHtml = fs.readFileSync(APP_HTML_PATH, 'utf8');
  const appJs = fs.readFileSync(APP_JS_PATH, 'utf8');
  const styleCss = fs.readFileSync(STYLE_CSS_PATH, 'utf8');
  const swJs = fs.readFileSync(SW_JS_PATH, 'utf8');
  const templates = JSON.parse(fs.readFileSync(TEMPLATES_JSON_PATH, 'utf8'));

  // ----------------------------------------------------
  // SUITE 1: Slide 0 Lifecycle & Aesthetic Conformance
  // ----------------------------------------------------
  startSuite('1. Slide 0 Lifecycle & Aesthetic Conformance');
  
  // 1.1 Modal structure
  assert(indexHtml.includes('id="slide0Modal"'), 'slide0Modal container exists in DOM');
  assert(indexHtml.includes('bg-[#000000] text-[#FFFFFF]'), 'slide0Modal has OLED #000000 background and #FFFFFF text');
  
  // 1.2 Monochrome check: no amber/yellow/purple/blue/green color slop inside Slide 0
  const slide0Block = indexHtml.match(/id="slide0Modal"[\s\S]*?<!-- ======================== MAIN DASHBOARD/);
  assert(!!slide0Block, 'Slide 0 block extracted cleanly');
  if (slide0Block) {
    const colorSlop = slide0Block[0].match(/text-(amber|yellow|blue|red|purple|indigo|green|emerald)-\d+/gi);
    assert(!colorSlop || colorSlop.length === 0, 'Slide 0 is 100% Monochrome OLED (0 color text slop classes)', colorSlop ? colorSlop.join(', ') : '');
  }

  // 1.3 Wallpaper Marquee
  assert(indexHtml.includes('class="slide0-bg-wall"'), 'slide0-bg-wall container exists');
  const marqueeRows = indexHtml.match(/<div class="slide0-row">[\s\S]*?<\/div>/g);
  assert(marqueeRows && marqueeRows.length === 5, 'Exactly 5 rows in typography wallpaper', `Found ${marqueeRows ? marqueeRows.length : 0}`);
  if (marqueeRows) {
    const allHaveText = marqueeRows.every(r => r.includes('DESIGN BY VUONGGIA'));
    assert(allHaveText, 'All 5 wallpaper rows contain "DESIGN BY VUONGGIA" text');
  }

  // 1.4 CSS Styling for wallpaper: rotate(-32deg)
  assert(styleCss.includes('.slide0-bg-wall {') && styleCss.includes('transform: rotate(-32deg);'), 'slide0-bg-wall has CSS transform rotate(-32deg)');
  assert(styleCss.includes('animation: marquee 65s linear infinite;'), 'slide0-row has 65s marquee animation');
  assert(styleCss.includes('animation-duration: 72s;'), 'slide0-row:nth-child(even) has 72s reverse marquee animation');

  // 1.5 Certificate Card & Intellectual Property
  assert(indexHtml.includes('id="slide0Card"'), 'Central frosted glass card #slide0Card exists');
  assert(indexHtml.includes('DESIGN BY <span class="bg-white text-black px-3 py-0.5 inline-block -skew-x-6">VUONGGIA</span>'), 'Card has skewed VUONGGIA logo tag');
  assert(indexHtml.includes('THUỘC QUYỀN SỞ HỮU CỦA VUONGGIA'), 'Card has ownership badge "THUỘC QUYỀN SỞ HỮU CỦA VUONGGIA"');
  assert(indexHtml.includes('TUYỆT ĐỐI KHÔNG THƯƠNG MẠI, MUA BÁN, SANG NHƯỢNG DƯỚI MỌI HÌNH THỨC SAU KHI ĐÃ SỞ HỮU'), 'Card contains strict non-commercial clause verbatim');

  // 1.6 Contact copy buttons
  assert(indexHtml.includes("copySlide0Contact('nguyennhu19022008@gmail.com', this)"), 'Email copy button bound with nguyennhu19022008@gmail.com');
  assert(indexHtml.includes("copySlide0Contact('0876637806', this)"), 'Hotline copy button bound with 0876637806');
  assert(appJs.includes('function copySlide0Contact('), 'copySlide0Contact function exists in app.js');

  // 1.7 Toggle Card & Floating bar
  assert(indexHtml.includes('id="slide0FloatingBar"'), '#slide0FloatingBar element exists');
  assert(indexHtml.includes('onclick="toggleSlide0Card(false)"'), 'Close X button triggers toggleSlide0Card(false)');
  assert(indexHtml.includes('onclick="toggleSlide0Card(true)"'), 'Floating bar has button triggering toggleSlide0Card(true)');
  assert(appJs.includes('function toggleSlide0Card('), 'toggleSlide0Card function defined in app.js');

  // 1.8 Keyboard navigation shortcuts & Dock hiding
  assert(appJs.includes("e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' '"), 'Keyboard shortcuts (ArrowRight, Enter, Space) wired to closeSlide0Modal');
  assert(appJs.includes("dock.classList.add('hidden')") && appJs.includes("dock.classList.remove('hidden')"), 'Navbar / Dock is hidden during Slide 0 and restored upon closing');
  assert(appJs.includes("document.body.classList.add('overflow-hidden')") && appJs.includes("document.body.classList.remove('overflow-hidden')"), 'Body overflow-hidden managed correctly during Slide 0');

  // ----------------------------------------------------
  // SUITE 2: Cockpit Interactions & ReferenceError Elimination
  // ----------------------------------------------------
  startSuite('2. Cockpit Interactions & ReferenceError Elimination');

  // 2.1 openPostPreviewModal Alias Definition (D1)
  assert(appJs.includes('function openPostPreviewModal(postId) {'), 'openPostPreviewModal helper function defined');
  assert(appJs.includes('window.openPostPreviewModal = viewQueuedPostContent;'), 'window.openPostPreviewModal alias globally assigned to viewQueuedPostContent');
  assert(appJs.includes('function viewQueuedPostContent(postId) {'), 'viewQueuedPostContent core renderer exists');

  // 2.2 Next Post Preview Button Binding
  assert(indexHtml.includes('id="cockpitViewNextBtn"'), 'cockpitViewNextBtn exists in index.html');
  assert(appJs.includes("viewBtn.onclick = () => openPostPreviewModal(nextPost.id);"), 'cockpitViewNextBtn wired to openPostPreviewModal in loadCockpitStatus');

  // 2.3 Timeline Row "👁️ Xem" Button Binding
  assert(appJs.includes('function renderCockpitTimeline(posts) {'), 'renderCockpitTimeline function exists');
  assert(appJs.includes('openPostPreviewModal(\'${post.id}\')'), 'Timeline rows render openPostPreviewModal button');

  // 2.4 Preview Modal Elements
  const previewModalIds = [
    'postPreviewModal', 'previewModalTitle', 'previewModalMeta',
    'previewModalMedia', 'previewModalContent', 'previewModalActions', 'previewModalExtraActions'
  ];
  previewModalIds.forEach(id => {
    assert(indexHtml.includes(`id="${id}"`), `Modal element #${id} present in index.html`);
  });

  // ----------------------------------------------------
  // SUITE 3: Multi-Channel Publishing Action Buttons
  // ----------------------------------------------------
  startSuite('3. Multi-Channel Publishing Action Buttons');

  // 3.1 Cockpit Next Post Card: '👤 Cá Nhân' (D2)
  assert(indexHtml.includes('id="cockpitPublishPersonalBtn"'), '#cockpitPublishPersonalBtn present in index.html');
  assert(appJs.includes("personalBtn.onclick = () => publishPostNow(nextPost.id, 'personal');"), 'cockpitPublishPersonalBtn wired to publishPostNow(nextPost.id, "personal")');

  // 3.2 Cockpit Next Post Card: '🚀 Đăng Cả Hai' & '⚡ Fanpage'
  assert(indexHtml.includes('id="cockpitPublishBothBtn"'), '#cockpitPublishBothBtn present in index.html');
  assert(indexHtml.includes('id="cockpitPublishNowBtn"'), '#cockpitPublishNowBtn present in index.html');
  assert(appJs.includes("publishBothBtn.onclick = () => publishPostNow(nextPost.id, 'both');"), 'cockpitPublishBothBtn wired to publishPostNow(nextPost.id, "both")');
  assert(appJs.includes("publishBtn.onclick = () => publishPostNow(nextPost.id, 'fanpage');"), 'cockpitPublishNowBtn wired to publishPostNow(nextPost.id, "fanpage")');

  // 3.3 Cockpit Timeline Row Buttons (D3)
  assert(appJs.includes("publishPostNow('${post.id}', 'personal')"), 'Timeline rows contain "👤 Cá Nhân" button');
  assert(appJs.includes("publishPostNow('${post.id}', 'both')"), 'Timeline rows contain "🚀 Cả Hai" button');
  assert(appJs.includes("publishPostNow('${post.id}', 'fanpage')"), 'Timeline rows contain "⚡ Fanpage" button');

  // 3.4 Compose Modal (Manual Post Modal) Buttons (D4)
  assert(indexHtml.includes("schedulePost(true, 'personal')"), 'Compose Modal contains "👤 ĐĂNG CÁ NHÂN" button');
  assert(indexHtml.includes("schedulePost(true, 'both')"), 'Compose Modal contains "🚀 ĐĂNG CẢ HAI" button');
  assert(indexHtml.includes("schedulePost(true, 'fanpage')"), 'Compose Modal contains "⚡ ĐĂNG FANPAGE" button');
  assert(indexHtml.includes("schedulePost(false, 'queue')"), 'Compose Modal contains "📅 ĐƯA VÀO HÀNG ĐỢI" button');

  // 3.5 Personal post isolation from Fanpage API
  assert(appJs.includes("const shouldPublishImmediately = publishImmediately && target !== 'personal';"), 'schedulePost prevents Fanpage immediate publish when target is "personal"');
  assert(appJs.includes("if (target === 'both' || target === 'fanpage') {"), 'publishPostNow only calls /publish-now when target is both or fanpage');
  assert(appJs.includes("action: 'VG_TRIGGER_PERSONAL_POST'"), 'Web Bridge postMessage VG_TRIGGER_PERSONAL_POST emitted for personal target');

  // ----------------------------------------------------
  // SUITE 4: Image Integrity & Model Template Health
  // ----------------------------------------------------
  startSuite('4. Image Integrity & Model Template Health');

  assert(templates.length >= 8, `Model templates loaded (total ${templates.length})`);
  
  // 4.1 Banned bad URL IDs (D5)
  const bannedIds = ['1793880993077', '1793880993717'];
  const rawTemplates = fs.readFileSync(TEMPLATES_JSON_PATH, 'utf8');
  bannedIds.forEach(badId => {
    assert(!rawTemplates.includes(badId), `Deleted bad image URL ID ${badId} is NOT present in model_templates.json`);
  });

  // 4.2 HP EliteBook 630 G9 validation
  const hp630 = templates.find(t => t.id === 'tpl_hp_elitebook_630_g9');
  assert(!!hp630, 'HP EliteBook 630 G9 template exists');
  if (hp630) {
    const urls = (hp630.media_files || []).map(m => m.url);
    assert(urls.length === 2, `HP 630 has exactly 2 clean media files (found ${urls.length})`);
    urls.forEach(u => {
      assert(u.startsWith('https://') && u.includes('supabase.co'), `HP 630 media URL is valid Supabase HTTPS: ${u.split('/').pop()}`);
    });
  }

  // ----------------------------------------------------
  // SUITE 5: Technical Layout, Bundling & Cache Parity
  // ----------------------------------------------------
  startSuite('5. Technical Layout, Bundling & Cache Parity');

  // 5.1 HTML Parity
  assert(indexHtml === appHtml, 'public/index.html and public/app.html are 100% byte-for-byte identical');

  // 5.2 Script tag location (D6)
  const scriptPos = indexHtml.indexOf('<script src="/js/app.js?v=20261111_v16_dual_personal_robot" defer></script>');
  const bodyClosePos = indexHtml.indexOf('</body>');
  assert(scriptPos > 0 && bodyClosePos > 0 && scriptPos < bodyClosePos, '<script src="/js/app.js"> placed before </body> with defer attribute');

  // 5.3 Service Worker Cache Version (D7)
  assert(swJs.includes("CACHE_NAME = 'vg-laptop-app-v16'"), 'Service Worker CACHE_NAME is vg-laptop-app-v16');
  assert(swJs.includes('20261111_v16_dual_personal_robot'), 'Service Worker cache assets use query v=20261111_v16_dual_personal_robot');

  // ----------------------------------------------------
  // SUMMARY
  // ----------------------------------------------------
  console.log(`\n======================================================`);
  console.log(`TOTAL TESTS: ${testResults.total}`);
  console.log(`PASSED:      ${testResults.passed}`);
  console.log(`FAILED:      ${testResults.failed}`);
  console.log(`======================================================`);

  if (testResults.failed > 0) {
    console.error(`\nFAILED TESTS DETECTED: ${testResults.failed}`);
    process.exit(1);
  } else {
    console.log(`\nALL ${testResults.passed} EMPIRICAL ASSERTIONS PASSED!`);
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error in test runner:', err);
  process.exit(1);
});
