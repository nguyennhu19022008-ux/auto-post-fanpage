// Global App State
let appSettings = {};
let currentMediaFiles = [];
let allPosts = [];
let isPage0Active = true;

// ======================== PAGE 0 LOGIC ========================

function copyContact(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    const originalText = btn.innerText;
    btn.innerText = 'ĐÃ CHÉP';
    btn.style.background = '#10b981';
    btn.style.color = '#fff';
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.background = '#ffffff';
      btn.style.color = '#000000';
    }, 2000);
  });
}

function toggleP0Card(show) {
  const card = document.getElementById('copyrightCard');
  const floating = document.getElementById('floatingReopen');
  if (show) {
    card.style.display = 'block';
    floating.style.display = 'none';
  } else {
    card.style.display = 'none';
    floating.style.display = 'flex';
  }
}

document.getElementById('closeP0Btn')?.addEventListener('click', () => toggleP0Card(false));

function enterDashboard() {
  isPage0Active = false;
  document.getElementById('page0').style.display = 'none';
  document.getElementById('mainApp').classList.remove('hidden');
  initDashboard();
}

function returnToPage0() {
  isPage0Active = true;
  document.getElementById('page0').style.display = 'flex';
  document.getElementById('mainApp').classList.add('hidden');
  toggleP0Card(true);
}

// Keyboard shortcuts for Page 0
window.addEventListener('keydown', (e) => {
  if (isPage0Active) {
    if (e.key === 'ArrowRight' || e.key === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      enterDashboard();
    }
  }
});

// ======================== TAB NAVIGATION ========================

function switchTab(tabName) {
  ['studio', 'queue', 'history', 'settings'].forEach(t => {
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

  if (tabName === 'queue' || tabName === 'history') {
    loadPosts();
  }
}

// ======================== INITIALIZE & SETTINGS ========================

async function initDashboard() {
  await loadSettings();
  await loadNextSlot();
  await loadPosts();
  setupDragAndDrop();
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
    scheduleTimes: document.getElementById('settingScheduleTimes').value.split(',').map(s => s.trim()).filter(Boolean)
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
      resultDiv.innerHTML = `<span class="text-emerald-400 font-semibold">✅ Kết nối thành công tới Trang: <strong>${data.pageInfo.name}</strong> (ID: ${data.pageInfo.id})</span>`;
    } else {
      resultDiv.innerHTML = `<span class="text-red-400">❌ ${data.error}</span>`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span class="text-red-400">❌ Lỗi: ${err.message}</span>`;
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
  if (files.length) uploadMediaFiles(files);
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
    item.className = 'relative group rounded-lg overflow-hidden border border-white/20 bg-black aspect-video flex items-center justify-center';

    if (isVideo) {
      item.innerHTML = `
        <video src="${file.url}" class="w-full h-full object-cover"></video>
        <div class="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <span class="text-white text-lg font-bold">▶ Video</span>
        </div>
        <button onclick="removeMediaItem(${index})" class="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
      `;
    } else {
      item.innerHTML = `
        <img src="${file.url}" class="w-full h-full object-cover">
        <button onclick="removeMediaItem(${index})" class="absolute top-1 right-1 bg-red-600 hover:bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition">✕</button>
      `;
    }

    container.appendChild(item);
  });

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

  // Render media preview in FB feed layout
  if (currentMediaFiles.length === 0) {
    mediaContainer.classList.add('hidden');
    mediaContainer.innerHTML = '';
  } else {
    mediaContainer.classList.remove('hidden');
    const count = currentMediaFiles.length;
    mediaContainer.className = `fb-media-grid grid-${Math.min(count, 4)}`;

    mediaContainer.innerHTML = currentMediaFiles.slice(0, 4).map((f, idx) => {
      const isVideo = f.mimetype?.startsWith('video/') || /\.(mp4|mov|avi)$/i.test(f.url);
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

    const queuedPosts = allPosts.filter(p => p.status === 'queued' || p.status === 'processing');
    const historyPosts = allPosts.filter(p => p.status === 'posted' || p.status === 'failed');

    document.getElementById('queueCount').innerText = queuedPosts.length;
    document.getElementById('historyCount').innerText = historyPosts.length;

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
      <div class="glass-panel p-8 text-center text-slate-400 space-y-2">
        <div class="text-3xl">📭</div>
        <div class="text-sm font-semibold">Chưa có bài viết nào trong hàng đợi</div>
        <p class="text-xs">Hãy qua mục <strong>AI Studio</strong> để dán tin nhắn Zalo và lên lịch đăng bài.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(post => {
    const scheduledDate = new Date(post.scheduledTime).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
    });
    const firstImg = post.mediaFiles?.[0]?.url;

    return `
      <div class="glass-panel p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div class="flex gap-4 items-center">
          ${firstImg ? `<img src="${firstImg}" class="w-16 h-16 rounded-lg object-cover border border-white/10">` : `<div class="w-16 h-16 rounded-lg bg-neutral-800 flex items-center justify-center text-xs text-neutral-500 font-mono">No Media</div>`}
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">Mã: #${post.machineCode}</span>
              <span class="text-xs text-amber-300 font-semibold">${post.price ? post.price : ''}</span>
            </div>
            <div class="text-xs text-slate-300 mt-1 line-clamp-1 max-w-lg font-medium">${post.content.split('\n')[0]}</div>
            <div class="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>⏰ Giờ đăng: <strong class="text-emerald-400 font-mono">${scheduledDate}</strong></span>
              <span>·</span>
              <span>📁 ${post.mediaFiles?.length || 0} media</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
          <button onclick="publishPostNow('${post.id}')" class="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1 transition">
            <span>⚡ Đăng ngay</span>
          </button>
          <button onclick="deletePost('${post.id}')" class="px-2.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-300 text-xs border border-red-500/30 transition">
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
      <div class="glass-panel p-8 text-center text-slate-400 space-y-2">
        <div class="text-3xl">📝</div>
        <div class="text-sm font-semibold">Chưa có bài viết nào được đăng</div>
      </div>
    `;
    return;
  }

  container.innerHTML = posts.map(post => {
    const isSuccess = post.status === 'posted';
    const postDate = new Date(post.postedAt || post.failedAt || post.createdAt).toLocaleString('vi-VN');
    const firstImg = post.mediaFiles?.[0]?.url;

    return `
      <div class="glass-panel p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div class="flex gap-4 items-center">
          ${firstImg ? `<img src="${firstImg}" class="w-16 h-16 rounded-lg object-cover border border-white/10">` : `<div class="w-16 h-16 rounded-lg bg-neutral-800 flex items-center justify-center text-xs text-neutral-500 font-mono">No Media</div>`}
          <div>
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-xs font-bold ${isSuccess ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
                ${isSuccess ? '✅ Đã đăng thành công' : '❌ Thất bại'}
              </span>
              <span class="text-xs font-mono text-slate-300">#${post.machineCode}</span>
              ${post.isSimulation ? `<span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">Mô phỏng (Test)</span>` : ''}
            </div>
            <div class="text-xs text-slate-300 mt-1 line-clamp-1 max-w-lg">${post.content.split('\n')[0]}</div>
            <div class="text-xs text-slate-400 mt-1">
              <span>Đăng lúc: ${postDate}</span>
              ${post.errorMessage ? `<span class="text-red-400 ml-2">(${post.errorMessage})</span>` : ''}
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto justify-end">
          ${post.fbPostUrl ? `
            <a href="${post.fbPostUrl}" target="_blank" class="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-blue-400 font-semibold text-xs flex items-center gap-1 border border-neutral-700 transition">
              <span>Xem trên FB ↗</span>
            </a>
          ` : ''}
          <button onclick="deletePost('${post.id}')" class="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-red-950 text-slate-400 hover:text-red-300 text-xs transition">
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
