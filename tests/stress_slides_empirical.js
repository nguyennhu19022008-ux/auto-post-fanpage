/**
 * Empirical Stress Test Harness for public/slides.html
 * Author: challenger_slides_1
 * Date: 2026-11-07
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SLIDES_PATH = path.join(ROOT_DIR, 'public', 'slides.html');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'public', 'evidence');

const EXPECTED_IMAGES = [
  'coc_200k_thuy_nhung.jpg',
  'coc_500k_thanhvu.jpg',
  'chuyenkhoan_1tr_thanhvu.jpg',
  'chuyenkhoan_300k_kimhoa.jpg',
  'chat_hocsinh_nguyen_thua.jpg',
  'chat_thay_quang_toan_gv.jpg',
  'chat_phuhuynh_co_le_ghi.jpg',
  'chat_tran_quoc_khanh_fb.jpg',
  'chat_khach_a_mau_hinh_that.jpg',
  'chat_phan_trieu_messenger.jpg'
];

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  findings: []
};

function assert(condition, testName, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  [PASS] ${testName}`);
  } else {
    results.failed++;
    console.error(`  [FAIL] ${testName} ${details ? '- ' + details : ''}`);
    results.findings.push({ testName, details, severity: 'ERROR' });
  }
}

function recordFinding(title, details, severity = 'WARNING') {
  console.log(`  [${severity}] ${title}: ${details}`);
  results.findings.push({ testName: title, details, severity });
}

async function runSuite1_AssetsAndNetwork() {
  console.log('\n======================================================');
  console.log('SUITE 1: Automated Asset & Network Verification');
  console.log('======================================================');

  // 1.1 slides.html existence and readability
  assert(fs.existsSync(SLIDES_PATH), 'slides.html exists');
  const slidesContent = fs.readFileSync(SLIDES_PATH, 'utf8');
  assert(slidesContent.length > 10000, 'slides.html is non-empty and substantial (>10KB)', `Size: ${slidesContent.length} bytes`);

  // 1.2 Parse all <img src="..."> in slides.html
  const imgSrcRegex = /<img[^>]+src=["']([^"']+)["']/gi;
  const foundImages = [];
  let match;
  while ((match = imgSrcRegex.exec(slidesContent)) !== null) {
    foundImages.push(match[1]);
  }
  console.log(`  Found ${foundImages.length} <img> tags in slides.html:`, foundImages);
  assert(foundImages.length >= 10, 'slides.html contains at least 10 image references', `Found ${foundImages.length}`);

  // 1.3 Verify each of the 10 target images on disk
  for (const imgName of EXPECTED_IMAGES) {
    const fullPath = path.join(EVIDENCE_DIR, imgName);
    const exists = fs.existsSync(fullPath);
    assert(exists, `Image file on disk: ${imgName}`);
    if (exists) {
      const stats = fs.statSync(fullPath);
      const isOver50KB = stats.size > 50 * 1024;
      assert(isOver50KB, `Image size > 50KB: ${imgName}`, `Size: ${stats.size} bytes (${(stats.size/1024).toFixed(1)} KB)`);
    }

    // Verify it is referenced in HTML
    const isReferenced = foundImages.some(src => src.includes(imgName));
    assert(isReferenced, `Image is referenced in slides.html: ${imgName}`);
  }

  // 1.4 Network verification via HTTP Server
  console.log('\n  Starting HTTP Server for Network Verification...');
  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];
    if (reqPath === '/' || reqPath === '/slides.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(slidesContent);
      return;
    }
    if (reqPath.startsWith('/evidence/')) {
      const filename = path.basename(reqPath);
      const filePath = path.join(EVIDENCE_DIR, filename);
      if (fs.existsSync(filePath)) {
        res.writeHead(200, { 'Content-Type': 'image/jpeg' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  console.log(`  Local test HTTP server listening on port ${port}`);

  // Helper for HTTP GET
  function httpGet(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
        let chunks = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: Buffer.concat(chunks)
          });
        });
      }).on('error', reject);
    });
  }

  // Test slides.html via HTTP
  const slidesRes = await httpGet('/slides.html');
  assert(slidesRes.statusCode === 200, 'HTTP GET /slides.html returns 200 OK');
  assert(slidesRes.body.length === Buffer.byteLength(slidesContent), 'HTTP GET /slides.html payload length matches disk');

  // Test all 10 images via HTTP
  for (const imgName of EXPECTED_IMAGES) {
    const imgRes = await httpGet(`/evidence/${imgName}`);
    assert(imgRes.statusCode === 200, `HTTP GET /evidence/${imgName} returns 200 OK`);
    assert(imgRes.headers['content-type'] === 'image/jpeg', `HTTP GET /evidence/${imgName} Content-Type is image/jpeg`);
    assert(imgRes.body.length > 50 * 1024, `HTTP GET /evidence/${imgName} body length > 50KB (${(imgRes.body.length/1024).toFixed(1)} KB)`);
  }

  // Test 404 for nonexistent image
  const notFoundRes = await httpGet('/evidence/non_existent_image.jpg');
  assert(notFoundRes.statusCode === 404, 'HTTP GET non-existent asset returns 404');

  await new Promise((resolve) => server.close(resolve));
  console.log('  HTTP test server closed successfully.');
}

async function runSuite2_DOMAndJSSyntax() {
  console.log('\n======================================================');
  console.log('SUITE 2: DOM & JavaScript Syntax Validation');
  console.log('======================================================');

  const slidesContent = fs.readFileSync(SLIDES_PATH, 'utf8');

  // 2.1 Extract and validate JS syntax in all <script> tags
  const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let scriptMatch;
  let scriptIndex = 0;
  while ((scriptMatch = scriptRegex.exec(slidesContent)) !== null) {
    const scriptCode = scriptMatch[1].trim();
    if (!scriptCode) continue; // External script like Tailwind CDN
    scriptIndex++;
    try {
      new vm.Script(scriptCode, { filename: `slides_script_${scriptIndex}.js` });
      assert(true, `Inline <script #${scriptIndex}> compiles with zero syntax errors`);
    } catch (err) {
      assert(false, `Inline <script #${scriptIndex}> compiles with zero syntax errors`, err.message);
    }
  }

  // 2.2 Verify DOM slide structure: <section id="slide-0"> through <section id="slide-9">
  for (let i = 0; i <= 9; i++) {
    const slideId = `slide-${i}`;
    const idRegex = new RegExp(`<section[^>]*id=["']${slideId}["'][^>]*>`, 'i');
    const hasSection = idRegex.test(slidesContent);
    assert(hasSection, `DOM structure contains <section id="${slideId}">`);

    // Verify has class slide-frame
    if (hasSection) {
      const matchTag = slidesContent.match(new RegExp(`<section[^>]*id=["']${slideId}["'][^>]*>`, 'i'))[0];
      const hasClass = matchTag.includes('slide-frame');
      assert(hasClass, `<section id="${slideId}"> has class 'slide-frame'`);
    }
  }

  // 2.3 Verify unclosed tags for major block elements
  const tagsToCheck = ['section', 'script', 'style'];
  for (const tag of tagsToCheck) {
    const openCount = (slidesContent.match(new RegExp(`<${tag}\\b`, 'gi')) || []).length;
    const closeCount = (slidesContent.match(new RegExp(`</${tag}>`, 'gi')) || []).length;
    assert(openCount === closeCount, `Balanced <${tag}> tags (Open: ${openCount}, Close: ${closeCount})`);
  }

  // 2.4 Verify Slide 0 conformity (DESIGN BY VUONGGIA)
  console.log('\n  Verifying Slide 0 (DESIGN BY VUONGGIA) specifications:');
  const slide0Match = slidesContent.match(/<section[^>]*id=["']slide-0["'][\s\S]*?<\/section>/i);
  assert(Boolean(slide0Match), 'Slide 0 block extracted');
  if (slide0Match) {
    const s0Content = slide0Match[0];
    assert(s0Content.includes('DESIGN BY VUONGGIA'), 'Slide 0 contains "DESIGN BY VUONGGIA"');
    assert(s0Content.includes('slide0-marquee-container'), 'Slide 0 contains marquee container');
    assert(s0Content.includes('slide0-marquee-row'), 'Slide 0 contains marquee rows');
    
    // Check 5 marquee rows
    const rowMatches = (s0Content.match(/class=["'][^"']*slide0-marquee-row/gi) || []).length;
    assert(rowMatches === 5, 'Slide 0 has exactly 5 marquee rows', `Found ${rowMatches}`);

    // Check Copyright table details
    assert(s0Content.includes('slide0CertificateCard'), 'Slide 0 contains #slide0CertificateCard');
    assert(s0Content.includes('THUỘC QUYỀN SỞ HỮU CỦA VUONGGIA'), 'Slide 0 contains ownership badge text');
    assert(s0Content.includes('nguyennhu19022008@gmail.com'), 'Slide 0 contains email contact');
    assert(s0Content.includes('0876637806'), 'Slide 0 contains phone contact');
    assert(s0Content.includes('toggleSlide0Card(false)'), 'Slide 0 contains dismiss close button');
    assert(s0Content.includes('slide0FloatingActions'), 'Slide 0 contains floating actions bar');
    assert(s0Content.includes('nextSlide()') || s0Content.includes('showSlide(1)'), 'Slide 0 contains CTA button to continue');
  }
}

async function runSuite3_StateMachineStressTest() {
  console.log('\n======================================================');
  console.log('SUITE 3: Slide Navigation State Machine Stress Test');
  console.log('======================================================');

  const slidesContent = fs.readFileSync(SLIDES_PATH, 'utf8');

  // Extract application script (the main script block)
  const scriptRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
  let mainScriptCode = '';
  let m;
  while ((m = scriptRegex.exec(slidesContent)) !== null) {
    if (m[1].includes('currentSlide') && m[1].includes('showSlide')) {
      mainScriptCode = m[1];
      break;
    }
  }
  assert(Boolean(mainScriptCode), 'Found main navigation script block');

  // Build a lightweight DOM Mock
  class MockElement {
    constructor(id = '', tagName = 'div') {
      this.id = id;
      this.tagName = tagName.toUpperCase();
      this._classes = new Set();
      this.style = {};
      this.innerText = '';
      this.src = '';
      const self = this;
      this.classList = {
        add: (...classes) => {
          classes.forEach(c => self._classes.add(c));
        },
        remove: (...classes) => {
          classes.forEach(c => self._classes.delete(c));
        },
        contains: (c) => self._classes.has(c)
      };
    }
  }

  const elementsMap = new Map();
  function getOrCreateElement(id, tagName = 'div') {
    if (!elementsMap.has(id)) {
      const el = new MockElement(id, tagName);
      elementsMap.set(id, el);
    }
    return elementsMap.get(id);
  }

  // Pre-create slide elements slide-0 to slide-9
  const slideFrames = [];
  for (let i = 0; i <= 9; i++) {
    const slideEl = getOrCreateElement(`slide-${i}`, 'section');
    slideEl.classList.add('slide-frame');
    if (i === 0) slideEl.classList.add('active');
    slideFrames.push(slideEl);
  }

  // Pre-create other required DOM elements
  const dock = getOrCreateElement('slideDock');
  const slideDisplay = getOrCreateElement('currentSlideDisplay');
  const toast = getOrCreateElement('copyToast');
  const timerDisplay = getOrCreateElement('timerDisplay');
  const timerBtn = getOrCreateElement('timerBtn');
  const overviewModal = getOrCreateElement('overviewModal');
  overviewModal.classList.add('hidden');
  const evidenceLightboxModal = getOrCreateElement('evidenceLightboxModal');
  evidenceLightboxModal.classList.add('hidden');
  const lightboxImg = getOrCreateElement('lightboxImg', 'img');
  const lightboxTitle = getOrCreateElement('lightboxTitle');
  const lightboxCaption = getOrCreateElement('lightboxCaption');
  const slide0CertificateCard = getOrCreateElement('slide0CertificateCard');
  const slide0FloatingActions = getOrCreateElement('slide0FloatingActions');
  slide0FloatingActions.classList.add('hidden');

  const listeners = {};

  const mockWindow = {
    addEventListener: (event, handler) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
    }
  };

  const mockDocument = {
    getElementById: (id) => elementsMap.get(id) || null,
    querySelectorAll: (selector) => {
      if (selector === '.slide-frame') {
        return slideFrames;
      }
      return [];
    },
    fullscreenElement: null,
    documentElement: {
      requestFullscreen: async () => {}
    },
    exitFullscreen: async () => {}
  };

  const mockNavigator = {
    clipboard: {
      writeText: async () => {}
    }
  };

  const sandbox = {
    window: mockWindow,
    document: mockDocument,
    navigator: mockNavigator,
    console: console,
    setTimeout: (fn, delay) => setTimeout(fn, delay),
    setInterval: (fn, delay) => setInterval(fn, delay),
    clearInterval: (id) => clearInterval(id),
    String: String,
    Math: Math
  };

  vm.createContext(sandbox);

  // Execute main script in sandbox
  try {
    vm.runInContext(mainScriptCode, sandbox);
    assert(true, 'Main navigation script executes without unhandled errors');
  } catch (err) {
    assert(false, 'Main navigation script executes without unhandled errors', err.message);
  }

  // Helper to read lexical scope variables inside VM context
  const getContextVar = (name) => vm.runInContext(name, sandbox);
  const getActiveSlideIndex = () => {
    for (let i = 0; i <= 9; i++) {
      if (elementsMap.get(`slide-${i}`).classList.contains('active')) return i;
    }
    return -1;
  };

  // 3.1 Verify existence of goToSlide vs showSlide
  console.log('\n  Checking navigation function signatures:');
  const hasShowSlide = typeof sandbox.showSlide === 'function';
  const hasGoToSlide = typeof sandbox.goToSlide === 'function';
  const hasJumpToSlide = typeof sandbox.jumpToSlide === 'function';
  const hasNextSlide = typeof sandbox.nextSlide === 'function';
  const hasPrevSlide = typeof sandbox.prevSlide === 'function';

  assert(hasShowSlide, 'showSlide function is defined');
  assert(hasNextSlide, 'nextSlide function is defined');
  assert(hasPrevSlide, 'prevSlide function is defined');
  assert(hasJumpToSlide, 'jumpToSlide function is defined');

  if (!hasGoToSlide) {
    recordFinding(
      'goToSlide alias missing',
      'The code defines showSlide(n) and jumpToSlide(n), but does NOT define goToSlide(n). Adding `window.goToSlide = showSlide;` would provide full compatibility with external orchestrator commands and standard slide controllers.',
      'NOTICE'
    );
  } else {
    assert(true, 'goToSlide is defined');
  }

  // 3.2 Test boundary clamping on showSlide / jumpToSlide
  console.log('\n  Testing boundary clamping with showSlide:');
  const navFn = sandbox.showSlide;

  // Clamping lower bound: n = -2, -1, 0
  navFn(-2);
  assert(getContextVar('currentSlide') === 0, 'showSlide(-2) clamps currentSlide to 0', `Actual: ${getContextVar('currentSlide')}`);
  assert(getActiveSlideIndex() === 0, 'slide-0 has active class at boundary -2');
  assert(dock.style.display === 'none', 'Dock is hidden at Slide 0');

  navFn(-1);
  assert(getContextVar('currentSlide') === 0, 'showSlide(-1) clamps currentSlide to 0', `Actual: ${getContextVar('currentSlide')}`);

  navFn(0);
  assert(getContextVar('currentSlide') === 0, 'showSlide(0) sets currentSlide to 0');
  assert(getActiveSlideIndex() === 0, 'slide-0 is active at Slide 0');
  assert(dock.style.display === 'none', 'Dock remains hidden at Slide 0');

  // Transition: 0 to 1
  navFn(1);
  assert(getContextVar('currentSlide') === 1, 'showSlide(1) transitions to Slide 1');
  assert(getActiveSlideIndex() === 1, 'slide-1 has active class');
  assert(!elementsMap.get('slide-0').classList.contains('active'), 'slide-0 active class removed');
  assert(dock.style.display === 'flex', 'Dock is visible at Slide 1');
  assert(slideDisplay.innerText === '01', 'slideDisplay shows "01" at Slide 1', `Actual: ${slideDisplay.innerText}`);

  // Transition: 1 to 9
  navFn(9);
  assert(getContextVar('currentSlide') === 9, 'showSlide(9) transitions to Slide 9');
  assert(getActiveSlideIndex() === 9, 'slide-9 has active class');
  assert(slideDisplay.innerText === '09', 'slideDisplay shows "09" at Slide 9');

  // Upper boundary clamping: 10, 15
  navFn(10);
  assert(getContextVar('currentSlide') === 9, 'showSlide(10) clamps currentSlide to 9', `Actual: ${getContextVar('currentSlide')}`);

  navFn(15);
  assert(getContextVar('currentSlide') === 9, 'showSlide(15) clamps currentSlide to 9', `Actual: ${getContextVar('currentSlide')}`);

  // nextSlide() boundary test: at slide 9, nextSlide() should not exceed 9
  sandbox.nextSlide();
  assert(getContextVar('currentSlide') === 9, 'nextSlide() at slide 9 stays at 9 (no overflow)');

  // prevSlide() boundary test: jump to 0, then prevSlide() should not drop below 0
  navFn(0);
  sandbox.prevSlide();
  assert(getContextVar('currentSlide') === 0, 'prevSlide() at slide 0 stays at 0 (no underflow)');

  // 3.3 Adversarial inputs to showSlide
  console.log('\n  Adversarial inputs to showSlide:');
  // String numeric "5"
  navFn("5");
  assert(getContextVar('currentSlide') == 5, 'showSlide("5") accepts numeric string or handles gracefully');

  // NaN or undefined
  try {
    navFn(NaN);
    const curr = getContextVar('currentSlide');
    if (Number.isNaN(curr)) {
      recordFinding(
        'showSlide(NaN) unprotected',
        'Passing NaN to showSlide sets currentSlide to NaN because NaN comparisons (NaN < 0, NaN > 9) evaluate to false in JS. A defensive check `if (isNaN(index)) return;` or `index = Number(index) || 0;` would harden against invalid input.',
        'WARNING'
      );
    } else {
      assert(true, 'showSlide(NaN) safely guarded');
    }
  } catch (err) {
    assert(false, 'showSlide(NaN) threw an unexpected exception', err.message);
  }
  navFn(0); // reset back to 0

  // 3.4 Keyboard Event Dispatch Stress Test
  console.log('\n  Keyboard event dispatch stress test:');
  const keydownHandlers = listeners['keydown'] || [];
  assert(keydownHandlers.length > 0, 'Global window keydown listener registered');

  function simulateKey(key, modifiers = {}) {
    let prevented = false;
    const evt = {
      key,
      ctrlKey: Boolean(modifiers.ctrlKey),
      metaKey: Boolean(modifiers.metaKey),
      altKey: Boolean(modifiers.altKey),
      shiftKey: Boolean(modifiers.shiftKey),
      preventDefault: () => { prevented = true; }
    };
    for (const h of keydownHandlers) {
      h(evt);
    }
    return { prevented };
  }

  // Test ArrowRight from 0 -> 1
  navFn(0);
  const rRes = simulateKey('ArrowRight');
  assert(getContextVar('currentSlide') === 1, 'ArrowRight advances slide from 0 to 1', `Actual: ${getContextVar('currentSlide')}`);
  assert(rRes.prevented, 'ArrowRight default action was prevented');

  // Test Space from 1 -> 2
  const spRes = simulateKey(' ');
  assert(getContextVar('currentSlide') === 2, 'Space advances slide from 1 to 2', `Actual: ${getContextVar('currentSlide')}`);
  assert(spRes.prevented, 'Space default action was prevented');

  // Test Enter from 2 -> 3
  const entRes = simulateKey('Enter');
  assert(getContextVar('currentSlide') === 3, 'Enter advances slide from 2 to 3', `Actual: ${getContextVar('currentSlide')}`);
  assert(entRes.prevented, 'Enter default action was prevented');

  // Test ArrowLeft from 3 -> 2
  const leftRes = simulateKey('ArrowLeft');
  assert(getContextVar('currentSlide') === 2, 'ArrowLeft decrements slide from 3 to 2', `Actual: ${getContextVar('currentSlide')}`);
  assert(leftRes.prevented, 'ArrowLeft default action was prevented');

  // Test End -> 9
  simulateKey('End');
  assert(getContextVar('currentSlide') === 9, 'End key navigates to final slide 9', `Actual: ${getContextVar('currentSlide')}`);

  // Test Home -> 0
  simulateKey('Home');
  assert(getContextVar('currentSlide') === 0, 'Home key navigates to Slide 0', `Actual: ${getContextVar('currentSlide')}`);

  // Test Lightbox Escape close
  evidenceLightboxModal.classList.remove('hidden');
  assert(!evidenceLightboxModal.classList.contains('hidden'), 'Lightbox opened');
  simulateKey('Escape');
  assert(evidenceLightboxModal.classList.contains('hidden'), 'Escape key closes Lightbox');

  // Test Overview modal toggle with O and Escape
  overviewModal.classList.add('hidden');
  simulateKey('o');
  assert(!overviewModal.classList.contains('hidden'), 'Key "o" opens Overview modal');
  simulateKey('Escape');
  assert(overviewModal.classList.contains('hidden'), 'Escape key closes Overview modal');

  // Test Timer toggle with T
  const initialTimerRunning = getContextVar('isTimerRunning');
  simulateKey('t');
  assert(getContextVar('isTimerRunning') !== initialTimerRunning, 'Key "t" toggles 8-minute presentation timer');
  simulateKey('t'); // toggle off
  if (sandbox.timerInterval) clearInterval(sandbox.timerInterval);

  // 3.5 Adversarial Modifier Key Collision Test (Ctrl+F, Ctrl+T, Ctrl+O, Alt+ArrowLeft)
  console.log('\n  Adversarial Modifier Key Collision Test:');
  const timerBeforeCtrlT = getContextVar('isTimerRunning');
  simulateKey('t', { ctrlKey: true });
  const timerAfterCtrlT = getContextVar('isTimerRunning');
  if (timerBeforeCtrlT !== timerAfterCtrlT) {
    recordFinding(
      'Keyboard modifier collision (Ctrl+T / Ctrl+F / Ctrl+O)',
      'Global keydown listener does not filter out modifier keys (ctrlKey, metaKey, altKey). When a user presses standard browser shortcuts such as Ctrl+T (new tab) or Ctrl+F (find) or Ctrl+O (open), it unintentionally triggers slide actions (e.g. toggles timer or fullscreen or overview modal). Adding `if (e.ctrlKey || e.metaKey || e.altKey) return;` resolves this.',
      'WARNING'
    );
    // restore timer state
    if (getContextVar('isTimerRunning') && sandbox.timerInterval) clearInterval(sandbox.timerInterval);
  } else {
    assert(true, 'Modifier keys (Ctrl/Meta/Alt) safely ignored by shortcut handler');
  }

  // 3.6 Clipboard API resilience check
  console.log('\n  Clipboard API resilience check:');
  const origClipboard = sandbox.navigator.clipboard;
  sandbox.navigator.clipboard = undefined;
  try {
    vm.runInContext('copyToClipboard("test", null)', sandbox);
  } catch (err) {
    if (err.name === 'TypeError' || (err.message && err.message.includes('writeText'))) {
      recordFinding(
        'copyToClipboard unprotected against missing navigator.clipboard',
        `In insecure (HTTP non-localhost) or restricted iframe environments, \`navigator.clipboard\` is undefined. Calling copyToClipboard throws an uncaught TypeError synchronously before the promise chain (\`${err.name}: ${err.message}\`). Adding a guard \`if (!navigator.clipboard) { showToast("Không thể sao chép trên môi trường này"); return; }\` ensures graceful degradation.`,
        'WARNING'
      );
    }
  } finally {
    sandbox.navigator.clipboard = origClipboard;
  }
}

async function runSuite4_ForbiddenTokens() {
  console.log('\n======================================================');
  console.log('SUITE 4: Search for Forbidden Tokens & Anti-Patterns');
  console.log('======================================================');

  const slidesContent = fs.readFileSync(SLIDES_PATH, 'utf8');

  // 4.1 Banned Neo-Brutalist classes
  const bannedNeoClasses = [
    'neo-box',
    'neo-tag',
    'border-[#18181B]',
    'shadow-[4px_4px_0px]',
    'shadow-[6px_6px_0px]',
    'shadow-[8px_8px_0px]'
  ];
  for (const token of bannedNeoClasses) {
    const hasToken = slidesContent.includes(token);
    assert(!hasToken, `Zero occurrence of banned Neo-Brutalist token: "${token}"`);
  }

  // 4.2 Banned Pop Colors
  const bannedPopColors = [
    '#FDE047',
    '#00FFA3',
    '#FF5757',
    'bg-yellow-400',
    'bg-yellow-300'
  ];
  for (const token of bannedPopColors) {
    const hasToken = slidesContent.includes(token);
    assert(!hasToken, `Zero occurrence of banned pop color token: "${token}"`);
  }

  // 4.3 Banned Fonts
  const bannedFonts = [
    'Anton',
    'Space Mono',
    'font-anton',
    'font-space'
  ];
  for (const token of bannedFonts) {
    const hasToken = slidesContent.includes(token);
    assert(!hasToken, `Zero occurrence of banned font token: "${token}"`);
  }

  // 4.4 Banned Purple Gradients & AI-slop Glows
  const bannedPurpleTokens = [
    'from-purple',
    'to-violet',
    'from-indigo',
    'to-fuchsia',
    'text-transparent bg-clip-text',
    'bg-clip-text bg-gradient-to-r'
  ];
  for (const token of bannedPurpleTokens) {
    const hasToken = slidesContent.includes(token);
    assert(!hasToken, `Zero occurrence of banned purple gradient / AI-slop token: "${token}"`);
  }
}

async function main() {
  console.log('======================================================');
  console.log('EMPIRICAL STRESS TEST SUITE: public/slides.html');
  console.log('Target: C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\fb-laptop-autopost\\public\\slides.html');
  console.log('Evidence: C:\\Users\\Admin\\.gemini\\antigravity\\scratch\\fb-laptop-autopost\\public\\evidence\\');
  console.log('======================================================\n');

  try {
    await runSuite1_AssetsAndNetwork();
    await runSuite2_DOMAndJSSyntax();
    await runSuite3_StateMachineStressTest();
    await runSuite4_ForbiddenTokens();
  } catch (err) {
    console.error('Fatal Test Runner Failure:', err);
    results.failed++;
  }

  console.log('\n======================================================');
  console.log('TEST SUMMARY:');
  console.log(`Total assertions: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Findings/Notes: ${results.findings.length}`);
  console.log('======================================================');

  if (results.findings.length > 0) {
    console.log('\nFindings Details:');
    results.findings.forEach((f, idx) => {
      console.log(`${idx + 1}. [${f.severity}] ${f.testName}: ${f.details}`);
    });
  }

  process.exit(results.failed > 0 ? 1 : 0);
}

main();
