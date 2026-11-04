document.addEventListener('DOMContentLoaded', () => {
  const urlInput = document.getElementById('backendUrlInput');
  const statusDiv = document.getElementById('connectionStatus');
  const saveBtn = document.getElementById('saveBtn');
  const openDashboardBtn = document.getElementById('openDashboardBtn');

  // Load saved backend URL
  if (chrome.storage && chrome.storage.sync) {
    chrome.storage.sync.get(['backendUrl'], (result) => {
      if (result.backendUrl) {
        urlInput.value = result.backendUrl;
      }
      checkConnection(urlInput.value);
    });
  } else {
    checkConnection(urlInput.value);
  }

  // Save backend URL
  saveBtn.addEventListener('click', () => {
    const val = urlInput.value.trim().replace(/\/$/, '');
    if (!val) return;

    if (chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.set({ backendUrl: val }, () => {
        saveBtn.innerText = '✅ Đã lưu!';
        setTimeout(() => saveBtn.innerText = '💾 Lưu Cấu Hình', 1500);
        checkConnection(val);
      });
    } else {
      checkConnection(val);
    }
  });

  // Open Web Dashboard
  openDashboardBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: urlInput.value || 'https://auto-post-fanpage-coral.vercel.app' });
  });

  async function checkConnection(url) {
    statusDiv.className = 'status-pill';
    statusDiv.innerHTML = '<span>⏳</span> Đang kiểm tra...';
    try {
      const res = await fetch(`${url}/api/settings`, { method: 'GET' });
      if (res.ok) {
        statusDiv.className = 'status-pill status-online';
        statusDiv.innerHTML = '<span style="font-size: 8px;">●</span> Đã kết nối Fanpage tốt!';
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (e) {
      statusDiv.className = 'status-pill status-offline';
      statusDiv.innerHTML = '<span style="font-size: 8px;">●</span> Không kết nối được';
    }
  }
});
