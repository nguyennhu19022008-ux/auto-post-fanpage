/**
 * Challenger 2: Deep Dive into Slide 8 Layout & Mobile Responsive Flow
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SLIDES_PATH = path.join(ROOT_DIR, 'public', 'slides.html');
const content = fs.readFileSync(SLIDES_PATH, 'utf8');

console.log('=== DEEP DIVE: SLIDE 8 INSPECTION ===');

const s8Match = content.match(/<section[^>]*id="slide-8"[^>]*>([\s\S]*?)<\/section>/);
if (!s8Match) {
  console.error('Slide 8 not found!');
  process.exit(1);
}

const s8 = s8Match[1];

// Find all img tags in Slide 8
const imgRegex = /<img\s+[^>]*src="([^"]+)"[^>]*>/g;
let m;
const imgs = [];
while ((m = imgRegex.exec(s8)) !== null) {
  imgs.push({
    full: m[0],
    src: m[1]
  });
}

console.log(`Slide 8 contains ${imgs.length} images:`);
imgs.forEach((img, idx) => {
  console.log(`\nImage ${idx + 1}: ${img.src}`);
  console.log(`Tag: ${img.full}`);
  
  // Find surrounding container element
  const imgPos = s8.indexOf(img.full);
  const before = s8.substring(Math.max(0, imgPos - 300), imgPos);
  const after = s8.substring(imgPos + img.full.length, Math.min(s8.length, imgPos + img.full.length + 300));
  
  const containerMatch = before.match(/<div[^>]*class="([^"]+)"[^>]*>[^<]*$/);
  if (containerMatch) {
    console.log(`Container class: ${containerMatch[1]}`);
  }
});

console.log('\n=== CHECKING LIGHTBOX / MODAL CODE ===');
const hasLightboxModal = content.includes('id="lightboxModal"') || content.includes('id="imageModal"');
console.log('Has lightboxModal:', hasLightboxModal);

const lightboxFunctions = ['openLightbox', 'closeLightbox'];
lightboxFunctions.forEach(fn => {
  console.log(`Function ${fn} defined:`, content.includes(`function ${fn}`));
});

console.log('\n=== CHECKING CSS MEDIA QUERIES FOR RESPONSIVE & MARQUEE ===');
const cssBlocks = content.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
console.log(`Found ${cssBlocks.length} style blocks.`);

cssBlocks.forEach((block, idx) => {
  console.log(`\nStyle block #${idx + 1}:`);
  const mediaMatches = block.match(/@media[^{]+\{[\s\S]*?\}(?:\s*\})/gi) || [];
  mediaMatches.forEach(mm => {
    console.log('--- Media Query ---');
    console.log(mm);
  });
});

console.log('\n=== CHECKING SCRIPT LOGIC FOR SLIDE DOCK & TIMER BAR ===');
const hasDock = content.includes('id="slideDock"');
const hasTimerBar = content.includes('id="timerBar"');
console.log('Has #slideDock:', hasDock);
console.log('Has #timerBar:', hasTimerBar);

// Check if dock is hidden on Slide 0
const hidesDockOnSlide0 = content.includes('slideDock.classList.add("hidden")') || 
                          content.includes("slideDock.classList.add('hidden')") ||
                          content.includes('dock.classList.add("hidden")') ||
                          content.includes("dock.classList.add('hidden')") ||
                          content.includes('slideDock.style.display = "none"') ||
                          content.includes("slideDock.style.display = 'none'") ||
                          content.includes('opacity-0 pointer-events-none');
console.log('Hides dock on Slide 0 in script/css:', hidesDockOnSlide0);
