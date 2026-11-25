/**
 * LAPTOP VƯƠNG GIA // EXTENSION MINI-APP CONTROLLER (popup.js)
 * Điều khiển soạn bài, nạp ảnh, đăng kép Fanpage + Facebook cá nhân & mở Web App /app
 */

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  const rawTextInput = document.getElementById('rawTextInput');
  const mediaFileInput = document.getElementById('mediaFileInput');
  const mediaPreview = document.getElementById('mediaPreview');

  const btnDualPost = document.getElementById('btnDualPost');
  const btnSchedulePost = document.getElementById('btnSchedulePost');

  const statusMsg = document.getElementById('statusMsg');
  const openFullAppBtn = document.getElementById('openFullAppBtn');

  const backendUrlInput = document.getElementById('backendUrlInput');
  const connectionStatus = document.getElementById('connectionStatus');
  const saveBtn = document.getElementById('saveBtn');

  const autoPersonalToggle = document.getElementById('autoPersonalToggle');
  const autoFanpageSyncToggle = document.getElementById('autoFanpageSyncToggle');
  const autoPersonalStatus = document.getElementById('autoPersonalStatus');
  const checkDueNowBtn = document.getElementById('checkDueNowBtn');

  // Local state
  let selectedMediaBase64 = [];
  let currentBackendUrl = 'https://auto-post-fanpage-coral.vercel.app';

  function refreshAutoPersonalStatus() {
    if (!autoPersonalStatus) return;
    chrome.runtime.sendMessage({ action: 'getAutoPersonalStatus' }, (st) => {
      if (!st) return;
      const lastCheck = st.vg_last_alarm_check
        ? new Date(st.vg_last_alarm_check).toLocaleTimeString('vi-VN')
        : 'Chưa quét';
      const dueCount = typeof st.vg_last_due_count === 'number' ? st.vg_last_due_count : 0;
      autoPersonalStatus.innerText = `Lần quét gần nhất: ${lastCheck} • Chờ đăng: ${dueCount} bài`;
    });
  }

  // 1. Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');
    });
  });

  // 2. Load and Sync Backend URL + Auto-Personal Settings
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['backendUrl', 'autoPersonalEnabled', 'autoPersonalIncludeFanpage'], (result) => {
      if (result.backendUrl) {
        currentBackendUrl = result.backendUrl.trim().replace(/\/$/, '');
        backendUrlInput.value = currentBackendUrl;
      }
      if (autoPersonalToggle) autoPersonalToggle.checked = result.autoPersonalEnabled !== false;
      if (autoFanpageSyncToggle) autoFanpageSyncToggle.checked = result.autoPersonalIncludeFanpage !== false;
      checkServerHealth(currentBackendUrl);
      refreshAutoPersonalStatus();
    });
  } else {
    checkServerHealth(currentBackendUrl);
  }

  const saveAutoFlags = () => {
    if (!chrome.storage || !chrome.storage.sync) return;
    chrome.storage.sync.set({
      autoPersonalEnabled: autoPersonalToggle ? autoPersonalToggle.checked : true,
      autoPersonalIncludeFanpage: autoFanpageSyncToggle ? autoFanpageSyncToggle.checked : true
    });
  };
  if (autoPersonalToggle) autoPersonalToggle.addEventListener('change', saveAutoFlags);
  if (autoFanpageSyncToggle) autoFanpageSyncToggle.addEventListener('change', saveAutoFlags);

  if (checkDueNowBtn) {
    checkDueNowBtn.addEventListener('click', () => {
      checkDueNowBtn.disabled = true;
      checkDueNowBtn.innerText = '⏳ Đang kiểm tra lịch...';
      chrome.runtime.sendMessage({ action: 'runAutoPersonalCheckNow' }, (resp) => {
        checkDueNowBtn.disabled = false;
        checkDueNowBtn.innerText = '⚡ Quét & Đăng Ngay Bài Đến Giờ';
        refreshAutoPersonalStatus();
        if (resp && resp.dispatched && autoPersonalStatus) {
          autoPersonalStatus.innerText = `🚀 Đang tự mở Facebook để đăng bài ${resp.postId}!`;
        } else if (resp && resp.dueCount === 0 && autoPersonalStatus) {
          autoPersonalStatus.innerText = '✅ Hiện không có bài Cá Nhân nào đang chờ đến giờ.';
        } else if (resp && resp.error && autoPersonalStatus) {
          autoPersonalStatus.innerText = `❌ Lỗi kiểm tra: ${resp.error}`;
        }
      });
    });
  }

  // 3. Save Settings
  saveBtn.addEventListener('click', () => {
    const val = backendUrlInput.value.trim().replace(/\/$/, '');
    if (!val) return;
    currentBackendUrl = val;

    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ backendUrl: val }, () => {
        saveBtn.innerText = '✅ ĐÃ LƯU!';
        setTimeout(() => saveBtn.innerText = '💾 Lưu Cấu Hình', 1500);
        checkServerHealth(val);
      });
    } else {
      checkServerHealth(val);
    }
  });

  async function checkServerHealth(url) {
    connectionStatus.style.color = '#B45309';
    connectionStatus.innerHTML = '● Đang kết nối máy chủ...';
    try {
      const res = await fetch(`${url}/api/settings`, { method: 'GET' });
      if (res.ok) {
        connectionStatus.style.color = '#15803D';
        connectionStatus.innerHTML = '● Máy chủ sẵn sàng! Fanpage đã liên kết.';
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      connectionStatus.style.color = '#B91C1C';
      connectionStatus.innerHTML = '● Không thể kết nối máy chủ (hãy kiểm tra URL hoặc server)';
    }
  }

  // 4. File input preview handling
  mediaFileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (!files || files.length === 0) return;

    mediaPreview.innerHTML = '';
    selectedMediaBase64 = [];

    for (const file of files) {
      const base64 = await readFileAsBase64(file);
      if (base64) {
        selectedMediaBase64.push(base64);
        const img = document.createElement('img');
        img.src = base64;
        img.className = 'media-thumb';
        mediaPreview.appendChild(img);
      }
    }
  });

  function readFileAsBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function setStatus(text, type = 'loading') {
    statusMsg.className = `status-msg ${type}`;
    statusMsg.innerHTML = text;
  }

  function setButtonsDisabled(disabled) {
    [btnDualPost, btnSchedulePost].forEach(b => {
      if (b) b.disabled = disabled;
    });
  }

  // 5. Action Dispatcher
  async function handlePostAction(target) {
    const text = rawTextInput.value.trim();
    if (!text && selectedMediaBase64.length === 0) {
      setStatus('⚠️ Vui lòng nhập nội dung cấu hình hoặc đính kèm ảnh!', 'error');
      return;
    }

    setButtonsDisabled(true);

    if (target === 'both') {
      setStatus('🌀 Đang tạo bài & đăng Fanpage + chuẩn bị cho Facebook cá nhân...', 'loading');
    } else if (target === 'personal') {
      setStatus('🌀 Đang định dạng bài viết chuyên nghiệp cho Facebook cá nhân...', 'loading');
    } else if (target === 'schedule') {
      setStatus('⏳ Đang phân tích và xếp hàng chờ giờ vàng...', 'loading');
    } else {
      setStatus('⚡ Đang xử lý AI và xuất bản lên Fanpage...', 'loading');
    }

    const payload = {
      rawText: text,
      mediaUrls: selectedMediaBase64,
      target: target,
      publishImmediately: (target === 'fanpage' || target === 'both'),
      sourceUrl: 'popup_miniapp'
    };

    chrome.runtime.sendMessage({
      action: 'pushPost',
      serverUrl: currentBackendUrl,
      payload: payload
    }, (response) => {
      setButtonsDisabled(false);

      if (!response || !response.success) {
        const errMsg = (response && response.error) || (response && response.data && response.data.error) || 'Lỗi không xác định khi kết nối';
        setStatus(`❌ Thất bại: ${errMsg}`, 'error');
        return;
      }

      const resData = response.data || {};
      const post = resData.post || {};

      if (target === 'both') {
        const pageLink = resData.fbPostUrl || post.fbPostUrl || resData.facebookPostUrl;
        setStatus(`✅ Fanpage thành công! Đang chuyển hướng sang Facebook cá nhân...`, 'success');

        // Kích hoạt Robot cá nhân
        chrome.runtime.sendMessage({
          action: 'triggerPersonalRobot',
          payload: {
            content: post.content || text,
            mediaUrls: post.mediaUrls || selectedMediaBase64,
            pagePostUrl: pageLink
          }
        });

      } else if (target === 'personal') {
        setStatus(`✅ Đã sẵn sàng! Đang mở Facebook cá nhân để robot tự động đăng...`, 'success');

        chrome.runtime.sendMessage({
          action: 'triggerPersonalRobot',
          payload: {
            content: post.content || text,
            mediaUrls: post.mediaUrls || selectedMediaBase64
          }
        });

      } else if (target === 'schedule') {
        setStatus(`⏳ Đã đưa vào Hàng Đợi thành công! Giờ đăng: ${post.scheduledTime || 'Giờ vàng'}`, 'success');
        rawTextInput.value = '';
        mediaFileInput.value = '';
        mediaPreview.innerHTML = '';
        selectedMediaBase64 = [];

      } else {
        const pageLink = resData.fbPostUrl || post.fbPostUrl || resData.facebookPostUrl;
        let linkHtml = pageLink ? `<br><a href="${pageLink}" target="_blank" style="color: #166534; font-weight: 800; text-decoration: underline;">👉 Xem bài viết trên Fanpage</a>` : '';
        setStatus(`⚡ Đã đăng lên Fanpage thành công!${linkHtml}`, 'success');
        rawTextInput.value = '';
        mediaFileInput.value = '';
        mediaPreview.innerHTML = '';
        selectedMediaBase64 = [];
      }
    });
  }

  // 6. Button Listeners (2 Nút Đăng Kép)
  if (btnDualPost) btnDualPost.addEventListener('click', () => handlePostAction('both'));
  if (btnSchedulePost) btnSchedulePost.addEventListener('click', () => handlePostAction('schedule'));

  // 7. Open Full Web App Dashboard (/app)
  openFullAppBtn.addEventListener('click', () => {
    const targetUrl = `${currentBackendUrl}/app`;
    chrome.tabs.create({ url: targetUrl });
  });
});
