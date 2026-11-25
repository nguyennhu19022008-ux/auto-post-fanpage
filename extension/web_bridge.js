/**
 * LAPTOP VƯƠNG GIA // WEB APP EXTENSION BRIDGE (web_bridge.js v1.5.0)
 * Cầu nối hai chiều giữa Web App Dashboard (/app) và Chrome Extension
 */

(function () {
  'use strict';

  window.sessionStorage.setItem('vg_extension_installed', 'true');
  document.documentElement.setAttribute('data-vg-extension', 'active');

  console.log('[VG Bridge v1.5.0] Web App Extension Bridge đã sẵn sàng kết nối!');

  function replyToPage(action, data) {
    window.postMessage({ action, ...data }, '*');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    const data = event.data;
    if (!data || !data.action) return;

    if (data.action === 'VG_TRIGGER_PERSONAL_POST') {
      chrome.runtime.sendMessage({
        action: 'triggerPersonalRobot',
        payload: data.payload
      }, () => { void chrome.runtime.lastError; });
    }

    if (data.action === 'VG_CHECK_EXTENSION') {
      replyToPage('VG_EXTENSION_RESPONSE', {
        installed: true,
        version: chrome.runtime.getManifest().version
      });
    }

    if (data.action === 'VG_GET_EXTENSION_CONFIG') {
      chrome.runtime.sendMessage({ action: 'getFullExtensionState' }, (resp) => {
        if (chrome.runtime.lastError || !resp) return;
        replyToPage('VG_EXTENSION_CONFIG_DATA', resp);
      });
    }

    if (data.action === 'VG_SAVE_EXTENSION_CONFIG') {
      chrome.runtime.sendMessage({
        action: 'saveExtensionConfig',
        config: data.config || {}
      }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          return replyToPage('VG_EXTENSION_CONFIG_SAVED', { success: false, error: 'Extension không phản hồi' });
        }
        replyToPage('VG_EXTENSION_CONFIG_SAVED', resp);
      });
    }

    if (data.action === 'VG_SCAN_JOINED_GROUPS') {
      chrome.runtime.sendMessage({ action: 'scanJoinedGroupsNow' }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          return replyToPage('VG_SCAN_JOINED_GROUPS_RESULT', { success: false, error: 'Không quét được danh sách nhóm' });
        }
        replyToPage('VG_SCAN_JOINED_GROUPS_RESULT', resp);
      });
    }

    if (data.action === 'VG_SHARE_TO_GROUPS_NOW') {
      chrome.runtime.sendMessage({
        action: data.payload ? 'shareSpecificPostToGroups' : 'shareLatestToGroupsNow',
        payload: data.payload || null
      }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          return replyToPage('VG_SHARE_TO_GROUPS_RESULT', { success: false, error: 'Không kích hoạt được chia sẻ nhóm' });
        }
        replyToPage('VG_SHARE_TO_GROUPS_RESULT', resp);
      });
    }

    if (data.action === 'VG_RUN_DUE_PERSONAL_NOW') {
      chrome.runtime.sendMessage({ action: 'runAutoPersonalCheckNow' }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          return replyToPage('VG_RUN_DUE_PERSONAL_RESULT', { success: false, error: 'Extension không phản hồi' });
        }
        replyToPage('VG_RUN_DUE_PERSONAL_RESULT', resp);
      });
    }
  });

  replyToPage('VG_EXTENSION_RESPONSE', {
    installed: true,
    version: chrome.runtime.getManifest().version
  });
})();
