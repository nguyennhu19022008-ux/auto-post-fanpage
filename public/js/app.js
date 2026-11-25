// Global App State
let appSettings = {};
let currentMediaFiles = [];
let allPosts = [];
let parsedTableItems = [];
let isDashboardInitialized = false;

let isSampleDataLoaded = false;

// DATA POST & Circular Engine Global State
let modelTemplatesList = [];
let dataPostFilters = { brand: 'all', price_range: 'all', status: 'all', search: '', sort: 'newest' };
let activeMediaTemplateId = null;
let currentSmartMatchTemplate = null;
let dataPostSearchDebounceTimer = null;
let smartMatchDebounceTimer = null;

// Auto-initialize Dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initDashboard();
}

// ======================== PAGE 0 / SLIDE 0: DESIGN BY VUONGGIA ========================
let isSlide0Active = true;

function closeSlide0Modal() {
  const modal = document.getElementById('slide0Modal');
  if (modal) {
    modal.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => { modal.style.display = 'none'; }, 300);
    isSlide0Active = false;
    document.body.classList.remove('overflow-hidden');
    const dock = document.getElementById('mobileAppDock');
    if (dock) dock.classList.remove('hidden');
    sessionStorage.setItem('vg_slide0_seen', 'true');
  }
}

function openSlide0Modal() {
  const modal = document.getElementById('slide0Modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.remove('opacity-0', 'pointer-events-none');
    isSlide0Active = true;
    document.body.classList.add('overflow-hidden');
    const dock = document.getElementById('mobileAppDock');
    if (dock) dock.classList.add('hidden');
    toggleSlide0Card(true);
  }
}

function toggleSlide0Card(show) {
  const card = document.getElementById('slide0Card');
  const bar = document.getElementById('slide0FloatingBar');
  if (card) card.style.display = show ? 'block' : 'none';
  if (bar) {
    if (show) {
      bar.classList.add('hidden');
    } else {
      bar.classList.remove('hidden');
    }
  }
}

function copySlide0Contact(val, btn) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(val);
  }
  const orig = btn.innerText;
  btn.innerText = 'ĐÃ CHÉP';
  btn.classList.add('bg-white', 'text-black');
  setTimeout(() => {
    btn.innerText = orig;
  }, 2000);
}

// Keyboard navigation for Page 0
window.addEventListener('keydown', (e) => {
  if (isSlide0Active && (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    closeSlide0Modal();
  }
});

// Auto-check session on initial boot
document.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('vg_slide0_seen') === 'true') {
    const modal = document.getElementById('slide0Modal');
    if (modal) {
      modal.style.display = 'none';
      isSlide0Active = false;
    }
  } else {
    document.body.classList.add('overflow-hidden');
    const dock = document.getElementById('mobileAppDock');
    if (dock) dock.classList.add('hidden');
  }
});

// ======================== TAB NAVIGATION (STREAMLINED 4 TABS) ========================

const ALL_TABS = ['cockpit', 'queue', 'datapost', 'settings'];

function switchTab(tabName) {
  // Graceful aliases for legacy or shortcut calls
  if (tabName === 'studio') {
    openManualPostModal();
    return;
  }
  if (tabName === 'table') {
    tabName = 'cockpit';
  }
  if (tabName === 'history') {
    tabName = 'settings';
    switchSettingsSubTab('history');
  }

  ALL_TABS.forEach(t => {
    const section = document.getElementById(`section-${t}`);
    const btn = document.getElementById(`tabBtn-${t}`);
    if (section && btn) {
      if (t === tabName) {
        section.classList.remove('hidden');
        btn.classList.add('nav-tab-active');
      } else {
        section.classList.add('hidden');
        btn.classList.remove('nav-tab-active');
      }
    }
  });

  // Sync mobile bottom dock
  ALL_TABS.forEach(t => {
    const mobileBtn = document.getElementById(`mobileDockBtn-${t}`);
    if (mobileBtn) {
      if (t === tabName) {
        mobileBtn.classList.add('active');
      } else {
        mobileBtn.classList.remove('active');
      }
    }
  });

  if (tabName === 'cockpit') {
    loadCockpitStatus();
  } else if (tabName === 'datapost') {
    fetchModelTemplates();
  } else if (tabName === 'queue') {
    loadPosts();
  } else if (tabName === 'settings') {
    loadPosts();
  }
}

// Sub-Tab switcher inside Tab 4 (Tự động & Cài đặt)
function switchSettingsSubTab(sub) {
  const autoView = document.getElementById('settingsAutomationView');
  const historyView = document.getElementById('settingsHistoryView');
  const configView = document.getElementById('settingsConfigView');
  const btnAuto = document.getElementById('settingsSubTabBtn-automation');
  const btnHistory = document.getElementById('settingsSubTabBtn-history');
  const btnConfig = document.getElementById('settingsSubTabBtn-config');

  const views = { automation: autoView, history: historyView, config: configView };
  const btns = { automation: btnAuto, history: btnHistory, config: btnConfig };
  const activeKey = views[sub] ? sub : 'automation';

  Object.keys(views).forEach(k => {
    if (views[k]) {
      if (k === activeKey) views[k].classList.remove('hidden');
      else views[k].classList.add('hidden');
    }
    if (btns[k]) {
      if (k === activeKey) btns[k].classList.add('active');
      else btns[k].classList.remove('active');
    }
  });

  if (activeKey === 'history') {
    loadPosts();
  }
}

// Modal helper: Manual single post
function openManualPostModal() {
  const modal = document.getElementById('manualPostModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }
}

function closeManualPostModal() {
  const modal = document.getElementById('manualPostModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

// Utility: Format schedule dates cleanly
function formatScheduleDate(dateInput) {
  if (!dateInput) return '---';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return String(dateInput);
  }
}

// Autonomous Cockpit: Load real-time status and timeline
async function loadCockpitStatus() {
  try {
    const res = await fetch('/api/cockpit/status');
    const data = await res.json();
    if (!data || !data.success) return;

    // 1. Update metric numbers
    const queueTotalEl = document.getElementById('cockpitQueueTotal');
    if (queueTotalEl) queueTotalEl.innerText = data.queueCount;

    const templateTotalEl = document.getElementById('cockpitTemplateTotal');
    if (templateTotalEl) templateTotalEl.innerText = data.templateCount;

    // 2. Next Post details
    const nextPost = data.nextPost;
    const nextPostTitleEl = document.getElementById('cockpitNextPostTitle');
    const nextPostPriceEl = document.getElementById('cockpitNextPostPrice');
    const nextSlotBadgeEl = document.getElementById('cockpitNextSlotBadge');
    const countdownEl = document.getElementById('cockpitCountdown');

    if (nextPost) {
      const scheduledTime = nextPost.scheduled_time || nextPost.scheduledTime;
      const formattedDate = formatScheduleDate(scheduledTime);
      if (nextSlotBadgeEl) nextSlotBadgeEl.innerText = formattedDate;
      const code = nextPost.product_code || nextPost.machineCode || nextPost.code || 'MÁY';
      const name = nextPost.product_name || nextPost.machineName || 'Laptop';
      if (nextPostTitleEl) nextPostTitleEl.innerText = `#${code}: ${name}`;
      if (nextPostPriceEl) nextPostPriceEl.innerText = nextPost.price || 'Giá ưu đãi';
      
      const diffMs = new Date(scheduledTime).getTime() - Date.now();
      if (diffMs > 0) {
        const diffMins = Math.round(diffMs / 60000);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        if (countdownEl) {
          countdownEl.innerText = hours > 0 ? `Còn ~${hours}h ${mins}m` : `Còn ~${mins} phút`;
        }
      } else {
        if (countdownEl) countdownEl.innerText = 'Đã đến giờ đăng';
      }

      const publishBtn = document.getElementById('cockpitPublishNowBtn');
      if (publishBtn) {
        publishBtn.onclick = () => publishPostNow(nextPost.id, 'both');
      }
      const publishBothBtn = document.getElementById('cockpitPublishBothBtn');
      if (publishBothBtn) {
        publishBothBtn.onclick = () => publishPostNow(nextPost.id, 'both');
      }
      const personalBtn = document.getElementById('cockpitPublishPersonalBtn');
      if (personalBtn) {
        personalBtn.onclick = () => publishPostNow(nextPost.id, 'both');
      }
      const viewBtn = document.getElementById('cockpitViewNextBtn');
      if (viewBtn) {
        viewBtn.onclick = () => openPostPreviewModal(nextPost.id);
      }
    } else {
      if (nextSlotBadgeEl) nextSlotBadgeEl.innerText = 'Trống';
      if (nextPostTitleEl) nextPostTitleEl.innerText = 'Chưa có bài nào trong hàng đợi';
      if (nextPostPriceEl) nextPostPriceEl.innerText = '---';
      if (countdownEl) countdownEl.innerText = 'Đã hết bài';
    }

    // 3. Coverage text
    const coverageEl = document.getElementById('cockpitCoverageText');
    if (coverageEl) {
      if (data.scheduledUntil) {
        const untilDate = formatScheduleDate(data.scheduledUntil);
        coverageEl.innerHTML = `Lịch bài phủ kín liên tục đến <strong>${escapeHtml(untilDate)}</strong>.`;
      } else {
        coverageEl.innerText = 'Hàng đợi đang cần thêm bài đăng mới.';
      }
    }

    // 4. Render Recent Timeline
    renderCockpitTimeline(data.recentUpcoming || []);
  } catch (err) {
    console.error('[Cockpit] Lỗi nạp trạng thái:', err);
  }
}

function renderCockpitTimeline(posts) {
  const container = document.getElementById('cockpitTimelineList');
  if (!container) return;

  if (posts.length === 0) {
    container.innerHTML = `<div class="py-8 text-center text-sm text-[#475569]">Chưa có bài đăng nào sắp diễn ra. Bấm “Tuần hoàn kho máy” để nạp bài.</div>`;
    return;
  }

  container.innerHTML = posts.map(post => {
    const scheduledTime = post.scheduled_time || post.scheduledTime;
    const formattedDate = formatScheduleDate(scheduledTime);
    const code = post.product_code || post.machineCode || post.code || 'MÁY';
    const name = post.product_name || post.machineName || 'Laptop';
    const pCount = (post.media_files || post.mediaFiles || []).length;
    const price = post.price || '';

    return `
      <div class="py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3 min-w-0">
          <span class="font-mono-num text-xs font-semibold text-[#1E40AF] bg-[#EFF6FF] border border-[#BFDBFE] px-2.5 py-1 rounded-md shrink-0">
            ${escapeHtml(formattedDate)}
          </span>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-[#0F172A] flex items-center gap-2 flex-wrap">
              <span class="vg-pill font-mono-num text-xs">#${escapeHtml(code)}</span>
              <span class="truncate">${escapeHtml(name)}</span>
            </div>
            <div class="text-xs text-[#475569] flex items-center gap-2 mt-1">
              <span>${pCount} ảnh/video</span>
              ${price ? `<span>·</span><span class="font-semibold text-[#065F46]">${escapeHtml(price)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5 flex-wrap">
          <button onclick="openPostPreviewModal('${post.id}')" class="vg-btn vg-btn-secondary vg-btn-sm" title="Xem chi tiết">
            Xem
          </button>
          <button onclick="sharePostToGroupsFromApp('${post.id}')" class="vg-btn vg-btn-soft-primary vg-btn-sm" title="Chia sẻ bài này lên Hội Nhóm Facebook">
            Chia sẻ nhóm
          </button>
          <button onclick="publishPostNow('${post.id}', 'both')" class="vg-btn vg-btn-primary vg-btn-sm" title="Đăng ngay cả Fanpage và Facebook Cá Nhân">
            Đăng ngay
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 1-Click trigger circular fill from Cockpit
async function triggerCircularFill() {
  try {
    const res = await fetch('/api/data-post/trigger-circular', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(`✓ ${data.message || 'Đã kích hoạt tuần hoàn thành công!'}`);
      loadCockpitStatus();
      loadPosts();
    } else {
      alert(`⚠️ ${data.error || 'Chưa thể kích hoạt tuần hoàn.'}`);
    }
  } catch (err) {
    alert(`Lỗi: ${err.message}`);
  }
}

// ======================== INITIALIZE & SETTINGS ========================

async function initDashboard() {
  if (isDashboardInitialized) return;
  isDashboardInitialized = true;
  await loadSettings();
  await loadNextSlot();
  await loadPosts();
  await loadCockpitStatus();
  setupDragAndDrop();
  setupDataPostEventListeners();
  fetchModelTemplates(false);
  initExtensionControlPanel();
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    appSettings = await res.json();

    // Populate Settings tab inputs
    if (document.getElementById('settingFanpageId')) {
      document.getElementById('settingFanpageId').value = appSettings.fanpageId || '';
      document.getElementById('settingPageToken').value = appSettings.facebookPageToken || '';
      document.getElementById('settingGeminiKey').value = appSettings.geminiApiKey || '';
      document.getElementById('settingFanpageName').value = appSettings.fanpageName || '';
      document.getElementById('settingHotline').value = appSettings.hotline || '';
      document.getElementById('settingWarranty').value = appSettings.warrantyPolicy || '';
      document.getElementById('settingAddress').value = appSettings.storeAddress || '';
      document.getElementById('settingScheduleTimes').value = (appSettings.scheduleTimes || []).join(', ');

      // Email notification fields
      if (document.getElementById('settingEmailEnabled')) {
        document.getElementById('settingEmailEnabled').checked = appSettings.emailNotificationEnabled !== false;
        document.getElementById('settingNotificationEmail').value = appSettings.notificationEmail || appSettings.email || 'nguyennhu19022008@gmail.com';
        document.getElementById('settingSmtpUser').value = appSettings.smtpUser || appSettings.email || 'nguyennhu19022008@gmail.com';
        document.getElementById('settingSmtpPass').value = appSettings.smtpPass || '';
      }

      // Telegram Bot fields
      if (document.getElementById('settingTelegramBotToken')) {
        document.getElementById('settingTelegramBotToken').value = appSettings.telegramBotToken || '';
        document.getElementById('settingTelegramChatId').value = appSettings.telegramChatId || '';
      }
    }

    // Update top header badge (High-contrast Emerald Ink — fixes white-on-mint legibility)
    const topBadge = document.getElementById('topFanpageBadge');
    if (topBadge && appSettings.fanpageId) {
      topBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#059669]"></span><span class="text-[#065F46]">Fanpage: <strong class="font-semibold text-[#065F46]">${escapeHtml(appSettings.fanpageName || 'Laptop Vương Gia')}</strong> (<span class="font-mono-num text-xs">${escapeHtml(appSettings.fanpageId)}</span>)</span>`;
    }

    // Update preview page name
    const previewName = document.getElementById('previewPageName');
    if (previewName && appSettings.fanpageName) {
      previewName.innerText = appSettings.fanpageName;
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

async function saveSettingsForm() {
  const updated = {
    fanpageId: document.getElementById('settingFanpageId').value.trim(),
    facebookPageToken: document.getElementById('settingPageToken').value.trim(),
    geminiApiKey: document.getElementById('settingGeminiKey').value.trim(),
    fanpageName: document.getElementById('settingFanpageName').value.trim(),
    hotline: document.getElementById('settingHotline').value.trim(),
    warrantyPolicy: document.getElementById('settingWarranty').value.trim(),
    storeAddress: document.getElementById('settingAddress').value.trim(),
    scheduleTimes: document.getElementById('settingScheduleTimes').value.split(',').map(s => s.trim()).filter(Boolean),
    emailNotificationEnabled: document.getElementById('settingEmailEnabled')?.checked ?? true,
    notificationEmail: document.getElementById('settingNotificationEmail')?.value.trim() || 'nguyennhu19022008@gmail.com',
    smtpUser: document.getElementById('settingSmtpUser')?.value.trim() || '',
    smtpPass: document.getElementById('settingSmtpPass')?.value.trim() || '',
    telegramBotToken: document.getElementById('settingTelegramBotToken')?.value.trim() || '',
    telegramChatId: document.getElementById('settingTelegramChatId')?.value.trim() || ''
  };

  try {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    const result = await res.json();
    alert('✅ ' + (result.message || 'Đã lưu cấu hình thành công!'));
    appSettings = result.settings;
    loadNextSlot();
  } catch (err) {
    alert('❌ Lỗi lưu cấu hình: ' + err.message);
  }
}

async function testFacebookConnection() {
  const resultDiv = document.getElementById('fbTestResult');
  resultDiv.innerHTML = '<span class="text-[#2563EB] font-medium">Đang kết nối tới Facebook...</span>';

  const fanpageId = document.getElementById('settingFanpageId').value.trim();
  const token = document.getElementById('settingPageToken').value.trim();

  try {
    const res = await fetch('/api/test-fb', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fanpageId, facebookPageToken: token })
    });
    const data = await res.json();

    if (data.valid) {
      resultDiv.innerHTML = `<span class="text-[#065F46] font-semibold">Kết nối thành công tới Trang: <strong>${escapeHtml(data.pageInfo.name)}</strong> (ID: ${escapeHtml(data.pageInfo.id)})</span>`;
    } else {
      resultDiv.innerHTML = `<span class="text-[#DC2626] font-semibold">${escapeHtml(data.error)}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-[#DC2626] font-semibold">Lỗi: ${escapeHtml(err.message)}</span>`;
  }
}

async function testEmailConnection() {
  const resultDiv = document.getElementById('emailTestResult');
  resultDiv.innerHTML = '<span class="text-[#2563EB] font-semibold">Đang gửi email kiểm thử...</span>';

  const notificationEmail = document.getElementById('settingNotificationEmail').value.trim();
  const smtpUser = document.getElementById('settingSmtpUser').value.trim();
  const smtpPass = document.getElementById('settingSmtpPass').value.trim();

  try {
    const res = await fetch('/api/test-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationEmail, smtpUser, smtpPass })
    });
    const data = await res.json();

    if (data.success) {
      resultDiv.innerHTML = `<span class="text-[#065F46] font-semibold">Đã gửi email kiểm thử thành công tới <strong>${escapeHtml(notificationEmail)}</strong>.</span>`;
    } else {
      resultDiv.innerHTML = `<span class="text-[#DC2626] font-semibold">${escapeHtml(data.error)}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-[#DC2626] font-semibold">Lỗi: ${escapeHtml(err.message)}</span>`;
  }
}

async function setupTelegramWebhook() {
  const resultDiv = document.getElementById('telegramStatusResult');
  const token = document.getElementById('settingTelegramBotToken').value.trim();
  if (!token) {
    alert('Vui lòng nhập Telegram Bot Token trước khi kích hoạt Webhook!');
    return;
  }

  resultDiv.innerHTML = '<span class="text-[#2563EB] font-semibold">Đang kết nối Webhook tới Telegram...</span>';
  try {
    const res = await fetch('/api/telegram/setup-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken: token })
    });
    const data = await res.json();
    if (data.success) {
      resultDiv.innerHTML = `<span class="text-[#065F46] font-semibold">${escapeHtml(data.message)}</span>`;
      await saveSettingsForm();
    } else {
      resultDiv.innerHTML = `<span class="text-[#DC2626] font-semibold">Lỗi: ${escapeHtml(data.error)}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-[#DC2626] font-semibold">Lỗi kết nối: ${escapeHtml(err.message)}</span>`;
  }
}

async function testTelegramMessage() {
  const resultDiv = document.getElementById('telegramStatusResult');
  const token = document.getElementById('settingTelegramBotToken').value.trim();
  const chatId = document.getElementById('settingTelegramChatId').value.trim();

  if (!token || !chatId) {
    alert('Vui lòng nhập cả Telegram Bot Token và Chat ID để gửi tin nhắn thử nghiệm!');
    return;
  }

  resultDiv.innerHTML = '<span class="text-[#2563EB] font-semibold">Đang gửi tin nhắn thử nghiệm tới Telegram...</span>';
  try {
    const res = await fetch('/api/telegram/test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken: token, telegramChatId: chatId })
    });
    const data = await res.json();
    if (data.success) {
      resultDiv.innerHTML = `<span class="text-[#065F46] font-semibold">${escapeHtml(data.message)}</span>`;
    } else {
      resultDiv.innerHTML = `<span class="text-[#DC2626] font-semibold">Lỗi: ${escapeHtml(data.error)}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-[#DC2626] font-semibold">Lỗi: ${escapeHtml(err.message)}</span>`;
  }
}

async function loadNextSlot() {
  try {
    const res = await fetch('/api/next-slot');
    const data = await res.json();
    const slotText = document.getElementById('suggestedSlotText');
    if (slotText && data.nextSlot) {
      const d = new Date(data.nextSlot);
      slotText.innerText = d.toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      slotText.dataset.raw = data.nextSlot;
    }
  } catch (err) {
    console.error('Error fetching next slot:', err);
  }
}

// ======================== SAMPLE DATA & INPUTS ========================

function loadSampleDell3410() {
  const sampleText = `Mã 046: DELL LATITUDE 3410 – TRỢ THỦ ĐẮC LỰC, CÂN MỌI TÁC VỤ VĂN PHÒNG!
Bạn đang tìm kiếm một chiếc laptop bền bỉ, mượt mà để phục vụ công việc và học tập mỗi ngày? Dell Latitude 3410 chính là câu trả lời hoàn hảo dành cho bạn!
✨ Những ưu điểm vượt trội không thể bỏ lỡ:
• Hiệu năng mạnh mẽ: Trang bị vi xử lý Intel Core i5-10210U (4 nhân 8 luồng) xử lý nhanh gọn các tác vụ từ Office, lướt web đến đồ họa 2D cơ bản.
• Đa nhiệm mượt mà: Bộ nhớ RAM 8GB giúp bạn thoải mái mở hàng chục tab trình duyệt và ứng dụng cùng lúc mà không lo giật lag.
• Tốc độ phản hồi cực nhanh: Ổ cứng SSD 256GB tốc độ cao giúp máy khởi động Windows và ứng dụng chỉ trong vài giây, mang lại không gian lưu trữ tài liệu tối ưu.
• Bền bỉ chuẩn Dell: Thiết kế gọn gàng, cứng cáp, bàn phím gõ êm ái – sẵn sàng đồng hành cùng bạn mọi lúc, mọi nơi. Giá 5.5 tr, lương 500k.`;

  document.getElementById('rawTextInput').value = sampleText;
  document.getElementById('machineCodeInput').value = '046';
  document.getElementById('customPriceInput').value = '5.5 triệu';

  // Automatically trigger AI Generation for delight!
  generateAiContent();
}

function clearRawInput() {
  document.getElementById('rawTextInput').value = '';
  document.getElementById('machineCodeInput').value = '';
  document.getElementById('customPriceInput').value = '';
  document.getElementById('finalContentInput').value = '';
  currentMediaFiles = [];
  renderMediaPreviews();
  updateFacebookPreview();
}

// ======================== AI GENERATION ========================

async function generateAiContent() {
  const rawText = document.getElementById('rawTextInput').value.trim();
  const customPrice = document.getElementById('customPriceInput').value.trim();
  const machineCode = document.getElementById('machineCodeInput').value.trim();

  if (!rawText) {
    alert('Vui lòng dán nội dung bài viết từ Zalo vào trước.');
    return;
  }

  const btn = document.getElementById('generateBtn');
  const spinner = document.getElementById('generateSpinner');
  btn.disabled = true;
  spinner.classList.remove('hidden');

  try {
    const res = await fetch('/api/generate-content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawText, customPrice })
    });
    const result = await res.json();

    if (result.content) {
      document.getElementById('finalContentInput').value = result.content;
      updateFacebookPreview();
      
      // Auto-extract code if not already set
      if (!machineCode) {
        const codeMatch = result.content.match(/#(?:MÃ\s*)?([A-Za-z0-9_-]+)/i);
        if (codeMatch) {
          document.getElementById('machineCodeInput').value = codeMatch[1];
        }
      }
    } else {
      alert('Không nhận được nội dung sinh từ AI.');
    }
  } catch (err) {
    alert('Lỗi tạo bài viết: ' + err.message);
  } finally {
    btn.disabled = false;
    spinner.classList.add('hidden');
  }
}

// ======================== MEDIA UPLOAD & HANDLING ========================

function setupDragAndDrop() {
  const dropZone = document.getElementById('dropZone');
  if (!dropZone) return;

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-[#2563EB]', 'bg-[#EFF6FF]');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-[#2563EB]', 'bg-[#EFF6FF]');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length) uploadMediaFiles(files);
  });
}

function handleFileSelect(event) {
  const files = event.target.files;
  if (files && files.length) uploadMediaFiles(files);
  event.target.value = ''; // Reset so the user can select more files or pick the same file again
}

// Helper to escape HTML characters safely
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Universal Clipboard copy with iOS/WebView fallback
function copyTextToClipboard(text, successMessage = '📋 Đã sao chép thành công!') {
  if (!text) return;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      alert(successMessage);
    }).catch(() => {
      fallbackCopyText(text, successMessage);
    });
  } else {
    fallbackCopyText(text, successMessage);
  }
}

function fallbackCopyText(text, successMessage) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.left = '-999999px';
  textArea.style.top = '-999999px';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
    alert(successMessage);
  } catch (err) {
    console.error('Fallback copy failed', err);
    prompt('Hãy sao chép thủ công bằng cách nhấn Ctrl+C hoặc giữ chọn:', text);
  }
  document.body.removeChild(textArea);
}

function copyPostText(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post || !post.content) return;
  copyTextToClipboard(post.content, `Đã sao chép nội dung Mã #${post.machineCode || 'N/A'}`);
}

function togglePostAccordion(postId) {
  const el = document.getElementById(`accordion-${postId}`);
  const btn = document.getElementById(`chevron-${postId}`);
  if (!el) return;
  if (el.classList.contains('hidden')) {
    el.classList.remove('hidden');
    if (btn) btn.innerHTML = 'Thu gọn nội dung';
  } else {
    el.classList.add('hidden');
    if (btn) btn.innerHTML = 'Xem nhanh nội dung';
  }
}

// Helper to determine if a media item is a video
function isVideoFile(file) {
  if (!file) return false;
  const mt = (file.mimetype || '').toLowerCase();
  const url = (file.url || file.filename || file.originalname || '').toLowerCase();
  return mt.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm|3gp)$/i.test(url);
}

function formatMediaCountText(files) {
  const vCount = (files || []).filter(isVideoFile).length;
  const pCount = (files || []).length - vCount;
  if (!files || files.length === 0) return '0 tệp đã chọn';
  if (vCount > 0 && pCount > 0) return `${vCount} video · ${pCount} ảnh đã chọn`;
  if (vCount > 0) return `${vCount} video đã chọn`;
  return `${pCount} ảnh đã chọn`;
}

async function uploadMediaFiles(files) {
  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  const mediaCountText = document.getElementById('mediaCountText');
  mediaCountText.innerText = 'Đang tải lên...';

  try {
    const res = await fetch('/api/upload-media', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();

    if (result.success && result.files) {
      const combined = [...currentMediaFiles, ...result.files];
      // Auto-deduplicate media by originalname + size to prevent uploading identical photos
      const seenMedia = new Set();
      currentMediaFiles = combined.filter(f => {
        const key = `${f.originalname}_${f.size}`;
        if (seenMedia.has(key)) return false;
        seenMedia.add(key);
        return true;
      });
      renderMediaPreviews();
    }
  } catch (err) {
    alert('Lỗi tải tệp: ' + err.message);
  } finally {
    mediaCountText.innerText = formatMediaCountText(currentMediaFiles);
  }
}

function removeMediaItem(index) {
  currentMediaFiles.splice(index, 1);
  renderMediaPreviews();
  document.getElementById('mediaCountText').innerText = formatMediaCountText(currentMediaFiles);
}

function renderMediaPreviews() {
  const container = document.getElementById('mediaPreviews');
  container.innerHTML = '';

  currentMediaFiles.forEach((file, index) => {
    const isVideo = isVideoFile(file);
    const item = document.createElement('div');
    item.className = 'relative group rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#0F172A] aspect-video flex items-center justify-center';

    if (isVideo) {
      item.innerHTML = `
        <video src="${file.url}" class="w-full h-full object-cover" preload="metadata" muted playsinline></video>
        <div class="absolute inset-0 flex items-center justify-center bg-[#0F172A]/40 pointer-events-none">
          <span class="bg-[#DC2626] text-white text-[11px] font-semibold font-mono-num px-2 py-0.5 rounded">VIDEO</span>
        </div>
        <span class="absolute bottom-1 left-1 bg-[#0F172A]/80 text-white text-[10px] px-1.5 py-0.5 font-mono-num rounded">#${index + 1}</span>
        <button onclick="removeMediaItem(${index})" class="absolute top-1 right-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition" aria-label="Xóa tệp">×</button>
      `;
    } else {
      item.innerHTML = `
        <img src="${file.url}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\\'w-full h-full bg-[#F1F5F9] flex items-center justify-center text-xs font-mono-num text-[#475569]\\\'>Ảnh lỗi</div>';" class="w-full h-full object-cover">
        <span class="absolute bottom-1 left-1 bg-[#0F172A]/80 text-white text-[10px] px-1.5 py-0.5 font-mono-num rounded">#${index + 1}</span>
        <button onclick="removeMediaItem(${index})" class="absolute top-1 right-1 bg-[#DC2626] hover:bg-[#B91C1C] text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition" aria-label="Xóa ảnh">×</button>
      `;
    }

    container.appendChild(item);
  });

  // Render "+ Thêm tệp" tile in gallery
  if (currentMediaFiles.length > 0) {
    const addMoreTile = document.createElement('div');
    addMoreTile.className = 'border border-dashed border-[#94A3B8] bg-white hover:border-[#2563EB] hover:bg-[#EFF6FF]/40 rounded-lg aspect-video flex flex-col items-center justify-center cursor-pointer transition text-center p-2';
    addMoreTile.onclick = () => document.getElementById('fileInput').click();
    addMoreTile.innerHTML = `
      <span class="text-xl font-semibold text-[#0F172A] leading-none">+</span>
      <span class="text-xs font-medium text-[#475569] mt-1">Thêm tệp</span>
    `;
    container.appendChild(addMoreTile);
  }

  updateFacebookPreview();
}

// ======================== LIVE FACEBOOK PREVIEW ========================

function updateFacebookPreview() {
  const content = document.getElementById('finalContentInput').value;
  const previewContent = document.getElementById('previewPostContent');
  const lengthBadge = document.getElementById('contentLengthBadge');
  const mediaContainer = document.getElementById('previewMediaContainer');

  lengthBadge.innerText = `${content.length} ký tự`;

  if (!content.trim()) {
    previewContent.innerText = 'Nội dung bài viết sẽ hiển thị tại đây sau khi AI xử lý hoặc bạn chỉnh sửa...';
  } else {
    previewContent.innerText = content;
  }

  // Render media preview in FB feed layout (multi-photo grid)
  if (currentMediaFiles.length === 0) {
    mediaContainer.classList.add('hidden');
    mediaContainer.innerHTML = '';
  } else {
    mediaContainer.classList.remove('hidden');
    const count = currentMediaFiles.length;
    mediaContainer.className = `fb-media-grid grid-${Math.min(count, 4)}`;

    mediaContainer.innerHTML = currentMediaFiles.slice(0, 4).map((f, idx) => {
      const isVideo = isVideoFile(f);
      
      // If 5+ files, display "+N" overlay on the 4th item like real Facebook
      if (idx === 3 && currentMediaFiles.length > 4) {
        const remaining = currentMediaFiles.length - 3;
        return `
          <div class="relative w-full h-full min-h-[140px] bg-black overflow-hidden flex items-center justify-center">
            ${isVideo 
              ? `<video src="${f.url}" class="w-full h-full object-cover opacity-60" preload="metadata" muted playsinline></video>`
              : `<img src="${f.url}" class="w-full h-full object-cover opacity-60" onerror="this.onerror=null; this.src='data:image/svg+xml,...';">`
            }
            <div class="absolute inset-0 flex items-center justify-center text-white text-2xl font-black bg-black/40">
              +${remaining}
            </div>
          </div>
        `;
      }

      if (isVideo) {
        return `
          <div class="relative w-full h-full min-h-[140px] bg-[#0F172A] overflow-hidden flex items-center justify-center rounded-lg">
            <video src="${f.url}" class="w-full h-full object-cover" controls preload="metadata" playsinline></video>
            <span class="absolute top-2 left-2 bg-[#DC2626] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded pointer-events-none">VIDEO</span>
          </div>
        `;
      } else {
        return `<img src="${f.url}" class="fb-media-item" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\\'w-full h-full min-h-[140px] bg-[#F1F5F9] flex items-center justify-center text-xs font-mono-num text-[#475569]\\\'>Ảnh máy</div>';">`;
      }
    }).join('');
  }
}

// ======================== SCHEDULE & PUBLISH POSTS ========================

async function schedulePost(publishImmediately = false, target = 'both') {
  const content = document.getElementById('finalContentInput').value.trim();
  const machineCode = document.getElementById('machineCodeInput').value.trim();
  const price = document.getElementById('customPriceInput').value.trim();
  const suggestedSlot = document.getElementById('suggestedSlotText').dataset.raw;

  if (!content) {
    alert('Vui lòng tạo hoặc soạn nội dung bài viết trước khi lên lịch/đăng.');
    return;
  }

  const shouldPublishImmediately = publishImmediately && target !== 'personal';

  const postPayload = {
    machineCode: machineCode || 'MÁY',
    content,
    price,
    mediaFiles: currentMediaFiles,
    scheduledTime: publishImmediately ? new Date().toISOString() : suggestedSlot,
    publishImmediately: shouldPublishImmediately
  };

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    });
    const result = await res.json();

    if (result.success) {
      if (publishImmediately && (target === 'both' || target === 'personal')) {
        // Trigger Personal Robot via Web Bridge
        const mediaUrls = currentMediaFiles.map(m => typeof m === 'string' ? m : (m.url || m.path || ''));
        window.postMessage({
          action: 'VG_TRIGGER_PERSONAL_POST',
          type: 'VG_TRIGGER_PERSONAL_POST',
          payload: {
            content,
            mediaUrls,
            machineCode: machineCode || 'MÁY',
            pagePostUrl: result.data?.facebookPostUrl || result.facebookPostUrl
          },
          postData: {
            title: machineCode ? `[${machineCode}] Laptop` : 'Laptop',
            content,
            price,
            mediaUrls,
            machineCode: machineCode || 'MÁY'
          }
        }, '*');

        if (navigator.clipboard) {
          try { await navigator.clipboard.writeText(content); } catch (e) {}
        }

        // Tự động tải ảnh về máy
        if (mediaUrls.length > 0) {
          downloadAllPostMedia(mediaUrls, machineCode);
        }

        // Mở modal hỗ trợ trực quan
        openPersonalPostHelperModal({
          machineCode: machineCode || 'MÁY',
          content,
          mediaUrls
        }, result.data?.facebookPostUrl || result.facebookPostUrl);

        window.open('https://www.facebook.com/', '_blank');
      } else {
        alert(publishImmediately ? '🚀 ' + result.message : '📅 ' + result.message);
      }

      if (typeof closeManualPostModal === 'function') {
        closeManualPostModal();
      }
      clearRawInput();
      await loadNextSlot();
      await loadPosts();
      switchTab(publishImmediately ? 'cockpit' : 'queue');
    } else {
      alert('Không thể lưu/đăng: ' + (result.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi đăng bài: ' + err.message);
  }
}

// ======================== POSTS LIST (QUEUE & HISTORY) ========================

async function loadPosts() {
  try {
    const res = await fetch('/api/posts');
    const data = await res.json();
    allPosts = Array.isArray(data) ? data : [];

    const queuedPosts = allPosts.filter(p => p.status === 'queued' || p.status === 'processing' || p.status === 'pending_media' || p.status === 'skipped_no_media');
    const historyPosts = allPosts.filter(p => p.status === 'posted' || p.status === 'failed');

    document.getElementById('queueCount').innerText = queuedPosts.length;
    document.getElementById('historyCount').innerText = historyPosts.length;

    // Update mobile bottom dock queue badge
    const mobileBadge = document.getElementById('mobileQueueBadge');
    if (mobileBadge) {
      if (queuedPosts.length > 0) {
        mobileBadge.innerText = queuedPosts.length;
        mobileBadge.classList.remove('hidden');
      } else {
        mobileBadge.classList.add('hidden');
      }
    }

    renderQueueList(queuedPosts);
    renderHistoryList(historyPosts);
    if (typeof populateGroupPostDropdown === 'function') populateGroupPostDropdown();
  } catch (err) {
    console.error('Error fetching posts:', err);
    if (!Array.isArray(allPosts)) allPosts = [];
  }
}

function renderQueueList(posts) {
  const container = document.getElementById('queueListContainer');
  if (posts.length === 0) {
    container.innerHTML = `
      <div class="vg-surface p-10 text-center space-y-2">
        <div class="text-base font-bold text-[#0F172A]">Hàng đợi hiện đang trống</div>
        <p class="text-sm text-[#475569]">Bấm “Soạn bài mới” ở góc trên hoặc kích hoạt tuần hoàn từ Kho máy để lên lịch đăng.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(post => {
    const scheduledDate = new Date(post.scheduledTime).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const mFiles = post.mediaFiles || [];
    const mCount = mFiles.length;
    const vCount = mFiles.filter(isVideoFile).length;
    const pCount = mCount - vCount;

    let mediaThumbHtml = '';
    if (mCount === 0) {
      mediaThumbHtml = `<div class="w-16 h-16 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-[11px] text-[#475569] font-medium text-center p-1 shrink-0">Thiếu ảnh</div>`;
    } else {
      const firstMedia = mFiles[0];
      const isFirstVideo = isVideoFile(firstMedia);
      mediaThumbHtml = `
        <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#0F172A] flex items-center justify-center shrink-0">
          ${isFirstVideo
            ? `<video src="${firstMedia.url}" class="w-full h-full object-cover" preload="metadata" muted playsinline></video>
               <span class="absolute inset-0 flex items-center justify-center bg-[#0F172A]/45 text-white text-[11px] font-semibold">VIDEO</span>`
            : `<img src="${firstMedia.url}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\\'w-16 h-16 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[11px] font-mono-num font-semibold text-[#475569]\\\'>#${escapeHtml(post.machineCode)}</div>';" class="w-full h-full object-cover">`
          }
          ${mCount > 1 ? `<span class="absolute bottom-1 right-1 bg-[#0F172A]/85 text-white text-[10px] px-1.5 rounded font-mono-num">+${mCount}</span>` : ''}
        </div>
      `;
    }

    const firstLine = (post.content || '').split('\n')[0] || post.machineName || 'Laptop';
    let statusBadge = '';
    if (post.status === 'pending_media') {
      statusBadge = `<span class="vg-pill vg-pill-warning">Chờ nạp ảnh</span>`;
    } else if (post.status === 'queued') {
      statusBadge = `<span class="vg-pill vg-pill-success">Sẵn sàng đăng</span>`;
    } else if (post.status === 'skipped_no_media') {
      statusBadge = `<span class="vg-pill vg-pill-danger">Bỏ qua (thiếu ảnh)</span>`;
    } else if (post.status === 'processing') {
      statusBadge = `<span class="vg-pill vg-pill-primary">Đang xuất bản</span>`;
    }

    const uploadBtnClass = mCount === 0 ? 'vg-btn vg-btn-soft-primary vg-btn-sm' : 'vg-btn vg-btn-secondary vg-btn-sm';

    return `
      <div class="vg-surface p-4 sm:p-5 space-y-3">
        <div class="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div class="flex gap-3.5 items-start sm:items-center min-w-0">
            ${mediaThumbHtml}
            <div class="min-w-0 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="vg-pill font-mono-num">#${escapeHtml(post.machineCode)}</span>
                ${post.price ? `<span class="text-xs font-bold text-[#059669]">${escapeHtml(post.price)}</span>` : ''}
                ${statusBadge}
              </div>
              <div class="text-sm sm:text-base font-semibold text-[#0F172A] line-clamp-1 cursor-pointer hover:text-[#2563EB] transition-colors" onclick="viewQueuedPostContent('${post.id}')" title="Xem toàn bộ nội dung">
                ${escapeHtml(firstLine)}
              </div>
              <div class="text-xs text-[#475569] flex items-center gap-2 flex-wrap">
                <span>Giờ hẹn: <strong class="text-[#0F172A] font-mono-num">${scheduledDate}</strong></span>
                <span>·</span>
                <span>${vCount > 0 ? `${vCount} video · ` : ''}${pCount} ảnh</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-[#E2E8F0]">
            <button onclick="viewQueuedPostContent('${post.id}')" class="vg-btn vg-btn-secondary vg-btn-sm" title="Xem chi tiết">
              Xem
            </button>
            <a href="/quick-upload?id=${post.id}" target="_blank" class="${uploadBtnClass}" title="Nạp hoặc xem ảnh/video">
              ${mCount > 0 ? `Media (${mCount})` : 'Nạp ảnh'}
            </a>
            <button onclick="publishPostNow('${post.id}', 'both')" class="vg-btn vg-btn-primary vg-btn-sm" title="Đăng ngay lên cả Fanpage và Cá Nhân">
              Đăng ngay
            </button>
            <button onclick="deletePost('${post.id}')" class="vg-btn vg-btn-danger-ghost vg-btn-sm" title="Xóa khỏi hàng đợi">
              Xóa
            </button>
          </div>
        </div>

        <div class="pt-2.5 border-t border-[#E2E8F0]">
          <div class="flex items-center justify-between">
            <button type="button" onclick="togglePostAccordion('${post.id}')" class="text-xs font-semibold text-[#475569] hover:text-[#0F172A] py-0.5">
              <span id="chevron-${post.id}">Xem nhanh nội dung</span>
            </button>
            <button type="button" onclick="copyPostText('${post.id}')" class="text-xs font-semibold text-[#2563EB] hover:underline">
              Sao chép text
            </button>
          </div>
          <div id="accordion-${post.id}" class="hidden mt-2.5 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] leading-relaxed select-text">
            <pre class="whitespace-pre-wrap font-sans text-xs sm:text-sm text-[#0F172A] leading-relaxed">${escapeHtml(post.content || 'Chưa có nội dung.')}</pre>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderHistoryList(posts) {
  const container = document.getElementById('historyListContainer');
  if (posts.length === 0) {
    container.innerHTML = `
      <div class="vg-surface p-10 text-center text-sm text-[#475569]">
        Chưa có bài viết nào được xuất bản.
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(post => {
    const isSuccess = post.status === 'posted';
    const postDate = new Date(post.postedAt || post.failedAt || post.createdAt).toLocaleString('vi-VN');
    const mFiles = post.mediaFiles || [];
    const mCount = mFiles.length;
    const firstMedia = mFiles[0];
    const isFirstVideo = firstMedia ? isVideoFile(firstMedia) : false;

    let historyThumbHtml = '';
    if (!firstMedia) {
      historyThumbHtml = `<div class="w-16 h-16 rounded-lg bg-[#F1F5F9] border border-[#E2E8F0] flex items-center justify-center text-xs text-[#475569] font-medium shrink-0">Không ảnh</div>`;
    } else if (isFirstVideo) {
      historyThumbHtml = `
        <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#0F172A] flex items-center justify-center shrink-0">
          <video src="${firstMedia.url}" class="w-full h-full object-cover" preload="metadata" muted playsinline></video>
          <span class="absolute inset-0 flex items-center justify-center bg-[#0F172A]/45 text-white text-[11px] font-semibold">VIDEO</span>
          ${mCount > 1 ? `<span class="absolute bottom-1 right-1 bg-[#0F172A]/85 text-white text-[10px] px-1.5 rounded font-mono-num">+${mCount}</span>` : ''}
        </div>
      `;
    } else {
      historyThumbHtml = `
        <div class="relative w-16 h-16 rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#F1F5F9] flex items-center justify-center shrink-0">
          <img src="${firstMedia.url}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\\'w-16 h-16 rounded-lg bg-[#F1F5F9] flex items-center justify-center text-[11px] font-mono-num font-semibold text-[#475569]\\\'>#${escapeHtml(post.machineCode)}</div>';" class="w-full h-full object-cover">
          ${mCount > 1 ? `<span class="absolute bottom-1 right-1 bg-[#0F172A]/85 text-white text-[10px] px-1.5 rounded font-mono-num">+${mCount}</span>` : ''}
        </div>
      `;
    }

    const firstLine = (post.content || '').split('\n')[0] || post.machineName || 'Laptop';

    return `
      <div class="vg-surface p-4 sm:p-5 space-y-3">
        <div class="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div class="flex gap-3.5 items-start sm:items-center min-w-0">
            ${historyThumbHtml}
            <div class="min-w-0 space-y-1">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="vg-pill ${isSuccess ? 'vg-pill-success' : 'vg-pill-danger'}">
                  ${isSuccess ? 'Đã đăng' : 'Thất bại'}
                </span>
                <span class="vg-pill font-mono-num">#${escapeHtml(post.machineCode)}</span>
                ${post.isSimulation ? `<span class="vg-pill vg-pill-warning">Thử nghiệm</span>` : ''}
              </div>
              <div class="text-sm sm:text-base font-semibold text-[#0F172A] line-clamp-1 cursor-pointer hover:text-[#2563EB] transition-colors" onclick="viewQueuedPostContent('${post.id}')" title="Xem lại nội dung bài đăng">
                ${escapeHtml(firstLine)}
              </div>
              <div class="text-xs text-[#475569]">
                <span>Đăng lúc: <strong class="text-[#0F172A] font-mono-num">${postDate}</strong></span>
                ${post.errorMessage ? `<span class="text-[#DC2626] ml-2">(${escapeHtml(post.errorMessage)})</span>` : ''}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-[#E2E8F0]">
            <button onclick="viewQueuedPostContent('${post.id}')" class="vg-btn vg-btn-secondary vg-btn-sm">
              Xem bài viết
            </button>
            ${post.fbPostUrl ? `
              <a href="${post.fbPostUrl}" target="_blank" class="vg-btn vg-btn-soft-primary vg-btn-sm">
                Xem trên FB ↗
              </a>
            ` : ''}
            <button onclick="deletePost('${post.id}')" class="vg-btn vg-btn-danger-ghost vg-btn-sm">
              Xóa
            </button>
          </div>
        </div>

        <div class="pt-2.5 border-t border-[#E2E8F0]">
          <div class="flex items-center justify-between">
            <button type="button" onclick="togglePostAccordion('${post.id}')" class="text-xs font-semibold text-[#475569] hover:text-[#0F172A] py-0.5">
              <span id="chevron-${post.id}">Xem nhanh nội dung</span>
            </button>
            <button type="button" onclick="copyPostText('${post.id}')" class="text-xs font-semibold text-[#2563EB] hover:underline">
              Sao chép text
            </button>
          </div>
          <div id="accordion-${post.id}" class="hidden mt-2.5 p-3.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-lg text-sm text-[#0F172A] leading-relaxed select-text">
            <pre class="whitespace-pre-wrap font-sans text-xs sm:text-sm text-[#0F172A] leading-relaxed">${escapeHtml(post.content || 'Chưa có nội dung.')}</pre>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function publishPostNow(id, target = 'fanpage') {
  const targetLabel = target === 'both' 
    ? 'CẢ HAI (Fanpage + Facebook Cá Nhân)' 
    : (target === 'personal' ? 'Facebook Cá Nhân' : 'Fanpage');

  if (!confirm(`Bạn có chắc muốn đăng bài viết này lên ${targetLabel} ngay bây giờ không?`)) return;

  try {
    let fanpageSuccess = false;
    let pageLink = null;

    // 1. If target is 'both' or 'fanpage', trigger Fanpage publishing via server
    if (target === 'both' || target === 'fanpage') {
      const res = await fetch(`/api/posts/${id}/publish-now`, { method: 'POST' });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Lỗi khi đăng lên Fanpage');
      }
      fanpageSuccess = true;
      pageLink = result.data?.facebookPostUrl || result.facebookPostUrl;
      
      if (target === 'fanpage') {
        alert(result.message || '⚡ Đã xuất bản lên Fanpage thành công!');
        await loadPosts();
        return;
      }
    }

    // 2. If target is 'both' or 'personal', trigger Personal Profile automation
    const post = allPosts.find(p => p.id === id);
    if (post) {
      const postText = post.content || '';
      const postMedia = post.mediaUrls || (post.mediaFiles ? post.mediaFiles.map(m => typeof m === 'string' ? m : (m.url || m.path || '')) : []);

      // A. Emit Web Bridge event for Chrome Extension
      window.postMessage({
        action: 'VG_TRIGGER_PERSONAL_POST',
        payload: {
          content: postText,
          mediaUrls: postMedia,
          machineCode: post.machineCode || post.code || 'MÁY',
          pagePostUrl: pageLink
        }
      }, '*');

      // B. Copy text to clipboard as universal fallback
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(postText);
        } catch (e) {}
      }

      // C. Tự động tải toàn bộ ảnh của máy về máy tính
      if (postMedia.length > 0) {
        downloadAllPostMedia(postMedia, post.machineCode);
      }

      // D. Hiển thị Modal hỗ trợ trực quan kèm nút mở Facebook
      openPersonalPostHelperModal(post, pageLink);

      // E. Mở tab Facebook
      window.open('https://www.facebook.com/', '_blank');
    }

    await loadPosts();
  } catch (err) {
    alert('Lỗi đăng bài: ' + err.message);
  }
}

// ======================== PERSONAL PROFILE POST HELPER ========================

async function downloadImageFile(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename || 'laptop_image.jpg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.warn('Lỗi tải ảnh:', err);
    window.open(url, '_blank');
  }
}

async function downloadAllPostMedia(mediaUrls, machineCode = 'LAPTOP') {
  if (!mediaUrls || mediaUrls.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < mediaUrls.length; i++) {
    const url = typeof mediaUrls[i] === 'string' ? mediaUrls[i] : (mediaUrls[i].url || '');
    if (url) {
      count++;
      await downloadImageFile(url, `Laptop_VuongGia_${machineCode || 'May'}_Anh_${count}.jpg`);
      await new Promise(r => setTimeout(r, 400));
    }
  }
  return count;
}

let currentPersonalPostData = null;

function openPersonalPostHelperModal(post, pageLink = null) {
  currentPersonalPostData = post;
  const modal = document.getElementById('personalPostHelperModal');
  if (!modal) return;

  const contentEl = document.getElementById('personalHelperContent');
  const mediaContainer = document.getElementById('personalHelperMedia');
  const mediaCountEl = document.getElementById('personalHelperMediaCount');
  const titleEl = document.getElementById('personalHelperTitle');

  const postText = post.content || '';
  const postMedia = post.mediaUrls || (post.mediaFiles ? post.mediaFiles.map(m => typeof m === 'string' ? m : (m.url || m.path || '')) : []);

  if (titleEl) {
    titleEl.innerText = `MÃ #${post.machineCode || 'LAPTOP'}: ĐĂNG FACEBOOK CÁ NHÂN`;
  }
  if (contentEl) {
    contentEl.innerText = postText;
  }
  if (mediaCountEl) {
    mediaCountEl.innerText = `${postMedia.length} ảnh HD`;
  }

  if (mediaContainer) {
    if (postMedia.length > 0) {
      mediaContainer.innerHTML = postMedia.map((url, idx) => `
        <div class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#0F172A] shrink-0">
          <img src="${url}" class="w-full h-full object-cover">
          <span class="absolute top-1 right-1 bg-[#0F172A]/80 text-white text-[10px] px-1.5 rounded font-mono-num">#${idx + 1}</span>
        </div>
      `).join('');
      mediaContainer.classList.remove('hidden');
    } else {
      mediaContainer.innerHTML = `<span class="text-xs text-[#475569] italic">Bài viết này chưa có ảnh đính kèm.</span>`;
      mediaContainer.classList.remove('hidden');
    }
  }

  modal.classList.remove('hidden');
  document.body.classList.add('overflow-hidden');
}

function closePersonalPostHelperModal() {
  const modal = document.getElementById('personalPostHelperModal');
  if (modal) {
    modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
}

async function triggerDownloadCurrentImages() {
  if (!currentPersonalPostData) return;
  const postMedia = currentPersonalPostData.mediaUrls || (currentPersonalPostData.mediaFiles ? currentPersonalPostData.mediaFiles.map(m => typeof m === 'string' ? m : (m.url || m.path || '')) : []);
  if (postMedia.length === 0) {
    alert('Bài viết này không có ảnh đính kèm.');
    return;
  }
  const btn = document.getElementById('personalHelperDownloadBtn');
  if (btn) btn.innerText = 'Đang tải ảnh...';
  const downloaded = await downloadAllPostMedia(postMedia, currentPersonalPostData.machineCode);
  if (btn) btn.innerText = `Đã tải (${downloaded} ảnh)`;
  setTimeout(() => { if (btn) btn.innerText = 'Tải lại ảnh'; }, 2500);
}

function copyCurrentPersonalText() {
  if (!currentPersonalPostData) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(currentPersonalPostData.content || '');
  }
  const btn = document.getElementById('personalHelperCopyBtn');
  if (btn) btn.innerText = 'Đã chép nội dung!';
  setTimeout(() => { if (btn) btn.innerText = 'Sao chép lại'; }, 2000);
}

function openFacebookFromHelper() {
  window.open('https://www.facebook.com/', '_blank');
}

async function deletePost(id) {
  if (!confirm('Bạn có muốn xóa bài này khỏi danh sách?')) return;
  try {
    const res = await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    const result = await res.json();
    await loadPosts();
  } catch (err) {
    alert('Lỗi xóa bài: ' + err.message);
  }
}

// ======================== AUTO DEDUPLICATION LOGIC ========================

function normalizeMachineCode(code) {
  if (!code) return '';
  let str = String(code).trim().toUpperCase();
  str = str.replace(/^(MÃ|MA|CODE|#)\s*:?\s*/i, '');
  return str.trim();
}

function isValidMachineCode(code) {
  const norm = normalizeMachineCode(code);
  if (!norm) return false;
  const genericWords = ['MÁY', 'MAY', 'LAPTOP', 'KHÔNG', 'NONE', 'UNKNOWN', 'NULL'];
  if (genericWords.includes(norm)) return false;
  return norm.length >= 2;
}

/**
 * Merges new items into existing list, auto-deduplicating by machineCode:
 * If an item code already exists in table, the OLD item is replaced by the NEW item!
 */
function mergeAndDeduplicateTableItems(existingList, newItems) {
  const map = new Map();
  const replacedCodes = [];

  // 1. Existing items
  existingList.forEach((item, idx) => {
    const norm = normalizeMachineCode(item.machineCode);
    const key = isValidMachineCode(norm) ? `code_${norm}` : `idx_${idx}`;
    map.set(key, item);
  });

  // 2. Incoming items: latest replaces older!
  newItems.forEach((item, idx) => {
    const norm = normalizeMachineCode(item.machineCode);
    const key = isValidMachineCode(norm) ? `code_${norm}` : `new_${idx}_${Date.now()}`;
    if (map.has(key)) {
      if (isValidMachineCode(norm) && !replacedCodes.includes(norm)) {
        replacedCodes.push(norm);
      }
    }
    map.set(key, {
      ...item,
      selected: true
    });
  });

  const merged = Array.from(map.values()).map((item, idx) => ({
    ...item,
    originalIndex: idx
  }));

  return {
    merged,
    replacedCount: replacedCodes.length,
    replacedCodes
  };
}

function showTableDedupAlert(message, type = 'info') {
  const alertBox = document.getElementById('tableDedupAlert');
  if (!alertBox) return;
  alertBox.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-base">⚡</span>
      <span>${message}</span>
    </div>
    <button onclick="document.getElementById('tableDedupAlert').classList.add('hidden')" class="text-neutral-500 hover:text-black font-black px-1.5 py-0.5">✕</button>
  `;
  alertBox.className = type === 'success' 
    ? 'p-3 bg-[#ECFDF5] border-2 border-emerald-600 rounded-lg text-xs font-bold text-emerald-900 flex items-center justify-between shadow-[2px_2px_0px_#18181B]'
    : 'p-3 bg-[#FFFBEB] border-2 border-amber-500 rounded-lg text-xs font-bold text-amber-900 flex items-center justify-between shadow-[2px_2px_0px_#18181B]';
  alertBox.classList.remove('hidden');
}

// ======================== BATCH STOCK TABLE & OCR ========================

function setupTableDragAndDrop() {
  const dropZone = document.getElementById('tableDropZone');
  const fileInput = document.getElementById('tableFileInput');
  if (!dropZone || !fileInput) return;

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length) {
      parseTableImageFiles(e.target.files);
    }
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('bg-[#EFF6FF]', 'border-[#2563EB]');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('bg-[#EFF6FF]', 'border-[#2563EB]');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files && files.length) {
      parseTableImageFiles(files);
    }
  });
}

async function loadSampleTableData() {
  const loading = document.getElementById('dropZoneLoading');
  const idle = document.getElementById('dropZoneIdle');
  if (loading) loading.classList.remove('hidden');
  if (idle) idle.classList.add('hidden');

  try {
    const res = await fetch('/api/parse-table', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}) // Empty body triggers built-in sample data
    });
    const data = await res.json();
    if (data.success && data.items) {
      isSampleDataLoaded = true;
      parsedTableItems = data.items.map((item, idx) => ({
        ...item,
        selected: true,
        originalIndex: idx
      }));
      renderParsedTable(parsedTableItems);
      updateSelectedCount();
      showTableDedupAlert(`✓ Đã nạp thành công ${data.items.length} mã máy từ mẫu bảng kho.`, 'success');
    } else {
      alert('Không thể nạp dữ liệu mẫu: ' + (data.error || 'Lỗi không xác định'));
    }
  } catch (err) {
    alert('Lỗi nạp mẫu: ' + err.message);
  } finally {
    if (loading) loading.classList.add('hidden');
    if (idle) idle.classList.remove('hidden');
  }
}

async function parseTableImageFiles(fileList) {
  const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
  if (files.length === 0) {
    alert('Vui lòng chọn một hoặc nhiều tệp hình ảnh (PNG, JPG, WebP)!');
    return;
  }

  const loading = document.getElementById('dropZoneLoading');
  const idle = document.getElementById('dropZoneIdle');
  const previewBar = document.getElementById('tableImagePreviewBar');
  const previewThumb = document.getElementById('tableImageThumbnail');
  const previewName = document.getElementById('tableImageFileName');

  if (loading) loading.classList.remove('hidden');
  if (idle) idle.classList.add('hidden');

  let totalNewItems = [];
  let totalReplacedCodes = [];

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      if (i === 0) {
        if (previewThumb) previewThumb.src = base64Data;
        if (previewName) previewName.innerText = files.length > 1 ? `${files.length} ảnh bảng kho` : file.name;
        if (previewBar) previewBar.classList.remove('hidden');
      }

      const res = await fetch('/api/parse-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data })
      });
      const data = await res.json();
      if (!data.success) {
        alert('Lỗi bóc tách ảnh: ' + (data.error || 'Không rõ nguyên nhân'));
        continue;
      }
      if (data.items && data.items.length > 0) {
        totalNewItems.push(...data.items);
        if (data.replacedCodes && data.replacedCodes.length) {
          totalReplacedCodes.push(...data.replacedCodes);
        }
      }
    }

    if (totalNewItems.length > 0) {
      // If table previously contained mock sample data, start fresh with the user's real uploaded photo!
      const baseList = isSampleDataLoaded ? [] : parsedTableItems;
      isSampleDataLoaded = false;

      const { merged, replacedCount, replacedCodes } = mergeAndDeduplicateTableItems(baseList, totalNewItems);
      parsedTableItems = merged;
      renderParsedTable(parsedTableItems);
      updateSelectedCount();

      const allReplaced = Array.from(new Set([...totalReplacedCodes, ...replacedCodes]));
      if (allReplaced.length > 0) {
        showTableDedupAlert(`🎉 Đã nạp thành công! Hệ thống đã tự động phát hiện và xóa ${allReplaced.length} máy cũ bị trùng mã (#${allReplaced.join(', #')}), thay thế bằng thông tin mã mới nhất!`, 'success');
      } else {
        const countDesc = totalNewItems.length === 1 ? '1 máy đơn lẻ' : `${totalNewItems.length} máy`;
        showTableDedupAlert(`✓ Đã bóc tách thành công ${countDesc} từ ảnh vừa nạp.`, 'success');
      }
    } else {
      alert('Không tìm thấy dữ liệu máy trong ảnh: Vui lòng thử lại với ảnh rõ nét hơn.');
    }
  } catch (err) {
    alert('Lỗi xử lý bảng: ' + err.message);
  } finally {
    if (loading) loading.classList.add('hidden');
    if (idle) idle.classList.remove('hidden');
  }
}

function clearTableImage() {
  const fileInput = document.getElementById('tableFileInput');
  if (fileInput) fileInput.value = '';
  const previewBar = document.getElementById('tableImagePreviewBar');
  if (previewBar) previewBar.classList.add('hidden');
  parsedTableItems = [];
  renderParsedTable([]);
  updateSelectedCount();
}

function renderParsedTable(items) {
  const tbody = document.getElementById('parsedTableTbody');
  const emptyState = document.getElementById('tableEmptyState');
  if (!tbody) return;

  if (!items || items.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    document.getElementById('totalTableCount').innerText = '0';
    document.getElementById('selectedTableCount').innerText = '0';
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');
  document.getElementById('totalTableCount').innerText = items.length;

  // Compute consecutive schedule slot labels for display
  const fixedSlots = ['08:30', '11:45', '15:30', '20:00'];
  let slotDate = new Date();
  
  tbody.innerHTML = items.map((item, idx) => {
    // Generate human-friendly slot text
    const slotIdx = idx % 4;
    const dayOffset = Math.floor(idx / 4);
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    const slotLabel = `${fixedSlots[slotIdx]} · ${dateStr}`;

    const specsDisplay = item.cpu ? `${item.cpu} · ${item.ram} · ${item.ssd}` : (item.rawSpecs || 'Đang cập nhật cấu hình');

    return `
      <tr class="hover:bg-[#F8FAFC] transition-colors border-b border-[#E2E8F0]">
        <td class="p-3 text-center">
          <input type="checkbox"
                 class="item-checkbox w-4 h-4 accent-[#2563EB] rounded cursor-pointer"
                 data-index="${idx}"
                 ${item.selected ? 'checked' : ''}
                 onchange="toggleRowSelection(${idx}, this.checked)" />
        </td>
        <td class="p-3">
          <span class="vg-pill font-mono-num">#${escapeHtml(item.machineCode)}</span>
        </td>
        <td class="p-3 font-semibold text-[#0F172A]">
          ${escapeHtml(item.machineName)}
        </td>
        <td class="p-3 text-[#334155]">
          <div>${escapeHtml(specsDisplay)}</div>
          ${item.screen ? `<div class="text-xs text-[#475569] font-mono-num mt-0.5">${escapeHtml(item.screen)}</div>` : ''}
        </td>
        <td class="p-3 text-center">
          ${item.isTouch ?
            `<span class="vg-pill vg-pill-success">Cảm ứng</span>` :
            `<span class="vg-pill">Không</span>`
          }
        </td>
        <td class="p-3">
          <input type="text"
                 class="vg-input py-1 px-2 text-xs font-semibold w-28 text-[#065F46]"
                 value="${escapeHtml(item.price || '')}"
                 placeholder="VD: 5.5 triệu"
                 onchange="updateItemPrice(${idx}, this.value)" />
        </td>
        <td class="p-3">
          <span class="vg-pill vg-pill-primary font-mono-num">
            ${escapeHtml(slotLabel)}
          </span>
        </td>
        <td class="p-3 text-center">
          <button onclick="previewPostItem(${idx})" class="vg-btn vg-btn-secondary vg-btn-sm" title="Xem trước bài viết hoàn chỉnh">
            Xem bài
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function toggleRowSelection(index, checked) {
  if (parsedTableItems[index]) {
    parsedTableItems[index].selected = checked;
  }
  updateSelectedCount();
}

function toggleSelectAllTableRows(checked) {
  parsedTableItems.forEach(item => {
    item.selected = checked;
  });
  const checkboxes = document.querySelectorAll('.item-checkbox');
  checkboxes.forEach(cb => cb.checked = checked);
  updateSelectedCount();
}

function updateItemPrice(index, newPrice) {
  if (parsedTableItems[index]) {
    parsedTableItems[index].price = newPrice;
    // Update the price in post content
    if (parsedTableItems[index].postContent) {
      parsedTableItems[index].postContent = parsedTableItems[index].postContent.replace(
        /GIÁ ƯU ĐÃI HÔM NAY: .*/,
        `GIÁ ƯU ĐÃI HÔM NAY: ${newPrice} (Giá công khai - Bao giá toàn quốc!)`
      );
    }
  }
}

function updateSelectedCount() {
  const selectedCount = parsedTableItems.filter(i => i.selected).length;
  const countEl = document.getElementById('selectedTableCount');
  const btn = document.getElementById('batchScheduleBtn');
  const selectAll = document.getElementById('selectAllCheckbox');

  if (countEl) countEl.innerText = selectedCount;

  if (selectAll) {
    selectAll.checked = selectedCount > 0 && selectedCount === parsedTableItems.length;
  }

  if (btn) {
    if (selectedCount === 0) {
      btn.disabled = true;
      btn.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      btn.disabled = false;
      btn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }
}

function previewPostItem(index) {
  const item = parsedTableItems[index];
  if (!item) return;

  const modal = document.getElementById('postPreviewModal');
  const title = document.getElementById('previewModalTitle');
  const meta = document.getElementById('previewModalMeta');
  const mediaContainer = document.getElementById('previewModalMedia');
  const content = document.getElementById('previewModalContent');
  const extraActions = document.getElementById('previewModalExtraActions');

  if (title) title.innerText = `Bài đăng Facebook · Mã #${item.machineCode || 'N/A'}: ${item.machineName || ''}`;

  if (meta) {
    meta.innerHTML = `
      <span class="vg-pill font-mono-num">#${escapeHtml(item.machineCode)}</span>
      ${item.price ? `<span class="vg-pill vg-pill-success">${escapeHtml(item.price)}</span>` : ''}
      <span class="vg-pill vg-pill-primary">Bản xem trước AI</span>
    `;
    meta.classList.remove('hidden');
  }

  if (mediaContainer) {
    mediaContainer.innerHTML = '';
    mediaContainer.classList.add('hidden');
  }

  if (content) content.innerText = item.postContent || 'Chưa có nội dung.';

  if (extraActions) {
    extraActions.innerHTML = `
      <button onclick="closePostPreviewModal()" class="vg-btn vg-btn-secondary vg-btn-sm">
        Đóng lại
      </button>
    `;
  }

  if (modal) modal.classList.remove('hidden');
}

function viewQueuedPostContent(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) {
    alert('Không tìm thấy thông tin bài đăng!');
    return;
  }

  const modal = document.getElementById('postPreviewModal');
  const title = document.getElementById('previewModalTitle');
  const meta = document.getElementById('previewModalMeta');
  const mediaContainer = document.getElementById('previewModalMedia');
  const content = document.getElementById('previewModalContent');
  const extraActions = document.getElementById('previewModalExtraActions');

  const scheduledDate = post.scheduledTime
    ? new Date(post.scheduledTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'Chưa đặt lịch';
  const mFiles = post.mediaFiles || [];
  const vCount = mFiles.filter(isVideoFile).length;
  const pCount = mFiles.length - vCount;

  if (title) {
    title.innerText = `Mã #${post.machineCode || 'N/A'}: ${post.machineName || 'Laptop'}`;
  }

  if (meta) {
    meta.innerHTML = `
      <span class="vg-pill font-mono-num">#${escapeHtml(post.machineCode)}</span>
      ${post.price ? `<span class="vg-pill vg-pill-success">${escapeHtml(post.price)}</span>` : ''}
      <span class="vg-pill font-mono-num">${escapeHtml(scheduledDate)}</span>
      <span class="vg-pill vg-pill-primary">${vCount > 0 ? `${vCount} video · ` : ''}${pCount} ảnh</span>
      ${post.status === 'queued' ? `<span class="vg-pill vg-pill-success">Trong hàng đợi</span>` : ''}
      ${post.status === 'pending_media' ? `<span class="vg-pill vg-pill-warning">Chờ media</span>` : ''}
      ${post.status === 'posted' ? `<span class="vg-pill vg-pill-success">Đã đăng Facebook</span>` : ''}
      ${post.status === 'failed' ? `<span class="vg-pill vg-pill-danger">Đăng thất bại</span>` : ''}
    `;
    meta.classList.remove('hidden');
  }

  if (mediaContainer) {
    if (mFiles.length > 0) {
      mediaContainer.innerHTML = `
        <div class="text-xs font-semibold text-[#475569] mb-1.5">Ảnh / Video đính kèm (${mFiles.length})</div>
        <div class="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
          ${mFiles.map((m, idx) => {
            const isVid = isVideoFile(m);
            return `
              <div class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border border-[#E2E8F0] bg-[#0F172A] shrink-0">
                ${isVid
                  ? `<video src="${m.url}" class="w-full h-full object-cover" muted preload="metadata"></video><span class="absolute inset-0 flex items-center justify-center bg-[#0F172A]/45 text-white text-[11px] font-semibold">VIDEO</span>`
                  : `<a href="${m.url}" target="_blank" title="Mở ảnh gốc HD"><img src="${m.url}" class="w-full h-full object-cover"></a>`
                }
                <span class="absolute top-1 right-1 bg-[#0F172A]/80 text-white text-[10px] px-1.5 rounded font-mono-num">#${idx + 1}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
      mediaContainer.classList.remove('hidden');
    } else {
      mediaContainer.innerHTML = `
        <div class="p-3 bg-[#FFFBEB] border border-[#FDE68A] rounded-lg text-xs text-[#92400E] flex items-center justify-between gap-2">
          <span>Chưa có ảnh/video đính kèm cho máy này.</span>
          <a href="/quick-upload?id=${post.id}" target="_blank" class="vg-btn vg-btn-soft-primary vg-btn-sm shrink-0">Nạp ảnh ngay</a>
        </div>
      `;
      mediaContainer.classList.remove('hidden');
    }
  }

  if (content) {
    content.innerText = post.content || 'Chưa có nội dung bài đăng.';
  }

  if (extraActions) {
    extraActions.innerHTML = `
      <a href="/quick-upload?id=${post.id}" target="_blank" class="vg-btn vg-btn-secondary vg-btn-sm">
        Media (${mFiles.length})
      </a>
      ${post.status === 'queued' || post.status === 'pending_media' ? `
        <button onclick="publishPostNow('${post.id}', 'both'); closePostPreviewModal();" class="vg-btn vg-btn-primary vg-btn-sm" title="Đăng lên cả Fanpage và Facebook Cá Nhân">
          Đăng ngay (Fanpage + Cá nhân)
        </button>
      ` : ''}
      ${post.fbPostUrl ? `
        <a href="${post.fbPostUrl}" target="_blank" class="vg-btn vg-btn-soft-primary vg-btn-sm">
          Xem trên FB ↗
        </a>
      ` : ''}
      <button onclick="closePostPreviewModal()" class="vg-btn vg-btn-secondary vg-btn-sm">
        Đóng lại
      </button>
    `;
  }

  if (modal) {
    modal.classList.remove('hidden');
    const scrollContainer = modal.querySelector('.overflow-y-auto');
    if (scrollContainer) scrollContainer.scrollTop = 0;
  }
}

// D1: Alias openPostPreviewModal to viewQueuedPostContent for Cockpit compatibility
function openPostPreviewModal(postId) {
  return viewQueuedPostContent(postId);
}
window.openPostPreviewModal = viewQueuedPostContent;

function closePostPreviewModal() {
  const modal = document.getElementById('postPreviewModal');
  if (modal) modal.classList.add('hidden');
}

function copyPreviewModalContent() {
  const content = document.getElementById('previewModalContent')?.innerText;
  if (!content) return;
  copyTextToClipboard(content, '📋 Đã sao chép nội dung bài đăng!');
}

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePostPreviewModal();
  }
});

async function submitBatchSchedule() {
  const selectedItems = parsedTableItems.filter(i => i.selected);
  if (selectedItems.length === 0) {
    alert('Vui lòng chọn ít nhất 1 máy để lên lịch!');
    return;
  }

  if (!confirm(`Bạn có chắc chắn muốn lên lịch tự động cho ${selectedItems.length} máy vào hàng đợi?\n\n• Các máy sẽ được xếp lần lượt vào các khung giờ vàng (08:30, 11:45, 15:30, 20:00).\n• Trước mỗi bài đăng 20 phút, hệ thống sẽ gửi email tới ${appSettings.notificationEmail || 'bạn'} kèm link nạp ảnh 1-chạm.\n• Nếu tới giờ mà chưa nạp ảnh, bài đăng sẽ được tự động bỏ qua để bảo vệ Fanpage.`)) {
    return;
  }

  const btn = document.getElementById('batchScheduleBtn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span>⏳ Đang lên lịch hàng loạt...</span>';

  try {
    const res = await fetch('/api/batch-schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: selectedItems })
    });
    const result = await res.json();

    if (result.success) {
      alert(`🎉 Thành công! ${result.message}\n\nĐang chuyển sang tab Hàng đợi lên lịch để theo dõi.`);
      await loadPosts();
      switchTab('queue');
    } else {
      alert('❌ Lỗi lên lịch: ' + (result.error || 'Không xác định'));
    }
  } catch (err) {
    alert('❌ Lỗi kết nối máy chủ: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

// ======================== PWA & SERVICE WORKER LOGIC ========================

let deferredPwaPrompt = null;

// Register Service Worker for offline shell and lightning fast caching
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js?v=20261106_v15_cockpit_slide0')
      .then(reg => {
        reg.update(); // Immediately check for SW script updates
        console.log('✅ ServiceWorker registered and updated:', reg.scope);
      })
      .catch(err => {
        console.warn('⚠️ ServiceWorker registration failed:', err);
      });
  });

  // Reload page once when a new service worker takes control so user sees updates immediately
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Capture Android / Chrome beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPwaPrompt = e;
  
  // Show direct 1-click install button inside modal
  const nativeBox = document.getElementById('androidNativeInstallBox');
  if (nativeBox) {
    nativeBox.classList.remove('hidden');
  }

  // Highlight header button
  const installBtn = document.getElementById('pwaInstallHeaderBtn');
  if (installBtn) {
    installBtn.classList.add('animate-pulse');
  }
});

window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA successfully installed on device!');
  deferredPwaPrompt = null;
  const nativeBox = document.getElementById('androidNativeInstallBox');
  if (nativeBox) nativeBox.classList.add('hidden');
  alert('🎉 Đã cài đặt Laptop Vương Gia App thành công! Biểu tượng đã xuất hiện trên màn hình chính của bạn.');
});

function showPwaInstallModal() {
  const modal = document.getElementById('pwaInstallModal');
  if (modal) modal.classList.remove('hidden');
}

function closePwaInstallModal() {
  const modal = document.getElementById('pwaInstallModal');
  if (modal) modal.classList.add('hidden');
}

async function triggerPwaPrompt() {
  if (!deferredPwaPrompt) {
    alert('Vui lòng làm theo hướng dẫn các bước trên màn hình để thêm ứng dụng vào Màn hình chính!');
    return;
  }
  deferredPwaPrompt.prompt();
  const choiceResult = await deferredPwaPrompt.userChoice;
  console.log('PWA prompt user choice:', choiceResult.outcome);
  deferredPwaPrompt = null;
  closePwaInstallModal();
}

// ========================================================
// DATA POST (KHO MODEL MẪU & TUẦN HOÀN) CONTROLLER
// ========================================================

/**
 * Setup Event Listeners for Instant Search & Smart Match
 */
function setupDataPostEventListeners() {
  // 1. Instant Search Debounce 150ms
  const searchInput = document.getElementById('dataPostSearchInput');
  const clearSearchBtn = document.getElementById('dataPostClearSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value;
      if (clearSearchBtn) {
        if (query.trim()) clearSearchBtn.classList.remove('hidden');
        else clearSearchBtn.classList.add('hidden');
      }

      clearTimeout(dataPostSearchDebounceTimer);
      dataPostSearchDebounceTimer = setTimeout(() => {
        dataPostFilters.search = query;
        fetchModelTemplates(false);
      }, 150);
    });
  }

  // 2. Smart Match in AI Studio on rawTextInput
  const rawTextInput = document.getElementById('rawTextInput');
  if (rawTextInput) {
    const runSmartMatchCheck = (text) => {
      clearTimeout(smartMatchDebounceTimer);
      if (!text || text.length < 10) {
        hideSmartMatchBanner();
        return;
      }

      smartMatchDebounceTimer = setTimeout(async () => {
        try {
          const res = await fetch('/api/data-post/smart-match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw_text: text })
          });
          const json = await res.json();
          if (json.success && json.matched && json.template) {
            currentSmartMatchTemplate = json.template;
            showSmartMatchBanner(json.template);
          } else {
            hideSmartMatchBanner();
          }
        } catch (err) {
          hideSmartMatchBanner();
        }
      }, 200);
    };

    rawTextInput.addEventListener('input', (e) => {
      runSmartMatchCheck(e.target.value.trim());
    });

    rawTextInput.addEventListener('paste', () => {
      setTimeout(() => {
        runSmartMatchCheck(rawTextInput.value.trim());
      }, 50);
    });
  }
}

/**
 * Fetch Model Templates with current filters
 */
async function fetchModelTemplates(showLoading = true) {
  const container = document.getElementById('modelTemplatesContainer');
  const loadingState = document.getElementById('dataPostLoadingState');
  const emptyState = document.getElementById('dataPostEmptyState');

  if (showLoading && loadingState) loadingState.classList.remove('hidden');
  if (emptyState) emptyState.classList.add('hidden');

  try {
    const params = new URLSearchParams();
    if (dataPostFilters.brand && dataPostFilters.brand !== 'all') {
      params.append('brand', dataPostFilters.brand);
    }
    if (dataPostFilters.price_range && dataPostFilters.price_range !== 'all') {
      params.append('price_range', dataPostFilters.price_range);
    }
    if (dataPostFilters.status && dataPostFilters.status !== 'all') {
      params.append('status', dataPostFilters.status);
    }
    if (dataPostFilters.search && dataPostFilters.search.trim()) {
      params.append('search', dataPostFilters.search.trim());
    }

    const url = `/api/data-post/templates${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.success && (json.data || json.templates)) {
      modelTemplatesList = json.data || json.templates;
    } else {
      modelTemplatesList = [];
    }

    // Sort templates
    sortModelTemplates(modelTemplatesList, dataPostFilters.sort);

    // Update Badges & Counters
    updateDataPostCounters(modelTemplatesList);

    // Render cards
    renderModelCards(modelTemplatesList);

  } catch (err) {
    console.error('Error fetching model templates:', err);
    if (container) {
      container.innerHTML = `
        <div class="col-span-full vg-surface p-8 text-center space-y-2 border-[#FECACA] bg-[#FEF2F2]">
          <div class="text-sm font-bold text-[#991B1B]">Lỗi kết nối khi tải danh sách mẫu máy</div>
          <p class="text-xs text-[#475569]">${escapeHtml(err.message)}</p>
          <button onclick="fetchModelTemplates()" class="mt-2 vg-btn vg-btn-secondary vg-btn-sm">
            Thử lại
          </button>
        </div>`;
    }
  } finally {
    if (loadingState) loadingState.classList.add('hidden');
  }
}

/**
 * Sort Model Templates
 */
function sortModelTemplates(list, sortKey) {
  if (!Array.isArray(list)) return;
  switch (sortKey) {
    case 'most_posted':
      list.sort((a, b) => (b.post_count || 0) - (a.post_count || 0));
      break;
    case 'last_posted':
      list.sort((a, b) => new Date(b.last_posted_at || 0) - new Date(a.last_posted_at || 0));
      break;
    case 'price_asc':
      list.sort((a, b) => (a.price_min || 0) - (b.price_min || 0));
      break;
    case 'price_desc':
      list.sort((a, b) => (b.price_min || b.price_max || 0) - (a.price_min || a.price_max || 0));
      break;
    case 'newest':
    default:
      list.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
      break;
  }
}

/**
 * Update UI counters for Data Post
 */
function updateDataPostCounters(list) {
  const total = list.length;
  const activeCount = list.filter(t => (t.status || 'active') === 'active').length;
  let totalPhotos = 0;
  list.forEach(t => {
    if (Array.isArray(t.media_files)) totalPhotos += t.media_files.length;
  });

  const badgeNav = document.getElementById('modelTemplateCountBadge');
  if (badgeNav) badgeNav.innerText = total;

  const statModels = document.getElementById('statTotalModels');
  if (statModels) statModels.innerText = total;

  const statActive = document.getElementById('statActiveCircular');
  if (statActive) statActive.innerText = activeCount;

  const statPhotos = document.getElementById('statTotalHdPhotos');
  if (statPhotos) statPhotos.innerText = totalPhotos;

  const mobileBadge = document.getElementById('mobileDataPostBadge');
  if (mobileBadge) {
    mobileBadge.innerText = total;
    if (total > 0) mobileBadge.classList.remove('hidden');
    else mobileBadge.classList.add('hidden');
  }
}

/**
 * Render Model Cards into #modelTemplatesContainer
 */
function renderModelCards(templates) {
  const container = document.getElementById('modelTemplatesContainer');
  const emptyState = document.getElementById('dataPostEmptyState');

  if (!container) return;
  container.innerHTML = '';

  if (!templates || templates.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  templates.forEach(t => {
    const card = document.createElement('div');
    card.className = 'vg-surface-interactive p-4 sm:p-5 flex flex-col justify-between gap-4';

    const brand = t.brand || 'Laptop';
    const isCircularActive = (t.status || 'active') === 'active';
    const postCount = t.post_count || 0;
    const lastPosted = t.last_posted_at ? new Date(t.last_posted_at).toLocaleDateString('vi-VN') : 'Chưa đăng';
    const mediaFiles = Array.isArray(t.media_files) ? t.media_files : [];

    // Mini Gallery HTML (up to 4 clean thumbnails without dark outer frames)
    let galleryHtml = '';
    if (mediaFiles.length > 0) {
      const thumbs = mediaFiles.slice(0, 4).map((f, idx) => {
        const isMore = idx === 3 && mediaFiles.length > 4;
        const moreBadge = isMore ? `<div class="gallery-more-overlay">+${mediaFiles.length - 3} ảnh</div>` : '';
        const isVideo = isVideoFile(f);
        const videoBadge = isVideo ? `<span class="absolute top-1 left-1 bg-[#DC2626] text-white text-[10px] font-semibold px-1.5 rounded z-10">Video</span>` : '';

        return `
          <div class="gallery-thumb-box" onclick="openMediaManagerModal('${t.id}')" title="Mở kho ảnh HD">
            <img src="${escapeHtml(f.url)}" alt="${escapeHtml(t.model_name)}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/icons/icon.svg';" />
            ${videoBadge}
            ${moreBadge}
          </div>
        `;
      }).join('');

      galleryHtml = `<div class="grid grid-cols-4 gap-2">${thumbs}</div>`;
    } else {
      galleryHtml = `
        <div onclick="openMediaManagerModal('${t.id}')" class="border border-dashed border-[#CBD5E1] bg-[#F8FAFC] rounded-lg p-3.5 text-center cursor-pointer hover:border-[#2563EB] hover:bg-[#EFF6FF]/40 text-xs font-medium text-[#475569] transition">
          Chưa có ảnh · Bấm để nạp ảnh HD
        </div>
      `;
    }

    // Concise 1-line specs summary (replaces 4 nested black boxes)
    const specsItems = [];
    if (t.cpu) specsItems.push(t.cpu);
    if (t.ram) specsItems.push(t.ram);
    if (t.ssd) specsItems.push(t.ssd);
    if (t.screen) specsItems.push(t.screen);
    if (t.is_touchscreen) specsItems.push('Cảm ứng');
    const specsLine = specsItems.join(' · ');

    const priceText = t.price_display || (t.price_min ? `${(t.price_min / 1000000).toFixed(1)} triệu` : 'Liên hệ');

    card.innerHTML = `
      <div class="space-y-2.5">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-xs font-bold text-[#475569] uppercase tracking-wide">${escapeHtml(brand)}</span>
            <span class="text-[#CBD5E1]">·</span>
            ${isCircularActive
              ? `<span class="inline-flex items-center gap-1.5 text-xs font-semibold text-[#065F46]"><span class="w-1.5 h-1.5 rounded-full bg-[#059669]"></span>Tuần hoàn</span>`
              : `<span class="text-xs font-medium text-[#64748B]">Tạm dừng</span>`
            }
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button onclick="openModelTemplateModal('${t.id}')" title="Chỉnh sửa mẫu" class="vg-btn vg-btn-ghost w-7 h-7 p-0" aria-label="Chỉnh sửa">
              <svg class="w-4 h-4 text-[#475569]" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button onclick="deleteModelTemplate('${t.id}')" title="Xóa mẫu" class="vg-btn vg-btn-danger-ghost w-7 h-7 p-0" aria-label="Xóa">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>

        <div class="space-y-1">
          <h3 class="font-bold text-base text-[#0F172A] leading-snug line-clamp-2">${escapeHtml(t.model_name)}</h3>
          <div class="font-mono-num font-bold text-sm text-[#059669]">${escapeHtml(priceText)}</div>
        </div>

        ${specsLine ? `<p class="text-xs text-[#475569] leading-relaxed line-clamp-2">${escapeHtml(specsLine)}</p>` : ''}
      </div>

      <div>
        ${galleryHtml}
      </div>

      <div class="space-y-2.5 pt-3 border-t border-[#E2E8F0]">
        <div class="flex items-center justify-between text-xs text-[#475569]">
          <span>Đã đăng <strong class="font-mono-num text-[#0F172A]">${postCount}</strong> lần</span>
          <span>Gần nhất: <strong class="font-mono-num text-[#0F172A]">${escapeHtml(lastPosted)}</strong></span>
        </div>

        <div class="space-y-2">
          <button onclick="createPostFromTemplate('${t.id}')" class="vg-btn vg-btn-primary vg-btn-sm w-full">
            Tạo bài mới từ mẫu
          </button>
          <div class="flex gap-2">
            <button onclick="enqueueCircularPost('${t.id}')" class="vg-btn vg-btn-secondary vg-btn-sm flex-1">
              Tuần hoàn
            </button>
            <button onclick="openMediaManagerModal('${t.id}')" class="vg-btn vg-btn-secondary vg-btn-sm flex-1">
              Kho ảnh (${mediaFiles.length})
            </button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

/**
 * Action: Create New Post from Template in AI Studio
 */
async function createPostFromTemplate(templateId) {
  let template = modelTemplatesList.find(t => t.id === templateId);
  if (!template) {
    try {
      const res = await fetch(`/api/data-post/templates/${templateId}`);
      const json = await res.json();
      template = json.data || json.template;
    } catch (e) {
      console.warn('Fetch template fallback failed:', e);
    }
  }
  if (!template) {
    alert('Không tìm thấy thông tin template!');
    return;
  }

  // 1. Switch to AI Studio Tab
  switchTab('studio');

  // 2. Set fresh machine code
  const brandPrefix = (template.brand || 'LAPTOP').replace(/[^a-zA-Z]/g, '').slice(0, 3).toUpperCase();
  const randNum = Math.floor(100 + Math.random() * 900);
  const machineCodeInput = document.getElementById('machineCodeInput');
  if (machineCodeInput) {
    machineCodeInput.value = `${brandPrefix}-${randNum}`;
  }

  // 3. Set custom price
  const customPriceInput = document.getElementById('customPriceInput');
  if (customPriceInput) {
    customPriceInput.value = template.price_display || (template.price_min ? `${(template.price_min / 1000000).toFixed(1)} triệu` : '');
  }

  // 4. Set raw text from base prompt or standard config
  const rawTextInput = document.getElementById('rawTextInput');
  if (rawTextInput) {
    const specsText = [
      template.model_name,
      template.cpu ? `CPU: ${template.cpu}` : '',
      template.ram ? `RAM: ${template.ram}` : '',
      template.ssd ? `SSD: ${template.ssd}` : '',
      template.screen ? `Màn hình: ${template.screen}` : ''
    ].filter(Boolean).join(' · ');

    rawTextInput.value = template.base_ai_prompt || `${template.brand} ${template.model_name}\n${specsText}\nGiá niêm yết: ${customPriceInput?.value || ''}`;
  }

  // 5. Load template's HD images into currentMediaFiles
  if (Array.isArray(template.media_files) && template.media_files.length > 0) {
    currentMediaFiles = template.media_files.map(f => ({
      url: f.url,
      filename: f.filename || (f.url ? f.url.split('/').pop() : 'photo.jpg'),
      originalname: f.filename || f.originalname || 'photo.jpg',
      mimetype: f.mimetype || 'image/jpeg',
      storage: f.storage || 'supabase'
    }));
    renderMediaPreviews();
    const mediaCountText = document.getElementById('mediaCountText');
    if (mediaCountText) {
      mediaCountText.innerText = formatMediaCountText(currentMediaFiles);
    }
  }

  // 6. Automatically generate AI content
  generateAiContent();

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Action: Enqueue Circular Post
 */
async function enqueueCircularPost(templateId) {
  try {
    const res = await fetch('/api/data-post/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: templateId,
        priority: 1,
        rewrite_style: 'featured_review'
      })
    });
    const json = await res.json();
    if (json.success) {
      alert(`🔄 Đã đưa model vào hàng đợi tuần hoàn thành công!\nMã hàng đợi: ${json.queue_id || 'OK'}`);
      fetchCircularQueue();
    } else {
      alert(`❌ Lỗi khi đưa vào hàng đợi: ${json.error || 'Vui lòng thử lại'}`);
    }
  } catch (err) {
    alert(`❌ Lỗi kết nối: ${err.message}`);
  }
}

/**
 * Filter handlers
 */
function setBrandFilter(brand) {
  dataPostFilters.brand = brand;
  document.querySelectorAll('.brand-filter-chip').forEach(btn => {
    if (btn.dataset.brand === brand) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  fetchModelTemplates();
}

function setPriceFilter(range) {
  dataPostFilters.price_range = range;
  document.querySelectorAll('.price-filter-chip').forEach(btn => {
    if (btn.dataset.price === range) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  fetchModelTemplates();
}

function setStatusFilter(status) {
  dataPostFilters.status = status;
  document.querySelectorAll('.status-filter-chip').forEach(btn => {
    if (btn.dataset.status === status) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  fetchModelTemplates();
}

function onDataPostSortChange(sortKey) {
  dataPostFilters.sort = sortKey;
  sortModelTemplates(modelTemplatesList, sortKey);
  renderModelCards(modelTemplatesList);
}

function clearDataPostSearch() {
  const input = document.getElementById('dataPostSearchInput');
  const clearBtn = document.getElementById('dataPostClearSearchBtn');
  if (input) input.value = '';
  if (clearBtn) clearBtn.classList.add('hidden');
  dataPostFilters.search = '';
  fetchModelTemplates();
}

function resetDataPostFilters() {
  dataPostFilters = { brand: 'all', price_range: 'all', status: 'all', search: '', sort: 'newest' };
  const searchInput = document.getElementById('dataPostSearchInput');
  if (searchInput) searchInput.value = '';
  const sortSelect = document.getElementById('dataPostSortSelect');
  if (sortSelect) sortSelect.value = 'newest';

  setBrandFilter('all');
  setPriceFilter('all');
  setStatusFilter('all');
}

/**
 * Smart Match Media Helpers (AI Studio)
 */
function showSmartMatchBanner(template) {
  const banner = document.getElementById('smartMatchBanner');
  const modelNameEl = document.getElementById('smartMatchModelName');
  const photoCountEl = document.getElementById('smartMatchPhotoCount');

  if (modelNameEl) modelNameEl.innerText = template.model_name || '';
  if (photoCountEl) photoCountEl.innerText = (template.media_files || []).length;
  if (banner) banner.classList.remove('hidden');
}

function hideSmartMatchBanner() {
  const banner = document.getElementById('smartMatchBanner');
  if (banner) banner.classList.add('hidden');
  currentSmartMatchTemplate = null;
}

function applySmartMatchMedia() {
  if (!currentSmartMatchTemplate) return;
  const files = currentSmartMatchTemplate.media_files || [];
  if (files.length === 0) {
    alert('Model này chưa có album ảnh HD trên Supabase Cloud.');
    return;
  }

  // Load template HD images into currentMediaFiles, strictly preserving user custom machine code & price
  currentMediaFiles = files.map(f => ({
    url: f.url,
    filename: f.filename || (f.url ? f.url.split('/').pop() : 'photo.jpg'),
    originalname: f.filename || f.originalname || 'photo.jpg',
    mimetype: f.mimetype || 'image/jpeg',
    storage: f.storage || 'supabase'
  }));

  renderMediaPreviews();
  updateFacebookPreview();

  const mediaCountText = document.getElementById('mediaCountText');
  if (mediaCountText) {
    mediaCountText.innerText = formatMediaCountText(currentMediaFiles);
  }

  hideSmartMatchBanner();
  alert(`⚡ Đã nạp thành công ${files.length} ảnh HD từ kho DATA POST vào bài viết!`);
}

// Global aliases for Smart Match handlers
window.applySmartMatchMedia = applySmartMatchMedia;
window.applySmartMatchPhotos = applySmartMatchMedia;
window.dismissSmartMatchBanner = hideSmartMatchBanner;
window.hideSmartMatchBanner = hideSmartMatchBanner;

/**
 * Modal 1: CRUD Model Template Modal
 */
function openModelTemplateModal(templateId = null) {
  const modal = document.getElementById('modelTemplateModal');
  const title = document.getElementById('modelTemplateModalTitle');
  const form = document.getElementById('modelTemplateForm');
  const preview = document.getElementById('templateFormMediaPreview');

  if (form) form.reset();
  if (preview) preview.innerHTML = '';
  document.getElementById('templateFormId').value = '';

  if (templateId) {
    if (title) title.innerText = 'Chỉnh Sửa Model Template';
    const t = modelTemplatesList.find(x => x.id === templateId);
    if (t) {
      document.getElementById('templateFormId').value = t.id;
      document.getElementById('templateFormBrand').value = t.brand || 'Dell';
      document.getElementById('templateFormModelName').value = t.model_name || '';
      document.getElementById('templateFormCpu').value = t.cpu || '';
      document.getElementById('templateFormRam').value = t.ram || '';
      document.getElementById('templateFormSsd').value = t.ssd || '';
      document.getElementById('templateFormScreen').value = t.screen || '';
      document.getElementById('templateFormTouch').checked = !!t.is_touchscreen;
      document.getElementById('templateFormPriceMin').value = t.price_min || '';
      document.getElementById('templateFormPriceMax').value = t.price_max || '';
      document.getElementById('templateFormPriceDisplay').value = t.price_display || '';
      document.getElementById('templateFormStatus').value = t.status || 'active';
      document.getElementById('templateFormBasePrompt').value = t.base_ai_prompt || '';

      const urls = (t.media_files || []).map(f => f.url).join('\n');
      document.getElementById('templateFormMediaUrls').value = urls;
      renderTemplateFormMediaPreview(t.media_files || []);
    }
  } else {
    if (title) title.innerText = 'Thêm Model Template Mới';
  }

  if (modal) modal.classList.remove('hidden');
}

function closeModelTemplateModal() {
  const modal = document.getElementById('modelTemplateModal');
  if (modal) modal.classList.add('hidden');
}

function renderTemplateFormMediaPreview(files) {
  const preview = document.getElementById('templateFormMediaPreview');
  if (!preview) return;
  preview.innerHTML = '';
  files.forEach(f => {
    const box = document.createElement('div');
    box.className = 'w-14 h-14 rounded-lg border border-[#E2E8F0] overflow-hidden shrink-0 bg-[#F1F5F9] relative';
    box.innerHTML = `<img src="${f.url}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/icons/icon.svg';" />`;
    preview.appendChild(box);
  });
}

async function handleTemplateFormFileUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const statusEl = document.getElementById('templateFormUploadStatus');
  if (statusEl) statusEl.innerText = 'Đang tải ảnh lên Supabase...';

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const res = await fetch('/api/upload-media', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (result.success && result.files) {
      const urlsArea = document.getElementById('templateFormMediaUrls');
      const existingUrls = urlsArea.value.trim() ? urlsArea.value.trim().split('\n') : [];
      const newUrls = result.files.map(f => f.url);
      const combined = [...existingUrls, ...newUrls];
      urlsArea.value = combined.join('\n');
      renderTemplateFormMediaPreview(combined.map(u => ({ url: u })));
      if (statusEl) statusEl.innerText = `Đã tải lên ${result.files.length} ảnh thành công!`;
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = `Lỗi: ${err.message}`;
  }
}

async function handleModelTemplateSubmit(event) {
  event.preventDefault();
  const id = document.getElementById('templateFormId').value;
  const submitBtn = document.getElementById('templateFormSubmitBtn');
  if (submitBtn) submitBtn.disabled = true;

  const mediaUrls = document.getElementById('templateFormMediaUrls').value
    .split('\n')
    .map(u => u.trim())
    .filter(u => u.startsWith('http'));

  const media_files = mediaUrls.map(u => ({
    url: u,
    filename: u.split('/').pop() || 'photo.jpg',
    storage: 'supabase',
    mimetype: 'image/jpeg'
  }));

  const payload = {
    brand: document.getElementById('templateFormBrand').value,
    model_name: document.getElementById('templateFormModelName').value.trim(),
    cpu: document.getElementById('templateFormCpu').value.trim(),
    ram: document.getElementById('templateFormRam').value.trim(),
    ssd: document.getElementById('templateFormSsd').value.trim(),
    screen: document.getElementById('templateFormScreen').value.trim(),
    is_touchscreen: document.getElementById('templateFormTouch').checked,
    price_min: Number(document.getElementById('templateFormPriceMin').value) || undefined,
    price_max: Number(document.getElementById('templateFormPriceMax').value) || undefined,
    price_display: document.getElementById('templateFormPriceDisplay').value.trim() || undefined,
    status: document.getElementById('templateFormStatus').value,
    base_ai_prompt: document.getElementById('templateFormBasePrompt').value.trim(),
    media_files
  };

  try {
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/data-post/templates/${id}` : '/api/data-post/templates';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();

    if (json.success) {
      alert(json.message || 'Lưu Model Template thành công!');
      closeModelTemplateModal();
      fetchModelTemplates();
    } else {
      alert(`❌ Lỗi: ${json.error || 'Vui lòng kiểm tra lại thông tin.'}`);
    }
  } catch (err) {
    alert(`❌ Lỗi kết nối: ${err.message}`);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function deleteModelTemplate(templateId) {
  const t = modelTemplatesList.find(x => x.id === templateId);
  const name = t ? t.model_name : 'mẫu này';
  if (!confirm(`Bạn có chắc chắn muốn xóa Model Template "${name}" khỏi kho?`)) return;

  try {
    const res = await fetch(`/api/data-post/templates/${templateId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      alert('Đã xóa Model Template thành công!');
      fetchModelTemplates();
    } else {
      alert(`❌ Lỗi xóa template: ${json.error}`);
    }
  } catch (err) {
    alert(`❌ Lỗi: ${err.message}`);
  }
}

/**
 * Modal 2: Media Manager Modal (Supabase HD Storage)
 */
function openMediaManagerModal(templateId) {
  activeMediaTemplateId = templateId;
  const modal = document.getElementById('mediaManagerModal');
  const title = document.getElementById('mediaManagerTitle');
  const template = modelTemplatesList.find(t => t.id === templateId);

  if (title) {
    title.innerText = template ? `Kho Ảnh HD: ${template.model_name}` : 'Kho Ảnh HD Model';
  }

  renderMediaManagerGrid(template ? (template.media_files || []) : []);
  if (modal) modal.classList.remove('hidden');
}

function closeMediaManagerModal() {
  const modal = document.getElementById('mediaManagerModal');
  if (modal) modal.classList.add('hidden');
  activeMediaTemplateId = null;
  fetchModelTemplates(false);
}

function renderMediaManagerGrid(mediaFiles) {
  const grid = document.getElementById('mediaManagerGrid');
  const empty = document.getElementById('mediaManagerEmpty');
  const counter = document.getElementById('mediaManagerCounter');

  if (counter) counter.innerText = `${mediaFiles.length} ảnh HD`;
  if (!grid) return;
  grid.innerHTML = '';

  if (!mediaFiles || mediaFiles.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  mediaFiles.forEach((file, index) => {
    const isVideo = isVideoFile(file);
    const box = document.createElement('div');
    box.className = 'vg-surface p-2 flex flex-col gap-2 relative';

    box.innerHTML = `
      <div class="aspect-square rounded-md overflow-hidden bg-[#0F172A] relative border border-[#E2E8F0]">
        ${isVideo
          ? `<video src="${file.url}" class="w-full h-full object-cover" muted></video><span class="absolute top-1 left-1 bg-[#DC2626] text-white text-[10px] font-semibold px-1.5 rounded">VIDEO</span>`
          : `<img src="${file.url}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/icons/icon.svg';" />`
        }
        <span class="absolute bottom-1 left-1 bg-[#0F172A]/80 text-white text-[10px] font-mono-num px-1.5 rounded">#${index + 1}</span>
      </div>
      <div class="flex items-center justify-between gap-1.5">
        <button onclick="copyTextToClipboard('${escapeHtml(file.url)}', 'Đã sao chép link ảnh công khai!')" class="vg-btn vg-btn-secondary vg-btn-sm flex-1" title="Sao chép link">
          Link
        </button>
        <button onclick="deleteMediaManagerPhoto(${index})" class="vg-btn vg-btn-danger-ghost vg-btn-sm" title="Xóa ảnh này">
          Xóa
        </button>
      </div>
    `;

    grid.appendChild(box);
  });
}

async function addUrlToMediaManager() {
  if (!activeMediaTemplateId) return;
  const input = document.getElementById('mediaManagerAddUrlInput');
  const url = input?.value.trim();
  if (!url || !url.startsWith('http')) {
    alert('Vui lòng nhập đường dẫn URL ảnh hợp lệ (bắt đầu bằng http:// hoặc https://)');
    return;
  }

  const template = modelTemplatesList.find(t => t.id === activeMediaTemplateId);
  if (!template) return;

  const currentFiles = Array.isArray(template.media_files) ? [...template.media_files] : [];
  currentFiles.push({
    url,
    filename: url.split('/').pop() || 'photo.jpg',
    storage: 'supabase',
    mimetype: 'image/jpeg'
  });

  try {
    const res = await fetch(`/api/data-post/templates/${activeMediaTemplateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_files: currentFiles })
    });
    const json = await res.json();
    if (json.success) {
      template.media_files = currentFiles;
      renderMediaManagerGrid(currentFiles);
      if (input) input.value = '';
    } else {
      alert(`❌ Lỗi cập nhật: ${json.error}`);
    }
  } catch (err) {
    alert(`❌ Lỗi: ${err.message}`);
  }
}

async function handleMediaManagerUpload(event) {
  if (!activeMediaTemplateId) return;
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const statusEl = document.getElementById('mediaManagerUploadStatus');
  if (statusEl) {
    statusEl.innerText = `Đang tải ${files.length} ảnh lên Supabase...`;
    statusEl.classList.remove('hidden');
  }

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }

  try {
    const res = await fetch('/api/upload-media', {
      method: 'POST',
      body: formData
    });
    const result = await res.json();
    if (result.success && result.files) {
      const template = modelTemplatesList.find(t => t.id === activeMediaTemplateId);
      if (template) {
        const currentFiles = Array.isArray(template.media_files) ? [...template.media_files] : [];
        const combined = [...currentFiles, ...result.files];
        template.media_files = combined;

        await fetch(`/api/data-post/templates/${activeMediaTemplateId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ media_files: combined })
        });

        renderMediaManagerGrid(combined);
      }
      if (statusEl) statusEl.innerText = `✅ Đã tải lên và lưu ${result.files.length} ảnh vào Supabase thành công!`;
    }
  } catch (err) {
    if (statusEl) statusEl.innerText = `❌ Lỗi: ${err.message}`;
  } finally {
    event.target.value = '';
    setTimeout(() => {
      if (statusEl) statusEl.classList.add('hidden');
    }, 4000);
  }
}

async function deleteMediaManagerPhoto(index) {
  if (!activeMediaTemplateId) return;
  const template = modelTemplatesList.find(t => t.id === activeMediaTemplateId);
  if (!template || !template.media_files) return;

  if (!confirm('Bạn có chắc chắn muốn xóa ảnh này khỏi album HD?')) return;

  const updatedFiles = [...template.media_files];
  updatedFiles.splice(index, 1);

  try {
    const res = await fetch(`/api/data-post/templates/${activeMediaTemplateId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_files: updatedFiles })
    });
    const json = await res.json();
    if (json.success) {
      template.media_files = updatedFiles;
      renderMediaManagerGrid(updatedFiles);
    } else {
      alert(`❌ Lỗi: ${json.error}`);
    }
  } catch (err) {
    alert(`❌ Lỗi: ${err.message}`);
  }
}

/**
 * Modal 3: Circular Queue Modal
 */
function openCircularQueueModal() {
  const modal = document.getElementById('circularQueueModal');
  fetchCircularQueue();
  if (modal) modal.classList.remove('hidden');
}

function closeCircularQueueModal() {
  const modal = document.getElementById('circularQueueModal');
  if (modal) modal.classList.add('hidden');
}

async function fetchCircularQueue() {
  const listContainer = document.getElementById('circularQueueModalList');
  const emptyState = document.getElementById('circularQueueModalEmpty');
  const countText = document.getElementById('circularQueueCountText');

  try {
    const res = await fetch('/api/data-post/queue');
    const json = await res.json();
    const queue = json.data || json.queue || [];

    if (countText) countText.innerText = `${queue.length} bài trong hàng đợi`;

    if (!listContainer) return;
    listContainer.innerHTML = '';

    if (queue.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    queue.forEach(item => {
      const scheduledDate = item.scheduled_time ? new Date(item.scheduled_time).toLocaleString('vi-VN') : 'Sớm nhất';
      const el = document.createElement('div');
      el.className = 'vg-surface p-3.5 flex flex-wrap items-center justify-between gap-3';
      el.innerHTML = `
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-sm text-[#0F172A]">${escapeHtml(item.model_name || item.template_id || 'Mẫu máy')}</span>
            <span class="vg-pill vg-pill-primary font-mono-num">${escapeHtml(item.rewrite_style || 'AI Rewrite')}</span>
          </div>
          <div class="text-xs text-[#475569] mt-1">
            Thời gian dự kiến: <strong class="font-mono-num text-[#0F172A]">${scheduledDate}</strong>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <button onclick="triggerCircularPostNow('${item.id}')" class="vg-btn vg-btn-primary vg-btn-sm">
            Đăng ngay
          </button>
          <button onclick="deleteCircularQueueItem('${item.id}')" class="vg-btn vg-btn-danger-ghost vg-btn-sm" title="Xóa khỏi hàng đợi">
            Xóa
          </button>
        </div>
      `;
      listContainer.appendChild(el);
    });

  } catch (err) {
    console.error('Error fetching circular queue:', err);
  }
}

async function triggerCircularPostNow(queueId) {
  if (!confirm('Bạn có chắc chắn muốn kích hoạt đăng ngay bài tuần hoàn này lên Facebook Fanpage?')) return;
  try {
    const res = await fetch('/api/data-post/queue/trigger-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queue_id: queueId })
    });
    const json = await res.json();
    if (json.success) {
      alert(`✅ Đã xuất bản thành công bài đăng tuần hoàn lên Fanpage!\nLink: ${json.post?.fbPostUrl || 'Đã xuất bản'}`);
      fetchCircularQueue();
      fetchModelTemplates(false);
    } else {
      alert(`❌ Lỗi đăng bài: ${json.error}`);
    }
  } catch (err) {
    alert(`❌ Lỗi: ${err.message}`);
  }
}

async function deleteCircularQueueItem(queueId) {
  if (!confirm('Bạn có chắc chắn muốn xóa bài này khỏi hàng đợi tuần hoàn?')) return;
  try {
    const res = await fetch(`/api/data-post/queue/${queueId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      fetchCircularQueue();
    } else {
      alert(`❌ Lỗi: ${json.error}`);
    }
  } catch (err) {
    alert(`❌ Lỗi: ${err.message}`);
  }
}

// ======================== EXTENSION TWO-WAY GROUP & PERSONAL CONTROL PANEL ========================

function parseAppGroupUrls(raw) {
  return String(raw || '')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => /facebook\.com\/groups\/[^/?#\s]+/i.test(s));
}

function setAppExtMessage(msg, isError = false) {
  const el = document.getElementById('appExtActionMsg');
  if (!el) return;
  el.className = `text-sm font-medium min-h-[20px] ${isError ? 'text-[#DC2626]' : 'text-[#065F46]'}`;
  el.textContent = msg;
}

let lastExtStateSnapshot = null;
let extPollInterval = null;

function onToggleAppShareAllGroups() {
  const cb = document.getElementById('appShareAllGroups');
  const perEl = document.getElementById('appGroupsPerPost');
  if (perEl && cb) perEl.disabled = cb.checked;
}

function populateGroupPostDropdown() {
  const sel = document.getElementById('appGroupPostSelect');
  if (!sel) return;
  const currentVal = sel.value;
  const candidates = (allPosts || []).filter(p => p && p.content && (p.mediaFiles?.length > 0 || p.mediaUrls?.length > 0)).slice(0, 25);

  let opts = '<option value="">Tự lấy bài vừa đăng Cá Nhân / Mới nhất</option>';
  candidates.forEach(p => {
    const code = p.machineCode || p.code || 'MÁY';
    const name = (p.machineName || p.content.split('\n')[0] || '').slice(0, 48);
    const imgCount = (p.mediaFiles || p.mediaUrls || []).length;
    opts += `<option value="${escapeHtml(p.id)}">#${escapeHtml(code)} · ${escapeHtml(name)} (${imgCount} ảnh)</option>`;
  });
  sel.innerHTML = opts;
  if (currentVal && candidates.some(c => c.id === currentVal)) {
    sel.value = currentVal;
  }
  renderSelectedGroupPostPreview();
}

function renderSelectedGroupPostPreview() {
  const sel = document.getElementById('appGroupPostSelect');
  const preview = document.getElementById('appGroupPostPreview');
  if (!preview) return;
  const postId = sel ? sel.value : '';
  if (postId) {
    const p = allPosts.find(item => item.id === postId);
    if (p) {
      const imgs = (p.mediaFiles || p.mediaUrls || []).length;
      const snippet = (p.content || '').split('\n').slice(0, 2).join(' · ');
      preview.innerHTML = `<strong>#${escapeHtml(p.machineCode || 'MÁY')}</strong> (${imgs} ảnh HD): ${escapeHtml(snippet)}`;
      return;
    }
  }
  const lp = lastExtStateSnapshot?.lastPersonalPost;
  if (lp && lp.content) {
    const imgs = (lp.mediaUrls || []).length;
    const snippet = lp.content.split('\n').slice(0, 2).join(' · ');
    preview.innerHTML = `<strong>Bài Cá Nhân gần nhất (#${escapeHtml(lp.machineCode || 'MÁY')}</strong>, ${imgs} ảnh): ${escapeHtml(snippet)}`;
    return;
  }
  preview.textContent = 'Mặc định lấy bài vừa xuất bản gần nhất (kèm link Fanpage & ảnh HD).';
}

function renderGroupShareLogs(logs = []) {
  const container = document.getElementById('appGroupLogsList');
  const countEl = document.getElementById('appGroupLogsCount');
  if (countEl) countEl.textContent = String(logs.length);
  if (!container) return;

  if (!Array.isArray(logs) || logs.length === 0) {
    container.innerHTML = '<div class="py-4 text-[#475569]">Chưa có lịch sử chia sẻ Hội Nhóm nào.</div>';
    return;
  }

  container.innerHTML = logs.map(log => {
    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('vi-VN') : '--:--';
    const slug = (log.groupUrl || '').replace(/https?:\/\/(www\.)?facebook\.com\/groups\//i, '').replace(/\/$/, '');
    let badgeClass = 'vg-pill vg-pill-success';
    let badgeText = 'Đã đăng';
    if (log.status === 'pending_approval') {
      badgeClass = 'vg-pill vg-pill-warning';
      badgeText = 'Chờ duyệt';
    } else if (!log.success) {
      badgeClass = 'vg-pill vg-pill-danger';
      badgeText = log.status === 'skipped_not_member' ? 'Chưa tham gia' : 'Lỗi';
    }

    return `
      <div class="py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="${badgeClass}">${badgeText}</span>
            <span class="font-mono-num font-semibold text-[#0F172A]">#${escapeHtml(log.machineCode || 'MÁY')}</span>
            <a href="${escapeHtml(log.groupUrl)}" target="_blank" class="font-mono-num text-xs text-[#2563EB] hover:underline truncate max-w-xs">${escapeHtml(slug || log.groupUrl)}</a>
            <span class="text-xs text-[#475569] font-mono-num">${timeStr}</span>
          </div>
          ${log.reason ? `<div class="text-xs text-[#475569]">${escapeHtml(log.reason)}</div>` : ''}
        </div>
        ${!log.success ? `
          <div class="flex items-center gap-1.5 shrink-0">
            <button type="button" onclick="retrySingleGroupLog('${escapeHtml(log.id)}')" class="vg-btn vg-btn-secondary vg-btn-sm">Thử lại</button>
            <button type="button" onclick="removeGroupUrlFromApp('${escapeHtml(log.groupUrl)}')" class="vg-btn vg-btn-danger-soft vg-btn-sm">Bỏ nhóm</button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function applyExtensionStateToApp(data) {
  lastExtStateSnapshot = data;
  const badge = document.getElementById('appExtStatusBadge');
  if (badge && data.version) {
    badge.className = 'vg-pill vg-pill-success font-mono-num';
    badge.textContent = `Extension v${data.version} · Đã kết nối`;
  }
  const cockpitBadge = document.getElementById('cockpitExtSummaryBadge');
  const cockpitText = document.getElementById('cockpitExtSummaryText');
  const cfg = data.config || {};
  const setChecked = (id, val) => {
    const el = document.getElementById(id);
    if (el && typeof val === 'boolean') el.checked = val;
  };
  setChecked('appAutoPersonalEnabled', cfg.autoPersonalEnabled !== false);
  setChecked('appAutoFanpageSync', cfg.autoPersonalIncludeFanpage !== false);
  setChecked('appAutoGroupShareEnabled', cfg.autoGroupShareEnabled !== false);
  setChecked('appShareAllGroups', cfg.shareAllGroups === true);

  const perPostEl = document.getElementById('appGroupsPerPost');
  if (perPostEl) {
    if (cfg.groupsPerPost) perPostEl.value = cfg.groupsPerPost;
    perPostEl.disabled = cfg.shareAllGroups === true;
  }

  const delayEl = document.getElementById('appGroupDelaySeconds');
  if (delayEl && typeof cfg.groupDelaySeconds === 'number') delayEl.value = cfg.groupDelaySeconds;

  const urlsEl = document.getElementById('appTargetGroupUrls');
  if (urlsEl && Array.isArray(cfg.targetGroupUrls) && document.activeElement !== urlsEl) {
    urlsEl.value = cfg.targetGroupUrls.join('\n');
  }

  const savedGroupsCount = Array.isArray(cfg.targetGroupUrls) ? cfg.targetGroupUrls.length : 0;
  const countEl = document.getElementById('appGroupCountLabel');
  if (countEl) {
    countEl.textContent = String(savedGroupsCount);
  }

  const queueCount = typeof data.groupQueueCount === 'number' ? data.groupQueueCount : 0;
  const queueInfo = document.getElementById('appGroupQueueInfo');
  if (queueInfo) {
    queueInfo.textContent = `Chờ chia sẻ: ${queueCount} lượt`;
  }

  if (cockpitBadge) {
    if (data.activeGroupJob) {
      cockpitBadge.className = 'vg-pill vg-pill-primary font-mono-num';
      cockpitBadge.textContent = `Đang chia sẻ nhóm (còn ${queueCount})`;
    } else if (data.queuePaused) {
      cockpitBadge.className = 'vg-pill vg-pill-warning';
      cockpitBadge.textContent = 'Hàng đợi nhóm đang tạm dừng';
    } else if (data.version) {
      cockpitBadge.className = 'vg-pill vg-pill-success font-mono-num';
      cockpitBadge.textContent = `Sẵn sàng (v${data.version}) · ${savedGroupsCount} nhóm`;
    }
  }
  if (cockpitText) {
    cockpitText.textContent = data.activeGroupJob
      ? 'Extension đang chạy tuần tự trong cửa sổ phụ.'
      : `Đã lưu ${savedGroupsCount} nhóm mục tiêu · Chờ ${queueCount} lượt.`;
  }

  const progText = document.getElementById('appActiveGroupProgressText');
  if (progText) {
    if (data.queuePaused && data.pauseReason) {
      progText.textContent = `Đã tạm dừng: ${data.pauseReason}`;
    } else if (data.activeGroupJob) {
      const slug = (data.activeGroupJob.groupUrl || '').replace(/https?:\/\/(www\.)?facebook\.com\/groups\//i, '');
      progText.textContent = `Đang mở tuần tự 1 tab: ${slug} (còn ${queueCount} nhóm chờ sau tab này)...`;
    } else if (data.nextGroupAt && data.nextGroupAt > Date.now() && queueCount > 0) {
      const sec = Math.ceil((data.nextGroupAt - Date.now()) / 1000);
      progText.textContent = `Đã đóng tab trước · Chờ đủ ${sec}s sẽ mở nhóm kế tiếp (còn ${queueCount} nhóm).`;
    } else if (queueCount > 0) {
      progText.textContent = `Đang chuẩn bị mở nhóm tiếp theo (${queueCount} lượt chờ)...`;
    } else {
      progText.textContent = 'Trạng thái hàng đợi: Đang rảnh (chưa có tab Group nào đang mở).';
    }
  }

  populateGroupPostDropdown();
  if (Array.isArray(data.groupLogs)) {
    renderGroupShareLogs(data.groupLogs);
  }
}

let isExtBridgeListenerAttached = false;
function initExtensionControlPanel() {
  if (!isExtBridgeListenerAttached) {
    isExtBridgeListenerAttached = true;
    window.addEventListener('message', (event) => {
      if (event.source !== window || !event.data || !event.data.action) return;
      const d = event.data;

      if (d.action === 'VG_EXTENSION_RESPONSE' && d.installed) {
        const badge = document.getElementById('appExtStatusBadge');
        if (badge) {
          badge.className = 'vg-pill vg-pill-success font-mono-num';
          badge.textContent = `Extension v${d.version || '1.6.0'} · Đã kết nối`;
        }
        const cockpitBadge = document.getElementById('cockpitExtSummaryBadge');
        if (cockpitBadge) {
          cockpitBadge.className = 'vg-pill vg-pill-success font-mono-num';
          cockpitBadge.textContent = `Đã kết nối v${d.version || '1.6.0'}`;
        }
        window.postMessage({ action: 'VG_GET_EXTENSION_CONFIG' }, '*');
      }

      if (d.action === 'VG_EXTENSION_CONFIG_DATA' && d.success) {
        applyExtensionStateToApp(d);
      }

      if (d.action === 'VG_EXTENSION_CONFIG_SAVED') {
        const btn = document.getElementById('appSaveExtBtn');
        if (btn) btn.disabled = false;
        if (d.success) {
          window.postMessage({ action: 'VG_GET_EXTENSION_CONFIG' }, '*');
          setAppExtMessage('Đã lưu cấu hình Extension & đồng bộ tức thì!');
        } else {
          setAppExtMessage(d.error || 'Chưa lưu được cấu hình Extension.', true);
        }
      }

      if (d.action === 'VG_SCAN_JOINED_GROUPS_RESULT') {
        const btn = document.getElementById('appScanGroupsBtn');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Quét Nhóm Đã Tham Gia';
        }
        if (d.success) {
          const urlsEl = document.getElementById('appTargetGroupUrls');
          const countEl = document.getElementById('appGroupCountLabel');
          if (urlsEl && Array.isArray(d.targetGroupUrls)) {
            urlsEl.value = d.targetGroupUrls.join('\n');
          }
          if (countEl) {
            countEl.textContent = String(d.totalSaved || d.foundCount || 0);
          }
          setAppExtMessage(`Đã quét ${d.foundCount} nhóm và lưu tổng ${d.totalSaved} nhóm!`);
        } else {
          setAppExtMessage(d.error || 'Không quét được nhóm Facebook.', true);
        }
      }

      if (d.action === 'VG_SHARE_TO_GROUPS_RESULT') {
        const btn = document.getElementById('appShareGroupsNowBtn');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Chia Sẻ Hội Nhóm Ngay';
        }
        if (d.success) {
          setAppExtMessage(`Đã đưa ${d.enqueueRes?.enqueued || 1} nhóm vào hàng đợi tuần tự (chạy trong cửa sổ phụ)!`);
          window.postMessage({ action: 'VG_GET_EXTENSION_CONFIG' }, '*');
        } else {
          setAppExtMessage(d.error || 'Không thể chia sẻ lên Hội Nhóm.', true);
        }
      }

      if (d.action === 'VG_STOP_GROUP_QUEUE_RESULT') {
        setAppExtMessage(`Đã dừng hàng đợi & đóng ${d.clearedTabs || 0} tab.`);
        window.postMessage({ action: 'VG_GET_EXTENSION_CONFIG' }, '*');
      }

      if (d.action === 'VG_RETRY_FAILED_GROUPS_RESULT') {
        if (d.success) {
          setAppExtMessage(`Đang chạy lại ${d.retriedCount} nhóm bị lỗi...`);
        } else {
          setAppExtMessage(d.error || 'Không có nhóm lỗi nào để thử lại.', true);
        }
        window.postMessage({ action: 'VG_GET_EXTENSION_CONFIG' }, '*');
      }

      if (d.action === 'VG_REMOVE_GROUP_URL_RESULT' || d.action === 'VG_CLEAR_GROUP_LOGS_RESULT') {
        window.postMessage({ action: 'VG_GET_EXTENSION_CONFIG' }, '*');
      }

      if (d.action === 'VG_RUN_DUE_PERSONAL_RESULT') {
        const btn = document.getElementById('appRunDuePersonalBtn');
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Đăng Cá Nhân Đến Giờ';
        }
        if (d.dispatched) {
          setAppExtMessage(`Đang mở Facebook đăng bài ${d.postId} lên Trang Cá Nhân!`);
        } else if (d.dueCount === 0) {
          setAppExtMessage('Hiện không có bài Trang Cá Nhân nào đang đến giờ.');
        } else if (d.error) {
          setAppExtMessage(d.error, true);
        }
      }
    });
  }

  window.postMessage({ action: 'VG_CHECK_EXTENSION' }, '*');
  setTimeout(() => {
    window.postMessage({ action: 'VG_GET_EXTENSION_CONFIG' }, '*');
  }, 400);

  if (!extPollInterval) {
    extPollInterval = setInterval(() => {
      if (!document.hidden) {
        window.postMessage({ action: 'VG_GET_EXTENSION_CONFIG' }, '*');
      }
    }, 3000);
  }
}

function saveExtConfigFromApp() {
  const urls = parseAppGroupUrls(document.getElementById('appTargetGroupUrls')?.value);
  const perPost = Math.max(1, Math.min(50, parseInt(document.getElementById('appGroupsPerPost')?.value, 10) || 3));
  const rawDelay = parseInt(document.getElementById('appGroupDelaySeconds')?.value, 10);
  const delaySec = Number.isFinite(rawDelay) && rawDelay >= 0 ? Math.min(rawDelay, 600) : 10;

  const btn = document.getElementById('appSaveExtBtn');
  if (btn) btn.disabled = true;

  window.postMessage({
    action: 'VG_SAVE_EXTENSION_CONFIG',
    config: {
      autoPersonalEnabled: document.getElementById('appAutoPersonalEnabled')?.checked ?? true,
      autoPersonalIncludeFanpage: document.getElementById('appAutoFanpageSync')?.checked ?? true,
      autoGroupShareEnabled: document.getElementById('appAutoGroupShareEnabled')?.checked ?? true,
      shareAllGroups: document.getElementById('appShareAllGroups')?.checked ?? false,
      groupsPerPost: perPost,
      groupDelaySeconds: delaySec,
      targetGroupUrls: urls
    }
  }, '*');
}

function scanGroupsFromApp() {
  const btn = document.getElementById('appScanGroupsBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang quét nhóm...';
  }
  setAppExtMessage('Đang quét danh sách nhóm Facebook đã tham gia...');
  window.postMessage({ action: 'VG_SCAN_JOINED_GROUPS' }, '*');
}

function runDuePersonalFromApp() {
  const btn = document.getElementById('appRunDuePersonalBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang kiểm tra...';
  }
  window.postMessage({ action: 'VG_RUN_DUE_PERSONAL_NOW' }, '*');
}

function shareLatestToGroupsFromApp() {
  const selectedId = document.getElementById('appGroupPostSelect')?.value || '';
  if (selectedId) {
    sharePostToGroupsFromApp(selectedId);
    return;
  }
  saveExtConfigFromApp();
  const btn = document.getElementById('appShareGroupsNowBtn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Đang chia sẻ...';
  }
  setAppExtMessage('Đang gửi lệnh chia sẻ sang Hội Nhóm...');
  setTimeout(() => {
    window.postMessage({ action: 'VG_SHARE_TO_GROUPS_NOW', payload: null }, '*');
  }, 150);
}

function sharePostToGroupsFromApp(postId) {
  const post = allPosts.find(p => p.id === postId);
  if (!post) {
    alert('Không tìm thấy dữ liệu bài viết này.');
    return;
  }
  saveExtConfigFromApp();
  const mediaUrls = (post.mediaUrls || (post.mediaFiles || []).map(m => typeof m === 'string' ? m : (m.url || m.path || '')))
    .filter(Boolean);
  setAppExtMessage(`Đang chia sẻ mã #${post.machineCode || 'MÁY'} lên các Hội Nhóm (cửa sổ chạy nền)...`);
  setTimeout(() => {
    window.postMessage({
      action: 'VG_SHARE_TO_GROUPS_NOW',
      payload: {
        postId: post.id,
        machineCode: post.machineCode || post.code || 'MÁY',
        content: post.content || '',
        mediaUrls
      }
    }, '*');
  }, 150);
}

function stopGroupQueueFromApp() {
  window.postMessage({ action: 'VG_STOP_GROUP_QUEUE' }, '*');
}

function retryFailedGroupsFromApp() {
  window.postMessage({ action: 'VG_RETRY_FAILED_GROUPS', logId: null }, '*');
}

function retrySingleGroupLog(logId) {
  window.postMessage({ action: 'VG_RETRY_FAILED_GROUPS', logId }, '*');
}

function removeGroupUrlFromApp(groupUrl) {
  if (!confirm(`Xóa nhóm ${groupUrl} khỏi danh sách mục tiêu?`)) return;
  window.postMessage({ action: 'VG_REMOVE_GROUP_URL', groupUrl }, '*');
}

function clearGroupLogsFromApp() {
  window.postMessage({ action: 'VG_CLEAR_GROUP_LOGS' }, '*');
}


