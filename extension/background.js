/**
 * LAPTOP VƯƠNG GIA // EXTENSION BACKGROUND SERVICE WORKER (MV3)
 * Handles cross-origin requests to bypass Zalo Web page CSP
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VG Zalo Extension] Background service worker đã khởi động thành công!');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
});
