/**
 * LAPTOP VƯƠNG GIA // WEB APP EXTENSION BRIDGE (web_bridge.js v1.6.0)
 * Cầu nối hai chiều giữa Web App Dashboard (/app) và Chrome Extension
 */

(function () {
  'use strict';

  window.sessionStorage.setItem('vg_extension_installed', 'true');
  document.documentElement.setAttribute('data-vg-extension', 'active');

  console.log('[VG Bridge v1.6.0] Web App Extension Bridge đã sẵn sàng kết nối!');

  function replyToPage(action, data) {
    window.postMessage({ action, ...data }, '*');
  }

  function safeSend(msg, responseAction, fallbackError) {
    chrome.runtime.sendMessage(msg, (resp) => {
      if (chrome.runtime.lastError || !resp) {
        if (responseAction) {
          replyToPage(responseAction, { success: false, error: fallbackError || 'Extension không phản hồi' });
        }
        return;
      }
      if (responseAction) replyToPage(responseAction, resp);
    });
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || !data.action) return;

    if (data.action === 'VG_TRIGGER_PERSONAL_POST') {
      safeSend({ action: 'triggerPersonalRobot', payload: data.payload }, null);
    }

    if (data.action === 'VG_CHECK_EXTENSION') {
      replyToPage('VG_EXTENSION_RESPONSE', {
        installed: true,
        version: chrome.runtime.getManifest().version
      });
    }

    if (data.action === 'VG_GET_EXTENSION_CONFIG') {
      safeSend({ action: 'getFullExtensionState' }, 'VG_EXTENSION_CONFIG_DATA', null);
    }

    if (data.action === 'VG_SAVE_EXTENSION_CONFIG') {
      safeSend({ action: 'saveExtensionConfig', config: data.config || {} }, 'VG_EXTENSION_CONFIG_SAVED', 'Chưa lưu được cấu hình');
    }

    if (data.action === 'VG_SCAN_JOINED_GROUPS') {
      safeSend({ action: 'scanJoinedGroupsNow' }, 'VG_SCAN_JOINED_GROUPS_RESULT', 'Không quét được danh sách nhóm');
    }

    if (data.action === 'VG_SHARE_TO_GROUPS_NOW') {
      safeSend({
        action: data.payload ? 'shareSpecificPostToGroups' : 'shareLatestToGroupsNow',
        payload: data.payload || null
      }, 'VG_SHARE_TO_GROUPS_RESULT', 'Không kích hoạt được chia sẻ nhóm');
    }

    if (data.action === 'VG_RUN_DUE_PERSONAL_NOW') {
      safeSend({ action: 'runAutoPersonalCheckNow' }, 'VG_RUN_DUE_PERSONAL_RESULT', 'Extension không phản hồi');
    }

    if (data.action === 'VG_STOP_GROUP_QUEUE') {
      safeSend({ action: 'stopGroupShareQueue' }, 'VG_STOP_GROUP_QUEUE_RESULT', 'Không dừng được hàng đợi');
    }

    if (data.action === 'VG_RETRY_FAILED_GROUPS') {
      safeSend({ action: 'retryFailedGroupLogs', logId: data.logId || null }, 'VG_RETRY_FAILED_GROUPS_RESULT', 'Không thử lại được');
    }

    if (data.action === 'VG_REMOVE_GROUP_URL') {
      safeSend({ action: 'removeGroupUrlFromList', groupUrl: data.groupUrl }, 'VG_REMOVE_GROUP_URL_RESULT', 'Không xóa được link nhóm');
    }

    if (data.action === 'VG_CLEAR_GROUP_LOGS') {
      safeSend({ action: 'clearGroupShareLogs' }, 'VG_CLEAR_GROUP_LOGS_RESULT', null);
    }
  });

  replyToPage('VG_EXTENSION_RESPONSE', {
    installed: true,
    version: chrome.runtime.getManifest().version
  });
})();
