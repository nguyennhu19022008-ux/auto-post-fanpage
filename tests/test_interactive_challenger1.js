/**
 * Comprehensive Empirical Interactive & Navigation Test Harness
 * Author: Challenger 1 (Interactive & Navigation Stress Challenger)
 * Target: public/slides.html
 * Date: 2026-11-07
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SLIDES_PATH = path.resolve(__dirname, '..', 'public', 'slides.html');

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  findings: []
};

function assert(condition, name, details = '') {
  results.total++;
  if (condition) {
    results.passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    results.failed++;
    console.error(`  [FAIL] ${name} ${details ? '- ' + details : ''}`);
    results.findings.push({ name, details, severity: 'ERROR' });
  }
}

function recordNotice(name, details) {
  console.log(`  [NOTICE] ${name}: ${details}`);
  results.findings.push({ name, details, severity: 'NOTICE' });
}

console.log('======================================================');
console.log('CHALLENGER 1: EMPIRICAL INTERACTIVE & NAVIGATION SUITE');
console.log('Target:', SLIDES_PATH);
console.log('======================================================\n');

// 0. Load slides.html
assert(fs.existsSync(SLIDES_PATH), 'slides.html exists');
const html = fs.readFileSync(SLIDES_PATH, 'utf8');

// 1. Static Verification of Required DOM Elements
console.log('--- 1. DOM Element Verification ---');
const requiredIds = [
  'slide-0', 'slide-1', 'slide-2', 'slide-3', 'slide-4', 
  'slide-5', 'slide-6', 'slide-7', 'slide-8', 'slide-9',
  'slideDock', 'currentSlideDisplay', 'topProgressBarContainer', 'topProgressBar',
  'timerBtn', 'timerDisplay', 'copyToast',
  'evidenceLightboxModal', 'lightboxImg', 'lightboxTitle', 'lightboxCaption',
  'overviewModal', 'slide0CertificateCard', 'slide0FloatingActions'
];

requiredIds.forEach(id => {
  assert(html.includes(`id="${id}"`), `Element #${id} exists in DOM`);
});

// Check for timerBar element
if (!html.includes('id="timerBar"')) {
  recordNotice(
    'Element #timerBar is not an explicit ID',
    'Mission mentions `#timerBar`. In `slides.html`, the timer element is `#timerBtn` containing `#timerDisplay` situated inside `#slideDock`. When `#slideDock` is hidden on Slide 0, the timer is also hidden.'
  );
}

// 2. Extract and Sandbox Navigation Script
console.log('\n--- 2. Sandboxed Dynamic State & Navigation Testing ---');
const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
const navScriptMatch = scriptMatches.find(m => m[1].includes('currentSlide') && m[1].includes('showSlide'));
assert(Boolean(navScriptMatch), 'Application script extracted from HTML');
const scriptCode = navScriptMatch ? navScriptMatch[1] : '';

// Mock DOM Environment
class MockClassList {
  constructor(owner) {
    this.owner = owner;
    this.classes = new Set();
  }
  add(...cls) { cls.forEach(c => this.classes.add(c)); }
  remove(...cls) { cls.forEach(c => this.classes.delete(c)); }
  contains(c) { return this.classes.has(c); }
  get length() { return this.classes.size; }
  toString() { return Array.from(this.classes).join(' '); }
}

class MockElement {
  constructor(id = '', tagName = 'div') {
    this.id = id;
    this.tagName = tagName.toUpperCase();
    this.classList = new MockClassList(this);
    this.style = {};
    this.innerText = '';
    this.src = '';
    this.children = [];
  }
}

const elements = new Map();
function getEl(id, tagName = 'div') {
  if (!elements.has(id)) {
    elements.set(id, new MockElement(id, tagName));
  }
  return elements.get(id);
}

// Instantiate frames
const slideFrames = [];
for (let i = 0; i <= 9; i++) {
  const f = getEl(`slide-${i}`, 'section');
  f.classList.add('slide-frame');
  if (i === 0) f.classList.add('active');
  slideFrames.push(f);
}

// Instantiate other key elements
const dock = getEl('slideDock');
dock.style.display = 'none';
const currentSlideDisplay = getEl('currentSlideDisplay');
currentSlideDisplay.innerText = '01';
const topProgressBarContainer = getEl('topProgressBarContainer');
topProgressBarContainer.style.display = 'none';
const topProgressBar = getEl('topProgressBar');
topProgressBar.style.width = '0%';
const timerBtn = getEl('timerBtn');
const timerDisplay = getEl('timerDisplay');
timerDisplay.innerText = '08:00';
const copyToast = getEl('copyToast');
const evidenceLightboxModal = getEl('evidenceLightboxModal');
evidenceLightboxModal.classList.add('hidden');
const lightboxImg = getEl('lightboxImg', 'img');
const lightboxTitle = getEl('lightboxTitle');
const lightboxCaption = getEl('lightboxCaption');
const overviewModal = getEl('overviewModal');
overviewModal.classList.add('hidden');
const slide0CertificateCard = getEl('slide0CertificateCard');
const slide0FloatingActions = getEl('slide0FloatingActions');
slide0FloatingActions.classList.add('hidden');

const eventListeners = {};
const mockWindow = {
  addEventListener: (type, fn, opts) => {
    eventListeners[type] = eventListeners[type] || [];
    eventListeners[type].push({ fn, opts });
  },
  dispatchEvent: (event) => {
    const list = eventListeners[event.type] || [];
    list.forEach(item => item.fn(event));
  }
};

const mockDocument = {
  getElementById: (id) => elements.get(id) || null,
  querySelectorAll: (selector) => {
    if (selector === '.slide-frame') return slideFrames;
    return [];
  },
  createElement: (tag) => new MockElement('', tag),
  body: {
    appendChild: () => {},
    removeChild: () => {}
  },
  fullscreenElement: null,
  documentElement: {
    requestFullscreen: async () => {},
  },
  exitFullscreen: async () => {},
  execCommand: (cmd) => true
};

const mockNavigator = {
  clipboard: {
    writeText: async (t) => true
  }
};

const sandbox = {
  window: mockWindow,
  document: mockDocument,
  navigator: mockNavigator,
  console: console,
  setTimeout: setTimeout,
  clearTimeout: clearTimeout,
  setInterval: setInterval,
  clearInterval: clearInterval,
  String: String,
  Math: Math,
  Number: Number,
  isNaN: isNaN
};

vm.createContext(sandbox);

try {
  vm.runInContext(scriptCode, sandbox);
  assert(true, 'Application script compiled and executed in VM sandbox');
} catch (err) {
  assert(false, 'Application script compiled and executed in VM sandbox', err.message);
}

// 3. Navigation Suite Verification
console.log('\n--- 3. Navigation Functions Suite ---');
assert(typeof sandbox.showSlide === 'function', 'showSlide is defined');
assert(typeof sandbox.nextSlide === 'function', 'nextSlide is defined');
assert(typeof sandbox.prevSlide === 'function', 'prevSlide is defined');
assert(typeof sandbox.goToSlide === 'function', 'goToSlide is defined');
assert(typeof sandbox.jumpToSlide === 'function', 'jumpToSlide is defined');

// Check toggleOverviewModal alias vs toggleOverview
if (typeof sandbox.toggleOverviewModal === 'undefined') {
  recordNotice(
    'toggleOverviewModal is undefined',
    'Mission mentions `toggleOverviewModal()`. In `slides.html`, the function is named `toggleOverview()`. Consider adding `window.toggleOverviewModal = toggleOverview;` for full backwards compatibility.'
  );
}

// Clamping & Step Navigation
console.log('\n--- 4. Slide State & Progress Bar Suite ---');
function getActiveSlideIndex() {
  for (let i = 0; i <= 9; i++) {
    if (elements.get(`slide-${i}`).classList.contains('active')) return i;
  }
  return -1;
}

// Initial Slide 0 State
assert(getActiveSlideIndex() === 0, 'Slide 0 is initially active');
assert(dock.style.display === 'none', 'Slide 0: #slideDock display is "none"');
assert(topProgressBarContainer.style.display === 'none', 'Slide 0: #topProgressBarContainer display is "none"');

// Test Step progression 1 through 9
for (let i = 1; i <= 9; i++) {
  sandbox.showSlide(i);
  assert(getActiveSlideIndex() === i, `Slide ${i} is active after showSlide(${i})`);
  assert(dock.style.display === 'flex', `Slide ${i}: #slideDock display is "flex"`);
  assert(topProgressBarContainer.style.display === 'block', `Slide ${i}: #topProgressBarContainer display is "block"`);
  assert(currentSlideDisplay.innerText === String(i).padStart(2, '0'), `Slide ${i}: counter displays "${String(i).padStart(2, '0')}"`);
  
  const expectedPercent = (i / 9) * 100;
  assert(topProgressBar.style.width === `${expectedPercent}%`, `Slide ${i}: progress bar width is ${expectedPercent}%`);
}

// Clamping Bounds
sandbox.showSlide(-5);
assert(getActiveSlideIndex() === 0, 'showSlide(-5) clamped to Slide 0');
assert(dock.style.display === 'none', 'Slide 0: dock hidden after clamping');

sandbox.showSlide(99);
assert(getActiveSlideIndex() === 9, 'showSlide(99) clamped to Slide 9');
assert(currentSlideDisplay.innerText === '09', 'Slide 9: counter displays "09" after clamping');

// nextSlide / prevSlide boundaries
sandbox.showSlide(9);
sandbox.nextSlide();
assert(getActiveSlideIndex() === 9, 'nextSlide() at Slide 9 does not overflow');

sandbox.showSlide(0);
sandbox.prevSlide();
assert(getActiveSlideIndex() === 0, 'prevSlide() at Slide 0 does not underflow');

// 5. Keyboard Navigation Suite
console.log('\n--- 5. Keyboard Shortcuts & Modifiers Suite ---');
function dispatchKey(key, opts = {}) {
  let defaultPrevented = false;
  const evt = {
    type: 'keydown',
    key: key,
    ctrlKey: !!opts.ctrlKey,
    metaKey: !!opts.metaKey,
    altKey: !!opts.altKey,
    shiftKey: !!opts.shiftKey,
    preventDefault: () => { defaultPrevented = true; }
  };
  mockWindow.dispatchEvent(evt);
  return { defaultPrevented, active: getActiveSlideIndex() };
}

// Advance keys: ArrowRight, Space, Enter, PageDown
sandbox.showSlide(0);
let res = dispatchKey('ArrowRight');
assert(res.active === 1 && res.defaultPrevented, 'ArrowRight advances slide 0 -> 1 with preventDefault');

res = dispatchKey(' ');
assert(res.active === 2 && res.defaultPrevented, 'Space advances slide 1 -> 2 with preventDefault');

res = dispatchKey('Enter');
assert(res.active === 3 && res.defaultPrevented, 'Enter advances slide 2 -> 3 with preventDefault');

res = dispatchKey('PageDown');
assert(res.active === 4 && res.defaultPrevented, 'PageDown advances slide 3 -> 4 with preventDefault');

// Decrement keys: ArrowLeft, PageUp
res = dispatchKey('ArrowLeft');
assert(res.active === 3 && res.defaultPrevented, 'ArrowLeft decrements slide 4 -> 3 with preventDefault');

res = dispatchKey('PageUp');
assert(res.active === 2 && res.defaultPrevented, 'PageUp decrements slide 3 -> 2 with preventDefault');

// Home & End
res = dispatchKey('End');
assert(res.active === 9, 'End navigates to final Slide 9');

res = dispatchKey('Home');
assert(res.active === 0, 'Home navigates to initial Slide 0');

// Overview Modal toggle via 'o' / 'O'
sandbox.showSlide(1);
assert(overviewModal.classList.contains('hidden'), 'Overview modal initially hidden');
dispatchKey('o');
assert(!overviewModal.classList.contains('hidden'), 'Key "o" opens overview modal');
dispatchKey('o');
assert(overviewModal.classList.contains('hidden'), 'Key "o" closes overview modal');
dispatchKey('O');
assert(!overviewModal.classList.contains('hidden'), 'Key "O" opens overview modal');
dispatchKey('Escape');
assert(overviewModal.classList.contains('hidden'), 'Key Escape closes overview modal');

// Lightbox Modal and Escape
sandbox.openLightbox('evidence/coc_200k_thuy_nhung.jpg', 'Title', 'Cap');
assert(!evidenceLightboxModal.classList.contains('hidden'), 'openLightbox opens lightbox');
// While open, slide navigation must be blocked
res = dispatchKey('ArrowRight');
assert(res.active === 1, 'ArrowRight blocked while Lightbox is open');
dispatchKey('Escape');
assert(evidenceLightboxModal.classList.contains('hidden'), 'Escape closes lightbox');

// Modifiers isolation
res = dispatchKey('ArrowRight', { ctrlKey: true });
assert(!res.defaultPrevented && res.active === 1, 'Ctrl+ArrowRight ignored (does not block browser shortcut)');

res = dispatchKey('t', { ctrlKey: true });
assert(!res.defaultPrevented, 'Ctrl+T ignored (does not block browser new tab)');

res = dispatchKey('f', { metaKey: true });
assert(!res.defaultPrevented, 'Meta+F ignored (does not block browser find)');

res = dispatchKey('o', { altKey: true });
assert(!res.defaultPrevented && overviewModal.classList.contains('hidden'), 'Alt+O ignored');

// 6. Touch & Swipe Gestures
console.log('\n--- 6. Touch & Gesture Listeners Suite ---');
function dispatchSwipe(startX, startY, endX, endY) {
  const startEvt = {
    type: 'touchstart',
    changedTouches: [{ screenX: startX, screenY: startY }]
  };
  const endEvt = {
    type: 'touchend',
    changedTouches: [{ screenX: endX, screenY: endY }]
  };
  mockWindow.dispatchEvent(startEvt);
  mockWindow.dispatchEvent(endEvt);
  return getActiveSlideIndex();
}

sandbox.showSlide(1);
// Horizontal swipe left > 50px (300 -> 100 = deltaX -200) -> nextSlide (1 -> 2)
let swipeRes = dispatchSwipe(300, 100, 100, 100);
assert(swipeRes === 2, 'Horizontal swipe left > 50px triggers nextSlide (1 -> 2)');

// Horizontal swipe right > 50px (100 -> 300 = deltaX +200) -> prevSlide (2 -> 1)
swipeRes = dispatchSwipe(100, 100, 300, 100);
assert(swipeRes === 1, 'Horizontal swipe right > 50px triggers prevSlide (2 -> 1)');

// Sub-threshold swipe (200 -> 160 = deltaX -40) -> should stay at 1
swipeRes = dispatchSwipe(200, 100, 160, 100);
assert(swipeRes === 1, 'Sub-threshold swipe (<50px) does not change slide');

// Vertical dominance (deltaX = -80, deltaY = 150) -> should stay at 1
swipeRes = dispatchSwipe(200, 100, 120, 250);
assert(swipeRes === 1, 'Vertical dominant swipe does not trigger slide navigation');

// 7. Timer & Modal Suite
console.log('\n--- 7. Timer & Modal Suite ---');
assert(typeof sandbox.toggleTimer === 'function', 'toggleTimer function exists');
assert(typeof sandbox.resetTimer === 'function', 'resetTimer function exists');
assert(typeof sandbox.formatTime === 'function', 'formatTime function exists');

assert(sandbox.formatTime(480) === '08:00', 'formatTime(480) -> "08:00"');
assert(sandbox.formatTime(180) === '03:00', 'formatTime(180) -> "03:00"');
assert(sandbox.formatTime(59) === '00:59', 'formatTime(59) -> "00:59"');
assert(sandbox.formatTime(0) === '00:00', 'formatTime(0) -> "00:00"');

// Timer Toggle
sandbox.toggleTimer(); // start
sandbox.toggleTimer(); // pause
sandbox.resetTimer();
assert(timerDisplay.innerText === '08:00', 'Timer display reset to 08:00');

// Lightbox full integrity
sandbox.openLightbox('evidence/coc_500k_thanhvu.jpg', 'Test Title', 'Test Caption');
assert(!evidenceLightboxModal.classList.contains('hidden'), 'openLightbox sets modal visible');
assert(lightboxImg.src === 'evidence/coc_500k_thanhvu.jpg', 'lightboxImg src matches input');
assert(lightboxTitle.innerText === 'Test Title', 'lightboxTitle matches input');
assert(lightboxCaption.innerText === 'Test Caption', 'lightboxCaption matches input');
sandbox.closeLightbox();
assert(evidenceLightboxModal.classList.contains('hidden'), 'closeLightbox hides modal');

// Slide 0 card toggle
sandbox.toggleSlide0Card(false);
assert(slide0CertificateCard.classList.contains('hidden'), 'toggleSlide0Card(false) hides certificate card');
assert(!slide0FloatingActions.classList.contains('hidden'), 'toggleSlide0Card(false) displays floating actions');

sandbox.toggleSlide0Card(true);
assert(!slide0CertificateCard.classList.contains('hidden'), 'toggleSlide0Card(true) displays certificate card');
assert(slide0FloatingActions.classList.contains('hidden'), 'toggleSlide0Card(true) hides floating actions');

console.log('\n======================================================');
console.log(`SUMMARY: ${results.passed} / ${results.total} PASSED (${results.failed} FAILED)`);
if (results.findings.length > 0) {
  console.log(`Findings: ${results.findings.length}`);
  results.findings.forEach(f => console.log(` - [${f.severity}] ${f.name}: ${f.details}`));
}
console.log('======================================================');

if (results.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
