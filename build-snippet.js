const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'extension', 'styles.css');
const jsPath = path.join(__dirname, 'extension', 'content.js');
const outPath = path.join(__dirname, 'public', 'zalo-snippet.js');

const css = fs.readFileSync(cssPath, 'utf8');
const js = fs.readFileSync(jsPath, 'utf8');

const combined = `/**
 * LAPTOP VƯƠNG GIA // ZALO WEB INJECTOR (CONSOLE / BOOKMARKLET VERSION)
 */
(function() {
  if (window.__VG_ZALO_AUTOPOST_LOADED__) {
    console.log('[VG Zalo] Đã được kích hoạt trước đó!');
    alert('⚡ Tiện ích Đăng Bài Laptop Vương Gia đã sẵn sàng trên Zalo!');
    return;
  }
  window.__VG_ZALO_AUTOPOST_LOADED__ = true;

  // 1. Inject Styles
  const styleEl = document.createElement('style');
  styleEl.id = 'vg-zalo-styles';
  styleEl.textContent = ${JSON.stringify(css)};
  document.head.appendChild(styleEl);

  // 2. Core content logic
  ${js}

  console.log('[VG Zalo Autopost] Kích hoạt thành công qua DevTools Console!');
})();
`;

fs.writeFileSync(outPath, combined, 'utf8');
console.log('Successfully created public/zalo-snippet.js, size:', combined.length);
