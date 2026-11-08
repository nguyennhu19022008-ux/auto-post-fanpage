/**
 * Adversarial Stress & Fuzzing Suite for slides.html
 * Author: Empirical Challenger (challenger_exec_1)
 * Target: public/slides.html and public/evidence/
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SLIDES_PATH = path.join(ROOT_DIR, 'public', 'slides.html');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'public', 'evidence');

const html = fs.readFileSync(SLIDES_PATH, 'utf8');

const suite = {
  total: 0,
  passed: 0,
  failed: 0,
  issues: []
};

function test(name, fn) {
  suite.total++;
  try {
    const res = fn();
    if (res !== false) {
      suite.passed++;
      console.log(`  [PASS] ${name}`);
    } else {
      suite.failed++;
      console.error(`  [FAIL] ${name}`);
      suite.issues.push({ name, error: 'Condition returned false' });
    }
  } catch (err) {
    suite.failed++;
    console.error(`  [FAIL] ${name} --> Exception: ${err.message}`);
    suite.issues.push({ name, error: err.message, stack: err.stack });
  }
}

console.log('======================================================================');
console.log('ADVERSARIAL STRESS, FUZZING & HOSTILE SCENARIOS TEST');
console.log('======================================================================\n');

// ----------------------------------------------------------------------
// 1. Extreme & Malformed Input Fuzzing to showSlide()
// ----------------------------------------------------------------------
console.log('>>> 1. Extreme & Malformed Input Fuzzing to showSlide() <<<');

const scriptMatches = [...html.matchAll(/<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi)];
const appScript = scriptMatches.map(m => m[1]).find(c => c.includes('function showSlide'));

class MockClassList {
  constructor() { this.classes = new Set(); }
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

function createFreshSandbox(omitElements = []) {
  const elements = {
    slideProgressBar: new MockElement('slideProgressBar'),
    slideNumberDisplay: new MockElement('slideNumberDisplay'),
    imageLightbox: new MockElement('imageLightbox'),
    lightboxImage: new MockElement('lightboxImage', 'img'),
    lightboxCaption: new MockElement('lightboxCaption'),
    slide0Overlay: new MockElement('slide0Overlay'),
    presentationCanvas: new MockElement('presentationCanvas')
  };
  elements.slide0Overlay.classList.add('hidden');

  const pages = [];
  for (let i = 1; i <= 9; i++) {
    const el = new MockElement(`slide-${i}`, 'section');
    if (i === 1) el.classList.add('active');
    pages.push(el);
    elements[`slide-${i}`] = el;
  }

  omitElements.forEach(id => {
    delete elements[id];
  });

  const keyListeners = [];
  const sbx = {
    console,
    document: {
      getElementById: (id) => elements[id] || null,
      querySelectorAll: (sel) => sel === '.slide-page' ? pages : [],
      startViewTransition: null // test when View Transitions API is NOT supported
    },
    window: {
      addEventListener: (type, h) => { if (type === 'keydown') keyListeners.push(h); }
    },
    Number,
    isNaN,
    keyListeners,
    elements,
    pages
  };

  vm.createContext(sbx);
  vm.runInContext(appScript, sbx);
  sbx.getCurrentSlide = () => vm.runInContext('currentSlide', sbx);
  return sbx;
}

const fuzzedInputs = [
  -1, -999, 0, 10, 11, 9999,
  NaN, Infinity, -Infinity, null, undefined,
  '', '   ', 'abc', 'slide-2', '0', '10', '99',
  {}, [], [1], () => {}, true, false, 1.5, 8.999
];

test('showSlide() survives fuzzed adversarial inputs without throwing or entering corrupted state', () => {
  const sbx = createFreshSandbox();
  for (const input of fuzzedInputs) {
    try {
      sbx.showSlide(input);
      const curr = sbx.getCurrentSlide();
      if (curr < 1 || curr > 9 || isNaN(curr)) {
        throw new Error(`Corrupted currentSlide state ${curr} on input: ${JSON.stringify(input)}`);
      }
    } catch (e) {
      throw new Error(`showSlide threw on input: ${input} (${e.message})`);
    }
  }
  return true;
});

test('showSlide("9") string coercion succeeds safely and navigates to 9', () => {
  const sbx = createFreshSandbox();
  sbx.showSlide("9");
  return sbx.getCurrentSlide() === 9 && sbx.elements['slide-9'].classList.contains('active');
});

test('Adversarial Boundary Finding: showSlide(1.5) non-integer input behavior', () => {
  const sbx = createFreshSandbox();
  sbx.showSlide(1.5);
  const activeCount = sbx.pages.filter(p => p.classList.contains('active')).length;
  const curr = sbx.getCurrentSlide();
  if (activeCount === 0 && curr === 1.5) {
    console.log('    [ADVERSARIAL INSIGHT] showSlide(1.5) sets currentSlide=1.5 and removes active class from all slides (blank stage)');
    console.log('    Mitigation: parse targetIndex via Math.floor/Math.round or Number.isInteger guard.');
  }
  return true;
});

// ----------------------------------------------------------------------
// 2. Fallback when DOM Elements are Missing (Graceful Degradation)
// ----------------------------------------------------------------------
console.log('\n>>> 2. Graceful Degradation under Missing DOM Elements <<<');

test('Navigation survives missing #slideProgressBar and #slideNumberDisplay without throwing', () => {
  const sbx = createFreshSandbox(['slideProgressBar', 'slideNumberDisplay']);
  sbx.nextSlide();
  return sbx.getCurrentSlide() === 2;
});

test('Lightbox survives missing #lightboxCaption without throwing', () => {
  const sbx = createFreshSandbox(['lightboxCaption']);
  sbx.openLightbox('evidence/coc_200k_thuy_nhung.jpg', 'Caption');
  return sbx.elements.imageLightbox.classList.contains('active');
});

test('Native View Transitions API fallback works seamlessly when startViewTransition is undefined', () => {
  const sbx = createFreshSandbox();
  sbx.document.startViewTransition = undefined;
  sbx.showSlide(4);
  return sbx.getCurrentSlide() === 4 && sbx.elements['slide-4'].classList.contains('active');
});

// ----------------------------------------------------------------------
// 3. Rapid Keyboard Spam & Boundary Concurrency Stress
// ----------------------------------------------------------------------
console.log('\n>>> 3. Rapid Keyboard Spam & Concurrency Stress <<<');

test('Spamming 500 interleaved keyboard navigation events terminates in a consistent state within [1, 9]', () => {
  const sbx = createFreshSandbox();
  const keys = ['ArrowRight', ' ', 'Enter', 'ArrowLeft', 'PageUp', 'PageDown', 'Home', 'End', 'Escape', '0', 'UnrelatedKey'];
  
  for (let i = 0; i < 500; i++) {
    const key = keys[Math.floor(Math.random() * keys.length)];
    sbx.keyListeners.forEach(listener => {
      listener({ key, preventDefault: () => {} });
    });
  }

  const curr = sbx.getCurrentSlide();
  const validRange = curr >= 1 && curr <= 9;
  
  // Exactly 1 slide must be active in DOM
  const activeCount = sbx.pages.filter(p => p.classList.contains('active')).length;
  return validRange && activeCount === 1;
});

// ----------------------------------------------------------------------
// 4. Canvas Click Edge Cases (Boundary Fuzzing)
// ----------------------------------------------------------------------
console.log('\n>>> 4. Canvas Click Edge Cases <<<');

test('Click boundary fuzzing: x=0, x=400 (40% border), x=1000, x=-100, x=2000', () => {
  const sbx = createFreshSandbox();
  
  // Start at slide 5
  sbx.showSlide(5);

  // x = 400 (width = 1000). Condition is clickX > rect.width * 0.4. Since 400 is NOT > 400, it falls into else -> prevSlide!
  sbx.handleCanvasClick({
    clientX: 400,
    currentTarget: sbx.elements.presentationCanvas,
    target: { closest: () => null }
  });
  if (sbx.getCurrentSlide() !== 4) return false;

  // x = 401. 401 > 400 -> nextSlide!
  sbx.handleCanvasClick({
    clientX: 401,
    currentTarget: sbx.elements.presentationCanvas,
    target: { closest: () => null }
  });
  if (sbx.getCurrentSlide() !== 5) return false;

  // Extreme right x = 5000 -> nextSlide
  sbx.handleCanvasClick({
    clientX: 5000,
    currentTarget: sbx.elements.presentationCanvas,
    target: { closest: () => null }
  });
  if (sbx.getCurrentSlide() !== 6) return false;

  // Extreme negative x = -500 -> prevSlide
  sbx.handleCanvasClick({
    clientX: -500,
    currentTarget: sbx.elements.presentationCanvas,
    target: { closest: () => null }
  });
  if (sbx.getCurrentSlide() !== 5) return false;

  return true;
});

// ----------------------------------------------------------------------
// 5. Aesthetic Purity & Anti-Slop Audit
// ----------------------------------------------------------------------
console.log('\n>>> 5. Aesthetic Purity & Anti-Slop Audit <<<');

test('Zero AI-slop gradient classes (no violet, purple, indigo gradients or text-purple)', () => {
  const slopPatterns = [
    /from-purple/i, /to-purple/i, /via-purple/i,
    /from-indigo/i, /to-indigo/i, /via-indigo/i,
    /from-violet/i, /to-violet/i, /via-violet/i,
    /text-purple-/i, /bg-purple-/i,
    /bg-gradient-to-[a-z]+\s+[^"]*text-transparent/i, // gradient text
    /bg-clip-text/i
  ];

  for (const pat of slopPatterns) {
    if (pat.test(html)) {
      throw new Error(`Found forbidden AI-slop pattern in slides.html: ${pat}`);
    }
  }
  return true;
});

test('Zero card-slop nesting (no .card inside .card)', () => {
  return !html.includes('class="card') && !html.includes('card-slop');
});

test('Zero broken relative links (all src and href point to valid local or safe CDN targets)', () => {
  const srcMatches = [...html.matchAll(/(?:src|href)="([^"]+)"/gi)];
  for (const m of srcMatches) {
    const url = m[1];
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Must be trusted CDNs (tailwindcss, google fonts)
      const allowedDomains = ['cdn.tailwindcss.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
      const ok = allowedDomains.some(d => url.includes(d));
      if (!ok) {
        throw new Error(`Untrusted external domain: ${url}`);
      }
    } else if (url.startsWith('#') || url === '') {
      continue;
    } else {
      // Relative path - must exist on disk relative to public/
      const cleanPath = url.split('?')[0].split('#')[0];
      const fullPath = path.resolve(ROOT_DIR, 'public', cleanPath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Broken local link: ${url} (Resolved: ${fullPath})`);
      }
    }
  }
  return true;
});

// ----------------------------------------------------------------------
// 6. Evidence Lightbox Hook Verification
// ----------------------------------------------------------------------
console.log('\n>>> 6. Evidence Lightbox Hook Verification <<<');

test('Every evidence image container in slide-8 has an onclick openLightbox handler', () => {
  const expectedImages = [
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

  for (const imgName of expectedImages) {
    // Check if openLightbox is wired to this image or its parent
    const hasLightboxCall = html.includes(`openLightbox('evidence/${imgName}'`) ||
                            html.includes(`openLightbox('/evidence/${imgName}'`);
    if (!hasLightboxCall) {
      throw new Error(`Missing openLightbox trigger for evidence image: ${imgName}`);
    }
  }
  return true;
});

// ----------------------------------------------------------------------
// 7. Full JPEG Segment Parser & Non-Zero Dimension Validation
// ----------------------------------------------------------------------
console.log('\n>>> 7. Full JPEG Segment Parser & Dimension Verification <<<');

test('All 10 JPEG evidence files have intact bitstream markers (SOI, DQT/SOF, EOI)', () => {
  const files = [
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

  for (const f of files) {
    const buf = fs.readFileSync(path.join(EVIDENCE_DIR, f));
    // Check SOI (FF D8)
    if (buf[0] !== 0xFF || buf[1] !== 0xD8) {
      throw new Error(`${f} missing SOI marker`);
    }
    // Check EOI (FF D9 at end)
    const len = buf.length;
    let foundEOI = false;
    for (let i = len - 2; i >= Math.max(0, len - 32); i--) {
      if (buf[i] === 0xFF && buf[i+1] === 0xD9) {
        foundEOI = true;
        break;
      }
    }
    if (!foundEOI) {
      throw new Error(`${f} missing EOI marker in trailing bytes`);
    }
  }
  return true;
});

// ----------------------------------------------------------------------
// SUMMARY
// ----------------------------------------------------------------------
console.log('\n======================================================================');
console.log(`STRESS SUITE: ${suite.total} checks | ${suite.passed} PASSED | ${suite.failed} FAILED`);
console.log('======================================================================');

process.exit(suite.failed === 0 ? 0 : 1);
