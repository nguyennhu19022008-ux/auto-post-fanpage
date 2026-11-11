/**
 * LAPTOP VƯƠNG GIA // FACEBOOK PERSONAL PROFILE ROBOT
 * Content Script for facebook.com
 * Automates 100% posting to User Personal Timeline with zero human effort
 */

(function () {
  'use strict';

  console.log('[VG FB Robot] Robot tự động đăng bài Facebook cá nhân đã kích hoạt!');

  let hudEl = null;
  let countdownTimer = null;
  let isCancelled = false;

  /**
   * Helper: Sleep for ms
   */
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  /**
   * Convert Data URL (Base64) or HTTP/HTTPS/Blob URL to real Browser File object
   */
  async function urlToFile(url, filename) {
    try {
      if (!url || typeof url !== 'string') return null;

      // Case 1: Base64 Data URL
      if (url.startsWith('data:')) {
        const arr = url.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, { type: mime });
      }

      // Case 2: HTTP/HTTPS or Blob URL
      if (url.startsWith('http') || url.startsWith('blob:')) {
        const resp = await fetch(url);
        if (!resp.ok && !url.startsWith('blob:')) {
          console.warn('[VG FB Robot] Không tải được ảnh từ URL:', url, resp.status);
          return null;
        }
        const blob = await resp.blob();
        const mime = blob.type || 'image/jpeg';
        return new File([blob], filename, { type: mime });
      }

      return null;
    } catch (e) {
      console.warn('[VG FB Robot] Lỗi chuyển URL sang File:', e);
      return null;
    }
  }

  /**
   * Create and show HUD status widget
   */
  function createHud(machineCode = '') {
    if (document.getElementById('vg-fb-robot-hud')) {
      document.getElementById('vg-fb-robot-hud').remove();
    }

    hudEl = document.createElement('div');
    hudEl.id = 'vg-fb-robot-hud';
    hudEl.innerHTML = `
      <div class="vg-hud-header">
        <div class="vg-hud-title">
          <span>⚡</span> LAPTOP VƯƠNG GIA ROBOT
        </div>
        <button class="vg-hud-close-btn" id="vg-hud-close" title="Đóng">&times;</button>
      </div>
      <div class="vg-hud-body">
        <div class="vg-hud-step active" id="vg-step-1">
          <span class="vg-hud-step-icon">🔍</span>
          <span>Đang tìm ô tạo bài viết cá nhân...</span>
        </div>
        <div class="vg-hud-step" id="vg-step-2">
          <span class="vg-hud-step-icon">📝</span>
          <span>Đang điền cấu hình máy #${machineCode}...</span>
        </div>
        <div class="vg-hud-step" id="vg-step-3">
          <span class="vg-hud-step-icon">🖼️</span>
          <span>Đang đính kèm ảnh thực tế...</span>
        </div>
        <div class="vg-hud-step" id="vg-step-4">
          <span class="vg-hud-step-icon">🚀</span>
          <span>Đang chuẩn bị xuất bản...</span>
        </div>
        <div class="vg-hud-countdown-box" id="vg-hud-countdown-area" style="display: none;">
          <div class="vg-hud-countdown-text" id="vg-countdown-label">Tự động bấm 'Đăng' sau 3s...</div>
          <div class="vg-hud-actions">
            <button class="vg-hud-btn vg-hud-btn-cancel" id="vg-btn-cancel-post">HỦY TỰ ĐỘNG</button>
            <button class="vg-hud-btn vg-hud-btn-now" id="vg-btn-post-now">ĐĂNG NGAY</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(hudEl);

    document.getElementById('vg-hud-close').onclick = () => {
      cancelAutoPost();
      hudEl.remove();
    };

    document.getElementById('vg-btn-cancel-post').onclick = () => {
      cancelAutoPost();
    };

    return hudEl;
  }

  function setStepStatus(stepNum, status = 'active', text = null) {
    const stepEl = document.getElementById(`vg-step-${stepNum}`);
    if (!stepEl) return;
    stepEl.className = `vg-hud-step ${status}`;
    if (text) {
      stepEl.querySelector('span:last-child').innerText = text;
    }
  }

  function cancelAutoPost() {
    isCancelled = true;
    if (countdownTimer) clearInterval(countdownTimer);
    const area = document.getElementById('vg-hud-countdown-area');
    if (area) {
      area.innerHTML = '<span style="color:#DC2626; font-weight:bold;">⛔ Đã hủy tự động đăng! Bạn có thể tự chỉnh sửa và bấm Đăng.</span>';
    }
  }

  /**
   * Helper: Realistic Full-Event Click Simulation for React 18 Event Delegation
   */
  function simulateRealisticClick(el) {
    if (!el) return false;
    try {
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }
      if (typeof el.focus === 'function') {
        el.focus();
      }

      const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 100, top: 100, width: 50, height: 20 };
      const clientX = Math.round(rect.left + rect.width / 2);
      const clientY = Math.round(rect.top + rect.height / 2);

      const eventOpts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX,
        clientY,
        screenX: clientX,
        screenY: clientY,
        button: 0,
        buttons: 1
      };

      // Full event chain for React 18 / Relay Event Delegation
      try { el.dispatchEvent(new PointerEvent('pointerover', eventOpts)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseover', eventOpts)); } catch (e) {}
      try { el.dispatchEvent(new PointerEvent('pointerdown', eventOpts)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mousedown', eventOpts)); } catch (e) {}
      try { el.dispatchEvent(new PointerEvent('pointerup', eventOpts)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseup', eventOpts)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('click', eventOpts)); } catch (e) {}

      // Native click
      if (typeof el.click === 'function') {
        el.click();
      }

      // Keyboard trigger fallback (Enter and Space)
      try {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      } catch (e) {}

      return true;
    } catch (err) {
      console.warn('[VG FB Robot] simulateRealisticClick warning:', err);
      return false;
    }
  }

  /**
   * Wait for a DOM element matching selector
   */
  function waitForElement(selector, root = document, timeout = 7000) {
    return new Promise((resolve) => {
      const el = root.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const found = root.querySelector(selector);
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });

      observer.observe(root, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * MAIN AUTOMATION WORKFLOW
   */
  async function executePersonalPost(payload) {
    const { content, mediaUrls = [], machineCode = '' } = payload;
    isCancelled = false;

    console.log('[VG FB Robot] Bắt đầu quy trình tự động đăng bài lên trang cá nhân:', machineCode);
    createHud(machineCode);

    try {
      // BƯỚC 1: Tìm và mở ô "Bạn đang nghĩ gì thế?"
      setStepStatus(1, 'active', 'Đang tìm và mở ô tạo bài viết...');
      await sleep(1000); // Chờ Facebook render các element

      let modal = null;
      const openStartTime = Date.now();
      const openTimeout = 15000; // Thử liên tục trong 15s

      while (!modal && (Date.now() - openStartTime < openTimeout)) {
        if (isCancelled) return;

        // Check if modal is already open
        modal = document.querySelector('div[role="dialog"]');
        if (modal) break;

        // Collect all potential trigger elements on Facebook Desktop feed
        const candidates = [];

        // 1. Photo/Video button (Green icon "Ảnh/video"): Clicking this ALWAYS opens the dialog
        const photoButtons = Array.from(document.querySelectorAll('div[role="button"], span, div[tabindex="0"]')).filter(b => {
          if (b.closest('div[role="dialog"]') || b.closest('#vg-robot-hud')) return false;
          const text = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase();
          return text === 'ảnh/video' || text.includes('ảnh/video') || text.includes('photo/video');
        });
        photoButtons.forEach(b => {
          candidates.push(b);
          if (b.parentElement) candidates.push(b.parentElement);
          const btn = b.closest('div[role="button"]');
          if (btn) candidates.push(btn);
        });

        // 2. Main composer text pill ("Gia ơi, bạn đang nghĩ gì thế?")
        const textElements = Array.from(document.querySelectorAll('div[role="button"], span, div[tabindex="0"], div[role="region"] div')).filter(el => {
          if (el.closest('div[role="dialog"]') || el.closest('#vg-robot-hud')) return false;
          const text = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
          return (
            text.includes('nghĩ gì') ||
            text.includes("what's on your mind") ||
            text.includes('tạo bài viết') ||
            text.includes('create post')
          ) && !text.includes('xem thêm') && !text.includes('bình luận');
        });
        textElements.forEach(el => {
          candidates.push(el);
          const btn = el.closest('div[role="button"]');
          if (btn) candidates.push(btn);
          if (el.parentElement) candidates.push(el.parentElement);
        });

        // 3. Pagelet and Feed composers
        const feedComposers = document.querySelectorAll(
          'div[data-pagelet*="Composer"] div[role="button"], div[data-pagelet="ProfileComposer"] div[role="button"], div[role="main"] div[role="button"]'
        );
        feedComposers.forEach(fc => candidates.push(fc));

        // Deduplicate candidates
        const uniqueCandidates = Array.from(new Set(candidates));

        // Try clicking each unique candidate
        for (const target of uniqueCandidates) {
          simulateRealisticClick(target);
          await sleep(350);
          modal = document.querySelector('div[role="dialog"]');
          if (modal) break;
        }

        if (modal) break;
        await sleep(600);
      }

      if (!modal) {
        // Last resort: Add a pulsating notice to click the box if browser sandbox blocked synthetic click
        setStepStatus(1, 'active', '👉 Vui lòng click vào ô "Bạn đang nghĩ gì thế?"...');
        modal = await waitForElement('div[role="dialog"]', document.body, 12000);
      }

      if (!modal) {
        throw new Error('Hộp thoại tạo bài viết không xuất hiện. Hãy thử click bằng tay vào ô đăng bài trên Facebook.');
      }

      setStepStatus(1, 'success', 'Đã mở khung soạn bài!');

      // BƯỚC 2: Chờ Modal soạn bài ổn định và điền nội dung vào Editor
      await sleep(600);
      setStepStatus(2, 'active', 'Đang nhập nội dung bài viết...');
      const editor = await waitForElement(
        'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], div[aria-label*="Bạn đang nghĩ gì"], div[aria-label*="What\'s on your mind"]',
        modal,
        6000
      );

      if (!editor) {
        throw new Error('Không tìm thấy khung soạn thảo văn bản trong hộp thoại.');
      }

      editor.focus();
      await sleep(300);

      // Điền nội dung văn bản chuẩn Lexical & Selection API
      const textToInsert = content || '';
      try {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editor);
        range.collapse(false);
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
        }
        document.execCommand('insertText', false, textToInsert);
      } catch (e) {
        console.warn('[VG FB Robot] execCommand insertText fallback:', e);
      }

      // Fallback: If editor is still empty, dispatch ClipboardEvent paste
      if (!editor.innerText || editor.innerText.trim().length === 0) {
        try {
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: new DataTransfer()
          });
          pasteEvent.clipboardData.setData('text/plain', textToInsert);
          editor.dispatchEvent(pasteEvent);
        } catch (e) {}
      }

      // Dispatch event để React cập nhật State
      editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, inputType: 'insertText', data: textToInsert }));
      editor.dispatchEvent(new InputEvent('input', { bubbles: true }));
      setStepStatus(2, 'success', 'Đã điền xong cấu hình máy!');
      await sleep(800);

      // BƯỚC 4: Đính kèm hình ảnh
      setStepStatus(3, 'active', `Đang tải lên ${mediaUrls.length} ảnh HD...`);
      if (mediaUrls.length > 0) {
        let fileInput = modal.querySelector('input[type="file"][accept*="image"]');
        
        // Nếu input file chưa có sẵn trong DOM, bấm nút "Ảnh/video" để kích hoạt
        if (!fileInput) {
          const photoBtn = Array.from(modal.querySelectorAll('div[role="button"], div[aria-label*="Ảnh/video"], div[aria-label*="Photo/video"], img[src*="photo"]')).find(b => {
            const label = (b.getAttribute('aria-label') || b.innerText || '').toLowerCase();
            return label.includes('ảnh') || label.includes('photo');
          });
          if (photoBtn) {
            simulateRealisticClick(photoBtn);
            await sleep(800);
          }
          fileInput = await waitForElement('input[type="file"][accept*="image"]', modal, 5000);
        }

        if (fileInput) {
          const fileObjects = [];
          for (let i = 0; i < mediaUrls.length; i++) {
            const url = mediaUrls[i];
            const fileObj = await urlToFile(url, `laptop_vuonggia_${machineCode}_${i + 1}.jpg`);
            if (fileObj) fileObjects.push(fileObj);
          }

          if (fileObjects.length > 0) {
            const dataTransfer = new DataTransfer();
            fileObjects.forEach(f => dataTransfer.items.add(f));
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            setStepStatus(3, 'success', `Đã gắn thành công ${fileObjects.length} ảnh HD!`);
          } else {
            setStepStatus(3, 'success', 'Bỏ qua đính kèm ảnh (ảnh rỗng).');
          }
        } else {
          setStepStatus(3, 'active', 'Không tìm thấy nút nạp ảnh, tiếp tục văn bản.');
        }
      } else {
        setStepStatus(3, 'success', 'Bài đăng không có ảnh.');
      }

      await sleep(1500); // Chờ Facebook xử lý ảnh đính kèm

      // BƯỚC 5: Đếm ngược và Tự động Bấm "ĐĂNG"
      setStepStatus(4, 'active', 'Chuẩn bị xuất bản...');
      const countdownBox = document.getElementById('vg-hud-countdown-area');
      if (countdownBox) countdownBox.style.display = 'block';

      let remaining = 3;
      const countdownLabel = document.getElementById('vg-countdown-label');

      async function triggerSubmit() {
        if (isCancelled) return;
        setStepStatus(4, 'active', '⚡ Đang kiểm tra tiến trình tải ảnh & chuẩn bị đăng...');

        // Chờ tiến trình upload ảnh hoàn tất (Facebook hiển thị progress bar hoặc nút Đăng có aria-disabled="true")
        let uploadWaitTime = 0;
        const maxUploadWait = 15000; // Chờ tối đa 15s cho ảnh tải lên hoàn tất
        while (uploadWaitTime < maxUploadWait) {
          if (isCancelled) return;
          const isUploading = modal.querySelector('div[role="progressbar"], [aria-valuemin], .sp_progress, div[data-visualcompletion="loading-state"]');
          const readyBtn = Array.from(modal.querySelectorAll('div[role="button"]')).find(b => {
            const label = (b.getAttribute('aria-label') || b.innerText || '').trim().toLowerCase();
            return (label === 'đăng' || label === 'post') &&
                   b.getAttribute('aria-disabled') !== 'true' &&
                   !b.classList.contains('disabled');
          });

          if (!isUploading && readyBtn) {
            break;
          }
          await sleep(500);
          uploadWaitTime += 500;
        }

        setStepStatus(4, 'active', '⚡ Đang bấm nút ĐĂNG...');

        // Tìm nút "Đăng" (Post)
        const postBtn = Array.from(modal.querySelectorAll('div[role="button"]')).find(b => {
          const label = (b.getAttribute('aria-label') || b.innerText || '').trim().toLowerCase();
          return (label === 'đăng' || label === 'post') &&
                 b.getAttribute('aria-disabled') !== 'true' &&
                 !b.classList.contains('disabled');
        });

        if (postBtn) {
          postBtn.click();
          setStepStatus(4, 'success', '✅ ĐÃ XUẤT BẢN THÀNH CÔNG LÊN TRANG CÁ NHÂN!');
          if (countdownBox) {
            countdownBox.innerHTML = '<span style="color:#059669; font-weight:900; font-size:14px;">🎉 BÀI VIẾT ĐÃ ĐƯỢC ĐĂNG LÊN TRANG CÁ NHÂN!</span>';
          }
          await sleep(3500);
          if (hudEl) hudEl.remove();
        } else {
          setStepStatus(4, 'active', 'Vui lòng bấm nút "Đăng" màu xanh trên Facebook để hoàn tất.');
        }
      }

      document.getElementById('vg-btn-post-now').onclick = () => {
        if (countdownTimer) clearInterval(countdownTimer);
        triggerSubmit();
      };

      countdownTimer = setInterval(() => {
        if (isCancelled) {
          clearInterval(countdownTimer);
          return;
        }
        remaining -= 1;
        if (countdownLabel) {
          countdownLabel.innerText = `Tự động bấm 'Đăng' sau ${remaining}s...`;
        }
        if (remaining <= 0) {
          clearInterval(countdownTimer);
          triggerSubmit();
        }
      }, 1000);

    } catch (err) {
      console.error('[VG FB Robot Lỗi]', err);
      setStepStatus(1, 'active', `❌ Lỗi: ${err.message}`);
    }
  }

  // Lắng nghe lệnh từ Service Worker hoặc kiểm tra Storage
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'executePersonalPost' && request.payload) {
      executePersonalPost(request.payload);
      sendResponse({ status: 'started' });
    }
  });

  // Tự động kiểm tra Storage nếu tab vừa được mở mới
  chrome.storage.local.get(['vg_pending_personal_post'], (res) => {
    if (res.vg_pending_personal_post) {
      const payload = res.vg_pending_personal_post;
      chrome.storage.local.remove(['vg_pending_personal_post'], () => {
        setTimeout(() => executePersonalPost(payload), 1200);
      });
    }
  });

})();
