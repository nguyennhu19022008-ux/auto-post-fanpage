/**
 * LAPTOP VƯƠNG GIA // EXTENSION BACKGROUND SERVICE WORKER (MV3 v1.3.0)
 * - Bypass Zalo Web CSP for API pushes
 * - Auto-Schedule Personal Profile Alarm Runner (runs silently when Chrome is open)
 */

const DEFAULT_BACKEND_URL = 'https://auto-post-fanpage-coral.vercel.app';
const ALARM_NAME = 'vgAutoPersonalCheck';
const MIN_AUTO_POST_GAP_MS = 5 * 60 * 1000; // 5 phút tối thiểu giữa 2 bài tự đăng cá nhân để tránh spam checkpoint

function ensureAlarmConfigured() {
  if (chrome.alarms) {
    chrome.alarms.get(ALARM_NAME, (existing) => {
      if (!existing) {
        chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
      }
    });
  }
}

function isHomeOrProfileUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (!u.hostname.endsWith('facebook.com')) return false;
    return u.pathname === '/' || u.pathname.startsWith('/profile') || u.pathname.startsWith('/me');
  } catch (e) {
    return false;
  }
}

function dispatchToFacebookTab(payload, callback) {
  chrome.storage.local.set({ vg_pending_personal_post: payload }, () => {
    chrome.tabs.query({ url: '*://*.facebook.com/*' }, (tabs) => {
      // Chỉ tái sử dụng tab Trang Chủ hoặc Trang Cá Nhân (tránh Watch/Marketplace/Group/Messenger)
      const suitableTab = (tabs || []).find(t => t.url && isHomeOrProfileUrl(t.url));

      if (suitableTab) {
        chrome.tabs.update(suitableTab.id, { active: true }, () => {
          chrome.tabs.sendMessage(suitableTab.id, { action: 'executePersonalPost', payload }, () => {
            if (chrome.runtime.lastError) {
              chrome.tabs.update(suitableTab.id, { url: 'https://www.facebook.com/' }, () => {
                if (callback) callback({ success: true, status: 'reloaded_tab', tabId: suitableTab.id });
              });
            } else {
              chrome.storage.local.remove(['vg_pending_personal_post']);
              if (callback) callback({ success: true, status: 'existing_tab_dispatched', tabId: suitableTab.id });
            }
          });
        });
      } else {
        // Mở tab active để Lexical Editor focus & execCommand hoạt động 100%, xong tự đóng nếu autoTriggered
        chrome.tabs.create({ url: 'https://www.facebook.com/', active: true }, (newTab) => {
          if (payload.autoTriggered && newTab && newTab.id) {
            chrome.storage.local.set({ vg_auto_opened_tab_id: newTab.id });
          }
          if (callback) callback({ success: true, status: 'new_tab_opened', tabId: newTab?.id });
        });
      }
    });
  });
}

async function getExtensionConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      ['backendUrl', 'autoPersonalEnabled', 'autoPersonalIncludeFanpage'],
      (res) => {
        resolve({
          backendUrl: (res.backendUrl || DEFAULT_BACKEND_URL).trim().replace(/\/$/, ''),
          autoPersonalEnabled: res.autoPersonalEnabled !== false, // Mặc định BẬT
          autoPersonalIncludeFanpage: res.autoPersonalIncludeFanpage !== false // Mặc định ĐỒNG BỘ cả bài Fanpage đến hạn
        });
      }
    );
  });
}

async function checkAndRunDuePersonalPosts(forceManual = false) {
  const config = await getExtensionConfig();
  if (!config.autoPersonalEnabled && !forceManual) {
    return { skipped: true, reason: 'disabled' };
  }

  const localState = await new Promise((resolve) => {
    chrome.storage.local.get(['vg_dispatched_personal_ids', 'vg_last_auto_personal_at'], resolve);
  });

  const dispatchedMap = localState.vg_dispatched_personal_ids || {};
  const lastAutoAt = localState.vg_last_auto_personal_at || 0;
  const now = Date.now();

  if (!forceManual && now - lastAutoAt < MIN_AUTO_POST_GAP_MS) {
    return { skipped: true, reason: 'cooldown_gap' };
  }

  try {
    const url = `${config.backendUrl}/api/extension/due-personal-posts?includeFanpage=${config.autoPersonalIncludeFanpage ? '1' : '0'}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const dueList = (data.posts || []).filter(p => !dispatchedMap[p.id]);
    await new Promise((r) => chrome.storage.local.set({
      vg_last_alarm_check: new Date().toISOString(),
      vg_last_due_count: dueList.length
    }, r));

    if (dueList.length === 0) {
      return { checked: true, dueCount: 0 };
    }

    // Chỉ lấy đúng 1 bài đến giờ sớm nhất mỗi lần chạy để tránh Facebook spam
    const nextPost = dueList[0];
    dispatchedMap[nextPost.id] = now;

    // Dọn bớt lịch sử cũ hơn 7 ngày
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    for (const [k, ts] of Object.entries(dispatchedMap)) {
      if (now - ts > sevenDaysMs) delete dispatchedMap[k];
    }

    await new Promise((r) => chrome.storage.local.set({
      vg_dispatched_personal_ids: dispatchedMap,
      vg_last_auto_personal_at: now
    }, r));

    console.log(`[VG Auto-Personal] 🤖 Đang tự động kích hoạt đăng bài #${nextPost.machineCode} (${nextPost.id}) lên Trang Cá Nhân...`);

    return await new Promise((resolve) => {
      dispatchToFacebookTab({
        postId: nextPost.id,
        machineCode: nextPost.machineCode || 'MÁY',
        content: nextPost.content,
        mediaUrls: nextPost.mediaUrls || [],
        autoTriggered: true
      }, (dispatchResp) => {
        resolve({ checked: true, dispatched: true, postId: nextPost.id, remainingDue: dueList.length - 1, dispatchResp });
      });
    });
  } catch (err) {
    console.warn('[VG Auto-Personal] Lỗi kiểm tra lịch:', err.message);
    return { error: err.message };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VG Zalo Extension v1.3.0] Background service worker đã khởi động!');
  ensureAlarmConfigured();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarmConfigured();
  setTimeout(() => checkAndRunDuePersonalPosts(false), 5000);
});

ensureAlarmConfigured();

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      checkAndRunDuePersonalPosts(false);
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // 1. Gửi dữ liệu về máy chủ (Fanpage / Storage / Gemini AI)
  if (request.action === 'pushPost') {
    const serverUrl = request.serverUrl || DEFAULT_BACKEND_URL;
    const endpoint = `${serverUrl}/api/extension/push-post`;

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

    return true;
  }

  // 2. Kích hoạt thủ công Robot Tự Động Hóa Đăng Bài lên Facebook Cá Nhân
  if (request.action === 'triggerPersonalRobot') {
    dispatchToFacebookTab(request.payload || {}, sendResponse);
    return true;
  }

  // 3. Robot báo cáo đã xuất bản xong lên Trang Cá Nhân -> đồng bộ Backend & đóng tab tự động nếu cần
  if (request.action === 'personalPostCompleted') {
    (async () => {
      const config = await getExtensionConfig();
      if (request.postId) {
        try {
          await fetch(`${config.backendUrl}/api/extension/personal-posted`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              postId: request.postId,
              success: !!request.success,
              errorMessage: request.error || ''
            })
          });
        } catch (e) {
          console.warn('[VG Auto-Personal] Lỗi đồng bộ trạng thái:', e.message);
        }
      }

      if (request.autoTriggered && request.success && sender && sender.tab && sender.tab.id) {
        chrome.storage.local.get(['vg_auto_opened_tab_id'], (st) => {
          if (st.vg_auto_opened_tab_id === sender.tab.id) {
            chrome.storage.local.remove(['vg_auto_opened_tab_id']);
            setTimeout(() => {
              chrome.tabs.remove(sender.tab.id, () => {
                void chrome.runtime.lastError;
              });
            }, 2500);
          }
        });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  // 4. Kiểm tra lịch hẹn ngay lập tức từ Popup
  if (request.action === 'runAutoPersonalCheckNow') {
    checkAndRunDuePersonalPosts(true).then(sendResponse);
    return true;
  }

  // 5. Lấy trạng thái Auto-Personal cho Popup
  if (request.action === 'getAutoPersonalStatus') {
    chrome.storage.local.get(['vg_last_alarm_check', 'vg_last_due_count', 'vg_last_auto_personal_at'], (st) => {
      sendResponse(st || {});
    });
    return true;
  }
});
