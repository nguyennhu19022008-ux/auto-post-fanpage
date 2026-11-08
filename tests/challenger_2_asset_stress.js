/**
 * Challenger 2: Asset Integrity, Script Syntax & Static Stress Test Suite
 * Target: public/slides.html & public/evidence/
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT_DIR = path.resolve(__dirname, '..');
const SLIDES_PATH = path.join(ROOT_DIR, 'public', 'slides.html');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'public', 'evidence');

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, details = '', metadata = {}) {
  results.total++;
  if (passed) {
    results.passed++;
    console.log(`[PASS] ${name}`);
  } else {
    results.failed++;
    console.error(`[FAIL] ${name} -> ${details}`);
  }
  results.tests.push({ name, passed, details, metadata });
}

console.log('================================================================');
console.log('CHALLENGER 2: ASSET INTEGRITY & STATIC STRESS TEST SUITE');
console.log(`Target: ${SLIDES_PATH}`);
console.log('================================================================\n');

if (!fs.existsSync(SLIDES_PATH)) {
  console.error(`ERROR: Target file does not exist: ${SLIDES_PATH}`);
  process.exit(1);
}

const htmlContent = fs.readFileSync(SLIDES_PATH, 'utf8');

// -----------------------------------------------------------------------------
// SECTION 1: Evidence Asset Integrity
// -----------------------------------------------------------------------------
console.log('--- SECTION 1: Evidence Asset Integrity ---');

// 1.1 Extract every <img> tag and src attribute
const imgTagRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
const foundImgSources = [];
let match;
while ((match = imgTagRegex.exec(htmlContent)) !== null) {
  foundImgSources.push({
    fullTag: match[0],
    src: match[1],
    index: match.index
  });
}

recordTest(
  'Image count verification (at least 10 evidence images present)',
  foundImgSources.length >= 10,
  `Found ${foundImgSources.length} images: ${foundImgSources.map(i => i.src).join(', ')}`,
  { foundImgSources: foundImgSources.map(i => i.src) }
);

// 1.2 Verify on disk that all 10 evidence files exist in public/evidence/ with non-zero byte size
const expectedEvidenceFiles = [
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

expectedEvidenceFiles.forEach(fileName => {
  const filePath = path.join(EVIDENCE_DIR, fileName);
  const exists = fs.existsSync(filePath);
  let size = 0;
  if (exists) {
    size = fs.statSync(filePath).size;
  }
  recordTest(
    `Evidence file exists & non-zero: ${fileName}`,
    exists && size > 1024,
    `Exists: ${exists}, Size: ${size} bytes`,
    { fileName, exists, size }
  );

  // Check if referenced in HTML
  const isReferenced = foundImgSources.some(img => img.src.includes(fileName));
  recordTest(
    `Evidence file referenced in slides.html: ${fileName}`,
    isReferenced,
    `Referenced: ${isReferenced}`
  );
});

// 1.3 Inspect Slide 8 layout:
// Verify 4 BIDV receipts are framed cleanly in vertical aspect ratio without destructive cropping,
// and 6 customer chat images are clearly readable.
console.log('\n--- SECTION 1.3: Slide 8 Framing & Uncropped Media Layout ---');

const slide8Match = htmlContent.match(/<section[^>]*id=["']slide-8["'][^>]*>([\s\S]*?)<\/section>/i);
recordTest(
  'Slide 8 section exists in slides.html',
  !!slide8Match,
  slide8Match ? 'Slide 8 extracted successfully' : 'Slide 8 not found'
);

if (slide8Match) {
  const slide8Content = slide8Match[1];

  // Extract images in slide 8
  const slide8Imgs = [];
  let s8Match;
  const s8ImgRegex = /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  while ((s8Match = s8ImgRegex.exec(slide8Content)) !== null) {
    slide8Imgs.push({
      tag: s8Match[0],
      src: s8Match[1]
    });
  }

  recordTest(
    'Slide 8 contains all 10 evidence images',
    slide8Imgs.length === 10,
    `Found ${slide8Imgs.length} images inside Slide 8 (expected 10)`
  );

  // Check 4 BIDV bank receipts
  const bidvFiles = [
    'coc_200k_thuy_nhung.jpg',
    'coc_500k_thanhvu.jpg',
    'chuyenkhoan_1tr_thanhvu.jpg',
    'chuyenkhoan_300k_kimhoa.jpg'
  ];

  bidvFiles.forEach(bidvFile => {
    const imgObj = slide8Imgs.find(img => img.src.includes(bidvFile));
    if (imgObj) {
      // Check for destructive cropping anti-patterns:
      // Object-cover without vertical aspect ratio, or small max-height causing crop
      const tag = imgObj.tag;
      const hasObjectCover = /object-cover/i.test(tag);
      const hasObjectContain = /object-contain/i.test(tag);
      const hasVerticalAspect = /aspect-\[3\/4\]|aspect-\[9\/16\]|aspect-\[2\/3\]|aspect-\[3\/5\]/i.test(slide8Content);

      recordTest(
        `BIDV receipt uncropped framing: ${bidvFile}`,
        hasObjectContain || (!hasObjectCover) || (hasObjectCover && hasVerticalAspect),
        `Tag: ${tag}`
      );
    } else {
      recordTest(`BIDV receipt present in Slide 8: ${bidvFile}`, false, 'Missing image tag');
    }
  });

  // Check 6 customer chat images
  const chatFiles = [
    'chat_hocsinh_nguyen_thua.jpg',
    'chat_thay_quang_toan_gv.jpg',
    'chat_phuhuynh_co_le_ghi.jpg',
    'chat_tran_quoc_khanh_fb.jpg',
    'chat_khach_a_mau_hinh_that.jpg',
    'chat_phan_trieu_messenger.jpg'
  ];

  chatFiles.forEach(chatFile => {
    const imgObj = slide8Imgs.find(img => img.src.includes(chatFile));
    if (imgObj) {
      recordTest(
        `Chat evidence present in Slide 8: ${chatFile}`,
        true,
        `Tag: ${imgObj.tag}`
      );
    } else {
      recordTest(`Chat evidence present in Slide 8: ${chatFile}`, false, 'Missing image tag');
    }
  });

  // Check if Lightbox or zoom inspection capability is implemented for evidence
  const hasLightbox = /openLightbox|lightbox|data-zoom|showModal/i.test(htmlContent);
  recordTest(
    'Interactive zoom / Lightbox inspection exists for evidence',
    hasLightbox,
    `Lightbox support detected: ${hasLightbox}`
  );
}

// -----------------------------------------------------------------------------
// SECTION 2: Script Syntax & Execution Validation
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 2: Script Syntax & Execution Validation ---');

const scriptTagRegex = /<script(?:\s+[^>]*)?>([\s\S]*?)<\/script>/gi;
const scriptBlocks = [];
let scriptMatch;
let blockIndex = 0;

while ((scriptMatch = scriptTagRegex.exec(htmlContent)) !== null) {
  const fullTag = scriptMatch[0];
  const code = scriptMatch[1].trim();

  // Check if it's an inline script (not external src)
  const isExternal = /src=["'][^"']+["']/i.test(fullTag);
  if (!isExternal && code.length > 0) {
    blockIndex++;
    scriptBlocks.push({
      index: blockIndex,
      code,
      startOffset: scriptMatch.index,
      length: code.length
    });
  }
}

recordTest(
  'Inline script blocks detected',
  scriptBlocks.length > 0,
  `Found ${scriptBlocks.length} inline script blocks`
);

scriptBlocks.forEach(block => {
  // 2.1 Parse syntax via new Function(code)
  let syntaxPassed = false;
  let syntaxError = null;
  try {
    new Function(block.code);
    syntaxPassed = true;
  } catch (err) {
    syntaxError = err.message;
  }

  recordTest(
    `Inline script block #${block.index} (${block.length} bytes) syntax check (new Function)`,
    syntaxPassed,
    syntaxError ? `SyntaxError: ${syntaxError}` : 'Valid JavaScript syntax'
  );

  // 2.2 Parse syntax via vm.Script
  let vmPassed = false;
  let vmError = null;
  try {
    new vm.Script(block.code, { filename: `inline-script-${block.index}.js` });
    vmPassed = true;
  } catch (err) {
    vmError = err.message;
  }

  recordTest(
    `Inline script block #${block.index} vm.Script compilation`,
    vmPassed,
    vmError ? `VM Error: ${vmError}` : 'Compiled successfully'
  );
});

// -----------------------------------------------------------------------------
// SECTION 3: Anti-AI-Slop Scanner
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 3: Anti-AI-Slop Scanner ---');

// Prohibited classes & patterns per user directives:
// purple, violet, fuchsia, bg-gradient-to, bg-clip-text
const bannedSlopPatterns = [
  { name: 'purple color utilities', regex: /\b(?:text|bg|border|from|to|via)-purple-[0-9]{2,3}\b/gi },
  { name: 'violet color utilities', regex: /\b(?:text|bg|border|from|to|via)-violet-[0-9]{2,3}\b/gi },
  { name: 'fuchsia color utilities', regex: /\b(?:text|bg|border|from|to|via)-fuchsia-[0-9]{2,3}\b/gi },
  { name: 'bg-gradient-to utility', regex: /\bbg-gradient-to-[trbl]{1,2}\b/gi },
  { name: 'bg-clip-text gradient text utility', regex: /\bbg-clip-text\b/gi },
  { name: 'text-transparent gradient utility', regex: /\btext-transparent\b/gi }
];

bannedSlopPatterns.forEach(pattern => {
  const matches = htmlContent.match(pattern.regex) || [];
  recordTest(
    `Anti-AI-Slop check: zero occurrences of ${pattern.name}`,
    matches.length === 0,
    matches.length === 0 ? '0 matches' : `Found ${matches.length} matches: ${matches.slice(0, 5).join(', ')}`,
    { pattern: pattern.name, count: matches.length, samples: matches.slice(0, 5) }
  );
});

// Check for Solid Ink typography per Directive 1
const solidInkMatches = htmlContent.match(/#0F172A|#1E293B|#09090B|text-zinc-900|text-slate-900|text-neutral-900/gi) || [];
recordTest(
  'Solid ink typography applied across slides',
  solidInkMatches.length > 20,
  `Found ${solidInkMatches.length} solid ink token occurrences`
);

// -----------------------------------------------------------------------------
// SECTION 4: Viewport & Responsive Checks
// -----------------------------------------------------------------------------
console.log('\n--- SECTION 4: Viewport & Responsive Checks ---');

// 4.1 16:9 ratio is respected
const has169Ratio = /aspect-\[16\/9\]|aspect-video|ratio-16-9|16\s*\/\s*9/i.test(htmlContent);
const hasFullBleedSlide = /w-full|h-screen|min-h-screen|max-w-7xl|max-w-screen/i.test(htmlContent);

recordTest(
  '16:9 aspect ratio or presentation viewport framing defined',
  has169Ratio || hasFullBleedSlide,
  `16:9 ratio tokens: ${has169Ratio}, Full-bleed tokens: ${hasFullBleedSlide}`
);

// 4.2 Mobile media queries properly disable marquee animation on small viewports (<768px)
const hasMediaScreen = /@media\s*\([^)]*max-width:\s*(?:767|768)px\)/i.test(htmlContent);
const disablesAnimationMobile = /animation:\s*none|transform:\s*none|animation-play-state:\s*paused/i.test(htmlContent);

// Check Slide 0 mobile calm rule
const slide0MobileCheck = /@media[^{]+\{[^}]*slide0[^}]*animation:\s*none/i.test(htmlContent) ||
  /@media\s*\(\s*max-width:\s*768px\s*\)[^{]*\{[\s\S]*?\.slide0-marquee-row[\s\S]*?animation:\s*none/i.test(htmlContent);

recordTest(
  'Mobile media queries present for responsive viewport (<768px)',
  hasMediaScreen,
  `Media query defined: ${hasMediaScreen}`
);

recordTest(
  'Mobile rules calm or disable heavy animations per User Directive 6',
  disablesAnimationMobile,
  `Disables animation on mobile: ${disablesAnimationMobile}`
);

// 4.3 Natural vertical flow on small viewports
const allowsVerticalScroll = /overflow-y-auto|overflow-x-hidden|h-auto|min-h-screen/i.test(htmlContent);
recordTest(
  'Natural vertical flow / scrolling supported on viewports',
  allowsVerticalScroll,
  `Overflow / height utilities present: ${allowsVerticalScroll}`
);

// -----------------------------------------------------------------------------
// SECTION 5: Summary Output
// -----------------------------------------------------------------------------
console.log('\n================================================================');
console.log(`RESULTS SUMMARY: ${results.passed}/${results.total} PASSED (${results.failed} FAILED)`);
console.log('================================================================');

fs.writeFileSync(
  path.join(__dirname, 'challenger_2_raw_results.json'),
  JSON.stringify(results, null, 2)
);

if (results.failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
