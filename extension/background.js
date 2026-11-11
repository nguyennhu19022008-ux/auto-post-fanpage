/**
 * LAPTOP VƯƠNG GIA // EXTENSION BACKGROUND SERVICE WORKER (MV3)
 * Handles cross-origin requests to bypass Zalo Web page CSP
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VG Zalo Extension] Background service worker đã khởi động thành công!');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Gửi dữ liệu về máy chủ (Fanpage / Storage / Gemini AI)
  if (request.action === 'pushPost') {
    const serverUrl = request.serverUrl || 'https://auto-post-fanpage-coral.vercel.app';
    const endpoint = `${serverUrl}/api/extension/push-post`;

    fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request.payload)
    })
      .then(async (res) => {
        const json = await res.json().catch(() => ({ success: false, error: 'Phản hồi không phải JSON hợp lệ' }));
        sendResponse({ success: res.ok && json.success, data: json });
      })
      .catch((err) => {
        console.error('[VG Extension SW] Lỗi fetch:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true; // Keep message channel open for async response
  }

  // 2. Kích hoạt Robot Tự Động Hóa Đăng Bài lên Facebook Cá Nhân
  if (request.action === 'triggerPersonalRobot') {
    const payload = request.payload;

    chrome.storage.local.set({ vg_pending_personal_post: payload }, () => {
      chrome.tabs.query({ url: "*://*.facebook.com/*" }, (tabs) => {
        if (tabs && tabs.length > 0) {
          const fbTab = tabs[0];
          chrome.tabs.update(fbTab.id, { active: true }, () => {
            chrome.tabs.sendMessage(fbTab.id, { action: 'executePersonalPost', payload }, () => {
              sendResponse({ success: true, status: 'existing_tab_focused' });
            });
          });
        } else {
          chrome.tabs.create({ url: 'https://www.facebook.com/', active: true }, () => {
            sendResponse({ success: true, status: 'new_tab_opened' });
          });
        }
      });
    });

    return true;
  }
});
