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
  let isExecuting = false;

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
   * Helper: Check if element is truly visible in viewport
   */
  function isVisible(el) {
    if (!el || !(el instanceof Element)) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  /**
   * Helper: Realistic Full-Event Click Simulation for React 18 Event Delegation
   */
  function simulateRealisticClick(el) {
    if (!el || !(el instanceof Element)) return false;
    try {
      if (typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'center' });
      }
      if (typeof el.focus === 'function') {
        el.focus();
      }

      const rect = el.getBoundingClientRect();
      const clientX = Math.round(rect.left + Math.max(5, rect.width / 2));
      const clientY = Math.round(rect.top + Math.max(5, rect.height / 2));

      const commonOpts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        detail: 1,
        clientX,
        clientY,
        screenX: clientX + (window.screenX || 0),
        screenY: clientY + (window.screenY || 0)
      };

      const downOpts = {
        ...commonOpts,
        button: 0,
        buttons: 1,
        isPrimary: true,
        pointerId: 1,
        pointerType: 'mouse',
        pressure: 0.5
      };

      const upOpts = {
        ...commonOpts,
        button: 0,
        buttons: 0,
        isPrimary: true,
        pointerId: 1,
        pointerType: 'mouse',
        pressure: 0
      };

      // 1. Hover / pointerover
      try { el.dispatchEvent(new PointerEvent('pointerover', downOpts)); } catch (e) {}
      try { el.dispatchEvent(new PointerEvent('pointerenter', downOpts)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseover', downOpts)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseenter', downOpts)); } catch (e) {}

      // 2. Pointer down & mouse down (buttons: 1)
      try { el.dispatchEvent(new PointerEvent('pointerdown', downOpts)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mousedown', downOpts)); } catch (e) {}

      // 3. Pointer up & mouse up (buttons: 0)
      try { el.dispatchEvent(new PointerEvent('pointerup', upOpts)); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseup', upOpts)); } catch (e) {}

      // 4. Click event (buttons: 0)
      try { el.dispatchEvent(new MouseEvent('click', upOpts)); } catch (e) {}

      // 5. Native click
      if (typeof el.click === 'function') {
        el.click();
      }

      // 6. Click top-most element at coordinates if it's an overlay
      try {
        const topEl = document.elementFromPoint(clientX, clientY);
        if (topEl && topEl !== el && !topEl.contains(el) && !el.contains(topEl) && typeof topEl.click === 'function') {
          topEl.click();
        }
      } catch (e) {}

      // 7. Keyboard trigger fallback (Enter and Space)
      try {
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true }));
        el.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', keyCode: 32, which: 32, bubbles: true }));
      } catch (e) {}

      return true;
    } catch (err) {
      console.warn('[VG FB Robot] simulateRealisticClick warning:', err);
      return false;
    }
  }

  /**
   * Strictly check if a dialog is the REAL Facebook Create Post Modal (Zero False Positives)
   */
  function isCreatePostModal(d) {
    if (!d || !(d instanceof Element)) return false;
    if (d.closest('#vg-fb-robot-hud')) return false;

    // 1. Must be visible and reasonably large (at least 320x200 px)
    const rect = d.getBoundingClientRect();
    if (rect.width < 320 || rect.height < 200) return false;
    const style = window.getComputedStyle(d);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

    // 2. Strictly exclude Messenger / Chat windows & Meta AI
    const aria = (d.getAttribute('aria-label') || '').toLowerCase();
    if (
      aria.includes('đoạn chat') ||
      aria.includes('tin nhắn') ||
      aria.includes('chat with') ||
      aria.includes('messenger') ||
      aria.includes('cuộc trò chuyện') ||
      aria.includes('meta ai')
    ) {
      return false;
    }
    const chatInput = d.querySelector('div[aria-label*="nhắn tin" i], div[aria-label*="tin nhắn" i], div[aria-label*="send a message" i]');
    if (chatInput) return false;

    // 3. MUST contain a Lexical / contenteditable textbox.
    // If there is NO editor, it CANNOT be the create-post dialog (e.g. menus, quick action popovers)
    const editor = d.querySelector(
      'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], div[contenteditable="true"][role="textbox"]'
    );
    if (!editor) return false;

    // 4. Editor must NOT be chat or comments
    const editorAria = (editor.getAttribute('aria-label') || '').toLowerCase();
    if (editorAria.includes('nhắn tin') || editorAria.includes('tin nhắn') || editorAria.includes('bình luận') || editorAria.includes('comment')) {
      return false;
    }

    // 5. Must have the submit button whose label is EXACTLY "Đăng" or "Post" (NOT "Đăng xuất", NOT "Đăng nhập")
    const buttons = Array.from(d.querySelectorAll('div[role="button"]'));
    const hasPostButton = buttons.some(b => {
      const label = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return label === 'đăng' || label === 'post';
    });
    if (!hasPostButton) return false;

    // 6. Must have "Tạo bài viết" / "Create post" title OR editor aria contains "nghĩ gì" / "what's on your mind" / "dòng thời gian"
    const headings = Array.from(d.querySelectorAll('h1, h2, h3, div[role="heading"], span'));
    const hasCreatePostHeading = headings.some(h => {
      const text = (h.innerText || '').trim().toLowerCase();
      return text === 'tạo bài viết' || text === 'create post' || text === 'tạo bài viết công khai';
    });
    const hasMindLabel =
      editorAria.includes('nghĩ gì') ||
      editorAria.includes("what's on your mind") ||
      editorAria.includes('dòng thời gian') ||
      editorAria.includes('timeline') ||
      editorAria.includes('write something');

    return hasCreatePostHeading || hasMindLabel;
  }

  /**
   * Find the REAL Facebook Create Post modal on document
   */
  function findCreatePostModal() {
    const dialogs = Array.from(document.querySelectorAll('div[role="dialog"]'));
    for (const d of dialogs) {
      if (isCreatePostModal(d)) return d;
    }
    return null;
  }

  /**
   * Find the EXACT "Bạn đang nghĩ gì?" composer pill on Facebook Desktop Feed & Personal Profile
   * NOTE: Strictly DO NOT click "Ảnh/video" here because Chrome blocks untrusted file chooser dialogs
   */
  function findFeedComposerTriggers() {
    const list = [];

    // 1. Target leaf span/div containing "đang nghĩ gì", "what's on your mind", or "dòng thời gian"
    const allTextNodes = Array.from(document.querySelectorAll('span, div'));
    for (const node of allTextNodes) {
      if (node.children.length > 0) continue; // leaf node only
      if (node.closest('div[role="dialog"]') || node.closest('#vg-fb-robot-hud')) continue;

      const text = (node.innerText || '').trim().toLowerCase();
      if (
        (text.includes('nghĩ gì') ||
         text.includes("what's on your mind") ||
         text.includes('tạo bài viết') ||
         text.includes('create post') ||
         text.includes('dòng thời gian') ||
         text.includes('write something')) &&
        !text.includes('bình luận') && !text.includes('xem thêm') && !text.includes('tin nhắn') && !text.includes('ảnh/video')
      ) {
        // The interactive role="button" container
        const button = node.closest('div[role="button"][tabindex="0"]') || node.closest('div[role="button"]');
        if (button && isVisible(button)) {
          list.push(button);
          list.push(node);
          if (node.parentElement && node.parentElement !== button) {
            list.push(node.parentElement);
          }
        }
      }
    }

    // 2. Direct query for aria-label or data-pagelet composer button (excluding photo/video)
    const directQuery = Array.from(document.querySelectorAll(
      'div[aria-label*="nghĩ gì" i][role="button"], div[aria-label*="what\'s on your mind" i][role="button"], div[aria-label*="dòng thời gian" i][role="button"], div[data-pagelet*="Composer"] div[role="button"][tabindex="0"], div[data-pagelet="ProfileComposer"] div[role="button"][tabindex="0"], div[data-pagelet="FeedUnit_0"] div[role="button"][tabindex="0"]'
    ));
    for (const el of directQuery) {
      const text = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('ảnh/video') || text.includes('photo/video')) continue;
      if (!el.closest('div[role="dialog"]') && !el.closest('#vg-fb-robot-hud') && isVisible(el)) {
        list.push(el);
      }
    }

    // Deduplicate
    return Array.from(new Set(list)).filter(Boolean);
  }

  /**
   * Wait for Create Post modal specifically via MutationObserver
   */
  function waitForCreatePostModal(timeout = 10000) {
    return new Promise((resolve) => {
      const existing = findCreatePostModal();
      if (existing) return resolve(existing);

      const observer = new MutationObserver(() => {
        const found = findCreatePostModal();
        if (found) {
          observer.disconnect();
          resolve(found);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        resolve(findCreatePostModal());
      }, timeout);
    });
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
    if (isExecuting) {
      console.warn('[VG FB Robot] Đang có tiến trình đăng bài chạy song song, bỏ qua lệnh trùng lặp.');
      return;
    }
    isExecuting = true;
    const { content, mediaUrls = [], machineCode = '' } = payload;
    isCancelled = false;

    console.log('[VG FB Robot] Bắt đầu quy trình tự động đăng bài lên trang cá nhân:', machineCode);
    createHud(machineCode);

    try {
      // BƯỚC 1: Tìm và mở ô "Bạn đang nghĩ gì thế?"
      setStepStatus(1, 'active', 'Đang tìm và mở ô tạo bài viết...');
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
      await sleep(1000); // Chờ Facebook render các element

      let modal = findCreatePostModal();
      console.log('[VG FB Robot] Trạng thái modal ban đầu:', modal);
      const openStartTime = Date.now();
      const openTimeout = 15000; // Thử tự động trong 15s

      // Lắng nghe click thủ công từ người dùng để bắt ngay lập tức nếu người dùng bấm bằng tay
      const manualClickListener = () => {
        setTimeout(() => {
          const m = findCreatePostModal();
          if (m) modal = m;
        }, 300);
      };
      document.addEventListener('click', manualClickListener, { capture: true, passive: true });

      while (!modal && (Date.now() - openStartTime < openTimeout)) {
        if (isCancelled) {
          document.removeEventListener('click', manualClickListener, true);
          return;
        }

        modal = findCreatePostModal();
        if (modal) break;

        const triggers = findFeedComposerTriggers();
        console.log('[VG FB Robot] Tìm thấy', triggers.length, 'phần tử kích hoạt bài viết.');

        // Thử click từng phần tử kích hoạt
        for (const target of triggers) {
          simulateRealisticClick(target);
          if (target.firstElementChild) {
            simulateRealisticClick(target.firstElementChild);
          }
          await sleep(350);
          modal = findCreatePostModal();
          if (modal) break;
        }

        if (modal) break;

        // Nếu sau 1.5 giây mà Facebook chưa mở, làm nổi bật viền vàng nhấp nháy để hướng dẫn người dùng
        if (Date.now() - openStartTime > 1500 && !modal) {
          setStepStatus(1, 'active', '👉 Vui lòng click vào ô "Bạn đang nghĩ gì thế?" (viền vàng)...');
          triggers.forEach(c => {
            if (c.style && !c.dataset.vgStyled) {
              c.dataset.vgStyled = 'true';
              c.style.outline = '4px solid #EAB308';
              c.style.boxShadow = '0 0 16px rgba(234, 179, 8, 0.8)';
              c.style.transition = 'all 0.3s ease';
              c.style.cursor = 'pointer';
            }
          });
        }

        await sleep(500);
      }

      if (!modal) {
        modal = await waitForCreatePostModal(8000);
      }

      document.removeEventListener('click', manualClickListener, true);

      // Xóa viền vàng làm nổi bật nếu có
      document.querySelectorAll('[data-vg-styled]').forEach(el => {
        el.style.outline = '';
        el.style.boxShadow = '';
        delete el.dataset.vgStyled;
      });

      if (!modal) {
        throw new Error('Hộp thoại tạo bài viết không xuất hiện. Hãy thử click bằng tay vào ô đăng bài trên Facebook.');
      }

      setStepStatus(1, 'success', 'Đã mở khung soạn bài!');

      // BƯỚC 2: Chờ Modal soạn bài ổn định và điền nội dung vào Editor
      await sleep(600);
      setStepStatus(2, 'active', 'Đang nhập nội dung bài viết...');
      let editor = await waitForElement(
        'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], div[contenteditable="true"], div[aria-label*="nghĩ gì" i], div[aria-label*="what\'s on your mind" i]',
        modal,
        6000
      );

      // Fallback search across active modal and document
      if (!editor) {
        editor = modal.querySelector('div[role="textbox"][contenteditable="true"]') ||
                 modal.querySelector('[contenteditable="true"]') ||
                 document.querySelector('div[role="dialog"] div[data-lexical-editor="true"]');
      }

      if (!editor) {
        throw new Error('Không tìm thấy khung soạn thảo văn bản trong hộp thoại.');
      }

      editor.focus();
      await sleep(300);

      // Điền nội dung văn bản chuẩn Lexical (chỉ chèn 1 lần duy nhất, giữ nguyên xuống dòng)
      const textToInsert = content || '';
      const placeCaretAtEnd = () => {
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(editor);
          range.collapse(false);
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
        } catch (e) {}
      };

      const hasInsertedText = () => (editor.innerText || '').trim().length > 0;

      // Ưu tiên 1: ClipboardEvent 'paste' (Lexical giữ nguyên 100% dấu xuống dòng \n và tự bật nút Đăng)
      if (!hasInsertedText() && textToInsert) {
        try {
          placeCaretAtEnd();
          const dt = new DataTransfer();
          dt.setData('text/plain', textToInsert);
          const pasteEvent = new ClipboardEvent('paste', {
            bubbles: true,
            cancelable: true,
            clipboardData: dt
          });
          editor.dispatchEvent(pasteEvent);
          await sleep(250);
        } catch (e) {
          console.warn('[VG FB Robot] ClipboardEvent paste fallback:', e);
        }
      }

      // Ưu tiên 2 (Fallback duy nhất): Nếu editor vẫn trống thì mới dùng execCommand insertText
      if (!hasInsertedText() && textToInsert) {
        try {
          placeCaretAtEnd();
          document.execCommand('insertText', false, textToInsert);
          await sleep(200);
        } catch (e) {
          console.warn('[VG FB Robot] execCommand insertText fallback:', e);
        }
      }

      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(textToInsert).catch(() => {});
        }
      } catch (e) {}
      setStepStatus(2, 'success', 'Đã điền xong cấu hình máy!');
      await sleep(800);

      // BƯỚC 3: Đính kèm hình ảnh
      setStepStatus(3, 'active', `Đang tải lên ${mediaUrls.length} ảnh HD...`);
      if (mediaUrls.length > 0) {
        let fileInput = modal.querySelector('input[type="file"][accept*="image"]') || document.querySelector('input[type="file"][accept*="image"]');
        
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
          fileInput = await waitForElement('input[type="file"][accept*="image"]', modal, 5000) || document.querySelector('input[type="file"][accept*="image"]');
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
        const maxUploadWait = 30000; // Chờ tối đa 30s cho album ảnh HD tải lên hoàn tất
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
          simulateRealisticClick(postBtn);
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
    } finally {
      isExecuting = false;
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
