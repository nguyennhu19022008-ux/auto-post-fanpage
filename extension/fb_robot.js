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

  const DEFAULT_FANPAGE_URL = 'https://www.facebook.com/profile.php?id=61590327190720';

  function ensureFanpageLink(rawContent) {
    const text = String(rawContent || '').trim();
    if (!text) return `🌐 Fanpage chính thức Laptop Vương Gia: ${DEFAULT_FANPAGE_URL}`;
    if (text.includes('61590327190720')) return text;
    const lines = text.split('\n');
    const lastLine = lines[lines.length - 1] || '';
    const linkLine = `🌐 Fanpage chính thức: ${DEFAULT_FANPAGE_URL}`;
    if (lastLine.trim().startsWith('#')) {
      lines.splice(lines.length - 1, 0, linkLine);
      return lines.join('\n');
    }
    return `${text}\n${linkLine}`;
  }

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
   * Clean single-click helper for Submit / Close / Discard buttons (never double-fires)
   */
  function simulateSingleClick(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    try {
      const rect = el.getBoundingClientRect();
      const clientX = Math.round(rect.left + rect.width / 2);
      const clientY = Math.round(rect.top + rect.height / 2);
      const base = { bubbles: true, cancelable: true, view: window, clientX, clientY };
      try { el.dispatchEvent(new PointerEvent('pointerdown', { ...base, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse' })); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mousedown', { ...base, button: 0, buttons: 1 })); } catch (e) {}
      try { el.dispatchEvent(new PointerEvent('pointerup', { ...base, button: 0, buttons: 0, pointerId: 1, pointerType: 'mouse' })); } catch (e) {}
      try { el.dispatchEvent(new MouseEvent('mouseup', { ...base, button: 0, buttons: 0 })); } catch (e) {}
      if (typeof el.click === 'function') {
        el.click();
      } else {
        el.dispatchEvent(new MouseEvent('click', { ...base, button: 0, buttons: 0 }));
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Clear all text inside Facebook Lexical editor cleanly
   */
  async function clearEditorContents(editor) {
    if (!editor) return;
    try {
      editor.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      await sleep(80);
      if ((editor.innerText || '').trim().length > 0) {
        editor.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'deleteContentBackward' }));
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
        await sleep(80);
      }
    } catch (e) {}
  }

  /**
   * Detect if Facebook's Feed/Group Composer Pill retained stale draft text after publishing, and reset it
   */
  function findResidualDraftPill(textSnippet) {
    const snippet = (textSnippet || '').trim().slice(0, 24).toLowerCase();
    const candidates = Array.from(document.querySelectorAll(
      'div[data-pagelet*="Composer"] div[role="button"][tabindex="0"], div[data-pagelet="ProfileComposer"] div[role="button"][tabindex="0"], div[data-pagelet="GroupInlineComposer"] div[role="button"][tabindex="0"], div[role="button"][tabindex="0"]'
    ));

    for (const el of candidates) {
      if (el.closest('div[role="dialog"]') || el.closest('#vg-fb-robot-hud') || !isVisible(el)) continue;
      const txt = (el.innerText || '').trim().toLowerCase();
      if (!txt || txt.includes('ảnh/video') || txt.includes('photo/video') || txt.includes('video trực tiếp')) continue;
      const isPlaceholder =
        txt.includes('nghĩ gì') ||
        txt.includes("what's on your mind") ||
        txt.includes('bạn viết gì') ||
        txt.includes('write something');
      if (isPlaceholder) continue;

      if ((snippet && txt.includes(snippet)) || txt.includes('[giá tốt]') || txt.includes('mã #') || txt.includes('laptop vương gia')) {
        return el;
      }
    }
    return null;
  }

  async function clearResidualDraftAfterPublish(textSnippet) {
    // 1. Đợi modal vừa đăng đóng hẳn
    const waitStart = Date.now();
    while (findCreatePostModal() && Date.now() - waitStart < 4000) {
      await sleep(150);
    }
    await sleep(450);

    const stalePill = findResidualDraftPill(textSnippet);
    if (!stalePill) return; // Facebook đã tự xóa sạch

    console.log('[VG FB Robot] Phát hiện chữ nháp còn đọng trên thanh đăng bài, đang tự động dọn sạch...');
    simulateSingleClick(stalePill);

    const draftModal = await waitForCreatePostModal(2500);
    if (!draftModal) return;

    const editor = draftModal.querySelector('div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"]');
    if (editor) {
      await clearEditorContents(editor);
    }

    // Xóa ảnh còn sót nếu có nút Xóa/Gỡ trên preview
    const removeMediaBtns = Array.from(draftModal.querySelectorAll('div[role="button"][aria-label*="Xóa" i], div[role="button"][aria-label*="Gỡ" i], div[role="button"][aria-label*="Remove" i]'));
    for (const rmBtn of removeMediaBtns) {
      if (isVisible(rmBtn)) simulateSingleClick(rmBtn);
    }
    await sleep(100);

    // Đóng hộp thoại đã xóa sạch
    const closeBtn = Array.from(draftModal.querySelectorAll('div[role="button"]')).find(b => {
      const a = (b.getAttribute('aria-label') || '').trim().toLowerCase();
      return a === 'đóng' || a === 'close';
    });
    if (closeBtn) {
      simulateSingleClick(closeBtn);
    } else {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true }));
    }

    // Nếu Facebook hiện hộp thoại xác nhận "Bỏ bài viết?", tự bấm "Bỏ" / "Discard"
    await sleep(250);
    const confirmDialogs = Array.from(document.querySelectorAll('div[role="dialog"]')).filter(d => !d.closest('#vg-fb-robot-hud') && isVisible(d));
    for (const cd of confirmDialogs) {
      const discardBtn = Array.from(cd.querySelectorAll('div[role="button"]')).find(b => {
        const lbl = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase();
        return lbl === 'bỏ' || lbl === 'discard' || lbl === 'bỏ bài viết' || lbl === 'rời khỏi';
      });
      if (discardBtn) {
        simulateSingleClick(discardBtn);
        break;
      }
    }
  }

  class VgRobotStatusError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  }

  /**
   * Kiểm tra xem Group đã tham gia chưa, và chuyển sang tab "Thảo luận" nếu đang ở Group Mua bán
   */
  async function prepareGroupComposerEnvironment() {
    // Đợi [role="main"] ổn định tối đa 3s nếu vừa mở trang
    await waitForElement('[role="main"]', document, 3500);
    await sleep(300);

    const existingTriggers = findFeedComposerTriggers();
    if (existingTriggers.length > 0) return;

    const main = document.querySelector('[role="main"]') || document.body;

    // 1. Kiểm tra nếu là Nhóm Mua Bán đang chọn tab "Mua bán" -> bấm chuyển sang tab "Thảo luận"
    const discussionTab = Array.from(main.querySelectorAll('a[role="tab"], div[role="tab"]')).find((t) => {
      const txt = (t.innerText || '').trim().toLowerCase();
      return (txt === 'thảo luận' || txt === 'discussion') && t.getAttribute('aria-selected') !== 'true';
    });
    if (discussionTab && isVisible(discussionTab)) {
      console.log('[VG FB Robot] Phát hiện Group Mua Bán -> chuyển sang tab Thảo luận...');
      simulateSingleClick(discussionTab);
      await sleep(1100);
      if (findFeedComposerTriggers().length > 0) return;
    }

    // 2. Cuộn nhẹ xuống dưới ảnh bìa Group để hiện thanh viết bài
    try { window.scrollTo(0, 220); } catch (e) {}
    await sleep(450);
    if (findFeedComposerTriggers().length > 0) return;

    // 3. Nếu chỉ thấy nút "Tham gia nhóm" / "Join group" mà không có khung viết -> kết luận sớm
    const joinBtn = Array.from(main.querySelectorAll('div[role="button"], button')).find((b) => {
      if (!isVisible(b)) return false;
      const lbl = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase();
      return lbl === 'tham gia nhóm' || lbl === 'join group';
    });
    if (joinBtn) {
      await sleep(1500);
      if (findFeedComposerTriggers().length === 0) {
        throw new VgRobotStatusError('skipped_not_member', 'Tài khoản chưa tham gia nhóm hoặc nhóm không cho phép người ngoài đăng bài.');
      }
    }
  }

  /**
   * Theo dõi tối đa 22s sau khi bấm "Đăng" để XÁC NHẬN THẬT bài đã được xuất bản hoặc tự retry nếu cú click đầu bị React nuốt
   */
  async function waitForPublishConfirmation(modal) {
    const startMs = Date.now();
    const maxConfirmMs = 22000;
    let lastClickAttemptMs = startMs;
    let retrySubmitCount = 0;

    const blockPhrases = [
      'bị chặn tạm thời',
      'temporarily blocked',
      'tạm thời bị hạn chế',
      'temporarily restricted',
      'vượt quá giới hạn',
      'không thể đăng bài lúc này',
      'action blocked',
      'tính năng này tạm thời'
    ];
    const errorPhrases = [
      'có lỗi xảy ra',
      'something went wrong',
      'không thể đăng',
      "couldn't post",
      'vui lòng thử lại'
    ];
    const publishedToastPhrases = [
      'bài viết của bạn đã được đăng',
      'your post has been published',
      'đã chia sẻ bài viết của bạn'
    ];
    const pendingPhrases = [
      'phê duyệt',
      'chờ duyệt',
      'approval',
      'submitted',
      'quản trị viên sẽ xem xét',
      'đã gửi bài viết'
    ];

    while (Date.now() - startMs < maxConfirmMs) {
      if (isCancelled) {
        return { ok: false, status: 'cancelled', reason: 'Người dùng đã hủy giữa chừng.' };
      }

      // A. Kiểm tra hộp thoại vẫn còn hay đã đóng hẳn
      const currentModal = findCreatePostModal();

      // B. Kiểm tra cảnh báo chặn spam của Facebook (nếu có -> dừng ngay hàng đợi bảo vệ nick!)
      const activeDialogsText = Array.from(document.querySelectorAll('div[role="dialog"]:not(#vg-fb-robot-hud), div[role="alert"]'))
        .map(el => (el.innerText || '').toLowerCase())
        .join('\n');

      const matchedBlock = blockPhrases.find(p => activeDialogsText.includes(p));
      if (matchedBlock) {
        return {
          ok: false,
          status: 'blocked_by_facebook',
          reason: `Facebook cảnh báo giới hạn đăng bài ("${matchedBlock}"). Đã tự dừng hàng đợi để bảo vệ nick.`
        };
      }

      const toastText = Array.from(document.querySelectorAll('[role="alert"], [role="status"], div[data-visualcompletion="ignore-dynamic"]'))
        .map(el => (el.innerText || '').toLowerCase())
        .join(' ');

      if (!currentModal || !document.contains(modal) || publishedToastPhrases.some(p => toastText.includes(p))) {
        await sleep(400);
        const postToastText = Array.from(document.querySelectorAll('[role="alert"], [role="status"], div[data-visualcompletion="ignore-dynamic"]'))
          .map(el => (el.innerText || '').toLowerCase())
          .join(' ');
        if (pendingPhrases.some(p => postToastText.includes(p))) {
          return {
            ok: true,
            status: 'pending_approval',
            reason: 'Đã gửi bài viết thành công (Group yêu cầu Admin phê duyệt).'
          };
        }
        return {
          ok: true,
          status: 'posted',
          reason: 'Đã xác nhận xuất bản thành công (hộp thoại đã đóng).'
        };
      }

      const modalText = (currentModal.innerText || '').toLowerCase();

      // C. Kiểm tra thông báo lỗi rõ ràng bên trong modal
      const matchedErr = errorPhrases.find(p => modalText.includes(p));
      if (matchedErr) {
        return {
          ok: false,
          status: 'failed_submit',
          reason: `Facebook báo lỗi khi đăng ("${matchedErr}").`
        };
      }

      // D. Nhận diện nhanh nếu Group bật hộp thoại phụ yêu cầu chọn danh mục / bấm "Tiếp"
      const modalButtons = Array.from(currentModal.querySelectorAll('div[role="button"]'));
      const hasPostButton = modalButtons.some(b => {
        const l = (b.getAttribute('aria-label') || b.innerText || '').trim().toLowerCase();
        return l === 'đăng' || l === 'post';
      });
      const hasNextButton = modalButtons.some(b => {
        const l = (b.getAttribute('aria-label') || b.innerText || '').trim().toLowerCase();
        return (l === 'tiếp' || l === 'next') && isVisible(b);
      });
      if (!hasPostButton && hasNextButton) {
        return {
          ok: false,
          status: 'failed_group_requires_input',
          reason: 'Group bật bước trung gian ("Tiếp") yêu cầu chọn danh mục hoặc điền form bán hàng.'
        };
      }

      // E. Tự kiểm tra: Nếu không ở trạng thái "Đang đăng" / loading mà nút Đăng vẫn còn sáng sau 2.6s -> click lại tối đa 2 lần phòng trường hợp React vừa re-render làm trượt click đầu
      const isSubmitting = Boolean(
        currentModal.querySelector('div[role="progressbar"], [aria-valuemin], .sp_progress, div[data-visualcompletion="loading-state"]')
      ) || modalText.includes('đang đăng') || modalText.includes('posting');

      if (!isSubmitting && retrySubmitCount < 2 && (Date.now() - lastClickAttemptMs >= 2600)) {
        const freshPostBtn = modalButtons.find(b => {
          const label = (b.getAttribute('aria-label') || b.innerText || '').trim().toLowerCase();
          return (label === 'đăng' || label === 'post') &&
                 isVisible(b) &&
                 b.getAttribute('aria-disabled') !== 'true' &&
                 !b.classList.contains('disabled');
        });
        if (freshPostBtn) {
          retrySubmitCount += 1;
          lastClickAttemptMs = Date.now();
          console.log(`[VG FB Robot] Nút Đăng vẫn mở sau 2.6s -> thử bấm lại lần ${retrySubmitCount}...`);
          try { freshPostBtn.focus(); } catch (e) {}
          simulateSingleClick(freshPostBtn);
        }
      }

      await sleep(250);
    }

    return {
      ok: false,
      status: 'failed_modal_stuck',
      reason: 'Đã bấm Đăng nhưng hộp thoại không tự đóng sau 22 giây (có thể Group yêu cầu chọn thêm danh mục hoặc mạng bị treo).'
    };
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

    // 6. Must have "Tạo bài viết" / "Create post" title OR editor aria contains "nghĩ gì" / "what's on your mind" / "dòng thời gian" / Group prompt
    const headings = Array.from(d.querySelectorAll('h1, h2, h3, div[role="heading"], span'));
    const hasCreatePostHeading = headings.some(h => {
      const text = (h.innerText || '').trim().toLowerCase();
      return (
        text === 'tạo bài viết' ||
        text === 'create post' ||
        text === 'tạo bài viết công khai' ||
        text === 'create a public post'
      );
    });
    const hasMindLabel =
      editorAria.includes('nghĩ gì') ||
      editorAria.includes("what's on your mind") ||
      editorAria.includes('dòng thời gian') ||
      editorAria.includes('timeline') ||
      editorAria.includes('write something') ||
      editorAria.includes('viết gì') ||
      editorAria.includes('bài viết công khai') ||
      editorAria.includes('public post');

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
   * Find the EXACT "Bạn đang nghĩ gì?" / Group "Bạn viết gì đi..." composer pill
   * NOTE: Strictly DO NOT click "Ảnh/video" here because Chrome blocks untrusted file chooser dialogs
   */
  function findFeedComposerTriggers() {
    const list = [];

    // 1. Target leaf span/div containing Feed, Profile, or Facebook Group composer labels
    const allTextNodes = Array.from(document.querySelectorAll('span, div'));
    for (const node of allTextNodes) {
      if (node.children.length > 0) continue; // leaf node only
      if (node.closest('div[role="dialog"]') || node.closest('#vg-fb-robot-hud')) continue;

      const text = (node.innerText || '').trim().toLowerCase();
      if (
        (text.includes('nghĩ gì') ||
         text.includes("what's on your mind") ||
         text.includes('bạn viết gì') ||
         text.includes('viết gì đi') ||
         text.includes('viết gì đó') ||
         text.includes('hãy viết gì') ||
         text.includes('bắt đầu thảo luận') ||
         text.includes('start a discussion') ||
         text.includes('tạo bài viết') ||
         text.includes('create post') ||
         text.includes('create a public post') ||
         text.includes('bài viết công khai') ||
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
      'div[aria-label*="nghĩ gì" i][role="button"], div[aria-label*="what\'s on your mind" i][role="button"], div[aria-label*="viết gì" i][role="button"], div[aria-label*="write something" i][role="button"], div[aria-label*="dòng thời gian" i][role="button"], div[data-pagelet*="Composer"] div[role="button"][tabindex="0"], div[data-pagelet="ProfileComposer"] div[role="button"][tabindex="0"], div[data-pagelet="GroupInlineComposer"] div[role="button"][tabindex="0"], div[data-pagelet="FeedUnit_0"] div[role="button"][tabindex="0"]'
    ));
    for (const el of directQuery) {
      const text = (el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
      if (text.includes('ảnh/video') || text.includes('photo/video')) continue;
      if (!el.closest('div[role="dialog"]') && !el.closest('#vg-fb-robot-hud') && isVisible(el)) {
        list.push(el);
      }
    }

    // 3. Fallback: Nếu thanh đăng bài đang giữ chữ nháp cũ từ phiên trước
    const residualPill = findResidualDraftPill('');
    if (residualPill) {
      list.push(residualPill);
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
   * Prefetch & convert all media URLs to File objects IN PARALLEL
   */
  async function prefetchMediaFiles(urls, machineCode) {
    if (!Array.isArray(urls) || urls.length === 0) return [];
    const results = await Promise.all(
      urls.map((url, idx) =>
        urlToFile(url, `laptop_vuonggia_${machineCode}_${idx + 1}.jpg`).catch(() => null)
      )
    );
    return results.filter(Boolean);
  }

  /**
   * MAIN AUTOMATION WORKFLOW (v1.3.0 High-Speed)
   */
  async function executePersonalPost(payload) {
    if (isExecuting) {
      console.warn('[VG FB Robot] Đang có tiến trình đăng bài chạy song song, bỏ qua lệnh trùng lặp.');
      return;
    }
    isExecuting = true;
    const {
      content,
      mediaUrls = [],
      machineCode = '',
      postId = null,
      autoTriggered = false,
      isGroupPost = false,
      groupUrl = null
    } = payload;
    const finalContent = ensureFanpageLink(content);
    isCancelled = false;

    const modeLabel = isGroupPost ? `HỘI NHÓM (${groupUrl || 'Group'})` : 'TRANG CÁ NHÂN';
    console.log(`[VG FB Robot v1.6.0] Bắt đầu quy trình cho ${modeLabel}:`, machineCode || postId || 'MÁY');
    createHud(isGroupPost ? `GROUP • ${machineCode}` : machineCode);

    // Tải trước toàn bộ ảnh HD SONG SONG ngay khi vừa mở hộp thoại (tiết kiệm 3-6s)
    const mediaFilesPromise = prefetchMediaFiles(mediaUrls, machineCode);

    try {
      // BƯỚC 1: Chuẩn bị & Mở ô tạo bài viết
      setStepStatus(1, 'active', isGroupPost ? 'Đang kiểm tra & mở khung bài Group...' : 'Đang tìm và mở ô tạo bài viết...');
      if (window.scrollY > 50) {
        try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) {}
      }

      if (isGroupPost) {
        await prepareGroupComposerEnvironment();
      }

      let modal = findCreatePostModal();
      const openStartTime = Date.now();
      const openTimeout = isGroupPost ? 9000 : 12000;

      // Lắng nghe click thủ công từ người dùng để bắt ngay lập tức nếu người dùng bấm bằng tay
      const manualClickListener = () => {
        setTimeout(() => {
          const m = findCreatePostModal();
          if (m) modal = m;
        }, 120);
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
        for (const target of triggers) {
          simulateRealisticClick(target);
          if (target.firstElementChild) {
            simulateRealisticClick(target.firstElementChild);
          }
          // Đợi bằng MutationObserver ngắn (tối đa 450ms) để bắt dialog ngay tích tắc vừa render
          modal = await waitForCreatePostModal(450);
          if (modal) break;
        }

        if (modal) break;

        if (Date.now() - openStartTime > 1200 && !modal) {
          setStepStatus(1, 'active', '👉 Vui lòng click vào ô "Bạn đang nghĩ gì thế?" (viền vàng)...');
          triggers.forEach(c => {
            if (c.style && !c.dataset.vgStyled) {
              c.dataset.vgStyled = 'true';
              c.style.outline = '4px solid #EAB308';
              c.style.boxShadow = '0 0 16px rgba(234, 179, 8, 0.8)';
              c.style.transition = 'all 0.2s ease';
              c.style.cursor = 'pointer';
            }
          });
        }

        await sleep(180);
      }

      if (!modal) {
        modal = await waitForCreatePostModal(3500);
      }

      document.removeEventListener('click', manualClickListener, true);

      document.querySelectorAll('[data-vg-styled]').forEach(el => {
        el.style.outline = '';
        el.style.boxShadow = '';
        delete el.dataset.vgStyled;
      });

      if (!modal) {
        // Kiểm tra nhanh xem có mở nhầm hộp thoại Mua bán có nút "Tiếp"/"Next" không
        const nextOnlyDialog = Array.from(document.querySelectorAll('div[role="dialog"]:not(#vg-fb-robot-hud)')).find(d => {
          const btns = Array.from(d.querySelectorAll('div[role="button"]'));
          return btns.some(b => {
            const l = (b.innerText || b.getAttribute('aria-label') || '').trim().toLowerCase();
            return l === 'tiếp' || l === 'next';
          });
        });
        if (nextOnlyDialog && isGroupPost) {
          throw new VgRobotStatusError('failed_buy_sell_form', 'Group Mua Bán dùng form niêm yết (Tiếp -> Đăng) và không hỗ trợ đăng thảo luận.');
        }
        throw new VgRobotStatusError('failed_no_composer', 'Không tìm thấy khung tạo bài viết trong nhóm/trang này.');
      }

      setStepStatus(1, 'success', 'Đã mở khung soạn bài!');

      // BƯỚC 2: Tìm ngay Editor bằng MutationObserver (không sleep cố định)
      setStepStatus(2, 'active', 'Đang nhập nội dung bài viết...');
      let editor = await waitForElement(
        'div[role="textbox"][contenteditable="true"], div[data-lexical-editor="true"], div[contenteditable="true"], div[aria-label*="nghĩ gì" i], div[aria-label*="what\'s on your mind" i]',
        modal,
        5000
      );

      if (!editor) {
        editor = modal.querySelector('div[role="textbox"][contenteditable="true"]') ||
                 modal.querySelector('[contenteditable="true"]') ||
                 document.querySelector('div[role="dialog"] div[data-lexical-editor="true"]');
      }

      if (!editor) {
        throw new Error('Không tìm thấy khung soạn thảo văn bản trong hộp thoại.');
      }

      editor.focus();
      await sleep(80);

      // Xóa sạch text nháp cũ nếu Facebook tự khôi phục từ phiên trước
      if ((editor.innerText || '').trim().length > 0) {
        await clearEditorContents(editor);
      }

      // Điền nội dung văn bản chuẩn Lexical (chỉ chèn 1 lần duy nhất, giữ nguyên xuống dòng & kèm link Fanpage)
      const textToInsert = finalContent;
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
          await sleep(120);
        } catch (e) {
          console.warn('[VG FB Robot] ClipboardEvent paste fallback:', e);
        }
      }

      // Ưu tiên 2 (Fallback duy nhất): Nếu editor vẫn trống thì mới dùng execCommand insertText
      if (!hasInsertedText() && textToInsert) {
        try {
          placeCaretAtEnd();
          document.execCommand('insertText', false, textToInsert);
          await sleep(100);
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

      // BƯỚC 3: Đính kèm hình ảnh (đã được prefetch song song từ đầu)
      setStepStatus(3, 'active', `Đang gắn ${mediaUrls.length} ảnh HD...`);
      if (mediaUrls.length > 0) {
        let fileInput = modal.querySelector('input[type="file"][accept*="image"]') || document.querySelector('input[type="file"][accept*="image"]');

        if (!fileInput) {
          const photoBtn = Array.from(modal.querySelectorAll('div[role="button"], div[aria-label*="Ảnh/video"], div[aria-label*="Photo/video"], img[src*="photo"]')).find(b => {
            const label = (b.getAttribute('aria-label') || b.innerText || '').toLowerCase();
            return label.includes('ảnh') || label.includes('photo');
          });
          if (photoBtn) {
            simulateRealisticClick(photoBtn);
          }
          fileInput = await waitForElement('input[type="file"][accept*="image"]', modal, 4000) || document.querySelector('input[type="file"][accept*="image"]');
        }

        if (fileInput) {
          const fileObjects = await mediaFilesPromise;
          if (fileObjects.length > 0) {
            const dataTransfer = new DataTransfer();
            fileObjects.forEach(f => dataTransfer.items.add(f));
            fileInput.files = dataTransfer.files;
            fileInput.dispatchEvent(new Event('change', { bubbles: true }));
            fileInput.dispatchEvent(new Event('input', { bubbles: true }));
            setStepStatus(3, 'success', `Đã gắn siêu tốc ${fileObjects.length} ảnh HD!`);
          } else {
            setStepStatus(3, 'success', 'Bỏ qua đính kèm ảnh (ảnh rỗng).');
          }
        } else {
          setStepStatus(3, 'active', 'Không tìm thấy nút nạp ảnh, tiếp tục văn bản.');
        }
      } else {
        setStepStatus(3, 'success', 'Bài đăng không có ảnh.');
      }

      await sleep(250); // Nhường 1 nhịp micro-render cho Facebook bắt đầu upload ảnh

      // BƯỚC 4: Đếm ngược nhanh 1s và Tự động Bấm "ĐĂNG"
      setStepStatus(4, 'active', 'Chuẩn bị xuất bản...');
      const countdownBox = document.getElementById('vg-hud-countdown-area');
      if (countdownBox) countdownBox.style.display = 'block';

      let remaining = 1;
      let hasSubmitted = false;
      const countdownLabel = document.getElementById('vg-countdown-label');
      if (countdownLabel) {
        countdownLabel.innerText = `Tự động bấm 'Đăng' sau ${remaining}s...`;
      }

      async function triggerSubmit() {
        if (isCancelled || hasSubmitted) return;
        hasSubmitted = true;
        setStepStatus(4, 'active', '⚡ Đang chờ ảnh tải xong & chuẩn bị bấm ĐĂNG...');

        let uploadWaitTime = 0;
        const maxUploadWait = 30000;
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
          await sleep(150);
          uploadWaitTime += 150;
        }

        setStepStatus(4, 'active', '⚡ Đang bấm nút ĐĂNG...');

        const postBtn = Array.from(modal.querySelectorAll('div[role="button"]')).find(b => {
          const label = (b.getAttribute('aria-label') || b.innerText || '').trim().toLowerCase();
          return (label === 'đăng' || label === 'post') &&
                 b.getAttribute('aria-disabled') !== 'true' &&
                 !b.classList.contains('disabled');
        });

        if (postBtn) {
          try { postBtn.focus(); } catch (e) {}
          simulateSingleClick(postBtn);
          setStepStatus(4, 'active', 'Đang xác nhận Facebook hoàn tất xuất bản...');
          const confirmRes = await waitForPublishConfirmation(modal);

          if (confirmRes.ok) {
            await clearResidualDraftAfterPublish(finalContent);
            const doneMsg = confirmRes.status === 'pending_approval'
              ? '✅ ĐÃ GỬI BÀI CHỜ ADMIN NHÓM DUYỆT!'
              : (isGroupPost ? '✅ ĐÃ XÁC NHẬN ĐĂNG LÊN HỘI NHÓM!' : '✅ ĐÃ XUẤT BẢN THÀNH CÔNG LÊN TRANG CÁ NHÂN!');
            setStepStatus(4, 'success', doneMsg);
            if (countdownBox) {
              countdownBox.innerHTML = `<span style="color:#059669; font-weight:900; font-size:14px;">🎉 ${confirmRes.status === 'pending_approval' ? 'ĐÃ GỬI CHỜ DUYỆT!' : 'ĐÃ XÁC NHẬN ĐĂNG XONG!'}</span>`;
            }
            chrome.runtime.sendMessage({
              action: isGroupPost ? 'groupShareCompleted' : 'personalPostCompleted',
              postId,
              machineCode,
              content: finalContent,
              mediaUrls,
              groupUrl,
              isGroupPost,
              autoTriggered,
              success: true,
              status: confirmRes.status,
              reason: confirmRes.reason
            }, () => { void chrome.runtime.lastError; });
            await sleep(900);
            if (hudEl) hudEl.remove();
          } else {
            setStepStatus(4, 'active', `❌ ${confirmRes.reason}`);
            chrome.runtime.sendMessage({
              action: isGroupPost ? 'groupShareCompleted' : 'personalPostCompleted',
              postId,
              machineCode,
              content: finalContent,
              mediaUrls,
              groupUrl,
              isGroupPost,
              autoTriggered,
              success: false,
              status: confirmRes.status,
              reason: confirmRes.reason,
              error: confirmRes.reason
            }, () => { void chrome.runtime.lastError; });
            await sleep(1000);
            if (hudEl) hudEl.remove();
          }
        } else {
          const noBtnReason = 'Nút Đăng vẫn bị vô hiệu hóa hoặc không tìm thấy sau khi tải ảnh.';
          setStepStatus(4, 'active', `⚠️ ${noBtnReason}`);
          chrome.runtime.sendMessage({
            action: isGroupPost ? 'groupShareCompleted' : 'personalPostCompleted',
            postId,
            machineCode,
            content: finalContent,
            mediaUrls,
            groupUrl,
            isGroupPost,
            autoTriggered,
            success: false,
            status: 'failed_upload',
            reason: noBtnReason,
            error: noBtnReason
          }, () => { void chrome.runtime.lastError; });
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
      console.warn('[VG FB Robot Cảnh báo]', err);
      setStepStatus(1, 'active', `❌ Lỗi: ${err.message}`);
      chrome.runtime.sendMessage({
        action: isGroupPost ? 'groupShareCompleted' : 'personalPostCompleted',
        postId,
        machineCode,
        content: finalContent,
        mediaUrls,
        groupUrl,
        isGroupPost,
        autoTriggered,
        success: false,
        status: err.status || 'failed_error',
        reason: err.message,
        error: err.message
      }, () => { void chrome.runtime.lastError; });
    } finally {
      isExecuting = false;
    }
  }

  /**
   * Quét danh sách các Group Facebook đã tham gia (trên trang /groups/joins/)
   */
  async function extractJoinedGroupsFromPage(filterLaptopKeywords = true) {
    // Đợi React render danh sách nhóm ngay cả khi tab mở ngầm (active: false)
    const mainRoot = await waitForElement('[role="main"] a[href*="/groups/"]', document, 5500);
    const scope = (mainRoot && document.querySelector('[role="main"]')) || document;
    await sleep(400);

    const anchors = Array.from(scope.querySelectorAll('a[href*="/groups/"]'));
    const seen = new Set();
    const allGroups = [];
    const matchedGroups = [];
    const keywords = ['laptop', 'máy tính', 'may tinh', 'công nghệ', 'cong nghe', 'chợ', 'cho ', 'mua bán', 'mua ban', 'thinkpad', 'dell', 'hp', 'sinh viên', 'văn phòng', 'giá rẻ', 'đồ cũ', 'macbook', 'it '];

    for (const a of anchors) {
      const href = a.getAttribute('href') || '';
      const m = href.match(/\/groups\/([^/?#]+)/i);
      if (!m) continue;
      const slug = m[1];
      if (['feed', 'discover', 'joins', 'notifications', 'create', 'categories', 'search', 'your_groups'].includes(slug.toLowerCase())) continue;

      const cleanUrl = `https://www.facebook.com/groups/${slug}/`;
      if (seen.has(cleanUrl)) continue;
      const rawName = (a.innerText || a.getAttribute('aria-label') || '').split('\n')[0].trim();
      const nameLower = rawName.toLowerCase();
      if (!rawName || rawName.length < 3 || nameLower === 'xem nhóm' || nameLower === 'view group' || nameLower.startsWith('nhóm của bạn')) continue;

      seen.add(cleanUrl);
      const item = { name: rawName, url: cleanUrl };
      allGroups.push(item);

      if (!filterLaptopKeywords || keywords.some(kw => nameLower.includes(kw))) {
        matchedGroups.push(item);
      }
    }

    return matchedGroups.length > 0 ? matchedGroups : allGroups;
  }

  // Lắng nghe lệnh từ Service Worker hoặc kiểm tra Storage
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'executePersonalPost' && request.payload) {
      executePersonalPost(request.payload);
      sendResponse({ status: 'started' });
    }
    if (request.action === 'scanJoinedLaptopGroups') {
      extractJoinedGroupsFromPage(true)
        .then((groups) => sendResponse({ success: true, groups }))
        .catch((e) => sendResponse({ success: false, error: e.message, groups: [] }));
      return true;
    }
  });

  // Tự động kiểm tra Storage nếu tab vừa được mở mới (giảm delay từ 1200ms -> 250ms)
  chrome.storage.local.get(['vg_pending_personal_post'], (res) => {
    if (res.vg_pending_personal_post) {
      const payload = res.vg_pending_personal_post;
      chrome.storage.local.remove(['vg_pending_personal_post'], () => {
        setTimeout(() => executePersonalPost(payload), 250);
      });
    }
  });

})();
