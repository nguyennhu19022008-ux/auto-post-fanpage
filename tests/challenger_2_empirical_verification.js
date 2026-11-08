/**
 * Comprehensive Empirical Verification Harness for Challenger 2
 * Author: Challenger 2 (Asset Integrity & Static Stress Challenger)
 * Date: 2026-11-07
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SLIDES_PATH = path.join(ROOT_DIR, 'public', 'slides.html');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'public', 'evidence');

const report = {
  timestamp: new Date().toISOString(),
  target: SLIDES_PATH,
  summary: {
    total: 0,
    passed: 0,
    failed: 0
  },
  suites: []
};

let currentSuite = null;

function suite(name) {
  currentSuite = {
    name,
    total: 0,
    passed: 0,
    failed: 0,
    checks: []
  };
  report.suites.push(currentSuite);
  console.log(`\n======================================================`);
  console.log(`SUITE: ${name}`);
  console.log(`======================================================`);
}

function check(name, condition, details = '') {
  report.summary.total++;
  currentSuite.total++;
  const result = { name, passed: Boolean(condition), details };
  if (condition) {
    report.summary.passed++;
    currentSuite.passed++;
    console.log(`  [PASS] ${name}`);
  } else {
    report.summary.failed++;
    currentSuite.failed++;
    console.error(`  [FAIL] ${name} ${details ? '--> ' + details : ''}`);
  }
  currentSuite.checks.push(result);
}

const html = fs.readFileSync(SLIDES_PATH, 'utf8');

// ====================================================================
// SUITE 1: Evidence Asset Integrity & Non-Destructive Layout
// ====================================================================
suite('Evidence Asset Integrity & Slide 8 Layout');

const expectedEvidence = [
  { file: 'coc_200k_thuy_nhung.jpg', type: 'BIDV Receipt', minBytes: 100000 },
  { file: 'coc_500k_thanhvu.jpg', type: 'BIDV Receipt', minBytes: 100000 },
  { file: 'chuyenkhoan_1tr_thanhvu.jpg', type: 'BIDV Receipt', minBytes: 100000 },
  { file: 'chuyenkhoan_300k_kimhoa.jpg', type: 'BIDV Receipt', minBytes: 300000 },
  { file: 'chat_hocsinh_nguyen_thua.jpg', type: 'Customer Chat', minBytes: 150000 },
  { file: 'chat_thay_quang_toan_gv.jpg', type: 'Customer Chat', minBytes: 70000 },
  { file: 'chat_phuhuynh_co_le_ghi.jpg', type: 'Customer Chat', minBytes: 100000 },
  { file: 'chat_tran_quoc_khanh_fb.jpg', type: 'Customer Chat', minBytes: 150000 },
  { file: 'chat_khach_a_mau_hinh_that.jpg', type: 'Customer Chat', minBytes: 100000 },
  { file: 'chat_phan_trieu_messenger.jpg', type: 'Customer Chat', minBytes: 150000 }
];

expectedEvidence.forEach(item => {
  const filePath = path.join(EVIDENCE_DIR, item.file);
  const exists = fs.existsSync(filePath);
  let size = 0;
  if (exists) {
    size = fs.statSync(filePath).size;
  }
  check(`File exists on disk: ${item.file}`, exists, `Path: ${filePath}`);
  check(`File size non-zero & substantial: ${item.file} (${size} bytes)`, exists && size >= item.minBytes, `Size: ${size} bytes (min: ${item.minBytes})`);
  check(`Image referenced in slides.html: ${item.file}`, html.includes(`evidence/${item.file}`));
});

// Extract Slide 8 DOM
const s8Match = html.match(/<section[^>]*id="slide-8"[^>]*>([\s\S]*?)<\/section>/i);
check('Slide 8 DOM element exists in slides.html', Boolean(s8Match));

if (s8Match) {
  const s8 = s8Match[1];
  
  // Verify 4 BIDV receipts uncropped framing
  const bidvFiles = expectedEvidence.filter(e => e.type === 'BIDV Receipt');
  bidvFiles.forEach(b => {
    const imgRegex = new RegExp(`<img[^>]*src="[^"]*${b.file}"[^>]*>`, 'i');
    const imgTagMatch = s8.match(imgRegex);
    check(`BIDV image tag exists in Slide 8: ${b.file}`, Boolean(imgTagMatch));
    if (imgTagMatch) {
      const tag = imgTagMatch[0];
      const hasObjectContain = tag.includes('object-contain');
      const hasDestructiveCover = tag.includes('object-cover');
      check(`BIDV receipt has object-contain (zero cropping): ${b.file}`, hasObjectContain && !hasDestructiveCover, `Tag: ${tag}`);
      check(`BIDV receipt has zoom/lightbox click trigger: ${b.file}`, tag.includes('openLightbox') || s8.includes(`openLightbox('evidence/${b.file}'`));
    }
  });

  // Verify 6 Customer Chat images readability & uncropped framing
  const chatFiles = expectedEvidence.filter(e => e.type === 'Customer Chat');
  chatFiles.forEach(c => {
    const imgRegex = new RegExp(`<img[^>]*src="[^"]*${c.file}"[^>]*>`, 'i');
    const imgTagMatch = s8.match(imgRegex);
    check(`Customer chat image tag exists in Slide 8: ${c.file}`, Boolean(imgTagMatch));
    if (imgTagMatch) {
      const tag = imgTagMatch[0];
      const hasObjectContain = tag.includes('object-contain');
      check(`Customer chat has object-contain (full bubble readable): ${c.file}`, hasObjectContain, `Tag: ${tag}`);
      check(`Customer chat has zoom/lightbox click trigger: ${c.file}`, tag.includes('openLightbox') || s8.includes(`openLightbox('evidence/${c.file}'`));
    }
  });

  // Verify Lightbox markup
  check('evidenceLightboxModal exists in document', html.includes('id="evidenceLightboxModal"'));
  check('lightboxImg exists in document', html.includes('id="lightboxImg"'));
  check('lightboxTitle exists in document', html.includes('id="lightboxTitle"'));
  check('lightboxCaption exists in document', html.includes('id="lightboxCaption"'));
}

// ====================================================================
// SUITE 2: Script Syntax & Execution Validation
// ====================================================================
suite('Script Syntax & Execution Validation');

const scriptTagRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
let sm;
let scriptIdx = 0;
while ((sm = scriptTagRegex.exec(html)) !== null) {
  const fullTag = sm[0];
  const code = sm[1].trim();
  if (!code) continue; // External script
  scriptIdx++;
  
  // 1. Syntax check via new Function
  let funcPassed = false;
  let funcErr = null;
  try {
    new Function(code);
    funcPassed = true;
  } catch (err) {
    funcErr = err.message;
  }
  check(`Inline script #${scriptIdx} passes new Function() syntax test`, funcPassed, funcErr);

  // 2. Compilation check via vm.Script
  let vmPassed = false;
  let vmErr = null;
  try {
    new vm.Script(code, { filename: `script_${scriptIdx}.js` });
    vmPassed = true;
  } catch (err) {
    vmErr = err.message;
  }
  check(`Inline script #${scriptIdx} compiles cleanly in Node vm`, vmPassed, vmErr);
}

// ====================================================================
// SUITE 3: Anti-AI-Slop Scanner
// ====================================================================
suite('Anti-AI-Slop Scanner & Aesthetic Directives');

const prohibitedPatterns = [
  { name: 'purple utilities', pattern: /\b(?:text|bg|border|from|to|via)-purple-[0-9]{2,3}\b/i },
  { name: 'violet utilities', pattern: /\b(?:text|bg|border|from|to|via)-violet-[0-9]{2,3}\b/i },
  { name: 'fuchsia utilities', pattern: /\b(?:text|bg|border|from|to|via)-fuchsia-[0-9]{2,3}\b/i },
  { name: 'bg-gradient-to utilities', pattern: /\bbg-gradient-to-[trbl]{1,2}\b/i },
  { name: 'bg-clip-text text gradient', pattern: /\bbg-clip-text\b/i },
  { name: 'from-purple token', pattern: /from-purple/i },
  { name: 'to-violet token', pattern: /to-violet/i },
  { name: 'from-indigo token', pattern: /from-indigo/i },
  { name: 'to-fuchsia token', pattern: /to-fuchsia/i },
  { name: 'Space Mono banned font', pattern: /Space Mono/i },
  { name: 'font-space banned utility', pattern: /font-space/i }
];

prohibitedPatterns.forEach(p => {
  const matches = html.match(new RegExp(p.pattern, 'gi')) || [];
  check(`Zero occurrences of prohibited ${p.name}`, matches.length === 0, `Matches: ${matches.join(', ')}`);
});

// Check font usage across slides 1 to 9 (Anton should NOT be used for slide content)
const slide1Pos = html.indexOf('id="slide-1"');
if (slide1Pos !== -1) {
  const slidesContent = html.substring(slide1Pos);
  const antonMatches = slidesContent.match(/\bfont-anton\b/gi) || [];
  check('Zero occurrences of font-anton in Slides 1 through 9', antonMatches.length === 0, `Found ${antonMatches.length} occurrences`);
}

// Check solid ink contrast
const solidInkColors = ['#0F172A', '#1E293B', '#09090B', 'text-slate-900', 'text-zinc-900', 'text-neutral-900'];
let solidInkCount = 0;
solidInkColors.forEach(c => {
  const count = (html.match(new RegExp(c, 'gi')) || []).length;
  solidInkCount += count;
});
check(`Solid ink color tokens abundant (>15 occurrences)`, solidInkCount >= 15, `Found ${solidInkCount} occurrences`);

// ====================================================================
// SUITE 4: Viewport & Responsive Checks
// ====================================================================
suite('Viewport & Responsive Checks');

// 1. Aspect ratio 16:9 defined
const hasAspectRatio = html.includes('aspect-video') || html.includes('aspect-ratio: 16 / 9') || html.includes('aspect-ratio: 16/9') || html.includes('aspect-[16/9]');
check('Slide frame defines or respects 16:9 aspect ratio', hasAspectRatio);

// 2. Mobile media query exists (<768px)
const hasMobileQuery = /@media\s*\(\s*max-width:\s*768px\s*\)/i.test(html);
check('Mobile media query @media (max-width: 768px) defined', hasMobileQuery);

// 3. Mobile marquee disabled per Directive 6 (Calm Mobile Performance)
const mobileMarqueeDisabled = /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.slide0-marquee-row[\s\S]*?animation:\s*none/i.test(html);
check('Mobile media query disables Slide 0 marquee animation', mobileMarqueeDisabled);

// 4. Mobile slide-frame allows natural vertical scroll
const mobileVerticalScroll = /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.slide-frame[\s\S]*?overflow-y:\s*auto/i.test(html);
check('Mobile media query unsets aspect-ratio and enables overflow-y: auto', mobileVerticalScroll);

// 5. Mobile col-divider adapts to horizontal hairline
const mobileDivider = /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.col-divider[\s\S]*?border-bottom/i.test(html);
check('Mobile col-divider switches to horizontal divider on small screens', mobileDivider);

// ====================================================================
// FINAL REPORT
// ====================================================================
console.log(`\n======================================================`);
console.log(`SUMMARY: ${report.summary.passed} / ${report.summary.total} CHECKS PASSED (${report.summary.failed} FAILED)`);
console.log(`======================================================`);

fs.writeFileSync(
  path.join(ROOT_DIR, '.agents', 'teamwork', 'challenger_2', 'empirical_results.json'),
  JSON.stringify(report, null, 2)
);

if (report.summary.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
