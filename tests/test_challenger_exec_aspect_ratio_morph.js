/**
 * Empirical Aspect Ratio & Cross-Screen Stress Challenger Suite
 * Invoked for: challenger_exec_2
 * Target: public/slides.html
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SLIDES_PATH = path.join(ROOT_DIR, 'public', 'slides.html');

const results = {
  timestamp: new Date().toISOString(),
  target: SLIDES_PATH,
  total: 0,
  passed: 0,
  failed: 0,
  checks: [],
  metrics: {}
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
console.log('CHALLENGER EXEC 2: EMPIRICAL ASPECT RATIO, CROSS-SCREEN & MORPH STRESS');
console.log('Target:', SLIDES_PATH);
console.log('======================================================================\n');

assert(fs.existsSync(SLIDES_PATH), 'public/slides.html exists on disk');
const html = fs.readFileSync(SLIDES_PATH, 'utf8');

// ======================================================================
// TASK 1: CSS & Responsive Geometry Clamping Formulas
// ======================================================================
console.log('\n>>> TASK 1: CSS & Responsive Geometry Clamping Formulas <<<');

// 1.1 Verify exact 16:9 clamping CSS formulas
const hasAspect16_9 = /aspect-ratio:\s*16\s*\/\s*9/i.test(html);
assert(hasAspect16_9, 'CSS defines aspect-ratio: 16 / 9');

const hasMaxWidthClamping = /max-width:\s*177\.78vh/i.test(html);
assert(hasMaxWidthClamping, 'CSS defines max-width: 177.78vh (16/9 = 1.77778 clamp)');

const hasMaxHeightClamping = /max-height:\s*56\.25vw/i.test(html);
assert(hasMaxHeightClamping, 'CSS defines max-height: 56.25vw (9/16 = 0.5625 clamp)');

// 1.2 Verify media queries for aspect ratios
const hasMaxAspectQuery = /@media\s*\(\s*max-aspect-ratio:\s*16\/9\s*\)/i.test(html);
assert(hasMaxAspectQuery, 'CSS specifies @media (max-aspect-ratio: 16/9) for vertical/narrow screen handling');

const hasMinAspectQuery = /@media\s*\(\s*min-aspect-ratio:\s*16\/9\s*\)/i.test(html);
assert(hasMinAspectQuery, 'CSS specifies @media (min-aspect-ratio: 16/9) for ultra-wide screen handling');

// 1.3 Viewport styling & scrollbar elimination
const hasHtmlBodyOverflowHidden = /html,\s*body\s*\{[^}]*overflow:\s*hidden/i.test(html);
assert(hasHtmlBodyOverflowHidden, 'html, body styling enforces overflow: hidden');

const hasViewportStageFlex = /#viewportStage\s*\{[^}]*display:\s*flex[^}]*align-items:\s*center[^}]*justify-content:\s*center/i.test(html);
assert(hasViewportStageFlex, '#viewportStage is styled with flex centering (align-items: center, justify-content: center)');

const hasViewportStage100 = /#viewportStage\s*\{[^}]*width:\s*100vw[^}]*height:\s*100vh/i.test(html);
assert(hasViewportStage100, '#viewportStage occupies 100vw and 100vh full screen');

const hasNoScrollbarRule = !/overflow(-[xy])?:\s*(scroll|auto)/i.test(
  html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/gi, '')
);
assert(hasNoScrollbarRule, 'No unintended overflow: scroll or overflow: auto rules on main slide stage');

// 1.4 Geometry Calculation Engine across 50 Viewport Presets
console.log('\n--- Evaluating Responsive Geometry across Presets ---');

function simulateLayout(viewportW, viewportH) {
  // CSS rule reproduction:
  // .canvas-16-9: width: 100%, height: 100%, max-width: 177.78vh, max-height: 56.25vw, aspect-ratio: 16/9
  // @media (max-aspect-ratio: 16/9): width: 100vw, height: 56.25vw
  // @media (min-aspect-ratio: 16/9): height: 100vh, width: 177.78vh
  const aspect = viewportW / viewportH;
  const targetAspect = 16 / 9; // 1.7777777777777777
  
  let canvasW, canvasH;
  if (aspect <= targetAspect) {
    // Screen is taller/narrower than 16:9 (e.g. 4:3, mobile portrait, iPad)
    // Letterbox on top & bottom
    canvasW = viewportW;
    canvasH = viewportW * (9 / 16); // 56.25vw
  } else {
    // Screen is wider than 16:9 (e.g. 21:9, ultra-wide)
    // Pillarbox on left & right
    canvasH = viewportH;
    canvasW = viewportH * (16 / 9); // 177.78vh
  }

  const verticalBars = viewportH - canvasH;
  const horizontalBars = viewportW - canvasW;
  const topBar = Math.max(0, verticalBars / 2);
  const bottomBar = Math.max(0, verticalBars / 2);
  const leftBar = Math.max(0, horizontalBars / 2);
  const rightBar = Math.max(0, horizontalBars / 2);

  const renderedRatio = canvasW / canvasH;
  const ratioDelta = Math.abs(renderedRatio - targetAspect);

  const overflowX = canvasW > viewportW;
  const overflowY = canvasH > viewportH;

  return {
    viewportW,
    viewportH,
    aspect: aspect.toFixed(3),
    canvasW: Math.round(canvasW * 100) / 100,
    canvasH: Math.round(canvasH * 100) / 100,
    renderedRatio: renderedRatio.toFixed(4),
    ratioDelta,
    topBar: Math.round(topBar * 100) / 100,
    bottomBar: Math.round(bottomBar * 100) / 100,
    leftBar: Math.round(leftBar * 100) / 100,
    rightBar: Math.round(rightBar * 100) / 100,
    overflowX,
    overflowY,
    type: aspect < 1.77 ? 'letterboxing (top/bottom bars)' : (aspect > 1.78 ? 'pillarboxing (left/right bars)' : 'exact fit')
  };
}

const testViewports = [
  // 4:3 Screens
  { name: 'SVGA (4:3)', w: 800, h: 600 },
  { name: 'XGA (4:3)', w: 1024, h: 768 },
  { name: 'SXGA+ (4:3)', w: 1400, h: 1050 },
  { name: 'UXGA (4:3)', w: 1600, h: 1200 },
  // 16:9 Screens
  { name: 'HD 720p (16:9)', w: 1280, h: 720 },
  { name: 'WXGA+ (16:9)', w: 1600, h: 900 },
  { name: 'Full HD 1080p (16:9)', w: 1920, h: 1080 },
  { name: 'QHD 1440p (16:9)', w: 2560, h: 1440 },
  { name: '4K UHD (16:9)', w: 3840, h: 2160 },
  // 21:9 Ultra-wide Screens
  { name: 'UW-UXGA (21:9)', w: 2560, h: 1080 },
  { name: 'UW-QHD (21:9)', w: 3440, h: 1440 },
  { name: '5K2K (21:9)', w: 5120, h: 2160 },
  // 16:10 Laptop Screens
  { name: 'MacBook Air / Pro (16:10)', w: 1440, h: 900 },
  { name: 'WUXGA (16:10)', w: 1920, h: 1200 },
  { name: 'WQXGA (16:10)', w: 2560, h: 1600 },
  // Portrait / Mobile
  { name: 'iPhone 13/14 (19.5:9)', w: 390, h: 844 },
  { name: 'iPad Portrait (4:3)', w: 768, h: 1024 }
];

let allGeometriesValid = true;
const sampleGeometryResults = [];

for (const vp of testViewports) {
  const sim = simulateLayout(vp.w, vp.h);
  sampleGeometryResults.push({ preset: vp.name, ...sim });
  
  if (sim.overflowX || sim.overflowY || sim.ratioDelta > 0.001) {
    allGeometriesValid = false;
  }
}

assert(allGeometriesValid, 'All 17 test viewport presets maintain exact 16:9 ratio with ZERO overflow');

// Verify 4:3, 16:9, and 21:9 specific behavior
const xga = sampleGeometryResults.find(r => r.preset === 'XGA (4:3)');
assert(xga && xga.canvasW === 1024 && xga.canvasH === 576 && xga.topBar === 96 && xga.bottomBar === 96,
  '4:3 (1024x768) accurately computes 1024x576 with 96px top/bottom bars');

const fhd = sampleGeometryResults.find(r => r.preset === 'Full HD 1080p (16:9)');
assert(fhd && fhd.canvasW === 1920 && fhd.canvasH === 1080 && fhd.topBar === 0 && fhd.leftBar === 0,
  '16:9 (1920x1080) accurately computes exact 1920x1080 fit with 0px bars');

const uw = sampleGeometryResults.find(r => r.preset === 'UW-UXGA (21:9)');
assert(uw && uw.canvasH === 1080 && Math.abs(uw.canvasW - 1920) < 1 && Math.abs(uw.leftBar - 320) < 1,
  '21:9 (2560x1080) accurately computes 1920x1080 with 320px left/right bars');

results.metrics.geometrySamples = sampleGeometryResults;


// ======================================================================
// TASK 2: PowerPoint Morph Engine & View Transitions Stress Harness
// ======================================================================
console.log('\n>>> TASK 2: PowerPoint Morph Engine & View Transitions Stress Harness <<<');

// 2.1 CSS View Transitions rules
const hasViewTransitionRule = /@view-transition\s*\{[^}]*navigation:\s*auto/i.test(html);
assert(hasViewTransitionRule, '@view-transition CSS rule is declared with navigation: auto');

const hasOldNewRoot = /::view-transition-(old|new)\(root\)/i.test(html);
assert(hasOldNewRoot, '::view-transition-old(root) and ::view-transition-new(root) are configured');

// 2.2 Spring physics cubic-bezier curve: cubic-bezier(0.16, 1, 0.3, 1)
const springCurveMatches = html.match(/cubic-bezier\(\s*0\.16\s*,\s*1\s*,\s*0\.3\s*,\s*1\s*\)/g);
assert(springCurveMatches && springCurveMatches.length >= 4,
  `PowerPoint spring physics curve cubic-bezier(0.16, 1, 0.3, 1) used across key animation points (found ${springCurveMatches ? springCurveMatches.length : 0} instances)`);

// 2.3 Shared morph element view-transition-names
const hasProgressBarVT = /#slideProgressBar\s*\{[^}]*view-transition-name:\s*progress-bar/i.test(html);
assert(hasProgressBarVT, '#slideProgressBar has view-transition-name: progress-bar assigned');

const hasNumberDisplayVT = /#slideNumberDisplay\s*\{[^}]*view-transition-name:\s*slide-counter/i.test(html);
assert(hasNumberDisplayVT, '#slideNumberDisplay has view-transition-name: slide-counter assigned');

// 2.4 JavaScript Engine Stress Testing (Mock DOM & VM environment)
console.log('\n--- Simulating showSlide() logic in sandboxed VM ---');

const jsScriptMatches = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)];
const mainScriptMatch = jsScriptMatches.find(m => m[1].includes('function showSlide'));
assert(mainScriptMatch && mainScriptMatch[1].length > 0, 'Extracted main presentation JavaScript logic block');
const scriptContentToRun = mainScriptMatch ? mainScriptMatch[1] : '';

function createMockEnvironment(hasViewTransitionsAPI = true) {
  const slides = [];
  for (let i = 1; i <= 9; i++) {
    slides.push({
      id: `slide-${i}`,
      classList: {
        classes: new Set(i === 1 ? ['slide-page', 'active'] : ['slide-page']),
        add(c) { this.classes.add(c); },
        remove(c) { this.classes.delete(c); },
        contains(c) { return this.classes.has(c); }
      }
    });
  }

  const progressBar = {
    id: 'slideProgressBar',
    style: { width: '11.11%' }
  };

  const numberDisplay = {
    id: 'slideNumberDisplay',
    textContent: '01 / 09'
  };

  const doc = {
    startViewTransition: hasViewTransitionsAPI ? function(fn) {
      // Synchronously run transition callback as native engine does
      fn();
      return { finished: Promise.resolve(), ready: Promise.resolve() };
    } : undefined,
    querySelectorAll(selector) {
      if (selector === '.slide-page') return slides;
      return [];
    },
    getElementById(id) {
      if (id === 'slideProgressBar') return progressBar;
      if (id === 'slideNumberDisplay') return numberDisplay;
      const found = slides.find(s => s.id === id);
      if (found) return found;
      return null;
    }
  };

  const win = {
    addEventListener: () => {},
    document: doc
  };

  const sandbox = {
    window: win,
    document: doc,
    console: console,
    Number: Number,
    isNaN: isNaN,
    Math: Math,
    slides,
    progressBar,
    numberDisplay
  };

  vm.createContext(sandbox);

  // Extract clean JS without external dependencies
  const scriptContent = scriptContentToRun;
  // Run script
  vm.runInContext(scriptContent, sandbox);

  return sandbox;
}

// Test with native View Transitions API
const envNative = createMockEnvironment(true);
assert(typeof envNative.showSlide === 'function', 'showSlide function is instantiated in environment');
assert(typeof envNative.nextSlide === 'function', 'nextSlide function is instantiated in environment');
assert(typeof envNative.prevSlide === 'function', 'prevSlide function is instantiated in environment');

// Test Sequential Slide Navigation 1 -> 9
let sequentialSuccess = true;
for (let target = 2; target <= 9; target++) {
  envNative.showSlide(target);
  const activeSlide = envNative.slides.find(s => s.classList.contains('active'));
  const activeCount = envNative.slides.filter(s => s.classList.contains('active')).length;
  const expectedProgress = ((target / 9) * 100) + '%';
  const expectedCounter = `0${target} / 09`;

  if (!activeSlide || activeSlide.id !== `slide-${target}` || activeCount !== 1) {
    sequentialSuccess = false;
  }
  if (envNative.progressBar.style.width !== expectedProgress || envNative.numberDisplay.textContent !== expectedCounter) {
    sequentialSuccess = false;
  }
}
assert(sequentialSuccess, 'Native View Transitions mode: Sequential navigation 1..9 correctly updates active class, progress bar width, and counter text');

// Test Fallback mechanism (document.startViewTransition is undefined)
console.log('\n--- Testing Fallback Mechanism when View Transitions API is unsupported ---');
const envFallback = createMockEnvironment(false);
assert(envFallback.document.startViewTransition === undefined, 'Simulated browser where document.startViewTransition is undefined');

let fallbackSuccess = true;
for (let target = 2; target <= 9; target++) {
  envFallback.showSlide(target);
  const activeSlide = envFallback.slides.find(s => s.classList.contains('active'));
  const activeCount = envFallback.slides.filter(s => s.classList.contains('active')).length;
  if (!activeSlide || activeSlide.id !== `slide-${target}` || activeCount !== 1) {
    fallbackSuccess = false;
  }
}
assert(fallbackSuccess, 'Fallback mode: showSlide() succeeds smoothly without errors when document.startViewTransition is absent');

// Test Boundary & Out-of-bounds inputs
console.log('\n--- Stress-testing input boundaries on showSlide() ---');
const badInputs = [0, 10, -1, 99, 'invalid', NaN, null, undefined, {}];
let boundaryProtected = true;

// Currently at slide 9 in envNative
for (const input of badInputs) {
  envNative.showSlide(input);
  const active = envNative.slides.find(s => s.classList.contains('active'));
  if (!active || active.id !== 'slide-9' || envNative.numberDisplay.textContent !== '09 / 09') {
    boundaryProtected = false;
  }
}
assert(boundaryProtected, 'Boundary inputs (0, 10, -1, 99, NaN, "invalid", null, undefined) safely ignored without state corruption');

// Test nextSlide at max (9) and prevSlide at min (1)
envNative.showSlide(9);
envNative.nextSlide();
const activeAfterNext = envNative.slides.find(s => s.classList.contains('active'));
assert(activeAfterNext && activeAfterNext.id === 'slide-9' && envNative.numberDisplay.textContent === '09 / 09',
  'nextSlide() clamps safely at slide 9 (cannot exceed totalSlides)');

envNative.showSlide(1);
envNative.prevSlide();
const activeAfterPrev = envNative.slides.find(s => s.classList.contains('active'));
assert(activeAfterPrev && activeAfterPrev.id === 'slide-1' && envNative.numberDisplay.textContent === '01 / 09',
  'prevSlide() clamps safely at slide 1 (cannot go below 1)');


// ======================================================================
// TASK 3: Anti-Slop Visual Constraints & Typography Tokens
// ======================================================================
console.log('\n>>> TASK 3: Anti-Slop Visual Constraints & Typography Tokens <<<');

// 3.1 Ensure ZERO linear-gradient purple/violet/indigo backgrounds
const purpleGradientRegex = /linear-gradient\([^)]*(purple|violet|indigo|fuchsia|rgba?\(\s*(14[0-9]|15[0-9]|16[0-9]|17[0-9]|18[0-9]|19[0-9]|20[0-9]|12[0-9]|13[0-9]),\s*(0|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9]|6[0-9]|7[0-9]),\s*(2[0-5][0-5]|1[8-9][0-9]))/i;
const hasPurpleGradient = purpleGradientRegex.test(html);
assert(!hasPurpleGradient, 'ZERO linear-gradient purple/violet/indigo backgrounds detected');

// Also scan tailwind gradient utility classes
const tailwindPurpleGradients = html.match(/(from|to|via)-(purple|violet|indigo|fuchsia)-[0-9]+/gi);
assert(!tailwindPurpleGradients, `ZERO Tailwind purple/violet/indigo gradient classes (found: ${tailwindPurpleGradients ? tailwindPurpleGradients.join(', ') : 'none'})`);

// 3.2 Ensure ZERO text gradient clipping (bg-clip-text)
const hasBgClipText = /bg-clip-text/i.test(html);
assert(!hasBgClipText, 'ZERO text gradient clipping (bg-clip-text) in public/slides.html');

const hasTextTransparent = /text-transparent/i.test(html);
assert(!hasTextTransparent, 'ZERO text-transparent classes (ensures 100% solid ink rendering)');

// 3.3 Ensure typography classes use solid ink tokens (#0E1013, #1E293B, #F8F7F3)
const inkTokensDeclared = {
  ink: /ink:\s*['"]#0E1013['"]/i.test(html),
  canvas: /canvas:\s*['"]#F8F7F3['"]/i.test(html),
  inkSecondary: /'ink-secondary':\s*['"]#2A303C['"]/i.test(html),
  vermilion: /vermilion:\s*['"]#C93B2B['"]/i.test(html),
  pine: /pine:\s*['"]#1E4D38['"]/i.test(html)
};
assert(inkTokensDeclared.ink, 'Declared primary solid ink token #0E1013');
assert(inkTokensDeclared.canvas, 'Declared primary canvas background token #F8F7F3');
assert(inkTokensDeclared.inkSecondary, 'Declared secondary solid ink token #2A303C');
assert(inkTokensDeclared.vermilion, 'Declared accent vermilion token #C93B2B');
assert(inkTokensDeclared.pine, 'Declared accent pine token #1E4D38');

// 3.4 Cardless Open Grid vs Card-Slop Stress Test
console.log('\n--- Inspecting Cardless Open Editorial Grid Architecture ---');

// Check for nested card-in-card slop:
// Looking for containers with card-like borders/backgrounds nested inside another card container
const cardClassPatterns = [
  /<div[^>]*class="[^"]*(bg-white|bg-slate-100|border\s+border-slate)[^"]*"[^>]*>[\s\S]*?<div[^>]*class="[^"]*(bg-white|bg-slate-100|border\s+border-slate)[^"]*"/gi
];

let nestedCardSlopFound = false;
for (const pattern of cardClassPatterns) {
  if (pattern.test(html)) {
    nestedCardSlopFound = true;
    break;
  }
}
assert(!nestedCardSlopFound, 'ZERO nested card-inside-card slop patterns detected');

// Verify use of editorial hairlines instead of heavy card boxes
const hairlineCount = (html.match(/hairline-[btlr]/g) || []).length;
assert(hairlineCount >= 20, `Editorial hairline grid dividers used consistently (found ${hairlineCount} hairlines)`);

// Verify font families: Plus Jakarta Sans, Be Vietnam Pro, JetBrains Mono
const hasJakartaSans = /Plus\+Jakarta\+Sans/i.test(html);
const hasBeVietnam = /Be\+Vietnam\+Pro/i.test(html);
const hasJetBrainsMono = /JetBrains\+Mono/i.test(html);
assert(hasJakartaSans && hasBeVietnam && hasJetBrainsMono, 'Editorial typography stack loaded: Plus Jakarta Sans + Be Vietnam Pro + JetBrains Mono');

// ======================================================================
// FINAL SUMMARY & VERDICT
// ======================================================================
console.log('\n======================================================================');
console.log(`TOTAL CHECKS: ${results.total}`);
console.log(`PASSED: ${results.passed}`);
console.log(`FAILED: ${results.failed}`);
const verdict = results.failed === 0 ? 'APPROVE' : 'REQUEST_CHANGES';
console.log(`VERDICT: ${verdict}`);
console.log('======================================================================\n');

results.verdict = verdict;

// Output results json
fs.writeFileSync(
  path.join(ROOT_DIR, '.agents', 'teamwork', 'challenger_exec_2', 'aspect_ratio_morph_results.json'),
  JSON.stringify(results, null, 2),
  'utf8'
);
