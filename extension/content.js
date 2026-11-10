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
   * Extract all content and media from a Zalo message bubble
   */
  async function extractMessageData(messageEl) {
    // 1. Extract Text Content
    let text = '';
    const textSelectors = [
      '[data-component="message-text-content"]',
      'span.text',
      '.text-message__container',
      '[data-id="div_ReceivedMsg_Text"]',
      '[data-component="text-container"]',
      '.rich-text-content',
      '.text-content',
      '.card--text',
      '.content',
      '[data-translate-inner]'
    ];

    for (const sel of textSelectors) {
      const el = messageEl.querySelector(sel);
      if (el) {
        // Clone and strip our own injected buttons before reading text
        const clone = el.cloneNode(true);
        clone.querySelectorAll('.vg-zalo-btn-wrapper, button').forEach(b => b.remove());
        text = clone.innerText.trim();
        if (text) break;
      }
    }

    // Fallback: If no dedicated text selector, read text directly from message container
    if (!text) {
      const clone = messageEl.cloneNode(true);
      clone.querySelectorAll(
        '.vg-zalo-btn-wrapper, button, .msg-menu, .extra-actions, [data-id="avatar"], ' +
        '.message-sender-name-wrapper, .reaction-emoji-icon, .-reaction, .chat-date, .time'
      ).forEach(b => b.remove());
      text = clone.innerText.trim();
    }

    // 2. Extract Media (Images & Videos)
    const rawMediaList = [];

    function collectFrom(el) {
      if (!el) return;
      const imgElements = el.querySelectorAll('img, img.zimg-el');
      imgElements.forEach(img => {
        const classes = (img.className || '').toLowerCase();
        const src = img.getAttribute('data-original') || img.getAttribute('data-src') || img.getAttribute('src') || '';
        
        if (
          classes.includes('avatar') ||
          classes.includes('emoji') ||
          classes.includes('icon') ||
          classes.includes('default-react-icon') ||
          src.includes('avatar') ||
          src.includes('emoji') ||
          src.includes('static.zalo.me') ||
          src.includes('iconlike')
        ) {
          return;
        }

        if (src && (src.startsWith('http') || src.startsWith('blob:'))) {
          rawMediaList.push(src);
        }
      });

      const videoElements = el.querySelectorAll('video, [data-video-url], a[href*=".mp4"]');
      videoElements.forEach(v => {
        const vSrc = v.getAttribute('data-video-url') || v.getAttribute('src') || v.getAttribute('href') || '';
        if (vSrc && (vSrc.startsWith('http') || vSrc.startsWith('blob:'))) {
          rawMediaList.push(vSrc);
        }
      });
    }

    // Collect from current message
    collectFrom(messageEl);

    // 3. Smart Neighbor Merge (Hai chiều thông minh - Tự động gom Text + Album Ảnh liền kề):
    const currentChatItem = messageEl.closest('.chat-item');
    if (currentChatItem) {
      // A. Nếu tin nhắn hiện tại CHƯA CÓ TEXT (chỉ có ảnh): Quét tin kế tiếp (next), sau đó quét tin trước (prev) để lấy cấu hình
      if (!text) {
        // Quét phía dưới trước (đầu kho hay gửi ảnh trước rồi gửi cấu hình ngay phía dưới)
        let next = currentChatItem.nextElementSibling;
        for (let i = 0; i < 3 && next && !text; i++) {
          if (next.classList && next.classList.contains('chat-item')) {
            const textEl = next.querySelector('[data-component="message-text-content"], span.text, .text-message__container, [data-id="div_ReceivedMsg_Text"]');
            if (textEl && textEl.innerText.trim().length > 10) {
              text = textEl.innerText.trim();
              break;
            }
          }
          next = next.nextElementSibling;
        }
        // Nếu phía dưới không có, quét lên phía trên
        if (!text) {
          let prev = currentChatItem.previousElementSibling;
          for (let i = 0; i < 3 && prev && !text; i++) {
            if (prev.classList && prev.classList.contains('chat-item')) {
              const textEl = prev.querySelector('[data-component="message-text-content"], span.text, .text-message__container, [data-id="div_ReceivedMsg_Text"]');
              if (textEl && textEl.innerText.trim().length > 10) {
                text = textEl.innerText.trim();
                break;
              }
            }
            prev = prev.previousElementSibling;
          }
        }
      }

      // B. Nếu tin nhắn hiện tại CHƯA CÓ ẢNH (chỉ có text): Quét tin trước (prev), sau đó quét tin sau (next) để gom ảnh HD
      if (rawMediaList.length === 0) {
        // Quét phía trên trước (như ảnh kho gửi: chùm ảnh nằm ngay trên bài text cấu hình)
        let prev = currentChatItem.previousElementSibling;
        for (let i = 0; i < 3 && prev; i++) {
          if (prev.classList && prev.classList.contains('chat-item')) {
            collectFrom(prev);
            if (rawMediaList.length > 0) break;
          }
          prev = prev.previousElementSibling;
        }
        // Nếu phía trên không có, quét tiếp phía dưới
        if (rawMediaList.length === 0) {
          let next = currentChatItem.nextElementSibling;
          for (let i = 0; i < 3 && next; i++) {
            if (next.classList && next.classList.contains('chat-item')) {
              collectFrom(next);
              if (rawMediaList.length > 0) break;
            }
            next = next.nextElementSibling;
          }
        }
      }
    } else {
      // Fallback khi không tìm thấy chat-item
      if (!text) {
        const next = messageEl.nextElementSibling;
        const prev = messageEl.previousElementSibling;
        if (next && next.innerText) text = next.innerText.trim();
        else if (prev && prev.innerText) text = prev.innerText.trim();
      }
      if (rawMediaList.length === 0) {
        collectFrom(messageEl.previousElementSibling);
        if (rawMediaList.length === 0) collectFrom(messageEl.nextElementSibling);
      }
    }

    // 4. Resolve media (convert blob: to base64, normalize CDN URLs)
    const mediaUrls = [];
    const seen = new Set();

    for (const src of rawMediaList) {
      if (seen.has(src)) continue;
      seen.add(src);

      if (src.startsWith('blob:')) {
        const base64 = await blobUrlToBase64(src);
        if (base64) mediaUrls.push(base64);
      } else {
        mediaUrls.push(normalizeZaloMediaUrl(src));
      }
    }

    return {
      text,
      mediaUrls
    };
  }

  /**
   * Send post data to Laptop Vương Gia backend
   */
  async function pushToFacebook(data, publishImmediately = true, btnElement = null) {
    if (!data.text && data.mediaUrls.length === 0) {
      showToast('Không tìm thấy nội dung bài viết hoặc hình ảnh để đăng!', 'error');
      return;
    }

    const originalBtnText = btnElement ? btnElement.innerHTML : '';
    const mediaCount = data.mediaUrls ? data.mediaUrls.length : 0;
    const mediaLabel = mediaCount > 0 ? ` (kèm ${mediaCount} ảnh HD)` : '';

    if (btnElement) {
      btnElement.innerHTML = `🌀 Đang xử lý${mediaCount > 0 ? ' (' + mediaCount + ' ảnh)' : ''}...`;
      btnElement.style.opacity = '0.7';
      btnElement.disabled = true;
    }

    const actionName = publishImmediately ? 'Đăng lên Facebook' : 'Đưa vào Hàng đợi';
    const loadingToast = showToast(`Đang bóc tách AI và ${actionName}${mediaLabel}...`, 'loading');

    try {
      let result;

      // Delegate to Background Service Worker to bypass Zalo Web page CSP completely
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        result = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'pushPost',
            serverUrl: defaultServerUrl,
            payload: {
              rawText: data.text,
              mediaUrls: data.mediaUrls,
              publishImmediately: publishImmediately
            }
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
          body: JSON.stringify({
            rawText: data.text,
            mediaUrls: data.mediaUrls,
            publishImmediately: publishImmediately
          })
        });
        result = await response.json();
      }

      loadingToast.remove();

      if (result.success) {
        const post = result.post || {};
        const successMsg = publishImmediately
          ? `Đã đăng thành công mã #${post.machineCode || ''}${mediaLabel} lên Fanpage!`
          : `Đã đưa bài #${post.machineCode || ''}${mediaLabel} vào hàng đợi!`;

        showToast(successMsg, 'success', result.fbPostUrl || post.fbPostUrl);
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

    // Check if element is a valid message bubble or card
    const hasText = Boolean(messageEl.querySelector(
      '.text-message__container, [data-id="div_ReceivedMsg_Text"], [data-component="message-text-content"], [data-component="text-container"], span.text, .rich-text-content, .text-content, .card--text, [data-translate-inner]'
    )) || (messageEl.innerText && messageEl.innerText.trim().length > 15);

    const hasPhoto = Boolean(messageEl.querySelector(
      '.card--photo, .card--album, .card--group-photo, [data-id*="GrpPhoto"], [data-id*="Photo"], [data-id*="Media"], #album-container, img.zimg-el, img:not([class*="avatar"]):not([class*="emoji"]):not([class*="default-react-icon"])'
    ));
    
    // Ignore non-message elements (like system banners, date separators)
    if (!hasText && !hasPhoto) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'vg-zalo-btn-wrapper';

    // Button 1: ⚡ ĐĂNG FANPAGE (Đăng ngay lập tức)
    const publishBtn = document.createElement('button');
    publishBtn.className = 'vg-zalo-autopost-btn';
    publishBtn.title = 'Bấm để AI bóc tách cấu hình, tải ảnh và ĐĂNG NGAY lên Fanpage Facebook (Hotline: 0876637806)';
    publishBtn.innerHTML = '⚡ ĐĂNG FANPAGE';
    publishBtn.onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      publishBtn.disabled = true;
      publishBtn.innerHTML = '🌀 Đang nạp ảnh...';
      const data = await extractMessageData(messageEl);
      pushToFacebook(data, true, publishBtn);
    };

    // Button 2: ⏳ LÊN LỊCH (Đưa vào hàng đợi giờ vàng)
    const scheduleBtn = document.createElement('button');
    scheduleBtn.className = 'vg-zalo-autopost-btn vg-btn-secondary';
    scheduleBtn.title = 'Bấm để đưa bài vào Hàng Đợi (Đăng tự động vào khung giờ vàng tiếp theo)';
    scheduleBtn.innerHTML = '⏳ LÊN LỊCH';
    scheduleBtn.onclick = async (e) => {
      e.stopPropagation();
      e.preventDefault();
      scheduleBtn.disabled = true;
      scheduleBtn.innerHTML = '🌀 Đang nạp ảnh...';
      const data = await extractMessageData(messageEl);
      pushToFacebook(data, false, scheduleBtn);
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

})();
