/**
 * LAPTOP VƯƠNG GIA // WEB APP EXTENSION BRIDGE (web_bridge.js)
 * Cầu nối giữa Web App Dashboard (/app) và Chrome Extension
 * Chạy trên http://localhost:3000/* và https://auto-post-fanpage-coral.vercel.app/*
 */

(function () {
  'use strict';

  // Mark the page that the extension is installed and ready
  window.sessionStorage.setItem('vg_extension_installed', 'true');
  document.documentElement.setAttribute('data-vg-extension', 'active');

  console.log('[VG Bridge] Web App Extension Bridge đã sẵn sàng kết nối!');

  // Listen to messages from Web App
  window.addEventListener('message', (event) => {
    // Only accept messages from same origin
    if (event.source !== window) return;

    const data = event.data;
    if (!data || !data.action) return;

    if (data.action === 'VG_TRIGGER_PERSONAL_POST') {
      console.log('[VG Bridge] Nhận yêu cầu đăng bài cá nhân từ Web App:', data.payload);
      
      chrome.runtime.sendMessage({
        action: 'triggerPersonalRobot',
        payload: data.payload
      }, (response) => {
        console.log('[VG Bridge] Phản hồi từ Background Robot:', response);
      });
    }

    if (data.action === 'VG_CHECK_EXTENSION') {
      window.postMessage({
        action: 'VG_EXTENSION_RESPONSE',
        installed: true,
        version: chrome.runtime.getManifest().version
      }, '*');
    }
  });

  // Announce presence to Web App
  window.postMessage({
    action: 'VG_EXTENSION_RESPONSE',
    installed: true,
    version: chrome.runtime.getManifest().version
  }, '*');
})();
