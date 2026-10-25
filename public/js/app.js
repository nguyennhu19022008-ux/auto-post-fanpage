// Global App State
let appSettings = {};
let currentMediaFiles = [];
let allPosts = [];
let parsedTableItems = [];
let isDashboardInitialized = false;

// Auto-initialize Dashboard on page load
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initDashboard();
}

// ======================== TAB NAVIGATION ========================

function switchTab(tabName) {
  ['studio', 'table', 'queue', 'history', 'settings'].forEach(t => {
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
  ['studio', 'table', 'queue', 'history', 'settings'].forEach(t => {
    const mobileBtn = document.getElementById(`mobileDockBtn-${t}`);
    if (mobileBtn) {
      if (t === tabName) {
        mobileBtn.classList.add('active');
      } else {
        mobileBtn.classList.remove('active');
      }
    }
  });

  if (tabName === 'queue' || tabName === 'history') {
    loadPosts();
  }
}

// ======================== INITIALIZE & SETTINGS ========================

async function initDashboard() {
  if (isDashboardInitialized) return;
  isDashboardInitialized = true;
  await loadSettings();
  await loadNextSlot();
  await loadPosts();
  setupDragAndDrop();
  setupTableDragAndDrop();
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
    smtpPass: document.getElementById('settingSmtpPass')?.value.trim() || ''
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
      currentMediaFiles = [...currentMediaFiles, ...result.files];
      renderMediaPreviews();
    }
  } catch (err) {
    alert('Lỗi tải tệp: ' + err.message);
  } finally {
    mediaCountText.innerText = `${currentMediaFiles.length} tệp đã chọn`;
  }
}

function removeMediaItem(index) {
  currentMediaFiles.splice(index, 1);
  renderMediaPreviews();
  document.getElementById('mediaCountText').innerText = `${currentMediaFiles.length} tệp đã chọn`;
}

function renderMediaPreviews() {
  const container = document.getElementById('mediaPreviews');
  container.innerHTML = '';

  currentMediaFiles.forEach((file, index) => {
    const isVideo = file.mimetype?.startsWith('video/') || /\.(mp4|mov|avi)$/i.test(file.url);
    const item = document.createElement('div');
    item.className = 'relative group rounded-lg overflow-hidden border-2 border-[#18181B] bg-black aspect-video flex items-center justify-center shadow-[2px_2px_0px_#18181B]';

    if (isVideo) {
      item.innerHTML = `
        <video src="${file.url}" class="w-full h-full object-cover"></video>
        <div class="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <span class="text-white text-xs font-bold font-mono">▶ Video</span>
        </div>
        <span class="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] px-1 font-mono rounded">#${index + 1}</span>
        <button onclick="removeMediaItem(${index})" class="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow">✕</button>
      `;
    } else {
      item.innerHTML = `
        <img src="${file.url}" class="w-full h-full object-cover">
        <span class="absolute bottom-1 left-1 bg-black/75 text-white text-[9px] px-1 font-mono rounded">#${index + 1}</span>
        <button onclick="removeMediaItem(${index})" class="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition shadow">✕</button>
      `;
    }

    container.appendChild(item);
  });

  // If there are already files uploaded, render a "+ Thêm ảnh khác" tile in the gallery
  if (currentMediaFiles.length > 0) {
    const addMoreTile = document.createElement('div');
    addMoreTile.className = 'border-2 border-dashed border-[#18181B] bg-white hover:bg-[#FEF08A]/50 rounded-lg aspect-video flex flex-col items-center justify-center cursor-pointer transition shadow-[2px_2px_0px_#18181B] text-center p-2';
    addMoreTile.onclick = () => document.getElementById('fileInput').click();
    addMoreTile.innerHTML = `
      <span class="text-2xl font-bold text-[#18181B] leading-none">+</span>
      <span class="text-[10px] font-black uppercase text-[#18181B] mt-1">Thêm ảnh khác</span>
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
      const isVideo = f.mimetype?.startsWith('video/') || /\.(mp4|mov|avi)$/i.test(f.url);
      
      // If 5+ photos, display "+N" overlay on the 4th item like real Facebook
      if (idx === 3 && currentMediaFiles.length > 4) {
        const remaining = currentMediaFiles.length - 3;
        return `
          <div class="relative w-full h-full min-h-[140px] bg-black overflow-hidden">
            <img src="${f.url}" class="w-full h-full object-cover opacity-60">
            <div class="absolute inset-0 flex items-center justify-center text-white text-2xl font-black">
              +${remaining}
            </div>
          </div>
        `;
      }

      if (isVideo) {
        return `<video src="${f.url}" class="fb-media-item" controls></video>`;
      } else {
        return `<img src="${f.url}" class="fb-media-item">`;
      }
    }).join('');
  }
}

// ======================== SCHEDULE & PUBLISH POSTS ========================

async function schedulePost(publishImmediately = false) {
  const content = document.getElementById('finalContentInput').value.trim();
  const machineCode = document.getElementById('machineCodeInput').value.trim();
  const price = document.getElementById('customPriceInput').value.trim();
  const suggestedSlot = document.getElementById('suggestedSlotText').dataset.raw;

  if (!content) {
    alert('Vui lòng tạo hoặc soạn nội dung bài viết trước khi lên lịch/đăng.');
    return;
  }

  const postPayload = {
    machineCode: machineCode || 'MÁY',
    content,
    price,
    mediaFiles: currentMediaFiles,
    scheduledTime: publishImmediately ? new Date().toISOString() : suggestedSlot,
    publishImmediately
  };

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postPayload)
    });
    const result = await res.json();

    if (result.success) {
      alert(publishImmediately ? '🚀 ' + result.message : '📅 ' + result.message);
      clearRawInput();
      await loadNextSlot();
      await loadPosts();
      switchTab(publishImmediately ? 'history' : 'queue');
    }
  } catch (err) {
    alert('Lỗi đăng bài: ' + err.message);
  }
}

// ======================== POSTS LIST (QUEUE & HISTORY) ========================

async function loadPosts() {
  try {
    const res = await fetch('/api/posts');
    allPosts = await res.json();

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
    const mCount = post.mediaFiles?.length || 0;

    let mediaThumbHtml = '';
    if (mCount === 0) {
      mediaThumbHtml = `<div class="w-16 h-16 rounded-lg bg-[#FAF5EE] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] flex items-center justify-center text-[10px] text-neutral-400 font-bold font-mono text-center p-1">Chưa có ảnh</div>`;
    } else if (mCount === 1) {
      mediaThumbHtml = `<img src="${post.mediaFiles[0].url}" class="w-16 h-16 rounded-lg object-cover border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">`;
    } else {
      mediaThumbHtml = `
        <div class="relative w-16 h-16 rounded-lg overflow-hidden border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">
          <img src="${post.mediaFiles[0].url}" class="w-full h-full object-cover">
          <span class="absolute bottom-0 right-0 bg-[#FDE047] text-black text-[10px] px-1 font-black border-t border-l border-[#18181B]">
            +${mCount}
          </span>
        </div>
      `;
    }

    return `
      <div class="neo-card p-4 sm:p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white shadow-[3px_3px_0px_#18181B]">
        <div class="flex gap-4 items-center">
          ${mediaThumbHtml}
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="neo-sticker sticker-lavender font-mono font-bold">#${post.machineCode}</span>
              ${post.price ? `<span class="neo-sticker sticker-yellow font-bold">${post.price}</span>` : ''}
              ${post.status === 'pending_media' ? `<span class="neo-sticker sticker-yellow text-[11px] font-bold">📬 Chờ ảnh (nhắc trước 20p)</span>` : ''}
              ${post.status === 'queued' ? `<span class="neo-sticker sticker-green text-[11px] font-bold">⏳ Sẵn sàng đăng (${mCount} ảnh)</span>` : ''}
              ${post.status === 'skipped_no_media' ? `<span class="neo-sticker sticker-coral text-[11px] font-bold">⚠️ Bỏ qua (thiếu ảnh)</span>` : ''}
              ${post.status === 'processing' ? `<span class="neo-sticker sticker-lavender text-[11px] font-bold">⚙️ Đang đăng</span>` : ''}
            </div>
            <div class="text-xs text-[#18181B] font-bold mt-1.5 line-clamp-1 max-w-lg">${post.content.split('\n')[0]}</div>
            <div class="text-xs text-neutral-500 font-medium mt-1 flex items-center gap-2">
              <span>⏰ Giờ hẹn: <strong class="text-emerald-700 font-mono">${scheduledDate}</strong></span>
              <span>·</span>
              <span>📁 <strong class="text-indigo-700">${mCount} ảnh/video</strong></span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
          <a href="/quick-upload?id=${post.id}" target="_blank" class="neo-btn neo-btn-lavender px-3 py-1.5 text-xs font-black" title="Xem hoặc thêm ảnh/video">
            <span>📸 ${mCount > 0 ? `Thêm ảnh (${mCount})` : 'Nạp ảnh'}</span>
          </a>
          <button onclick="publishPostNow('${post.id}')" class="neo-btn neo-btn-yellow px-3 py-1.5 text-xs font-black">
            <span>⚡ Đăng ngay</span>
          </button>
          <button onclick="deletePost('${post.id}')" class="neo-btn neo-btn-white px-2.5 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">
            <span>Xóa</span>
          </button>
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
    const firstImg = post.mediaFiles?.[0]?.url;

    return `
      <div class="neo-card p-4 sm:p-5 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white shadow-[3px_3px_0px_#18181B]">
        <div class="flex gap-4 items-center">
          ${firstImg ? `<img src="${firstImg}" class="w-16 h-16 rounded-lg object-cover border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B]">` : `<div class="w-16 h-16 rounded-lg bg-[#FAF5EE] border-2 border-[#18181B] shadow-[2px_2px_0px_#18181B] flex items-center justify-center text-xs text-neutral-500 font-bold font-mono">No Media</div>`}
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="neo-sticker ${isSuccess ? 'sticker-green' : 'sticker-coral'}">
                ${isSuccess ? '✅ Đã đăng thành công' : '❌ Thất bại'}
              </span>
              <span class="neo-sticker sticker-lavender font-mono">#${post.machineCode}</span>
              ${post.isSimulation ? `<span class="neo-sticker sticker-yellow text-[10px]">Mô phỏng (Test)</span>` : ''}
            </div>
            <div class="text-xs text-[#18181B] font-bold mt-1.5 line-clamp-1 max-w-lg">${post.content.split('\n')[0]}</div>
            <div class="text-xs text-neutral-500 font-medium mt-1">
              <span>Đăng lúc: <strong>${postDate}</strong></span>
              ${post.errorMessage ? `<span class="text-red-600 ml-2">(${post.errorMessage})</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
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
    `;
  }).join('');
}

async function publishPostNow(id) {
  if (!confirm('Bạn có chắc muốn đăng bài viết này lên Fanpage ngay bây giờ không?')) return;
  try {
    const res = await fetch(`/api/posts/${id}/publish-now`, { method: 'POST' });
    const result = await res.json();
    alert(result.message || 'Đã thực hiện xong!');
    await loadPosts();
  } catch (err) {
    alert('Lỗi đăng ngay: ' + err.message);
  }
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

// ======================== BATCH STOCK TABLE & OCR ========================

function setupTableDragAndDrop() {
  const dropZone = document.getElementById('tableDropZone');
  const fileInput = document.getElementById('tableFileInput');
  if (!dropZone || !fileInput) return;

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      parseTableImageFile(e.target.files[0]);
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
    if (files && files[0]) {
      parseTableImageFile(files[0]);
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
      parsedTableItems = data.items.map((item, idx) => ({
        ...item,
        selected: true,
        originalIndex: idx
      }));
      renderParsedTable(parsedTableItems);
      updateSelectedCount();
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

function parseTableImageFile(file) {
  if (!file.type.startsWith('image/')) {
    alert('Vui lòng chọn một tệp hình ảnh (PNG, JPG, WebP)!');
    return;
  }

  const reader = new FileReader();
  const loading = document.getElementById('dropZoneLoading');
  const idle = document.getElementById('dropZoneIdle');
  const previewBar = document.getElementById('tableImagePreviewBar');
  const previewThumb = document.getElementById('tableImageThumbnail');
  const previewName = document.getElementById('tableImageFileName');

  if (loading) loading.classList.remove('hidden');
  if (idle) idle.classList.add('hidden');

  reader.onload = async (e) => {
    const base64Data = e.target.result;
    if (previewThumb) previewThumb.src = base64Data;
    if (previewName) previewName.innerText = file.name;
    if (previewBar) previewBar.classList.remove('hidden');

    try {
      const res = await fetch('/api/parse-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64Data })
      });
      const data = await res.json();

      if (data.success && data.items && data.items.length > 0) {
        parsedTableItems = data.items.map((item, idx) => ({
          ...item,
          selected: true,
          originalIndex: idx
        }));
        renderParsedTable(parsedTableItems);
        updateSelectedCount();
      } else {
        alert('Không tìm thấy dữ liệu máy trong ảnh: ' + (data.error || 'Vui lòng thử ảnh rõ nét hơn.'));
      }
    } catch (err) {
      alert('Lỗi xử lý bảng: ' + err.message);
    } finally {
      if (loading) loading.classList.add('hidden');
      if (idle) idle.classList.remove('hidden');
    }
  };

  reader.readAsDataURL(file);
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
  const content = document.getElementById('previewModalContent');

  if (title) title.innerText = `BÀI ĐĂNG FACEBOOK · MÃ #${item.machineCode}: ${item.machineName}`;
  if (content) content.innerText = item.postContent || 'Chưa có nội dung.';
  if (modal) modal.classList.remove('hidden');
}

function closePostPreviewModal() {
  const modal = document.getElementById('postPreviewModal');
  if (modal) modal.classList.add('hidden');
}

function copyPreviewModalContent() {
  const content = document.getElementById('previewModalContent')?.innerText;
  if (!content) return;
  navigator.clipboard.writeText(content).then(() => {
    alert('📋 Đã sao chép nội dung bài đăng!');
  });
}

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
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('✅ ServiceWorker registered:', reg.scope);
      })
      .catch(err => {
        console.warn('⚠️ ServiceWorker registration failed:', err);
      });
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
