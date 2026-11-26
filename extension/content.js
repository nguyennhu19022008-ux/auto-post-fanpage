/**
 * LAPTOP VƯƠNG GIA // ZALO AUTOPOST HELPER
 * Content Script for chat.zalo.me
 */

(function () {
  'use strict';

  console.log('[VG Zalo Autopost] Tiện ích tự động đẩy bài Laptop Vương Gia đã sẵn sàng!');

  let defaultServerUrl = 'https://auto-post-fanpage-coral.vercel.app';

  // Load configured backend URL from storage if user customized it
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['backendUrl'], (result) => {
      if (result.backendUrl) defaultServerUrl = result.backendUrl;
    });
  }

  /**
   * Show stylish Neo-Brutalist Toast notification
   */
  function showToast(message, type = 'info', linkUrl = null) {
    let container = document.getElementById('vg-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'vg-toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `vg-toast vg-toast-${type}`;

    let icon = '⚡';
    if (type === 'loading') icon = '🌀';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';

    let contentHtml = `<span>${icon}</span> <span>${message}</span>`;
    if (linkUrl) {
      contentHtml += ` <a href="${linkUrl}" target="_blank" class="vg-toast-link">Xem trên Facebook ↗</a>`;
    }

    toast.innerHTML = contentHtml;
    container.appendChild(toast);

    if (type !== 'loading') {
      setTimeout(() => {
        toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 300);
      }, 5000);
    }

    return toast;
  }

  /**
   * Clean and normalize media URLs from Zalo (get full resolution)
   */
  function normalizeZaloMediaUrl(url) {
    if (!url) return '';
    let clean = url.trim();

    // Upgrade thumbnail dimensions to high-resolution original
    // Examples: /w120/ -> /w1200/, _w360.jpg -> .jpg, _thumb.jpg -> .jpg
    clean = clean.replace(/\/w(?:120|240|360|480|500|640)\//gi, '/');
    clean = clean.replace(/_w(?:120|240|360|480|500|640)\.(jpg|png|jpeg|webp)/gi, '.$1');
    clean = clean.replace(/_thumb\.(jpg|png|jpeg|webp)/gi, '.$1');

    return clean;
  }

  /**
   * Helper: Convert browser in-memory blob: URL to base64 Data URL
   */
  async function blobUrlToBase64(blobUrl) {
    if (!blobUrl || !blobUrl.startsWith('blob:')) return null;
    try {
      const res = await fetch(blobUrl);
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[VG Zalo] Lỗi chuyển blob sang base64:', e);
      return null;
    }
  }

  /**
   * Helper: Extract clean laptop specs text from a message container
   */
  function getPureText(container) {
    if (!container) return '';
    const textSelectors = [
      '[data-component="message-text-content"]',
      'span.text',
      '.text-message__container',
      '[data-id="div_ReceivedMsg_Text"]',
      '[data-component="text-container"]',
      '.rich-text-content',
      '.text-content',
      '.card--text'
    ];

    for (const sel of textSelectors) {
      const el = container.querySelector(sel);
      if (el) {
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.vg-zalo-btn-wrapper, button, .message-reaction-container, .default-react-icon-thumb').forEach(b => b.remove());
        const raw = clone.innerText.trim();
        if (raw.length > 10 && !raw.startsWith('/-heart') && !raw.startsWith('/-strong')) {
          return raw;
        }
      }
    }

    return '';
  }

  /**
   * Helper: Check if a text strictly belongs to a laptop specs listing
   * Rejects chat noise, group policies, keyboard sticker instructions, etc.
   */
  function isLaptopSpecsText(text) {
    if (!text || text.length < 15) return false;
    const lower = text.toLowerCase();
    
    // Explicit blacklist of non-laptop announcements
    if (
      lower.includes('chính sách nhóm') ||
      lower.includes('nội quy') ||
      lower.includes('hướng dẫn dán phím') ||
      lower.includes('các mã hiện bán') ||
      lower.includes('mua hàng và cọc hàng')
    ) {
      return false;
    }

    const hasCode = /(?:mã|ms|code|lô|lo)\s*[:#\s]?\s*[a-z0-9]+/i.test(text);
    const hasHardware = (
      /(?:i3|i5|i7|i9|ryzen|celeron|pentium|gen)/i.test(text) ||
      /(?:ram|ssd|hdd|16gb|8gb|32gb|256|512|1tb)/i.test(text) ||
      /(?:inch|\"|fhd|ips)/i.test(text) ||
      /(?:thinkpad|dell|hp|latitude|probook|elitebook|xps|macbook|surface|panasonic|dynabook|toshiba|fujitsu|nec|vaio|lg\s*gram)/i.test(text)
    );

    return hasCode || hasHardware;
  }

  /**
   * Helper: Extract pure high-resolution media URLs from a message container
   * Strictly filters out Zalo user avatars, tiny icons, emojis, and banned images
   */
  function getPureMedia(container) {
    if (!container) return [];
    const rawMediaList = [];
    const imgElements = container.querySelectorAll('img, img.zimg-el');
    imgElements.forEach(img => {
      const classes = (img.className || '').toLowerCase();
      const src = img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src') || '';
      
      // 1. Strict Avatar container check: Never take images located inside avatar wrappers
      const isInsideAvatar = Boolean(
        img.closest('.avatar') ||
        img.closest('.avt-m') ||
        img.closest('[class*="avatar"]') ||
        img.closest('[class*="avt"]') ||
        img.closest('.chat-item-avatar') ||
        (img.closest('.rel') && img.closest('.rel').querySelector('.avt-m'))
      );
      if (isInsideAvatar) return;

      // 2. Strict Avatar URL pattern check
      const isAvatarUrl = (
        src.includes('ava-talk') ||
        src.includes('avatar') ||
        src.includes('/w120/') ||
        src.includes('/w160/') ||
        src.includes('/w200/') ||
        src.includes('static.zalo.me/avatar') ||
        (src.includes('zadn.vn') && (src.includes('120') || src.includes('160')))
      );
      if (isAvatarUrl) return;

      // 3. Junk icons, reaction icons, emojis
      const isJunkIcon = (
        classes.includes('avatar') ||
        classes.includes('emoji') ||
        classes.includes('icon') ||
        classes.includes('default-react-icon') ||
        classes.includes('react') ||
        classes.includes('thumb') ||
        src.includes('emoji') ||
        src.includes('static.zalo.me') ||
        src.includes('iconlike')
      );
      if (isJunkIcon) return;

      // 4. Natural dimensions check (reject small/square avatars and tiny thumbnails)
      const w = img.naturalWidth || img.width || 0;
      const h = img.naturalHeight || img.height || 0;
      if (w > 0 && h > 0) {
        if ((w <= 250 && h <= 250) || w < 250 || h < 250) {
          return;
        }
      }

      if (src && (src.startsWith('http') || src.startsWith('blob:'))) {
        rawMediaList.push(src);
      }
    });

    const videoElements = container.querySelectorAll('video, [data-video-url], a[href*=".mp4"]');
    videoElements.forEach(v => {
      const vSrc = v.getAttribute('data-video-url') || v.getAttribute('src') || v.getAttribute('href') || '';
      if (vSrc && (vSrc.startsWith('http') || vSrc.startsWith('blob:'))) {
        rawMediaList.push(vSrc);
      }
    });

    return rawMediaList;
  }

  /**
   * Helper: Detect if an image is a spreadsheet, document, or phone screenshot (Banned Media)
   * Samples a 40x40 pixel grid via offscreen canvas.
   * Excel tables and documents have > 70% white background and < 8% color saturation.
   */
  async function isBannedDocumentOrSpreadsheet(src) {
    return new Promise((resolve) => {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;

          // Reject avatars or tiny images
          if ((w <= 250 && h <= 250) || w < 250 || h < 250) {
            console.log('[Content] 🚫 Chặn ảnh đại diện / ảnh nhỏ:', `${w}x${h}`);
            return resolve(true);
          }

          try {
            const canvas = document.createElement('canvas');
            canvas.width = 40;
            canvas.height = 40;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, 40, 40);
            const data = ctx.getImageData(0, 0, 40, 40).data;
            let whitePixels = 0;
            let totalSat = 0;
            const total = 40 * 40;

            for (let i = 0; i < data.length; i += 4) {
              const r = data[i];
              const g = data[i + 1];
              const b = data[i + 2];
              if (r > 230 && g > 230 && b > 230) {
                whitePixels++;
              }
              const maxC = Math.max(r, g, b);
              const minC = Math.min(r, g, b);
              if (maxC > 0) totalSat += (maxC - minC) / maxC;
            }

            const whiteRatio = whitePixels / total;
            const avgSat = totalSat / total;

            if (whiteRatio > 0.70 && avgSat < 0.08) {
              console.log('[Content] 🚫 Chặn ảnh Bảng Excel / Ảnh chụp màn hình tra Google:', {
                w, h,
                whitePercent: Math.round(whiteRatio * 100) + '%',
                satPercent: Math.round(avgSat * 100) + '%'
              });
              return resolve(true);
            }
          } catch (e) {
            // If cross-origin prevents canvas reading, allow photo
          }
          resolve(false);
        };
        img.onerror = () => resolve(false);
        img.src = src;
      } catch (err) {
        resolve(false);
      }
    });
  }

  /**
   * Extract all content and media from a Zalo message bubble
   * STRICT ANTI-MISMATCH PAIRING: Ensures 100% zero-mismatch between text & photos
   */
  async function extractMessageData(messageEl) {
    const chatItem = messageEl.closest('.chat-item') || messageEl;

    let directText = getPureText(chatItem);
    let directMedia = getPureMedia(chatItem);

    let finalFormattedText = '';
    let rawMediaList = [];

    // TRƯỜNG HỢP 1: Bấm ở tin nhắn TEXT CẤU HÌNH LAPTOP
    if (isLaptopSpecsText(directText)) {
      finalFormattedText = directText;

      if (directMedia.length > 0) {
        rawMediaList = directMedia;
      } else {
        // Quy chuẩn kho: [ẢNH MÁY] đi liền TRƯỚC [TEXT MÁY].
        // Quét ngược lên TRÊN (prev 1..2), TUYỆT ĐỐI KHÔNG quét xuống dưới để tránh vớ nhầm ảnh của máy đăng sau!
        let prev = chatItem.previousElementSibling;
        for (let i = 0; i < 2 && prev && rawMediaList.length === 0; i++) {
          const prevMedia = getPureMedia(prev);
          const prevText = getPureText(prev);

          if (prevMedia.length > 0) {
            rawMediaList = prevMedia;
            break;
          }

          // Nếu gặp một tin cấu hình laptop khác ở giữa -> DỪNG NGAY, không vượt biên giới máy khác
          if (isLaptopSpecsText(prevText)) {
            break;
          }

          prev = prev.previousElementSibling;
        }
      }
    }

    // TRƯỜNG HỢP 2: Bấm ở tin CHỈ CÓ ẢNH (Album ảnh máy)
    else if (directMedia.length > 0) {
      rawMediaList = directMedia;

      // Quy chuẩn kho: [ẢNH MÁY] đi liền TRƯỚC [TEXT MÁY].
      // Cụm ảnh quét XUỐNG DƯỚI (next 1..2) để lấy text cấu hình của chính nó!
      let next = chatItem.nextElementSibling;
      for (let i = 0; i < 2 && next && !finalFormattedText; i++) {
        const nextText = getPureText(next);
        if (isLaptopSpecsText(nextText)) {
          finalFormattedText = nextText;
          break;
        }
        if (getPureMedia(next).length > 0) {
          break;
        }
        next = next.nextElementSibling;
      }

      // Fallback hiếm: Nếu kho gửi text trước ảnh sau, tìm lên TRÊN (prev 1)
      if (!finalFormattedText) {
        let prev = chatItem.previousElementSibling;
        if (prev && isLaptopSpecsText(getPureText(prev))) {
          finalFormattedText = getPureText(prev);
        }
      }
    } else {
      // Fallback cho tin nhắn text thông thường
      finalFormattedText = directText;
      rawMediaList = directMedia;
    }

    // 4. Resolve media (convert blob: to base64, normalize CDN URLs)
    const mediaUrls = [];
    const seen = new Set();

    for (const src of rawMediaList) {
      if (seen.has(src)) continue;
      seen.add(src);

      // Strict Anti-Spam: Filter banned spreadsheet, document, or search screenshot
      const isBanned = await isBannedDocumentOrSpreadsheet(src);
      if (isBanned) continue;

      if (src.startsWith('blob:')) {
        const base64 = await blobUrlToBase64(src);
        if (base64) mediaUrls.push(base64);
      } else {
        mediaUrls.push(normalizeZaloMediaUrl(src));
      }
    }

    return {
      text: finalFormattedText,
      mediaUrls
    };
  }

  /**
   * Send post data to Laptop Vương Gia backend
   * Supports: 'fanpage' | 'personal' | 'both'
   */
  async function pushToFacebook(data, options = { publishImmediately: true, target: 'fanpage' }, btnElement = null) {
    if (!data.text && data.mediaUrls.length === 0) {
      showToast('Không tìm thấy nội dung bài viết hoặc hình ảnh để đăng!', 'error');
      return;
    }

    const target = options.target || 'fanpage';
    const publishImmediately = Boolean(options.publishImmediately);

    const originalBtnText = btnElement ? btnElement.innerHTML : '';
    const mediaCount = data.mediaUrls ? data.mediaUrls.length : 0;
    const mediaLabel = mediaCount > 0 ? ` (kèm ${mediaCount} ảnh HD)` : '';

    if (btnElement) {
      btnElement.innerHTML = `🌀 Đang xử lý${mediaCount > 0 ? ' (' + mediaCount + ' ảnh)' : ''}...`;
      btnElement.style.opacity = '0.7';
      btnElement.disabled = true;
    }

    let actionLabel = 'Đăng lên Fanpage';
    if (target === 'both') actionLabel = 'Đăng Kép (Fanpage + Cá Nhân)';
    if (target === 'personal') actionLabel = 'Soạn bài Trang Cá Nhân';
    if (!publishImmediately && target === 'fanpage') actionLabel = 'Đưa vào Hàng đợi';

    const loadingToast = showToast(`Đang bóc tách AI và ${actionLabel}${mediaLabel}...`, 'loading');

    try {
      let result;
      const payload = {
        rawText: data.text,
        mediaUrls: data.mediaUrls,
        publishImmediately: publishImmediately,
        target: target
      };

      // Delegate to Background Service Worker to bypass Zalo Web page CSP completely
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        result = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'pushPost',
            serverUrl: defaultServerUrl,
            payload: payload
          }, (res) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message });
            } else if (!res) {
              resolve({ success: false, error: 'Không nhận được phản hồi từ extension' });
            } else if (!res.success && res.error) {
              resolve({ success: false, error: res.error });
            } else {
              resolve(res.data || res);
            }
          });
        });
      } else {
        // Direct fetch fallback for non-extension environments
        const response = await fetch(`${defaultServerUrl}/api/extension/push-post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        result = await response.json();
      }

      loadingToast.remove();

      if (result.success) {
        const post = result.post || {};
        const code = post.machineCode ? `#${post.machineCode}` : '';

        // Tự động sao chép nội dung bài viết vào Clipboard để người dùng dán tự do
        if (post.content && navigator.clipboard && navigator.clipboard.writeText) {
          try {
            await navigator.clipboard.writeText(post.content);
          } catch (clipErr) {
            console.warn('[Clipboard] Không thể tự copy:', clipErr);
          }
        }

        // 1. Chế độ ĐĂNG CẢ HAI (Both: Fanpage + Facebook cá nhân Robot)
        if (target === 'both') {
          showToast(`Đã xuất bản mã ${code} lên Fanpage! Robot đang tự động đăng tiếp lên Trang Cá Nhân...`, 'success', result.fbPostUrl);
          
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'triggerPersonalRobot',
              payload: {
                content: post.content,
                mediaUrls: data.mediaUrls,
                machineCode: post.machineCode || ''
              }
            });
          }
        }
        // 2. Chế độ ĐĂNG TRANG CÁ NHÂN (Personal only via Robot)
        else if (target === 'personal') {
          showToast(`🤖 Robot đang tự động mở Facebook và đăng bài ${code}...`, 'success');
          
          if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({
              action: 'triggerPersonalRobot',
              payload: {
                content: post.content,
                mediaUrls: data.mediaUrls,
                machineCode: post.machineCode || ''
              }
            });
          }
        }
        // 3. Chế độ FANPAGE
        else {
          const successMsg = publishImmediately
            ? `Đã đăng thành công mã ${code}${mediaLabel} lên Fanpage!`
            : `Đã đưa bài ${code}${mediaLabel} vào hàng đợi!`;

          showToast(successMsg, 'success', result.fbPostUrl || post.fbPostUrl);
        }
      } else {
        showToast(`Lỗi: ${result.error || 'Không thể đăng bài'}`, 'error');
      }
    } catch (err) {
      loadingToast.remove();
      console.error('[VG Zalo Autopost] Lỗi gửi dữ liệu:', err);
      showToast(`Lỗi kết nối máy chủ: ${err.message}`, 'error');
    } finally {
      if (btnElement) {
        btnElement.innerHTML = originalBtnText;
        btnElement.style.opacity = '1';
        btnElement.disabled = false;
      }
    }
  }

  /**
   * Check if an element is strictly inside the active chat message timeline
   * and NOT in the left sidebar, navigation icons, search bar, or pinned header
   */
  function isInsideChatMessageArea(el) {
    if (!el || !(el instanceof Element)) return false;

    // 1. Immediately reject sidebar, navigation, search, pinned banner, and avatar
    const blacklisted = el.closest(
      '.nav-bar, #main-tab, .sidebar-left, #conversationList, .chat-list, ' +
      '.chat-sidebar, .pin-message, .chat-header, #chat-header, .header-search, ' +
      '[data-id*="conv"], [data-id="div_Search"], .banner, [data-id="avatar"], ' +
      '.main-tab, .left-bar, .sub-tab, .bubble-tab, #header-search'
    );
    if (blacklisted) return false;

    // 2. Reject if element is in the left sidebar area (width < 340px)
    const rect = el.getBoundingClientRect();
    if (rect.left < 340 && rect.width < 350) {
      return false;
    }

    // 3. Must be inside the main chat view or message viewport
    const insideChatArea = el.closest(
      '#chatViewContainer, .chat-view, #messageViewContainer, .message-view-container, ' +
      '.chat-thread, .chat-box, .msg-list, [class*="chatView"], [class*="messageList"], ' +
      '[id*="chatView"], #messageView, .message-view'
    );
    if (insideChatArea) return true;

    // If no specific container class, check if it's in the chat area (left > 320px)
    return rect.left >= 320;
  }

  /**
   * Inject 1-Click Action Buttons into a Zalo message bubble
   */
  function injectButtons(messageEl) {
    if (!isInsideChatMessageArea(messageEl)) return;
    if (messageEl.querySelector('.vg-zalo-btn-wrapper')) return;

    // Only inject buttons for REAL laptop specs listings or laptop photo albums
    const pureText = getPureText(messageEl);
    const isSpecs = isLaptopSpecsText(pureText);
    const pureMedia = getPureMedia(messageEl);
    const hasPhoto = pureMedia.length > 0;
    
    // Ignore non-laptop elements (system banners, policies, chat noise, date separators)
    if (!isSpecs && !hasPhoto) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'vg-zalo-btn-wrapper';

    // Nút 1: 🚀 ĐĂNG NGAY (Đăng đồng thời cả Fanpage + Facebook Cá Nhân)
    const publishBtn = document.createElement('button');
    publishBtn.className = 'vg-zalo-autopost-btn vg-btn-dual';
    publishBtn.title = 'Bấm để AI bóc tách cấu hình, tải ảnh và ĐĂNG NGAY lên cả Fanpage lẫn Facebook Cá Nhân (Hotline: 0876637806)';
    publishBtn.innerHTML = '🚀 ĐĂNG NGAY';
    publishBtn.onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      publishBtn.disabled = true;
      publishBtn.innerHTML = '🌀 Đang nạp ảnh...';
      const data = await extractMessageData(messageEl);
      pushToFacebook(data, { publishImmediately: true, target: 'both' }, publishBtn);
    };

    // Nút 2: ⏳ LÊN LỊCH (Đưa vào Hàng Đợi - Đăng cả Fanpage lẫn Facebook Cá Nhân)
    const scheduleBtn = document.createElement('button');
    scheduleBtn.className = 'vg-zalo-autopost-btn vg-btn-secondary';
    scheduleBtn.title = 'Bấm để đưa bài vào Hàng Đợi (Đăng tự động cả Fanpage lẫn Facebook Cá Nhân vào khung giờ vàng tiếp theo)';
    scheduleBtn.innerHTML = '⏳ LÊN LỊCH';
    scheduleBtn.onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      scheduleBtn.disabled = true;
      scheduleBtn.innerHTML = '🌀 Đang nạp ảnh...';
      const data = await extractMessageData(messageEl);
      pushToFacebook(data, { publishImmediately: false, target: 'both' }, scheduleBtn);
    };

    wrapper.appendChild(publishBtn);
    wrapper.appendChild(scheduleBtn);

    // Inject into action menu or append directly below message content
    const actionsMenu = messageEl.querySelector('.msg-menu, .message-actions, .extra-actions, [data-id="div_DisabledTargetEventLayer"]');
    if (actionsMenu) {
      actionsMenu.appendChild(wrapper);
    } else {
      messageEl.appendChild(wrapper);
    }
  }

  /**
   * Scan DOM and inject buttons into all available messages
   */
  function scanAndInject() {
    // 1. Cleanup any misinjected buttons on sidebar / navigation / search
    document.querySelectorAll('.vg-zalo-btn-wrapper').forEach(wrapper => {
      if (!isInsideChatMessageArea(wrapper)) {
        wrapper.remove();
      }
    });

    // 2. Find the chat view container
    const chatContainer = document.querySelector(
      '#chatViewContainer, .chat-view, #messageViewContainer, .message-view-container, ' +
      '.chat-thread, .chat-box, [id*="chatView"], #messageView'
    ) || document.body;

    const candidateSelectors = [
      '[data-component="message-content-view"]',
      '.message-frame',
      '.card--group-photo',
      '.card--text',
      '.chat-message',
      '.msg-item',
      '.chat-item'
    ];

    const elements = chatContainer.querySelectorAll(candidateSelectors.join(', '));
    const seenBubbles = new Set();

    elements.forEach(el => {
      if (!isInsideChatMessageArea(el)) return;
      const bubble = el.closest('[data-component="message-content-view"], .message-frame, .chat-message') || el;
      if (seenBubbles.has(bubble)) return;
      seenBubbles.add(bubble);

      if (isInsideChatMessageArea(bubble)) {
        injectButtons(bubble);
      }
    });
  }

  // Initial Scan
  setTimeout(scanAndInject, 1500);

  // Debounced MutationObserver to detect new incoming messages & room switches
  let scanTimer = null;
  const observer = new MutationObserver(() => {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(scanAndInject, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // =========================================================================
  // ZALO SYNC RADAR (v1.7.0) — 1-CLICK QUÉT & LỌC THÔ TRƯỚC KHI XỬ LÝ
  // =========================================================================
  let radarItems = [];
  let radarActiveTab = 'actionable'; // 'actionable' | 'archived'
  let isRadarScanning = false;
  let isRadarExecuting = false;

  function sendSwMessage(msg) {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
        return resolve({ success: false, error: 'Extension context unavailable' });
      }
      chrome.runtime.sendMessage(msg, (res) => {
        if (chrome.runtime.lastError) {
          return resolve({ success: false, error: chrome.runtime.lastError.message });
        }
        resolve(res || { success: false, error: 'Empty response' });
      });
    });
  }

  function findZaloScrollContainer() {
    const all = Array.from(document.querySelectorAll('div'));
    return all.find((el) => {
      const st = getComputedStyle(el);
      return (st.overflowY === 'auto' || st.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 40 &&
        el.querySelector('[id^="bb_msg_id_"]');
    }) || null;
  }

  async function compressZaloImageToJpegDataUrl(src) {
    if (!src) return null;
    try {
      if (src.startsWith('data:image/')) return src;
      const res = await fetch(src);
      if (!res.ok) return null;
      const rawBlob = await res.blob();
      const bmp = await createImageBitmap(rawBlob);
      const maxDim = 1280;
      let w = bmp.width;
      let h = bmp.height;
      if (w < 220 || h < 220) {
        bmp.close();
        return null;
      }
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bmp, 0, 0, w, h);
      bmp.close();
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch (e) {
      return null;
    }
  }

  function extractCodeFromZaloText(text) {
    if (!text) return '';
    const m = text.match(/(?:Mã|Ma|MS|Code)\s*[:#]?\s*([0-9]+[A-Za-z]?)/i);
    return m ? m[1].toUpperCase() : '';
  }

  function isSoldReplyText(fullText) {
    const lines = String(fullText || '').split('\n').map(s => s.trim()).filter(Boolean);
    const tail = lines.slice(1).join(' ');
    return /\b(chốt|đã bán|ra đi|bay rồi|hết hàng|đã cọc|xong)\b/i.test(tail) ||
      (lines.length >= 2 && lines[lines.length - 1].length <= 28 && /(chốt|bán|cọc|xong|hết)/i.test(lines[lines.length - 1]));
  }

  function escapeRadarHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function runZaloSyncRadar(mode = 'smart_auto') {
    if (isRadarScanning || isRadarExecuting) return;
    const scrollEl = findZaloScrollContainer();
    if (!scrollEl) {
      showToast('Hãy mở một cuộc trò chuyện nhóm Zalo có tin nhắn trước khi quét.', 'error');
      return;
    }

    isRadarScanning = true;
    updateRadarBarState();
    const scanToast = showToast(
      mode === 'from_view'
        ? 'Đang quét từ vị trí đang xem xuống đáy khung chat...'
        : 'Zalo Sync Radar đang tự quét các mã mới nhất...',
      'loading'
    );

    try {
      // 1. Lấy danh sách mã hiện có trên Web App (chỉ đọc nhẹ, chưa đụng AI)
      const appRes = await sendSwMessage({ action: 'fetchAppPostsSummary', serverUrl: defaultServerUrl });
      const appPosts = Array.isArray(appRes.posts) ? appRes.posts : [];
      const appByCode = new Map();
      for (const p of appPosts) {
        if (!p.machineCode) continue;
        if (!appByCode.has(p.machineCode)) appByCode.set(p.machineCode, p);
      }

      // 2. Thu thập tin nhắn & giữ ảnh blob ngay trên DOM trong lúc cuộn
      const collected = new Map();
      const grabVisible = async () => {
        const nodes = Array.from(document.querySelectorAll('[id^="bb_msg_id_"]'));
        for (const el of nodes) {
          const id = el.id;
          const tsMatch = id.match(/bb_msg_id_(\d+)/);
          const ts = tsMatch ? Number(tsMatch[1]) : 0;
          const textEl = el.querySelector('[data-component="message-text-content"], span.text, .text-message__container, .rich-text-content, .text-content');
          const fullText = textEl ? textEl.innerText.trim() : '';
          const quoteEl = el.querySelector('.quote-banner, [class*="quote"]');
          const isReply = Boolean(quoteEl) || /^(?:Thanh[\s\u00a0]+Vũ[\s\u00a0]+Store|[^\n]{2,30})\n(?:Mã|Ma)\s+/i.test(fullText);

          const rawImgs = getPureMedia(el).filter(u => !/\.mp4(\?|$)/i.test(u));
          const prev = collected.get(id);
          if (prev && prev.dataUrls.length >= rawImgs.length && prev.fullText.length >= fullText.length) {
            continue;
          }

          const dataUrls = [];
          for (const src of rawImgs) {
            const banned = await isBannedDocumentOrSpreadsheet(src).catch(() => false);
            if (banned) continue;
            const dataUrl = await compressZaloImageToJpegDataUrl(src);
            if (dataUrl) dataUrls.push(dataUrl);
          }

          collected.set(id, {
            id,
            ts,
            isReply,
            fullText,
            dataUrls
          });
        }
      };

      if (mode === 'from_view') {
        let pos = scrollEl.scrollTop;
        for (let step = 0; step < 30; step++) {
          await grabVisible();
          if (pos + scrollEl.clientHeight >= scrollEl.scrollHeight - 20) break;
          pos = Math.min(scrollEl.scrollHeight, pos + 520);
          scrollEl.scrollTop = pos;
          scrollEl.dispatchEvent(new Event('scroll', { bubbles: true }));
          await new Promise(r => setTimeout(r, 260));
        }
        await grabVisible();
      } else {
        // Smart auto: cuộn từ đáy ngược lên, dừng khi gặp >= 3 mã liên tiếp đã có đủ ảnh trên Web App
        scrollEl.scrollTop = scrollEl.scrollHeight;
        await new Promise(r => setTimeout(r, 300));
        await grabVisible();

        let knownStreak = 0;
        let prevSize = collected.size;
        let stall = 0;
        for (let step = 0; step < 28; step++) {
          const nextTop = Math.max(0, scrollEl.scrollTop - 520);
          scrollEl.scrollTop = nextTop;
          scrollEl.dispatchEvent(new Event('scroll', { bubbles: true }));
          await new Promise(r => setTimeout(r, 320));
          await grabVisible();

          // Kiểm tra số mã đã tồn tại đầy đủ trên Web App ở vùng vừa cuộn qua
          const sortedNow = Array.from(collected.values()).sort((a, b) => a.ts - b.ts);
          knownStreak = 0;
          for (const msg of sortedNow) {
            if (msg.isReply) continue;
            const c = extractCodeFromZaloText(msg.fullText);
            if (!c) continue;
            const existing = appByCode.get(c);
            if (existing && existing.mediaCount > 0) {
              knownStreak++;
            } else {
              break;
            }
          }

          if (knownStreak >= 3) break;
          if (nextTop === 0) break;
          if (collected.size === prevSize) {
            stall++;
            if (stall >= 4) break;
          } else {
            stall = 0;
            prevSize = collected.size;
          }
        }
      }

      // 3. Lọc thô & ghép cặp Text + Album Ảnh (0 call AI, 0 upload)
      const timeline = Array.from(collected.values()).sort((a, b) => a.ts - b.ts);
      const soldCodes = new Set();
      for (const msg of timeline) {
        if (!msg.isReply) continue;
        const c = extractCodeFromZaloText(msg.fullText);
        if (c && isSoldReplyText(msg.fullText)) {
          soldCodes.add(c);
        }
      }

      const parsed = [];
      const seenCodes = new Set();

      for (let i = 0; i < timeline.length; i++) {
        const msg = timeline[i];
        if (msg.isReply) continue;
        if (!isLaptopSpecsText(msg.fullText)) continue;
        const code = extractCodeFromZaloText(msg.fullText);
        if (!code || seenCodes.has(code)) continue;
        seenCodes.add(code);

        // Ghép ảnh từ chính tin nhắn hoặc tin nhắn album ngay sát phía trên (hoặc dưới nếu không phải mã khác)
        let images = [...msg.dataUrls];
        if (images.length === 0) {
          for (let back = i - 1; back >= Math.max(0, i - 2); back--) {
            const candidate = timeline[back];
            if (candidate.dataUrls.length > 0 && !extractCodeFromZaloText(candidate.fullText) && !candidate.fullText.includes('CÁC MÃ HIỆN BÁN')) {
              images = candidate.dataUrls;
              break;
            }
          }
        }

        const existing = appByCode.get(code) || null;
        const isSold = soldCodes.has(code);
        const firstLine = msg.fullText.split('\n').map(s => s.trim()).find(Boolean) || `Mã #${code}`;

        let category = 'skipped'; // 'new_avail' | 'replenish' | 'sold_in_queue' | 'skipped'
        let badgeText = 'Đã có';
        let badgeClass = 'vg-badge-muted';
        let checked = false;

        if (isSold) {
          if (existing && (existing.status === 'queued' || existing.status === 'pending_media' || existing.status === 'skipped_no_media')) {
            category = 'sold_in_queue';
            badgeText = 'Chốt · Đang trong hàng đợi';
            badgeClass = 'vg-badge-warn';
            checked = false;
          } else {
            category = 'skipped';
            badgeText = 'Đã bán (Chốt)';
            badgeClass = 'vg-badge-muted';
          }
        } else if (!existing) {
          if (images.length > 0) {
            category = 'new_avail';
            badgeText = 'Mới · Còn hàng';
            badgeClass = 'vg-badge-new';
            checked = true;
          } else {
            category = 'skipped';
            badgeText = 'Mới · Thiếu ảnh';
            badgeClass = 'vg-badge-muted';
          }
        } else if (existing.mediaCount === 0 && images.length > 0) {
          category = 'replenish';
          badgeText = `Bù ảnh (${existing.status})`;
          badgeClass = 'vg-badge-replenish';
          checked = true;
        } else {
          category = 'skipped';
          badgeText = `Đã có (${existing.mediaCount} ảnh)`;
          badgeClass = 'vg-badge-muted';
        }

        parsed.push({
          id: `radar_${code}`,
          code,
          title: firstLine.slice(0, 120),
          fullText: msg.fullText,
          images,
          existingPostId: existing ? existing.id : null,
          existingStatus: existing ? existing.status : '',
          category,
          badgeText,
          badgeClass,
          checked,
          execState: 'idle', // 'idle' | 'running' | 'done' | 'error'
          execNote: ''
        });
      }

      radarItems = parsed;
      radarActiveTab = parsed.some(i => i.category !== 'skipped') ? 'actionable' : 'archived';
      renderRadarDrawer();
      openRadarDrawer();
      showToast(`Radar đã lọc xong ${parsed.length} mã máy.`, 'success');
    } catch (err) {
      showToast(`Lỗi Radar: ${err.message}`, 'error');
    } finally {
      scanToast.remove();
      isRadarScanning = false;
      updateRadarBarState();
    }
  }

  function renderRadarDrawer() {
    const drawer = document.getElementById('vg-radar-drawer');
    if (!drawer) return;

    const actionable = radarItems.filter(i => i.category !== 'skipped');
    const archived = radarItems.filter(i => i.category === 'skipped');
    const list = radarActiveTab === 'actionable' ? actionable : archived;
    const checkedCount = actionable.filter(i => i.checked && i.execState !== 'done').length;

    const sub = drawer.querySelector('#vg-radar-sub');
    if (sub) {
      const newCount = actionable.filter(i => i.category === 'new_avail').length;
      const repCount = actionable.filter(i => i.category === 'replenish').length;
      const warnCount = actionable.filter(i => i.category === 'sold_in_queue').length;
      sub.textContent = `${newCount} mã mới · ${repCount} bù ảnh · ${warnCount} chốt cần gỡ · ${archived.length} đã có/đã bán`;
    }

    const tabAct = drawer.querySelector('#vg-radar-tab-actionable');
    const tabArc = drawer.querySelector('#vg-radar-tab-archived');
    if (tabAct) {
      tabAct.textContent = `Cần xử lý (${actionable.length})`;
      tabAct.classList.toggle('active', radarActiveTab === 'actionable');
    }
    if (tabArc) {
      tabArc.textContent = `Đã có / Đã bán (${archived.length})`;
      tabArc.classList.toggle('active', radarActiveTab === 'archived');
    }

    const body = drawer.querySelector('#vg-radar-body');
    if (body) {
      if (list.length === 0) {
        body.innerHTML = `<div style="padding:28px 12px;text-align:center;color:#64748B;font-size:13px;">Không có mã nào trong mục này.</div>`;
      } else {
        body.innerHTML = list.map((item) => {
          const thumbHtml = item.images[0]
            ? `<img src="${item.images[0]}" class="vg-radar-item-thumb" alt="#${escapeRadarHtml(item.code)}" />`
            : `<div class="vg-radar-item-thumb" style="display:flex;align-items:center;justify-content:center;font-size:11px;color:#94A3B8;">0 ảnh</div>`;
          const disabledAttr = (item.category === 'skipped' || isRadarExecuting || item.execState === 'done') ? 'disabled' : '';
          const checkedAttr = item.checked ? 'checked' : '';
          const statusLine = item.execNote
            ? `<span style="font-weight:600;color:${item.execState === 'error' ? '#DC2626' : (item.execState === 'done' ? '#059669' : '#2563EB')};">${escapeRadarHtml(item.execNote)}</span>`
            : '';

          return `
            <label class="vg-radar-item ${item.checked ? 'checked' : ''}" data-radar-id="${escapeRadarHtml(item.id)}">
              <input type="checkbox" class="vg-radar-chk" data-id="${escapeRadarHtml(item.id)}" ${checkedAttr} ${disabledAttr} style="margin-top:4px;accent-color:#2563EB;cursor:pointer;" />
              ${thumbHtml}
              <div class="vg-radar-item-main">
                <div class="vg-radar-item-top">
                  <span class="vg-radar-code">#${escapeRadarHtml(item.code)}</span>
                  <span class="vg-radar-badge ${item.badgeClass}">${escapeRadarHtml(item.badgeText)}</span>
                </div>
                <div class="vg-radar-snippet">${escapeRadarHtml(item.title)}</div>
                <div class="vg-radar-meta">
                  <span>${item.images.length} ảnh gốc</span>
                  ${statusLine}
                </div>
              </div>
            </label>
          `;
        }).join('');

        body.querySelectorAll('.vg-radar-chk').forEach((chk) => {
          chk.addEventListener('change', (e) => {
            const id = e.target.getAttribute('data-id');
            const target = radarItems.find(x => x.id === id);
            if (target) {
              target.checked = e.target.checked;
              renderRadarDrawer();
            }
          });
        });
      }
    }

    const confirmBtn = drawer.querySelector('#vg-radar-confirm-btn');
    if (confirmBtn) {
      confirmBtn.disabled = isRadarExecuting || checkedCount === 0;
      confirmBtn.textContent = isRadarExecuting
        ? 'Đang xử lý lên hàng đợi...'
        : `Xác nhận xử lý (${checkedCount} bài)`;
    }
  }

  async function executeRadarConfirmedBatch() {
    const queue = radarItems.filter(i => i.checked && i.category !== 'skipped' && i.execState !== 'done');
    if (queue.length === 0 || isRadarExecuting) return;

    isRadarExecuting = true;
    renderRadarDrawer();

    let okCount = 0;
    for (let idx = 0; idx < queue.length; idx++) {
      const item = queue[idx];
      item.execState = 'running';
      item.execNote = `Đang xử lý (${idx + 1}/${queue.length})...`;
      renderRadarDrawer();

      try {
        if (item.category === 'sold_in_queue' && item.existingPostId) {
          const delRes = await sendSwMessage({
            action: 'deleteAppPost',
            serverUrl: defaultServerUrl,
            postId: item.existingPostId
          });
          if (!delRes.success) throw new Error(delRes.error || 'Không xóa được bài đã chốt');
          item.execState = 'done';
          item.execNote = 'Đã gỡ khỏi hàng đợi';
          okCount++;
        } else if (item.category === 'replenish' && item.existingPostId) {
          const upRes = await sendSwMessage({
            action: 'attachMediaToPost',
            serverUrl: defaultServerUrl,
            postId: item.existingPostId,
            code: item.code,
            dataUrls: item.images
          });
          if (!upRes.success) throw new Error(upRes.error || 'Lỗi nạp ảnh');
          item.execState = 'done';
          item.execNote = `Đã bù ${item.images.length} ảnh → queued`;
          okCount++;
        } else if (item.category === 'new_avail') {
          const firstBatch = item.images.slice(0, 3);
          const restBatch = item.images.slice(3);
          const pushRes = await sendSwMessage({
            action: 'pushPost',
            serverUrl: defaultServerUrl,
            payload: {
              rawText: item.fullText,
              mediaUrls: firstBatch,
              publishImmediately: false,
              target: 'both'
            }
          });
          const created = pushRes.data && pushRes.data.post;
          if (!pushRes.success || !created || !created.id) {
            throw new Error((pushRes.data && pushRes.data.error) || pushRes.error || 'Lỗi tạo bài');
          }
          if (restBatch.length > 0) {
            await sendSwMessage({
              action: 'attachMediaToPost',
              serverUrl: defaultServerUrl,
              postId: created.id,
              code: item.code,
              dataUrls: restBatch
            });
          }
          item.execState = 'done';
          item.execNote = `Đã lên hàng đợi (${item.images.length} ảnh)`;
          okCount++;
        }
      } catch (err) {
        item.execState = 'error';
        item.execNote = `Lỗi: ${err.message}`;
      }
      renderRadarDrawer();
    }

    isRadarExecuting = false;
    renderRadarDrawer();
    showToast(`Hoàn tất xử lý ${okCount}/${queue.length} bài từ Zalo Sync Radar!`, okCount > 0 ? 'success' : 'error');
  }

  function openRadarDrawer() {
    document.getElementById('vg-radar-drawer')?.classList.remove('vg-hidden');
  }

  function closeRadarDrawer() {
    document.getElementById('vg-radar-drawer')?.classList.add('vg-hidden');
  }

  function updateRadarBarState() {
    const smartBtn = document.getElementById('vg-radar-scan-smart');
    const viewBtn = document.getElementById('vg-radar-scan-view');
    const openBtn = document.getElementById('vg-radar-open-drawer');
    if (smartBtn) {
      smartBtn.disabled = isRadarScanning || isRadarExecuting;
      smartBtn.textContent = isRadarScanning ? 'Đang quét...' : 'Quét kho mới';
    }
    if (viewBtn) {
      viewBtn.disabled = isRadarScanning || isRadarExecuting;
    }
    if (openBtn) {
      openBtn.style.display = radarItems.length > 0 ? 'inline-flex' : 'none';
      openBtn.textContent = `Kết quả (${radarItems.filter(i => i.category !== 'skipped').length})`;
    }
  }

  function initZaloSyncRadarUI() {
    if (!document.getElementById('vg-radar-bar')) {
      const bar = document.createElement('div');
      bar.id = 'vg-radar-bar';
      bar.innerHTML = `
        <button type="button" id="vg-radar-scan-smart" class="vg-radar-btn vg-radar-btn-primary" title="Tự cuộn ngược lên từ đáy chat và dừng khi gặp mã đã có trên Web App">Quét kho mới</button>
        <button type="button" id="vg-radar-scan-view" class="vg-radar-btn" title="Cuộn từ vị trí bạn đang xem xuống đáy khung chat">Từ vị trí này</button>
        <button type="button" id="vg-radar-open-drawer" class="vg-radar-btn" style="display:none;">Kết quả (0)</button>
      `;
      document.body.appendChild(bar);
      bar.querySelector('#vg-radar-scan-smart').addEventListener('click', () => runZaloSyncRadar('smart_auto'));
      bar.querySelector('#vg-radar-scan-view').addEventListener('click', () => runZaloSyncRadar('from_view'));
      bar.querySelector('#vg-radar-open-drawer').addEventListener('click', openRadarDrawer);
    }

    if (!document.getElementById('vg-radar-drawer')) {
      const drawer = document.createElement('div');
      drawer.id = 'vg-radar-drawer';
      drawer.className = 'vg-hidden';
      drawer.innerHTML = `
        <div class="vg-radar-header">
          <div>
            <h3 class="vg-radar-title">Zalo Sync Radar</h3>
            <div class="vg-radar-sub" id="vg-radar-sub">Lọc thô tại chỗ — chỉ xử lý AI &amp; nạp ảnh khi bạn xác nhận</div>
          </div>
          <button type="button" class="vg-radar-close" id="vg-radar-close-btn" aria-label="Đóng">✕</button>
        </div>
        <div class="vg-radar-tabs">
          <div class="vg-radar-tab-group">
            <button type="button" class="vg-radar-tab active" id="vg-radar-tab-actionable">Cần xử lý (0)</button>
            <button type="button" class="vg-radar-tab" id="vg-radar-tab-archived">Đã có / Đã bán (0)</button>
          </div>
          <button type="button" class="vg-radar-btn" id="vg-radar-toggle-all" style="padding:4px 9px;font-size:11px;">Chọn / Bỏ hết</button>
        </div>
        <div class="vg-radar-body" id="vg-radar-body"></div>
        <div class="vg-radar-footer">
          <button type="button" class="vg-radar-btn" id="vg-radar-rescan-btn">Quét lại</button>
          <button type="button" class="vg-radar-btn vg-radar-btn-primary" id="vg-radar-confirm-btn">Xác nhận xử lý (0 bài)</button>
        </div>
      `;
      document.body.appendChild(drawer);
      drawer.querySelector('#vg-radar-close-btn').addEventListener('click', closeRadarDrawer);
      drawer.querySelector('#vg-radar-tab-actionable').addEventListener('click', () => {
        radarActiveTab = 'actionable';
        renderRadarDrawer();
      });
      drawer.querySelector('#vg-radar-tab-archived').addEventListener('click', () => {
        radarActiveTab = 'archived';
        renderRadarDrawer();
      });
      drawer.querySelector('#vg-radar-toggle-all').addEventListener('click', () => {
        const actionable = radarItems.filter(i => i.category !== 'skipped' && i.execState !== 'done');
        const allChecked = actionable.length > 0 && actionable.every(i => i.checked);
        actionable.forEach(i => { i.checked = !allChecked; });
        renderRadarDrawer();
      });
      drawer.querySelector('#vg-radar-rescan-btn').addEventListener('click', () => runZaloSyncRadar('smart_auto'));
      drawer.querySelector('#vg-radar-confirm-btn').addEventListener('click', executeRadarConfirmedBatch);
    }
    updateRadarBarState();
  }

  setTimeout(initZaloSyncRadarUI, 1200);

})();
