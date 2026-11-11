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
        btn.classList.remove('text-slate-400');
      } else {
        section.classList.add('hidden');
        btn.classList.remove('nav-tab-active');
        btn.classList.add('text-slate-400');
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

// Sub-Tab switcher inside Tab 4 (Settings & History)
function switchSettingsSubTab(sub) {
  const historyView = document.getElementById('settingsHistoryView');
  const configView = document.getElementById('settingsConfigView');
  const btnHistory = document.getElementById('settingsSubTabBtn-history');
  const btnConfig = document.getElementById('settingsSubTabBtn-config');

  if (sub === 'history') {
    if (historyView) historyView.classList.remove('hidden');
    if (configView) configView.classList.add('hidden');
    if (btnHistory) {
      btnHistory.classList.add('neo-btn-yellow');
      btnHistory.classList.remove('neo-btn-white');
    }
    if (btnConfig) {
      btnConfig.classList.add('neo-btn-white');
      btnConfig.classList.remove('neo-btn-yellow');
    }
    loadPosts();
  } else {
    if (historyView) historyView.classList.add('hidden');
    if (configView) configView.classList.remove('hidden');
    if (btnConfig) {
      btnConfig.classList.add('neo-btn-yellow');
      btnConfig.classList.remove('neo-btn-white');
    }
    if (btnHistory) {
      btnHistory.classList.add('neo-btn-white');
      btnHistory.classList.remove('neo-btn-yellow');
    }
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
          countdownEl.innerText = hours > 0 ? `⏳ Còn ~${hours}h ${mins}m` : `⏳ Còn ~${mins} phút`;
        }
      } else {
        if (countdownEl) countdownEl.innerText = `⏳ Đã đến giờ đăng!`;
      }

      const publishBothBtn = document.getElementById('cockpitPublishBothBtn');
      if (publishBothBtn) {
        publishBothBtn.onclick = () => publishPostNow(nextPost.id, 'both');
      }
      const publishBtn = document.getElementById('cockpitPublishNowBtn');
      if (publishBtn) {
        publishBtn.onclick = () => publishPostNow(nextPost.id, 'fanpage');
      }
      const personalBtn = document.getElementById('cockpitPublishPersonalBtn');
      if (personalBtn) {
        personalBtn.onclick = () => publishPostNow(nextPost.id, 'personal');
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
    container.innerHTML = `<div class="py-6 text-center text-xs text-neutral-500 font-medium">Hiện chưa có bài đăng nào sắp diễn ra. Bấm nút tuần hoàn để nạp bài ngay!</div>`;
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
      <div class="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-[#FDFBF7] transition px-2 rounded-lg">
        <div class="flex items-center gap-3">
          <span class="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded">
            ⏰ ${escapeHtml(formattedDate)}
          </span>
          <div>
            <div class="text-xs font-black text-[#18181B] flex items-center gap-2">
              <span class="neo-sticker sticker-blue text-[10px]">#${escapeHtml(code)}</span>
              <span>${escapeHtml(name)}</span>
            </div>
            <div class="text-[11px] text-neutral-500 font-medium flex items-center gap-2 mt-0.5">
              <span>📁 ${pCount} ảnh/video</span>
              ${price ? `<span>·</span><span class="font-bold text-emerald-700">${escapeHtml(price)}</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-1.5">
          <button onclick="openPostPreviewModal('${post.id}')" class="neo-btn neo-btn-white px-2 py-1 text-xs font-bold" title="Xem chi tiết">
            👁️ Xem
          </button>
          <button onclick="publishPostNow('${post.id}', 'both')" class="neo-btn bg-[#FB923C] text-[#431407] hover:bg-orange-400 px-2.5 py-1 text-xs font-black shadow-[1.5px_1.5px_0px_#18181B]" title="Đăng cả Fanpage + Cá Nhân">
            🚀 Cả Hai
          </button>
          <button onclick="publishPostNow('${post.id}', 'fanpage')" class="neo-btn neo-btn-yellow px-2 py-1 text-xs font-black" title="Đăng Fanpage">
            ⚡ Fanpage
          </button>
          <button onclick="publishPostNow('${post.id}', 'personal')" class="px-2 py-1 bg-white text-black border border-black font-black text-xs hover:bg-zinc-100" title="Đăng Facebook Cá Nhân qua Extension">
            👤 Cá Nhân
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

    // Update top header badge
    const topBadge = document.getElementById('topFanpageBadge');
    if (topBadge && appSettings.fanpageId) {
      topBadge.innerHTML = `<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span><span>Fanpage: <strong class="text-white">${appSettings.fanpageName || 'Laptop Vương Gia'}</strong> (<span class="font-mono text-[11px]">${appSettings.fanpageId}</span>)</span>`;
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
  resultDiv.innerHTML = '<span class="text-blue-400">⏳ Đang kết nối tới Facebook...</span>';

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
      resultDiv.innerHTML = `<span class="text-emerald-700 font-bold">✅ Kết nối thành công tới Trang: <strong>${data.pageInfo.name}</strong> (ID: ${data.pageInfo.id})</span>`;
    } else {
      resultDiv.innerHTML = `<span class="text-red-600 font-bold">❌ ${data.error}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-red-600 font-bold">❌ Lỗi: ${err.message}</span>`;
  }
}

async function testEmailConnection() {
  const resultDiv = document.getElementById('emailTestResult');
  resultDiv.innerHTML = '<span class="text-blue-700 font-bold">⏳ Đang gửi email kiểm thử...</span>';

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
      resultDiv.innerHTML = `<span class="text-emerald-700 font-bold">✅ Đã gửi email kiểm thử thành công tới <strong>${notificationEmail}</strong>! Hãy kiểm tra hòm thư của bạn.</span>`;
    } else {
      resultDiv.innerHTML = `<span class="text-red-600 font-bold">❌ ${data.error}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-red-600 font-bold">❌ Lỗi: ${err.message}</span>`;
  }
}

async function setupTelegramWebhook() {
  const resultDiv = document.getElementById('telegramStatusResult');
  const token = document.getElementById('settingTelegramBotToken').value.trim();
  if (!token) {
    alert('Vui lòng nhập Telegram Bot Token trước khi kích hoạt Webhook!');
    return;
  }

  resultDiv.innerHTML = '<span class="text-indigo-700 font-bold">⏳ Đang kết nối Webhook tới Telegram...</span>';
  try {
    const res = await fetch('/api/telegram/setup-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken: token })
    });
    const data = await res.json();
    if (data.success) {
      resultDiv.innerHTML = `<span class="text-emerald-700 font-bold">✅ ${data.message}</span>`;
      await saveSettingsForm();
    } else {
      resultDiv.innerHTML = `<span class="text-red-600 font-bold">❌ Lỗi: ${data.error}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-red-600 font-bold">❌ Lỗi kết nối: ${err.message}</span>`;
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

  resultDiv.innerHTML = '<span class="text-indigo-700 font-bold">⏳ Đang gửi tin nhắn thử nghiệm tới Telegram...</span>';
  try {
    const res = await fetch('/api/telegram/test-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken: token, telegramChatId: chatId })
    });
    const data = await res.json();
    if (data.success) {
      resultDiv.innerHTML = `<span class="text-emerald-700 font-bold">✅ ${data.message} (Hãy kiểm tra app Telegram của anh!)</span>`;
    } else {
      resultDiv.innerHTML = `<span class="text-red-600 font-bold">❌ Lỗi: ${data.error}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-red-600 font-bold">❌ Lỗi: ${err.message}</span>`;
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
      dropZone.classList.add('border-blue-500', 'bg-blue-950/20');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-blue-500', 'bg-blue-950/20');
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
  copyTextToClipboard(post.content, `📋 Đã sao chép nội dung Mã #${post.machineCode || 'N/A'}!`);
}

function togglePostAccordion(postId) {
  const el = document.getElementById(`accordion-${postId}`);
  const btn = document.getElementById(`chevron-${postId}`);
  if (!el) return;
  if (el.classList.contains('hidden')) {
    el.classList.remove('hidden');
    if (btn) btn.innerHTML = '▲ Thu gọn nội dung text';
  } else {
    el.classList.add('hidden');
    if (btn) btn.innerHTML = '▶ Xem nhanh nội dung & thông số text';
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
    item.className = 'relative group rounded-lg overflow-hidden border-2 border-[#18181B] bg-black aspect-video flex items-center justify-center shadow-[2px_2px_0px_#18181B]';

    if (isVideo) {
      item.innerHTML = `
        <video src="${file.url}" class="w-full h-full object-cover" preload="metadata" muted playsinline></video>
        <div class="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <span class="bg-[#F43F5E] text-white text-[10px] font-black font-mono px-2 py-0.5 rounded shadow">▶ VIDEO</span>
        </div>
        <span class="absolute bottom-1 left-1 bg-black/80 text-white text-[9px] px-1 font-mono rounded">#${index + 1}</span>
        <button onclick="removeMediaItem(${index})" class="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-90 hover:opacity-100 transition shadow">✕</button>
      `;
    } else {
      item.innerHTML = `
        <img src="${file.url}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\\'w-full h-full bg-[#FAF5EE] flex items-center justify-center text-[10px] font-mono text-neutral-400 font-bold\\\'>Ảnh lỗi</div>';" class="w-full h-full object-cover">
        <span class="absolute bottom-1 left-1 bg-black/80 text-white text-[9px] px-1 font-mono rounded">#${index + 1}</span>
        <button onclick="removeMediaItem(${index})" class="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-90 hover:opacity-100 transition shadow">✕</button>
      `;
    }

    container.appendChild(item);
  });

  // If there are already files uploaded, render a "+ Thêm ảnh/video" tile in the gallery
  if (currentMediaFiles.length > 0) {
    const addMoreTile = document.createElement('div');
    addMoreTile.className = 'border-2 border-dashed border-[#18181B] bg-white hover:bg-[#FEF08A]/50 rounded-lg aspect-video flex flex-col items-center justify-center cursor-pointer transition shadow-[2px_2px_0px_#18181B] text-center p-2';
    addMoreTile.onclick = () => document.getElementById('fileInput').click();
    addMoreTile.innerHTML = `
      <span class="text-2xl font-bold text-[#18181B] leading-none">+</span>
      <span class="text-[10px] font-black uppercase text-[#18181B] mt-1">Thêm tệp</span>
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
          <div class="relative w-full h-full min-h-[140px] bg-black overflow-hidden flex items-center justify-center rounded">
            <video src="${f.url}" class="w-full h-full object-cover" controls preload="metadata" playsinline></video>
            <span class="absolute top-2 left-2 bg-[#F43F5E] text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow pointer-events-none">▶ VIDEO</span>
          </div>
        `;
      } else {
        return `<img src="${f.url}" class="fb-media-item" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\\'w-full h-full min-h-[140px] bg-[#FAF5EE] flex items-center justify-center text-xs font-mono text-neutral-400 font-bold\\\'>Ảnh máy</div>';">`;
      }
    }).join('');
  }
}

// ======================== SCHEDULE & PUBLISH POSTS ========================

async function schedulePost(publishImmediately = false, target = 'fanpage') {
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
  } catch (err) {
    console.error('Error fetching posts:', err);
    if (!Array.isArray(allPosts)) allPosts = [];
  }
}

function renderQueueList(posts) {
  const container = document.getElementById('queueListContainer');
  if (posts.length === 0) {
    container.innerHTML = `
      <div class="neo-card p-8 text-center text-neutral-600 space-y-2 bg-white">
        <div class="text-4xl">📭</div>
        <div class="text-sm font-black text-[#18181B] uppercase">Chưa có bài viết nào trong hàng đợi</div>
        <p class="text-xs text-neutral-500 font-medium">Hãy qua mục <strong>1. AI Studio & Soạn bài</strong> để dán bài Zalo và lên lịch đăng bài.</p>
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
      mediaThumbHtml = `<div class="w-16 h-16 rounded-lg bg-[#FAF5EE] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] flex items-center justify-center text-[10px] text-neutral-400 font-bold font-mono text-center p-1 shrink-0">Chưa có media</div>`;
    } else {
      const firstMedia = mFiles[0];
      const isFirstVideo = isVideoFile(firstMedia);
      mediaThumbHtml = `
        <div class="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] bg-black flex items-center justify-center shrink-0">
          ${isFirstVideo 
            ? `<video src="${firstMedia.url}" class="w-full h-full object-cover" preload="metadata" muted playsinline></video>
               <span class="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-[12px] font-bold">▶</span>`
            : `<img src="${firstMedia.url}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\\'w-16 h-16 rounded-lg bg-[#FAF5EE] border-2 border-[#18181B] flex items-center justify-center text-[9px] font-mono font-bold text-neutral-500 text-center\\\'>#${escapeHtml(post.machineCode)}</div>';" class="w-full h-full object-cover">`
          }
          ${mCount > 1 ? `<span class="absolute bottom-0 right-0 bg-[#FDE047] text-black text-[9px] px-1 font-black border-t border-l border-[#18181B]">+${mCount}</span>` : ''}
          ${vCount > 0 ? `<span class="absolute top-0 left-0 bg-[#F43F5E] text-white text-[8px] font-black px-1 border-b border-r border-[#18181B]">🎬</span>` : ''}
        </div>
      `;
    }

    const firstLine = (post.content || '').split('\n')[0] || post.machineName || 'Laptop';

    return `
      <div class="neo-card p-4 sm:p-5 flex flex-col gap-3.5 bg-white shadow-[3px_3px_0px_#18181B]">
        <div class="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div class="flex gap-3.5 items-start sm:items-center">
            ${mediaThumbHtml}
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="neo-sticker sticker-lavender font-mono font-bold">#${escapeHtml(post.machineCode)}</span>
                ${post.price ? `<span class="neo-sticker sticker-yellow font-bold">${escapeHtml(post.price)}</span>` : ''}
                ${vCount > 0 ? `<span class="neo-sticker bg-[#F43F5E] text-white text-[10px] font-black">🎬 ${vCount} Video</span>` : ''}
                ${post.status === 'pending_media' ? `<span class="neo-sticker sticker-yellow text-[11px] font-bold">📬 Chờ media (nhắc trước 20p)</span>` : ''}
                ${post.status === 'queued' ? `<span class="neo-sticker sticker-green text-[11px] font-bold">⏳ Sẵn sàng (${vCount > 0 ? `${vCount} video · ` : ''}${pCount} ảnh)</span>` : ''}
                ${post.status === 'skipped_no_media' ? `<span class="neo-sticker sticker-coral text-[11px] font-bold">⚠️ Bỏ qua (thiếu media)</span>` : ''}
                ${post.status === 'processing' ? `<span class="neo-sticker sticker-lavender text-[11px] font-bold">⚙️ Đang đăng</span>` : ''}
              </div>
              <div class="text-xs text-[#18181B] font-bold mt-1.5 line-clamp-1 max-w-lg cursor-pointer hover:text-indigo-600 transition-colors" onclick="viewQueuedPostContent('${post.id}')" title="Bấm để xem toàn bộ nội dung">
                <span>${escapeHtml(firstLine)}</span>
              </div>
              <div class="text-xs text-neutral-500 font-medium mt-1 flex items-center gap-2 flex-wrap">
                <span>⏰ Giờ hẹn: <strong class="text-emerald-700 font-mono">${scheduledDate}</strong></span>
                <span>·</span>
                <span>📁 <strong class="text-indigo-700">${vCount > 0 ? `${vCount} video · ` : ''}${pCount} ảnh</strong></span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 w-full md:w-auto justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100">
            <button onclick="viewQueuedPostContent('${post.id}')" class="neo-btn neo-btn-white px-2.5 py-1.5 text-xs font-black text-indigo-700 hover:bg-indigo-50 border-2 border-[#18181B]" title="Xem nội dung bài viết và thông số">
              <span>👁️ Xem</span>
            </button>
            <a href="/quick-upload?id=${post.id}" target="_blank" class="neo-btn neo-btn-lavender px-2.5 py-1.5 text-xs font-black" title="Xem hoặc thêm ảnh/video">
              <span>🎬 ${mCount > 0 ? `Media (${mCount})` : 'Nạp'}</span>
            </a>
            <button onclick="publishPostNow('${post.id}', 'both')" class="neo-btn bg-[#FB923C] text-[#431407] hover:bg-orange-400 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#18181B]" title="Đăng lên cả Fanpage và Facebook cá nhân">
              <span>🚀 Đăng Cả Hai</span>
            </button>
            <button onclick="publishPostNow('${post.id}', 'fanpage')" class="neo-btn neo-btn-yellow px-2.5 py-1.5 text-xs font-black" title="Đăng bài này lên Fanpage ngay lập tức">
              <span>⚡ Fanpage</span>
            </button>
            <button onclick="publishPostNow('${post.id}', 'personal')" class="neo-btn bg-[#38BDF8] text-[#082F49] hover:bg-sky-400 px-2.5 py-1.5 text-xs font-black shadow-[2px_2px_0px_#18181B]" title="Đăng bài này lên Facebook cá nhân">
              <span>👤 Cá Nhân</span>
            </button>
            <button onclick="deletePost('${post.id}')" class="neo-btn neo-btn-white px-2 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" title="Xóa khỏi hàng đợi">
              <span>Xóa</span>
            </button>
          </div>
        </div>

        <!-- Inline Accordion Quick Expand (Toggleable) -->
        <div class="pt-2 border-t border-neutral-200">
          <div class="flex items-center justify-between">
            <button type="button" onclick="togglePostAccordion('${post.id}')" class="text-[11px] font-black text-neutral-700 hover:text-black flex items-center gap-1.5 py-0.5">
              <span id="chevron-${post.id}">▶ Xem nhanh nội dung & thông số text</span>
            </button>
            <button type="button" onclick="copyPostText('${post.id}')" class="text-[11px] font-bold text-indigo-700 hover:underline">
              📋 Sao chép text
            </button>
          </div>
          <div id="accordion-${post.id}" class="hidden mt-2 p-3 bg-[#FAF8F5] border-2 border-[#18181B] rounded-lg text-xs text-[#18181B] leading-relaxed select-text shadow-[2px_2px_0px_#18181B]">
            <pre class="whitespace-pre-wrap font-sans text-xs text-[#18181B] leading-relaxed">${escapeHtml(post.content || 'Chưa có nội dung.')}</pre>
            <div class="mt-2.5 pt-2 border-t border-neutral-300 flex justify-end gap-2">
              <button type="button" onclick="copyPostText('${post.id}')" class="neo-btn neo-btn-yellow px-2.5 py-1 text-[11px] font-bold">📋 Sao chép nội dung</button>
              <button type="button" onclick="viewQueuedPostContent('${post.id}')" class="neo-btn neo-btn-lavender px-2.5 py-1 text-[11px] font-bold">🔍 Chi tiết đầy đủ</button>
            </div>
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
      <div class="neo-card p-8 text-center text-neutral-600 space-y-2 bg-white">
        <div class="text-4xl">📝</div>
        <div class="text-sm font-black text-[#18181B] uppercase">Chưa có bài viết nào được đăng</div>
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
      historyThumbHtml = `<div class="w-16 h-16 rounded-lg bg-[#FAF5EE] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] flex items-center justify-center text-xs text-neutral-500 font-bold font-mono shrink-0">No Media</div>`;
    } else if (isFirstVideo) {
      historyThumbHtml = `
        <div class="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] bg-black flex items-center justify-center shrink-0">
          <video src="${firstMedia.url}" class="w-full h-full object-cover" preload="metadata" muted playsinline></video>
          <span class="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-[12px] font-bold">▶</span>
          ${mCount > 1 ? `<span class="absolute bottom-0 right-0 bg-[#FDE047] text-black text-[9px] px-1 font-black border-t border-l border-[#18181B]">+${mCount}</span>` : ''}
          <span class="absolute top-0 left-0 bg-[#F43F5E] text-white text-[8px] font-black px-1 border-b border-r border-[#18181B]">🎬</span>
        </div>
      `;
    } else {
      historyThumbHtml = `
        <div class="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] bg-neutral-100 flex items-center justify-center shrink-0">
          <img src="${firstMedia.url}" onerror="this.onerror=null; this.parentElement.innerHTML='<div class=\\\'w-16 h-16 rounded-lg bg-[#FAF5EE] border-2 border-[#18181B] flex items-center justify-center text-[9px] font-mono font-bold text-neutral-500 text-center\\\'>#${escapeHtml(post.machineCode)}</div>';" class="w-full h-full object-cover">
          ${mCount > 1 ? `<span class="absolute bottom-0 right-0 bg-[#FDE047] text-black text-[9px] px-1 font-black border-t border-l border-[#18181B]">+${mCount}</span>` : ''}
        </div>
      `;
    }

    const firstLine = (post.content || '').split('\n')[0] || post.machineName || 'Laptop';

    return `
      <div class="neo-card p-4 sm:p-5 flex flex-col gap-3.5 bg-white shadow-[3px_3px_0px_#18181B]">
        <div class="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          <div class="flex gap-3.5 items-start sm:items-center">
            ${historyThumbHtml}
            <div>
              <div class="flex items-center gap-2 flex-wrap">
                <span class="neo-sticker ${isSuccess ? 'sticker-green' : 'sticker-coral'}">
                  ${isSuccess ? '✅ Đã đăng thành công' : '❌ Thất bại'}
                </span>
                <span class="neo-sticker sticker-lavender font-mono">#${escapeHtml(post.machineCode)}</span>
                ${post.isSimulation ? `<span class="neo-sticker sticker-yellow text-[10px]">Mô phỏng (Test)</span>` : ''}
              </div>
              <div class="text-xs text-[#18181B] font-bold mt-1.5 line-clamp-1 max-w-lg cursor-pointer hover:text-indigo-600 transition-colors" onclick="viewQueuedPostContent('${post.id}')" title="Bấm để xem lại bài đăng">
                <span>${escapeHtml(firstLine)}</span>
              </div>
              <div class="text-xs text-neutral-500 font-medium mt-1">
                <span>Đăng lúc: <strong>${postDate}</strong></span>
                ${post.errorMessage ? `<span class="text-red-600 ml-2">(${escapeHtml(post.errorMessage)})</span>` : ''}
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap pt-2 md:pt-0 border-t md:border-t-0 border-neutral-100">
            <button onclick="viewQueuedPostContent('${post.id}')" class="neo-btn neo-btn-white px-2.5 py-1.5 text-xs font-black text-neutral-800 hover:bg-neutral-100 border-2 border-[#18181B]" title="Xem lại toàn bộ nội dung bài viết">
              <span>👁️ Xem bài viết</span>
            </button>
            ${post.fbPostUrl ? `
              <a href="${post.fbPostUrl}" target="_blank" class="neo-btn neo-btn-lavender px-3 py-1.5 text-xs font-black">
                <span>Xem trên FB ↗</span>
              </a>
            ` : ''}
            <button onclick="deletePost('${post.id}')" class="neo-btn neo-btn-white px-2.5 py-1.5 text-xs font-bold text-neutral-500 hover:text-red-600">
              <span>Xóa</span>
            </button>
          </div>
        </div>

        <!-- Inline Accordion Quick Expand (Toggleable) -->
        <div class="pt-2 border-t border-neutral-200">
          <div class="flex items-center justify-between">
            <button type="button" onclick="togglePostAccordion('${post.id}')" class="text-[11px] font-black text-neutral-700 hover:text-black flex items-center gap-1.5 py-0.5">
              <span id="chevron-${post.id}">▶ Xem nhanh nội dung & thông số text</span>
            </button>
            <button type="button" onclick="copyPostText('${post.id}')" class="text-[11px] font-bold text-indigo-700 hover:underline">
              📋 Sao chép text
            </button>
          </div>
          <div id="accordion-${post.id}" class="hidden mt-2 p-3 bg-[#FAF8F5] border-2 border-[#18181B] rounded-lg text-xs text-[#18181B] leading-relaxed select-text shadow-[2px_2px_0px_#18181B]">
            <pre class="whitespace-pre-wrap font-sans text-xs text-[#18181B] leading-relaxed">${escapeHtml(post.content || 'Chưa có nội dung.')}</pre>
            <div class="mt-2.5 pt-2 border-t border-neutral-300 flex justify-end gap-2">
              <button type="button" onclick="copyPostText('${post.id}')" class="neo-btn neo-btn-yellow px-2.5 py-1 text-[11px] font-bold">📋 Sao chép nội dung</button>
              <button type="button" onclick="viewQueuedPostContent('${post.id}')" class="neo-btn neo-btn-lavender px-2.5 py-1 text-[11px] font-bold">🔍 Chi tiết đầy đủ</button>
            </div>
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
        <div class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] bg-black shrink-0">
          <img src="${url}" class="w-full h-full object-cover">
          <span class="absolute top-0 right-0 bg-[#FDE047] text-black text-[9px] px-1 font-black border-b border-l border-[#18181B]">#${idx + 1}</span>
        </div>
      `).join('');
      mediaContainer.classList.remove('hidden');
    } else {
      mediaContainer.innerHTML = `<span class="text-xs text-neutral-500 italic">Bài viết này không có ảnh đính kèm.</span>`;
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
  if (btn) btn.innerText = '⏳ Đang tải ảnh...';
  const downloaded = await downloadAllPostMedia(postMedia, currentPersonalPostData.machineCode);
  if (btn) btn.innerText = `✅ Đã tải xong (${downloaded} ảnh)`;
  setTimeout(() => { if (btn) btn.innerText = `📥 Tải Lại Ảnh`; }, 2500);
}

function copyCurrentPersonalText() {
  if (!currentPersonalPostData) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(currentPersonalPostData.content || '');
  }
  const btn = document.getElementById('personalHelperCopyBtn');
  if (btn) btn.innerText = '✅ ĐÃ CHÉP NỘI DUNG!';
  setTimeout(() => { if (btn) btn.innerText = '📋 Sao Chép Lại'; }, 2000);
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
      dropZone.classList.add('bg-[#E0E7FF]/40', 'border-indigo-600');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('bg-[#E0E7FF]/40', 'border-indigo-600');
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
      <tr class="hover:bg-[#FAF8F5] transition-colors border-b border-neutral-200">
        <td class="p-3 text-center">
          <input type="checkbox" 
                 class="item-checkbox w-4 h-4 accent-[#18181B] rounded cursor-pointer" 
                 data-index="${idx}" 
                 ${item.selected ? 'checked' : ''} 
                 onchange="toggleRowSelection(${idx}, this.checked)" />
        </td>
        <td class="p-3">
          <span class="neo-sticker sticker-lavender font-mono font-bold text-xs">#${item.machineCode}</span>
        </td>
        <td class="p-3 font-bold text-[#18181B]">
          ${item.machineName}
        </td>
        <td class="p-3 text-neutral-700">
          <div>${specsDisplay}</div>
          ${item.screen ? `<div class="text-[11px] text-neutral-500 font-mono mt-0.5">🖥️ ${item.screen}</div>` : ''}
        </td>
        <td class="p-3 text-center">
          ${item.isTouch ? 
            `<span class="neo-sticker sticker-green text-[10px] font-bold">✓ Cảm ứng</span>` : 
            `<span class="neo-sticker sticker-white text-[10px] text-neutral-500">Không</span>`
          }
        </td>
        <td class="p-3">
          <input type="text" 
                 class="neo-input px-2 py-1 text-xs font-bold w-28 text-emerald-800" 
                 value="${item.price || ''}" 
                 placeholder="VD: 5.5 triệu"
                 onchange="updateItemPrice(${idx}, this.value)" />
        </td>
        <td class="p-3">
          <span class="neo-sticker sticker-yellow font-mono text-[11px] font-bold">
            ⏰ ${slotLabel}
          </span>
        </td>
        <td class="p-3 text-center">
          <button onclick="previewPostItem(${idx})" class="neo-btn neo-btn-white px-2.5 py-1 text-[11px] font-bold" title="Xem trước bài viết hoàn chỉnh">
            <span>👁️ Xem bài</span>
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

  if (title) title.innerText = `BÀI ĐĂNG FACEBOOK · MÃ #${item.machineCode || 'N/A'}: ${item.machineName || ''}`;
  
  if (meta) {
    meta.innerHTML = `
      <span class="neo-sticker sticker-lavender font-mono font-bold">#${escapeHtml(item.machineCode)}</span>
      ${item.price ? `<span class="neo-sticker sticker-yellow font-bold">${escapeHtml(item.price)}</span>` : ''}
      <span class="neo-sticker sticker-green text-[11px] font-bold">Bản xem trước AI</span>
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
      <button onclick="closePostPreviewModal()" class="neo-btn neo-btn-white px-3 py-1.5 text-xs font-bold">
        <span>Đóng lại</span>
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
    title.innerText = `MÃ #${post.machineCode || 'N/A'}: ${post.machineName || 'Laptop'}`;
  }

  if (meta) {
    meta.innerHTML = `
      <span class="neo-sticker sticker-lavender font-mono font-bold">#${escapeHtml(post.machineCode)}</span>
      ${post.price ? `<span class="neo-sticker sticker-yellow font-bold">${escapeHtml(post.price)}</span>` : ''}
      <span class="neo-sticker font-mono text-[11px]">⏰ ${escapeHtml(scheduledDate)}</span>
      <span class="neo-sticker font-bold text-[11px] text-indigo-700 bg-indigo-50 border border-indigo-200">📁 ${vCount > 0 ? `${vCount} video · ` : ''}${pCount} ảnh</span>
      ${post.status === 'queued' ? `<span class="neo-sticker sticker-green text-[11px] font-bold">⏳ Trong hàng đợi</span>` : ''}
      ${post.status === 'pending_media' ? `<span class="neo-sticker sticker-yellow text-[11px] font-bold">📬 Chờ media</span>` : ''}
      ${post.status === 'posted' ? `<span class="neo-sticker sticker-green text-[11px] font-bold">✅ Đã đăng Facebook</span>` : ''}
      ${post.status === 'failed' ? `<span class="neo-sticker sticker-coral text-[11px] font-bold">❌ Đăng thất bại</span>` : ''}
    `;
    meta.classList.remove('hidden');
  }

  if (mediaContainer) {
    if (mFiles.length > 0) {
      mediaContainer.innerHTML = `
        <div class="text-[11px] font-bold text-neutral-500 uppercase tracking-wide mb-1.5">Ảnh / Video đính kèm (${mFiles.length}):</div>
        <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          ${mFiles.map((m, idx) => {
            const isVid = isVideoFile(m);
            return `
              <div class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] bg-black shrink-0">
                ${isVid 
                  ? `<video src="${m.url}" class="w-full h-full object-cover" muted preload="metadata"></video><span class="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs font-bold">▶</span>`
                  : `<a href="${m.url}" target="_blank" title="Bấm mở ảnh gốc HD"><img src="${m.url}" class="w-full h-full object-cover"></a>`
                }
                <span class="absolute top-0 right-0 bg-[#FDE047] text-black text-[9px] px-1 font-black border-b border-l border-[#18181B]">#${idx + 1}</span>
              </div>
            `;
          }).join('')}
        </div>
      `;
      mediaContainer.classList.remove('hidden');
    } else {
      mediaContainer.innerHTML = `
        <div class="p-2.5 bg-[#FAF5EE] border-2 border-dashed border-neutral-400 rounded-lg text-xs text-neutral-500 font-medium flex items-center justify-between">
          <span>⚠️ Chưa có ảnh/video đính kèm cho máy này.</span>
          <a href="/quick-upload?id=${post.id}" target="_blank" class="neo-btn neo-btn-lavender px-2 py-1 text-[11px] font-bold shrink-0">🎬 Nạp ảnh ngay</a>
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
      <a href="/quick-upload?id=${post.id}" target="_blank" class="neo-btn neo-btn-lavender px-3 py-1.5 text-xs font-black">
        <span>🎬 Media (${mFiles.length})</span>
      </a>
      ${post.status === 'queued' || post.status === 'pending_media' ? `
        <button onclick="publishPostNow('${post.id}', 'both'); closePostPreviewModal();" class="neo-btn bg-[#FB923C] text-[#431407] hover:bg-orange-400 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#18181B]" title="Đăng lên cả Fanpage và Facebook Cá Nhân">
          <span>🚀 Đăng Cả Hai</span>
        </button>
        <button onclick="publishPostNow('${post.id}', 'fanpage'); closePostPreviewModal();" class="neo-btn neo-btn-yellow px-3 py-1.5 text-xs font-black" title="Đăng lên Fanpage">
          <span>⚡ Fanpage</span>
        </button>
        <button onclick="publishPostNow('${post.id}', 'personal'); closePostPreviewModal();" class="neo-btn bg-[#38BDF8] text-[#082F49] hover:bg-sky-400 px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#18181B]" title="Đăng lên Facebook Cá Nhân">
          <span>👤 Cá Nhân</span>
        </button>
      ` : ''}
      ${post.fbPostUrl ? `
        <a href="${post.fbPostUrl}" target="_blank" class="neo-btn neo-btn-lavender px-3 py-1.5 text-xs font-black">
          <span>Xem trên FB ↗</span>
        </a>
      ` : ''}
      <button onclick="closePostPreviewModal()" class="neo-btn neo-btn-white px-3 py-1.5 text-xs font-bold">
        <span>Đóng lại</span>
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
        <div class="col-span-full py-12 text-center text-red-600 neo-card bg-red-50 p-6">
          <div class="text-3xl mb-2">⚠️</div>
          <div class="text-sm font-black">Lỗi kết nối khi nạp danh sách Model Template</div>
          <p class="text-xs text-neutral-600 mt-1">${escapeHtml(err.message)}</p>
          <button onclick="fetchModelTemplates()" class="mt-3 neo-btn neo-btn-white px-3 py-1.5 text-xs font-bold">
            🔄 Thử lại
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
    card.className = 'neo-card p-4 sm:p-5 bg-white flex flex-col justify-between gap-3.5 shadow-[3px_3px_0px_#18181B] hover:shadow-[5px_5px_0px_#18181B] transition-all';

    const brand = t.brand || 'LAPTOP';
    const isCircularActive = (t.status || 'active') === 'active';
    const postCount = t.post_count || 0;
    const lastPosted = t.last_posted_at ? new Date(t.last_posted_at).toLocaleDateString('vi-VN') : 'Chưa đăng';
    const mediaFiles = Array.isArray(t.media_files) ? t.media_files : [];

    // Mini Gallery HTML (up to 4 thumbnails)
    let galleryHtml = '';
    if (mediaFiles.length > 0) {
      const thumbs = mediaFiles.slice(0, 4).map((f, idx) => {
        const isMore = idx === 3 && mediaFiles.length > 4;
        const moreBadge = isMore ? `<div class="gallery-more-overlay">+${mediaFiles.length - 3} HD ➔</div>` : '';
        const isVideo = isVideoFile(f);
        const videoBadge = isVideo ? `<span class="absolute top-1 left-1 bg-rose-600 text-white text-[9px] font-black px-1 rounded z-10">🎬</span>` : '';

        return `
          <div class="gallery-thumb-box" onclick="openMediaManagerModal('${t.id}')" title="Xem kho ảnh HD">
            <img src="${escapeHtml(f.url)}" alt="${escapeHtml(t.model_name)}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/icons/icon.svg';" />
            ${videoBadge}
            ${moreBadge}
          </div>
        `;
      }).join('');

      galleryHtml = `<div class="grid grid-cols-4 gap-2 pt-1">${thumbs}</div>`;
    } else {
      galleryHtml = `
        <div onclick="openMediaManagerModal('${t.id}')" class="border-2 border-dashed border-[#18181B] bg-[#FAF5EE] rounded-lg p-3 text-center cursor-pointer hover:bg-yellow-50 text-xs font-bold text-neutral-600">
          🖼️ Bấm để nạp album ảnh HD Supabase
        </div>
      `;
    }

    // Hardware Specs Pills
    const specsItems = [];
    if (t.cpu) specsItems.push(`CPU: ${t.cpu}`);
    if (t.ram) specsItems.push(`RAM: ${t.ram}`);
    if (t.ssd) specsItems.push(`SSD: ${t.ssd}`);
    if (t.screen) specsItems.push(`Màn: ${t.screen}`);

    const specsPills = specsItems.map(s => `<span class="model-spec-tag">${escapeHtml(s)}</span>`).join(' ');

    const priceText = t.price_display || (t.price_min ? `${(t.price_min / 1000000).toFixed(1)} triệu` : 'Liên hệ');

    card.innerHTML = `
      <!-- Top Meta Bar -->
      <div>
        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="neo-sticker sticker-lavender font-mono font-black text-[11px]">${escapeHtml(brand.toUpperCase())}</span>
          <div class="flex items-center gap-1.5">
            ${isCircularActive
              ? `<span class="neo-sticker sticker-green text-[10px] font-bold"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> Tuần hoàn: BẬT</span>`
              : `<span class="neo-sticker sticker-peach text-[10px] font-bold">⏸️ Tạm dừng</span>`
            }
            <button onclick="openModelTemplateModal('${t.id}')" title="Chỉnh sửa model" class="neo-btn neo-btn-white px-2 py-0.5 text-xs font-black">✏️</button>
            <button onclick="deleteModelTemplate('${t.id}')" title="Xóa model" class="neo-btn neo-btn-white px-2 py-0.5 text-xs font-black text-red-600 hover:bg-red-50">🗑️</button>
          </div>
        </div>

        <!-- Model Title & Price -->
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-black text-base text-[#18181B] uppercase tracking-tight line-clamp-2">${escapeHtml(t.model_name)}</h3>
          <div class="font-mono font-black text-xs text-emerald-800 bg-[#DCFCE7] px-2 py-0.5 rounded border border-[#18181B] shadow-[1px_1px_0px_#18181B] shrink-0">
            ${escapeHtml(priceText)}
          </div>
        </div>

        <!-- Specs pills -->
        <div class="flex flex-wrap gap-1.5 mt-2.5">
          ${specsPills}
          ${t.is_touchscreen ? `<span class="model-spec-tag bg-yellow-100">Cảm ứng</span>` : ''}
        </div>
      </div>

      <!-- Center: Mini Photo Gallery Preview -->
      <div class="my-1">
        ${galleryHtml}
      </div>

      <!-- Bottom Stats & Action Buttons -->
      <div class="space-y-2.5 pt-2 border-t border-neutral-200">
        <div class="flex items-center justify-between text-[11px] text-neutral-600 font-medium">
          <span>📊 Đã đăng: <strong class="font-mono text-indigo-700">${postCount} lần</strong></span>
          <span>📅 Gần nhất: <strong class="font-mono text-neutral-800">${escapeHtml(lastPosted)}</strong></span>
        </div>

        <!-- Action Buttons -->
        <div class="space-y-2">
          <button onclick="createPostFromTemplate('${t.id}')" class="neo-btn neo-btn-yellow w-full py-2.5 text-xs font-black shadow-[2.5px_2.5px_0px_#18181B]">
            ⚡ TẠO BÀI MỚI TỪ MẪU
          </button>
          <div class="flex gap-2">
            <button onclick="enqueueCircularPost('${t.id}')" class="neo-btn neo-btn-green py-1.5 px-2 text-[11px] font-black shadow-[2px_2px_0px_#18181B] flex-1">
              🔄 Tuần hoàn
            </button>
            <button onclick="openMediaManagerModal('${t.id}')" class="neo-btn neo-btn-white py-1.5 px-2 text-[11px] font-black shadow-[2px_2px_0px_#18181B] flex-1">
              🖼️ Kho ảnh (${mediaFiles.length})
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
      btn.classList.add('neo-btn-yellow', 'active');
      btn.classList.remove('neo-btn-white', 'text-neutral-700');
    } else {
      btn.classList.remove('neo-btn-yellow', 'active');
      btn.classList.add('neo-btn-white', 'text-neutral-700');
    }
  });
  fetchModelTemplates();
}

function setPriceFilter(range) {
  dataPostFilters.price_range = range;
  document.querySelectorAll('.price-filter-chip').forEach(btn => {
    if (btn.dataset.price === range) {
      btn.classList.add('neo-btn-yellow', 'active');
      btn.classList.remove('neo-btn-white', 'text-neutral-700');
    } else {
      btn.classList.remove('neo-btn-yellow', 'active');
      btn.classList.add('neo-btn-white', 'text-neutral-700');
    }
  });
  fetchModelTemplates();
}

function setStatusFilter(status) {
  dataPostFilters.status = status;
  document.querySelectorAll('.status-filter-chip').forEach(btn => {
    if (btn.dataset.status === status) {
      btn.classList.add('neo-btn-yellow', 'active');
      btn.classList.remove('neo-btn-white', 'text-neutral-700');
    } else {
      btn.classList.remove('neo-btn-yellow', 'active');
      btn.classList.add('neo-btn-white', 'text-neutral-700');
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
    box.className = 'w-14 h-14 rounded border border-[#18181B] overflow-hidden shrink-0 bg-black relative';
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
    box.className = 'neo-card p-2 bg-white flex flex-col gap-2 relative shadow-[2px_2px_0px_#18181B]';

    box.innerHTML = `
      <div class="aspect-square rounded-md overflow-hidden bg-black relative border border-[#18181B]">
        ${isVideo
          ? `<video src="${file.url}" class="w-full h-full object-cover" muted></video><span class="absolute top-1 left-1 bg-rose-600 text-white text-[9px] font-black px-1 rounded">▶ VIDEO</span>`
          : `<img src="${file.url}" class="w-full h-full object-cover" onerror="this.onerror=null;this.src='/icons/icon.svg';" />`
        }
        <span class="absolute bottom-1 left-1 bg-black/80 text-white text-[9px] font-mono px-1 rounded">#${index + 1}</span>
      </div>
      <div class="flex items-center justify-between gap-1">
        <button onclick="copyTextToClipboard('${escapeHtml(file.url)}', '📋 Đã sao chép link ảnh công khai!')" class="neo-btn neo-btn-white px-2 py-1 text-[10px] font-bold flex-1" title="Sao chép link">
          📋 Link
        </button>
        <button onclick="deleteMediaManagerPhoto(${index})" class="neo-btn neo-btn-white px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50" title="Xóa ảnh này">
          🗑️ Xóa
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
      el.className = 'p-3.5 bg-white border-2 border-[#18181B] rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-[2.5px_2.5px_0px_#18181B]';
      el.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="text-xl">⏰</span>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-black text-sm text-[#18181B]">${escapeHtml(item.model_name || item.template_id || 'Model Template')}</span>
              <span class="neo-sticker sticker-lavender text-[10px] font-mono">${escapeHtml(item.rewrite_style || 'AI Rewrite')}</span>
            </div>
            <div class="text-xs text-neutral-600 mt-0.5">
              Thời gian xuất bản: <strong>${scheduledDate}</strong>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="triggerCircularPostNow('${item.id}')" class="neo-btn neo-btn-yellow px-3 py-1.5 text-xs font-black shadow-[2px_2px_0px_#18181B]">
            ⚡ Đăng ngay
          </button>
          <button onclick="deleteCircularQueueItem('${item.id}')" class="neo-btn neo-btn-white px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50" title="Xóa khỏi hàng đợi">
            🗑️
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

