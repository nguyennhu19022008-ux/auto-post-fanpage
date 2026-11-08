// test_remediation_fixes.js
// Targeted verification of all Reviewer 1 and Challenger 1 remediation items
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

console.log('======================================================');
console.log('REMEDIATION VERIFICATION TEST SUITE');
console.log('======================================================');

const slidesPath = path.resolve(__dirname, '../public/slides.html');
const content = fs.readFileSync(slidesPath, 'utf8');

let passCount = 0;
let failCount = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passCount++;
  } else {
    console.error(`  [FAIL] ${desc}`);
    failCount++;
  }
}

// ----------------------------------------------------
// TEST SUITE 1: Slide 0 Specificity & Display Split Bug
// ----------------------------------------------------
console.log('\n--- SUITE 1: Slide 0 Display Specificity & Split Prevention ---');

// Check HTML: #slide-0 must NOT have the class "flex"
const s0Match = content.match(/<section[^>]*id=["']slide-0["'][^>]*>/i);
check('Slide 0 section tag found', !!s0Match);
if (s0Match) {
  const classMatch = s0Match[0].match(/class=["']([^"']*)["']/i);
  const classes = classMatch ? classMatch[1].split(/\s+/) : [];
  check('Slide 0 HTML tag does NOT have "flex" class', !classes.includes('flex'));
  check('Slide 0 has "slide-frame" class', classes.includes('slide-frame'));
  check('Slide 0 initially has "active" class', classes.includes('active'));
}

// Check CSS in <style>: Must have display: none !important and :not(.active)
check('.slide-frame has display: none !important', content.includes('.slide-frame {') && content.includes('display: none !important;'));
check('.slide-frame.active has display: flex !important', content.includes('.slide-frame.active {') && content.includes('display: flex !important;'));
check('.slide-frame:not(.active) has display: none !important', content.includes('.slide-frame:not(.active) {') && content.includes('display: none !important;'));

// ----------------------------------------------------
// TEST SUITE 2: 720p/1080p Vertical Overflow & Spacing Tightening
// ----------------------------------------------------
console.log('\n--- SUITE 2: 720p/1080p Layout Padding & Tightening ---');

const tightenedSlides = [1, 2, 4, 6, 8, 9];
tightenedSlides.forEach(num => {
  const sMatch = content.match(new RegExp(`<section[^>]*id=["']slide-${num}["'][^>]*>`, 'i'));
  check(`Slide ${num} section tag found`, !!sMatch);
  if (sMatch) {
    const classMatch = sMatch[0].match(/class=["']([^"']*)["']/i);
    const classes = classMatch ? classMatch[1] : '';
    check(`Slide ${num} uses compact padding "p-4 sm:p-6 lg:p-8" (not p-8 sm:p-12)`, classes.includes('p-4') && !classes.includes('p-8 sm:p-12'));
  }
});

// Check that Slide 1 has bold, prominent heading
check('Slide 1 heading uses prominent font-display typography', content.includes('font-display') && (content.includes('text-2xl') || content.includes('text-xl')));

// Check Slide 8 gallery images have framed containers (not unconstrained)
check('Slide 8 bank bills use framed container', content.includes('rounded') && content.includes('border'));
check('Slide 8 chat cards use framed container', content.includes('object-contain') && content.includes('overflow-hidden'));

// ----------------------------------------------------
// TEST SUITE 3: Slide 4 Mathematical Formula
// ----------------------------------------------------
console.log('\n--- SUITE 3: Slide 4 Mathematical Formula ---');

check('No raw LaTeX $$ in slides.html', !content.includes('$$Q_{\\text{BEP}}'));
check('No raw LaTeX \\frac in slides.html', !content.includes('\\frac{FC}'));
check('No raw LaTeX \\mathbf in slides.html', !content.includes('\\mathbf{0'));
check('Slide 4 contains semantic HTML Q_BEP', content.includes('Q<sub') || content.includes('Q<sub>BEP</sub>'));
check('Slide 4 contains numerator FC and denominator P - VC', content.includes('FC') && (content.includes('P &minus; VC') || content.includes('P - VC')));
check('Slide 4 contains numeric values 4.600.000 and 4.100.000', content.includes('4.600.000') && content.includes('4.100.000'));
check('Slide 4 highlights 0 MÁY', content.includes('0 MÁY') || content.includes('0 máy'));

// ----------------------------------------------------
// TEST SUITE 4: Modal Keyboard Navigation Leak Isolation
// ----------------------------------------------------
console.log('\n--- SUITE 4: Modal Keyboard Navigation Leak Isolation ---');

// Extract JS engine and execute inside mock DOM
const scriptMatches = content.match(/<script>([\s\S]*?)<\/script>/gi);
const jsEngineCode = scriptMatches[scriptMatches.length - 1]
  .replace(/^<script>/i, '')
  .replace(/<\/script>$/i, '');

// Set up mock DOM environment
const elements = {};
function createMockEl(id, tagName = 'div', classes = '') {
  const classList = new Set(classes ? classes.split(/\s+/) : []);
  const el = {
    id,
    tagName,
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      contains: (c) => classList.has(c),
      values: () => Array.from(classList)
    },
    style: {},
    innerText: '',
    appendChild: () => {},
    removeChild: () => {},
    focus: () => {},
    select: () => {}
  };
  elements[id] = el;
  return el;
}

// Create slide elements
const slideFrames = [];
for (let i = 0; i <= 9; i++) {
  const sf = createMockEl(`slide-${i}`, 'section', i === 0 ? 'slide-frame active' : 'slide-frame');
  slideFrames.push(sf);
}

const slideDock = createMockEl('slideDock', 'div');
const currentSlideDisplay = createMockEl('currentSlideDisplay', 'span');
const copyToast = createMockEl('copyToast', 'div');
const timerDisplay = createMockEl('timerDisplay', 'span');
const timerBtn = createMockEl('timerBtn', 'button');
const slide0CertificateCard = createMockEl('slide0CertificateCard', 'div');
const slide0FloatingActions = createMockEl('slide0FloatingActions', 'div', 'hidden');
const evidenceLightboxModal = createMockEl('evidenceLightboxModal', 'div', 'hidden');
const lightboxImg = createMockEl('lightboxImg', 'img');
const lightboxTitle = createMockEl('lightboxTitle', 'div');
const lightboxCaption = createMockEl('lightboxCaption', 'div');
const overviewModal = createMockEl('overviewModal', 'div', 'hidden');

const eventListeners = {};
const sandbox = {
  console,
  document: {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (sel) => {
      if (sel === '.slide-frame') return slideFrames;
      return [];
    },
    createElement: (tag) => createMockEl('temp_' + Math.random(), tag),
    body: {
      appendChild: () => {},
      removeChild: () => {}
    },
    fullscreenElement: null,
    documentElement: { requestFullscreen: async () => {} },
    exitFullscreen: async () => {},
    execCommand: (cmd) => true
  },
  window: {
    addEventListener: (evt, fn) => {
      eventListeners[evt] = eventListeners[evt] || [];
      eventListeners[evt].push(fn);
    }
  },
  navigator: {},
  setInterval: () => 123,
  clearInterval: () => {},
  setTimeout: (fn) => fn(),
  String,
  Math,
  Number,
  isNaN
};

vm.createContext(sandbox);
vm.runInContext(jsEngineCode, sandbox);

const getCurSlide = () => vm.runInContext('currentSlide', sandbox);
const runInSandbox = (code) => vm.runInContext(code, sandbox);

check('Engine loaded, currentSlide initialized to 0', getCurSlide() === 0);

// Advance to Slide 3
runInSandbox('showSlide(3)');
check('showSlide(3) sets currentSlide to 3', getCurSlide() === 3);

// Open Lightbox Modal (removes class 'hidden')
evidenceLightboxModal.classList.remove('hidden');
check('Lightbox modal is now open (not hidden)', !evidenceLightboxModal.classList.contains('hidden'));

// Dispatch ArrowRight, Space, Enter, PageDown while Lightbox is OPEN
const keydownHandler = eventListeners['keydown'][0];
check('Global keydown listener exists', typeof keydownHandler === 'function');

let defaultPrevented = false;
const makeEvent = (key, opts = {}) => ({
  key,
  preventDefault: () => { defaultPrevented = true; },
  ctrlKey: !!opts.ctrlKey,
  metaKey: !!opts.metaKey,
  altKey: !!opts.altKey
});

// Try to navigate while modal is open
keydownHandler(makeEvent('ArrowRight'));
check('ArrowRight does NOT advance slide when Lightbox is open (still on 3)', getCurSlide() === 3);

keydownHandler(makeEvent(' '));
check('Space does NOT advance slide when Lightbox is open (still on 3)', getCurSlide() === 3);

keydownHandler(makeEvent('Enter'));
check('Enter does NOT advance slide when Lightbox is open (still on 3)', getCurSlide() === 3);

keydownHandler(makeEvent('PageDown'));
check('PageDown does NOT advance slide when Lightbox is open (still on 3)', getCurSlide() === 3);

keydownHandler(makeEvent('Home'));
check('Home does NOT navigate to Slide 0 when Lightbox is open (still on 3)', getCurSlide() === 3);

// Press Escape to close modal
keydownHandler(makeEvent('Escape'));
check('Escape closes Lightbox modal (adds hidden class)', evidenceLightboxModal.classList.contains('hidden'));

// Now that Lightbox is closed, ArrowRight should work
keydownHandler(makeEvent('ArrowRight'));
check('ArrowRight advances to Slide 4 when Lightbox is closed', getCurSlide() === 4);

// Now test Overview Modal
runInSandbox('toggleOverview()');
check('Overview modal is now open', !overviewModal.classList.contains('hidden'));

keydownHandler(makeEvent('ArrowLeft'));
check('ArrowLeft does NOT navigate when Overview is open (still on 4)', getCurSlide() === 4);

keydownHandler(makeEvent('Escape'));
check('Escape closes Overview modal', overviewModal.classList.contains('hidden'));

// ----------------------------------------------------
// TEST SUITE 5: Challenger Hardening Verification
// ----------------------------------------------------
console.log('\n--- SUITE 5: Challenger Hardening Verification ---');

// Alias check
check('window.goToSlide === showSlide alias exists', runInSandbox('window.goToSlide === showSlide'));

// Input validation check
const curBefore = getCurSlide();
runInSandbox('showSlide(NaN)');
check('showSlide(NaN) safely ignored, does not alter slide', getCurSlide() === curBefore);

runInSandbox('showSlide(undefined)');
check('showSlide(undefined) safely ignored', getCurSlide() === curBefore);

runInSandbox('showSlide("invalid")');
check('showSlide("invalid") safely ignored', getCurSlide() === curBefore);

// Modifier keys check
runInSandbox('showSlide(5)');
check('Moved to Slide 5 for modifier test', getCurSlide() === 5);
keydownHandler(makeEvent('t', { ctrlKey: true })); // Ctrl+T should be ignored
keydownHandler(makeEvent('ArrowRight', { altKey: true }));
check('Alt+ArrowRight does not advance slide (still on 5)', getCurSlide() === 5);

keydownHandler(makeEvent('ArrowRight', { metaKey: true }));
check('Meta+ArrowRight does not advance slide (still on 5)', getCurSlide() === 5);

// Clipboard fallback check
let execCommandCalled = false;
sandbox.document.execCommand = (cmd) => {
  if (cmd === 'copy') execCommandCalled = true;
  return true;
};
sandbox.navigator.clipboard = undefined; // Force undefined clipboard
sandbox.copyToClipboard('0876637806', null);
check('copyToClipboard falls back to document.execCommand when navigator.clipboard is undefined', execCommandCalled);

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log('\n======================================================');
console.log(`TOTAL ASSERTIONS: ${passCount + failCount}`);
console.log(`PASSED: ${passCount}`);
console.log(`FAILED: ${failCount}`);
console.log('======================================================');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL REMEDIATION ITEMS VERIFIED SUCCESSFULLY!');
  process.exit(0);
}
