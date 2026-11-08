/**
 * DOM & Media Integrity Challenge Suite
 * Invoked for: challenger_exec_1
 * Target: public/slides.html and public/evidence/
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SLIDES_PATH = path.join(ROOT_DIR, 'public', 'slides.html');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'public', 'evidence');

const results = {
  timestamp: new Date().toISOString(),
  target: SLIDES_PATH,
  total: 0,
  passed: 0,
  failed: 0,
  checks: []
};

function assert(condition, name, details = '') {
  results.total++;
  const passed = Boolean(condition);
  if (passed) {
    results.passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    results.failed++;
    console.error(`  [FAIL] ${name} ${details ? '--> ' + details : ''}`);
  }
  results.checks.push({ name, passed, details });
  return passed;
}

console.log('======================================================================');
console.log('CHALLENGER EXEC 1: EMPIRICAL DOM & MEDIA INTEGRITY CHALLENGE');
console.log('Target:', SLIDES_PATH);
console.log('======================================================================\n');

// Ensure file exists
assert(fs.existsSync(SLIDES_PATH), 'public/slides.html exists on disk');
const html = fs.readFileSync(SLIDES_PATH, 'utf8');

// ======================================================================
// TASK 1: HTML DOM Tree Validation & Elements
// ======================================================================
console.log('>>> TASK 1: HTML DOM Tree Validation & Elements <<<');

// 1.1 Strict HTML Tag Balancer
function validateDOMBalance(htmlString) {
  const voidTags = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
  ]);
  
  // Strip comments and doctype
  let clean = htmlString.replace(/<!--[\s\S]*?-->/g, '');
  
  // Extract and replace script and style contents to avoid parsing inside them
  clean = clean.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, '<script></script>');
  clean = clean.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gi, '<style></style>');

  const tagRegex = /<\/?([a-zA-Z0-9\-]+)(?:\s+[^>]*?)?(\/?)>/g;
  const stack = [];
  const errors = [];
  let match;

  while ((match = tagRegex.exec(clean)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = match[2] === '/' || voidTags.has(tagName);

    if (voidTags.has(tagName)) {
      continue;
    }

    if (isClosing) {
      if (stack.length === 0) {
        errors.push(`Unexpected closing tag </${tagName}> at char ${match.index}`);
      } else {
        const top = stack.pop();
        if (top.tagName !== tagName) {
          errors.push(`Mismatched closing tag </${tagName}> at char ${match.index}, expected </${top.tagName}> (opened at char ${top.index})`);
        }
      }
    } else if (!isSelfClosing) {
      stack.push({ tagName, index: match.index });
    }
  }

  if (stack.length > 0) {
    stack.forEach(unclosed => {
      errors.push(`Unclosed tag <${unclosed.tagName}> opened at char ${unclosed.index}`);
    });
  }

  return { balanced: errors.length === 0, errors };
}

const domCheck = validateDOMBalance(html);
assert(domCheck.balanced, 'HTML DOM tree has balanced open/close tags', domCheck.errors.join('; '));

// 1.2 Verify all 9 content slides exist (#slide-1 to #slide-9)
for (let i = 1; i <= 9; i++) {
  const slideRegex = new RegExp(`<section[^>]*id="slide-${i}"[^>]*>`, 'i');
  assert(slideRegex.test(html), `Content Slide #${i} (#slide-${i}) exists in DOM`);
}

// 1.3 Verify Slide 1 is active, and #slide-2 through #slide-9 are not active
const slide1Active = /<section[^>]*id="slide-1"[^>]*class="[^"]*\bactive\b[^"]*"[^>]*>/i.test(html) ||
                    /<section[^>]*class="[^"]*\bactive\b[^"]*"[^>]*id="slide-1"[^>]*>/i.test(html);
assert(slide1Active, 'Slide 1 (#slide-1) has the "active" class on initial load');

for (let i = 2; i <= 9; i++) {
  const isInactive = !new RegExp(`<section[^>]*id="slide-${i}"[^>]*class="[^"]*\\bactive\\b[^"]*"[^>]*>`, 'i').test(html) &&
                     !new RegExp(`<section[^>]*class="[^"]*\\bactive\\b[^"]*"[^>]*id="slide-${i}"[^>]*>`, 'i').test(html);
  assert(isInactive, `Slide #${i} (#slide-${i}) does NOT have "active" class on initial load`);
}

// 1.4 Verify no slide 0 blocks initial view
const hasSlide0AsSlidePage = /<section[^>]*id="slide-0"[^>]*class="[^"]*\bslide-page\b[^"]*"[^>]*>/i.test(html);
assert(!hasSlide0AsSlidePage, 'No <section id="slide-0"> exists as a slide-page');

const overlayMatch = html.match(/<div[^>]*id="slide0Overlay"[^>]*class="([^"]*)"[^>]*>/i);
if (overlayMatch) {
  const overlayClasses = overlayMatch[1];
  const isHidden = overlayClasses.includes('hidden');
  assert(isHidden, '#slide0Overlay is present but hidden by default with class "hidden"');
} else {
  assert(true, 'No #slide0Overlay element present to block view');
}

// 1.5 Verify absence of floating docks, button bars, or key hint tooltips
assert(!html.includes('id="slideDock"'), 'Absence of legacy #slideDock');
assert(!html.includes('id="dockBar"'), 'Absence of #dockBar');
assert(!html.includes('id="bottomDock"'), 'Absence of #bottomDock');
assert(!/class="[^"]*fixed\s+bottom-[^"]*"[^>]*>[\s\S]*?<button/i.test(html), 'Absence of floating bottom button navigation dock');

// Verify absence of key hint tooltips like "Bấm phím này để làm gì", "Phím tắt", etc.
const hasHintTooltip = /bấm phím/i.test(html) || /phím tắt/i.test(html) || /hướng dẫn phím/i.test(html);
assert(!hasHintTooltip, 'Absence of key hint tooltips or instructions ("bấm phím", "phím tắt")');

// ======================================================================
// TASK 2: Evidence Images in public/evidence/
// ======================================================================
console.log('\n>>> TASK 2: Evidence Images in public/evidence/ <<<');

const expectedEvidence = [
  // 4 BIDV receipts
  { filename: 'coc_200k_thuy_nhung.jpg', category: 'BIDV Receipt', minBytes: 100000 },
  { filename: 'coc_500k_thanhvu.jpg', category: 'BIDV Receipt', minBytes: 100000 },
  { filename: 'chuyenkhoan_1tr_thanhvu.jpg', category: 'BIDV Receipt', minBytes: 100000 },
  { filename: 'chuyenkhoan_300k_kimhoa.jpg', category: 'BIDV Receipt', minBytes: 300000 },
  // 6 chats
  { filename: 'chat_hocsinh_nguyen_thua.jpg', category: 'Chat Screenshot', minBytes: 150000 },
  { filename: 'chat_thay_quang_toan_gv.jpg', category: 'Chat Screenshot', minBytes: 70000 },
  { filename: 'chat_phuhuynh_co_le_ghi.jpg', category: 'Chat Screenshot', minBytes: 100000 },
  { filename: 'chat_tran_quoc_khanh_fb.jpg', category: 'Chat Screenshot', minBytes: 150000 },
  { filename: 'chat_khach_a_mau_hinh_that.jpg', category: 'Chat Screenshot', minBytes: 100000 },
  { filename: 'chat_phan_trieu_messenger.jpg', category: 'Chat Screenshot', minBytes: 150000 }
];

function parseJpegDimensions(buffer) {
  // Check SOI marker 0xFF 0xD8 0xFF
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8 || buffer[2] !== 0xFF) {
    return { valid: false, error: 'Not a valid JPEG (Missing SOI marker)' };
  }

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      offset++;
      continue;
    }
    const marker = buffer[offset + 1];
    offset += 2;

    // SOF markers: 0xC0 to 0xC3, 0xC5 to 0xC7, 0xC9 to 0xCB, 0xCD to 0xCF
    const isSOF = (marker >= 0xC0 && marker <= 0xC3) ||
                  (marker >= 0xC5 && marker <= 0xC7) ||
                  (marker >= 0xC9 && marker <= 0xCB) ||
                  (marker >= 0xCD && marker <= 0xCF);

    if (isSOF) {
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      return { valid: true, width, height, marker: '0x' + marker.toString(16).toUpperCase() };
    } else if (marker === 0xD9) { // EOI
      break;
    } else if (marker === 0xDA) { // SOS (Start of Scan - image data begins)
      break;
    } else if (marker >= 0xD0 && marker <= 0xD7) { // RST
      continue;
    } else {
      if (offset + 2 <= buffer.length) {
        const length = buffer.readUInt16BE(offset);
        offset += length;
      } else {
        break;
      }
    }
  }

  return { valid: false, error: 'SOF marker not found before SOS/EOI' };
}

expectedEvidence.forEach(item => {
  const filePath = path.join(EVIDENCE_DIR, item.filename);
  const exists = fs.existsSync(filePath);
  assert(exists, `Evidence file exists on disk: ${item.filename}`);

  if (exists) {
    const stat = fs.statSync(filePath);
    assert(stat.size > 0, `Evidence file size positive: ${item.filename} (${stat.size} bytes)`);
    assert(stat.size >= item.minBytes, `Evidence file exceeds expected byte threshold: ${item.filename} (${stat.size} >= ${item.minBytes})`);

    const buffer = fs.readFileSync(filePath);
    const jpeg = parseJpegDimensions(buffer);
    assert(jpeg.valid, `Valid JPEG header & SOF marker: ${item.filename} (${jpeg.width}x${jpeg.height})`, jpeg.error || '');
    assert(jpeg.valid && jpeg.width > 0 && jpeg.height > 0, `Positive dimensions: ${item.filename} (${jpeg.width}x${jpeg.height})`);
  }

  // Check referenced path in slides.html
  const isReferenced = html.includes(`evidence/${item.filename}`) || html.includes(`evidence/${encodeURIComponent(item.filename)}`);
  assert(isReferenced, `Image is referenced in slides.html: ${item.filename}`);
});

// Check all 10 images are in slide-8 (or slide content)
assert(expectedEvidence.every(item => html.includes(item.filename)), 'All 10 evidence filenames are present in slides.html');

// ======================================================================
// TASK 3: Interactive Mechanisms
// ======================================================================
console.log('\n>>> TASK 3: Interactive Mechanisms <<<');

// Extract navigation script
const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
const appScript = scriptMatches.map(m => m[1]).find(code => code.includes('function showSlide') && code.includes('handleCanvasClick'));
assert(Boolean(appScript), 'Application interactive navigation script found');

// Build sandbox to test interactive state machine
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(...c) { c.forEach(x => this.classes.add(x)); }
  remove(...c) { c.forEach(x => this.classes.delete(x)); }
  contains(c) { return this.classes.has(c); }
  toggle(c) { if (this.contains(c)) this.remove(c); else this.add(c); }
}

class MockElement {
  constructor(id, tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList();
    this.style = {};
    this.textContent = '';
    this.innerText = '';
    this.src = '';
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1000, height: 562.5 };
  }
}

const mockElements = {
  slideProgressBar: new MockElement('slideProgressBar'),
  slideNumberDisplay: new MockElement('slideNumberDisplay'),
  imageLightbox: new MockElement('imageLightbox'),
  lightboxImage: new MockElement('lightboxImage', 'img'),
  lightboxCaption: new MockElement('lightboxCaption'),
  slide0Overlay: new MockElement('slide0Overlay'),
  presentationCanvas: new MockElement('presentationCanvas')
};
mockElements.slide0Overlay.classList.add('hidden');

const slidePages = [];
for (let i = 1; i <= 9; i++) {
  const el = new MockElement(`slide-${i}`, 'section');
  if (i === 1) el.classList.add('active');
  slidePages.push(el);
  mockElements[`slide-${i}`] = el;
}

const keyListeners = [];
const touchListeners = {};

const sandbox = {
  console,
  document: {
    getElementById: (id) => mockElements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '.slide-page') return slidePages;
      return [];
    },
    startViewTransition: (cb) => cb() // simulate native view transition
  },
  window: {
    addEventListener: (type, handler) => {
      if (type === 'keydown') keyListeners.push(handler);
      else touchListeners[type] = handler;
    }
  },
  Number,
  isNaN,
  event: null
};

vm.createContext(sandbox);
vm.runInContext(appScript, sandbox);

const getCurrentSlide = () => vm.runInContext('currentSlide', sandbox);

// 3.1 Initial State Check
assert(getCurrentSlide() === 1, 'Initial currentSlide is 1');
assert(mockElements['slide-1'].classList.contains('active'), 'Mock DOM #slide-1 has active class');
assert(mockElements.slideNumberDisplay.textContent.includes('01'), `Initial counter displays 01: ${mockElements.slideNumberDisplay.textContent}`);

// 3.2 Navigation Forward (nextSlide, ArrowRight, Space, Enter)
sandbox.nextSlide();
assert(getCurrentSlide() === 2, 'nextSlide() advances to slide 2');
assert(mockElements['slide-2'].classList.contains('active'), 'slide-2 now active');
assert(!mockElements['slide-1'].classList.contains('active'), 'slide-1 no longer active');
assert(mockElements.slideNumberDisplay.textContent.includes('02'), 'Counter updated to 02');

// Trigger keydown ArrowRight
const mockEvent = (key) => ({ key, preventDefault: () => {} });
keyListeners.forEach(l => l(mockEvent('ArrowRight')));
assert(getCurrentSlide() === 3, 'Key ArrowRight advances to slide 3');

// Trigger keydown Space
keyListeners.forEach(l => l(mockEvent(' ')));
assert(getCurrentSlide() === 4, 'Key Space advances to slide 4');

// Trigger keydown Enter
keyListeners.forEach(l => l(mockEvent('Enter')));
assert(getCurrentSlide() === 5, 'Key Enter advances to slide 5');

// 3.3 Navigation Backward (prevSlide, ArrowLeft)
sandbox.prevSlide();
assert(getCurrentSlide() === 4, 'prevSlide() moves back to slide 4');

keyListeners.forEach(l => l(mockEvent('ArrowLeft')));
assert(getCurrentSlide() === 3, 'Key ArrowLeft moves back to slide 3');

// 3.4 Navigation Jump (Home, End, showSlide)
keyListeners.forEach(l => l(mockEvent('End')));
assert(getCurrentSlide() === 9, 'Key End jumps to slide 9 (last slide)');
assert(mockElements['slide-9'].classList.contains('active'), 'slide-9 is active');

// Test upper boundary clamp
sandbox.nextSlide();
assert(getCurrentSlide() === 9, 'nextSlide() at slide 9 clamped to 9 (no overflow)');

keyListeners.forEach(l => l(mockEvent('Home')));
assert(getCurrentSlide() === 1, 'Key Home jumps to slide 1 (first slide)');
assert(mockElements['slide-1'].classList.contains('active'), 'slide-1 is active');

// Test lower boundary clamp
sandbox.prevSlide();
assert(getCurrentSlide() === 1, 'prevSlide() at slide 1 clamped to 1 (no underflow)');

// Test invalid jumps
sandbox.showSlide(0);
assert(getCurrentSlide() === 1, 'showSlide(0) rejected; currentSlide remains 1');
sandbox.showSlide(10);
assert(getCurrentSlide() === 1, 'showSlide(10) rejected; currentSlide remains 1');
sandbox.showSlide('invalid');
assert(getCurrentSlide() === 1, 'showSlide("invalid") rejected; currentSlide remains 1');

// 3.5 Canvas Click Zones (left 40% prev, right 60% next)
sandbox.showSlide(5);
assert(getCurrentSlide() === 5, 'Jumped to slide 5 for click test');

// Right 60% click (x = 600 of 1000)
sandbox.handleCanvasClick({
  clientX: 600,
  currentTarget: mockElements.presentationCanvas,
  target: { closest: () => null }
});
assert(getCurrentSlide() === 6, 'Canvas click at 60% advances to slide 6');

// Left 40% click (x = 200 of 1000)
sandbox.handleCanvasClick({
  clientX: 200,
  currentTarget: mockElements.presentationCanvas,
  target: { closest: () => null }
});
assert(getCurrentSlide() === 5, 'Canvas click at 20% reverses to slide 5');

// Click on interactive element (e.g. button or .group) is ignored
sandbox.handleCanvasClick({
  clientX: 900,
  currentTarget: mockElements.presentationCanvas,
  target: { closest: (sel) => sel === 'button' ? {} : null }
});
assert(getCurrentSlide() === 5, 'Canvas click on <button> is ignored (does not navigate)');

// 3.6 Lightbox Modal Interactions
sandbox.openLightbox('evidence/coc_200k_thuy_nhung.jpg', 'Biên lai cọc 200k');
assert(mockElements.imageLightbox.classList.contains('active'), 'openLightbox() activates #imageLightbox');
assert(mockElements.lightboxImage.src === 'evidence/coc_200k_thuy_nhung.jpg', 'openLightbox() sets image source');
assert(mockElements.lightboxCaption.innerText === 'Biên lai cọc 200k', 'openLightbox() sets caption text');

// While lightbox is active, Escape key should close lightbox and NOT navigate
keyListeners.forEach(l => l(mockEvent('Escape')));
assert(!mockElements.imageLightbox.classList.contains('active'), 'Escape key closes active lightbox modal');
assert(getCurrentSlide() === 5, 'Escape key did not alter currentSlide');

// Test closeLightbox directly
sandbox.openLightbox('evidence/coc_500k_thanhvu.jpg', 'Biên lai 500k');
sandbox.closeLightbox();
assert(!mockElements.imageLightbox.classList.contains('active'), 'closeLightbox() deactivates #imageLightbox');

// ======================================================================
// TASK 4: JavaScript Syntax Validation
// ======================================================================
console.log('\n>>> TASK 4: JavaScript Code Syntax Validation <<<');

let scriptBlockIndex = 0;
for (const match of scriptMatches) {
  scriptBlockIndex++;
  const code = match[1];
  try {
    new vm.Script(code);
    assert(true, `Script block #${scriptBlockIndex} compiles with 0 syntax errors`);
  } catch (err) {
    assert(false, `Script block #${scriptBlockIndex} syntax error`, err.message);
  }
}

// Check inline event handlers
const inlineHandlerRegex = /\son[a-z]+\s*=\s*"([^"]+)"/gi;
let inlineMatch;
let inlineCount = 0;
let inlineErrors = 0;

while ((inlineMatch = inlineHandlerRegex.exec(html)) !== null) {
  inlineCount++;
  const handlerCode = inlineMatch[1];
  try {
    new Function('event', handlerCode);
  } catch (err) {
    inlineErrors++;
    assert(false, `Inline handler syntax error: ${handlerCode}`, err.message);
  }
}
assert(inlineErrors === 0, `All ${inlineCount} inline event handlers compiled with 0 syntax errors`);

// ======================================================================
// SUMMARY & VERDICT
// ======================================================================
console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${results.total} | PASSED: ${results.passed} | FAILED: ${results.failed}`);
const verdict = results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
console.log(`VERDICT: ${verdict}`);
console.log('======================================================================');

// Save raw JSON results to tests/test_challenger_exec_dom_media_results.json
fs.writeFileSync(
  path.join(__dirname, 'test_challenger_exec_dom_media_results.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);

process.exit(results.failed === 0 ? 0 : 1);
