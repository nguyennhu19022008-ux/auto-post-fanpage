/**
 * LAPTOP VƯƠNG GIA // EXTENSION BACKGROUND SERVICE WORKER (MV3 v1.6.0)
 * - Bypass Zalo Web CSP for API pushes
 * - Auto-Schedule Personal Profile Alarm Runner
 * - Strict Sequential Group Share Engine: Worker Window (focused: false), 1 tab at a time,
 *   verified post completion, guaranteed tab close, mandatory delay countdown (default 10s),
 *   account spam-block protection & detailed per-group execution logs.
 */

const DEFAULT_BACKEND_URL = 'https://auto-post-fanpage-coral.vercel.app';
const DEFAULT_FANPAGE_URL = 'https://www.facebook.com/profile.php?id=61590327190720';
const ALARM_PERSONAL = 'vgAutoPersonalCheck';
const ALARM_GROUP = 'vgGroupShareTick';
const ALARM_GROUP_IMMEDIATE = 'vgGroupShareImmediate';
const ALARM_GROUP_WATCHDOG = 'vgGroupWatchdog';
const MIN_AUTO_POST_GAP_MS = 15 * 1000;
const MAX_AUTO_RETRIES_PER_GROUP = 1; // Thất bại -> tự thử lại tối đa 1 lần, vẫn lỗi thì bỏ qua
const MAX_KEPT_FAILED_TABS = 5;       // Giữ lại tối đa 5 tab lỗi cuối cùng để kiểm tra nguyên nhân
const NON_RETRYABLE_STATUSES = new Set([
  'skipped_not_member',
  'failed_buy_sell_form',
  'failed_group_requires_input',
  'blocked_by_facebook',
  'cancelled',
  'cancelled_by_user'
]);

let isTickRunning = false;
const closingManagedTabIds = new Set();

function markTabClosingByBot(tabId) {
  if (!tabId) return;
  closingManagedTabIds.add(tabId);
  setTimeout(() => closingManagedTabIds.delete(tabId), 8000);
}

function ensureFanpageLink(rawContent) {
  const text = String(rawContent || '').trim();
  if (!text) return `🌐 Fanpage chính thức Laptop Vương Gia: ${DEFAULT_FANPAGE_URL}`;
  if (text.includes('61590327190720')) return text;
  const lines = text.split('\n');
  const lastLine = lines[lines.length - 1] || '';
  const linkLine = `🌐 Fanpage chính thức: ${DEFAULT_FANPAGE_URL}`;
  if (lastLine.trim().startsWith('#')) {
    lines.splice(lines.length - 1, 0, linkLine);
    return lines.join('\n');
  }
  return `${text}\n${linkLine}`;
}

function ensureAlarmsConfigured() {
  if (!chrome.alarms) return;
  chrome.alarms.get(ALARM_PERSONAL, (a) => {
    if (!a) chrome.alarms.create(ALARM_PERSONAL, { periodInMinutes: 1 });
  });
  chrome.alarms.get(ALARM_GROUP, (a) => {
    if (!a) chrome.alarms.create(ALARM_GROUP, { periodInMinutes: 1 });
  });
}

function runOneTimeV160Migration() {
  if (!chrome.storage || !chrome.storage.sync) return;
  chrome.storage.sync.get(['vg_migrated_v160', 'groupDelaySeconds'], (res) => {
    if (res && res.vg_migrated_v160) return;
    const updates = { vg_migrated_v160: true };
    if (typeof res?.groupDelaySeconds !== 'number' || res.groupDelaySeconds === 0) {
      updates.groupDelaySeconds = 10;
    }
    chrome.storage.sync.set(updates, () => {
      console.log('[VG Extension v1.6.0] Đã áp dụng mặc định chờ 10 giây giữa các nhóm.');
    });
  });
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

function normalizeGroupUrls(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const s = String(raw || '').trim();
    if (!s) continue;
    const m = s.match(/facebook\.com\/groups\/([^/?#\s]+)/i);
    if (m) {
      const normalized = `https://www.facebook.com/groups/${m[1]}/`;
      if (!seen.has(normalized)) {
        seen.add(normalized);
        out.push(normalized);
      }
    }
  }
  return out;
}

function storageGet(area, keys) {
  return new Promise((resolve) => {
    chrome.storage[area].get(keys, (res) => resolve(res || {}));
  });
}

function storageSet(area, obj) {
  return new Promise((resolve) => {
    chrome.storage[area].set(obj, resolve);
  });
}

function storageRemove(area, keys) {
  return new Promise((resolve) => {
    chrome.storage[area].remove(keys, resolve);
  });
}

async function getExtensionConfig() {
  const res = await storageGet('sync', [
    'backendUrl',
    'autoPersonalEnabled',
    'autoPersonalIncludeFanpage',
    'autoGroupShareEnabled',
    'shareAllGroups',
    'targetGroupUrls',
    'groupsPerPost',
    'groupDelaySeconds'
  ]);
  const parsedPerPost = parseInt(res.groupsPerPost, 10);
  const parsedDelay = parseInt(res.groupDelaySeconds, 10);
  return {
    backendUrl: (res.backendUrl || DEFAULT_BACKEND_URL).trim().replace(/\/$/, ''),
    autoPersonalEnabled: res.autoPersonalEnabled !== false,
    autoPersonalIncludeFanpage: res.autoPersonalIncludeFanpage !== false,
    autoGroupShareEnabled: res.autoGroupShareEnabled !== false,
    shareAllGroups: res.shareAllGroups === true,
    targetGroupUrls: normalizeGroupUrls(res.targetGroupUrls || []),
    groupsPerPost: Number.isFinite(parsedPerPost) && parsedPerPost > 0 ? Math.min(parsedPerPost, 50) : 3,
    groupDelaySeconds: Number.isFinite(parsedDelay) && parsedDelay >= 0 ? Math.min(parsedDelay, 600) : 10
  };
}

async function trackManagedTabId(tabId) {
  if (!tabId) return;
  const st = await storageGet('local', ['vg_auto_opened_tab_ids']);
  const ids = Array.isArray(st.vg_auto_opened_tab_ids) ? st.vg_auto_opened_tab_ids : [];
  if (!ids.includes(tabId)) {
    ids.push(tabId);
    await storageSet('local', { vg_auto_opened_tab_ids: ids.slice(-30) });
  }
}

async function closeTabAndConfirm(tabId) {
  if (!tabId) return;
  markTabClosingByBot(tabId);
  const st = await storageGet('local', ['vg_auto_opened_tab_ids']);
  const ids = Array.isArray(st.vg_auto_opened_tab_ids) ? st.vg_auto_opened_tab_ids : [];
  const nextIds = ids.filter((id) => id !== tabId);
  await storageSet('local', { vg_auto_opened_tab_ids: nextIds });

  await new Promise((resolve) => {
    chrome.tabs.remove(tabId, () => {
      void chrome.runtime.lastError;
      resolve();
    });
  });
}

async function openTabInWorkerWindow(targetUrl) {
  const st = await storageGet('local', ['vg_worker_window_id']);
  const existingWinId = st.vg_worker_window_id;

  if (existingWinId) {
    const winExists = await new Promise((resolve) => {
      chrome.windows.get(existingWinId, (win) => {
        if (chrome.runtime.lastError || !win) return resolve(false);
        resolve(true);
      });
    });

    if (winExists) {
      const tab = await new Promise((resolve) => {
        chrome.tabs.create({ windowId: existingWinId, url: targetUrl, active: true }, (newTab) => {
          if (chrome.runtime.lastError || !newTab) return resolve(null);
          resolve(newTab);
        });
      });
      if (tab && tab.id) {
        await trackManagedTabId(tab.id);
        return { tabId: tab.id, windowId: existingWinId };
      }
    }
  }

  // Tạo cửa sổ phụ phía sau màn hình làm việc chính (focused: false), dùng luôn tab đầu tiên win.tabs[0]
  const createdWin = await new Promise((resolve) => {
    chrome.windows.create(
      {
        url: targetUrl,
        focused: false,
        type: 'normal',
        width: 1120,
        height: 780
      },
      (win) => {
        if (chrome.runtime.lastError || !win) return resolve(null);
        resolve(win);
      }
    );
  });

  if (createdWin && createdWin.id) {
    await storageSet('local', { vg_worker_window_id: createdWin.id });
    const firstTabId = createdWin.tabs && createdWin.tabs[0] ? createdWin.tabs[0].id : null;
    if (firstTabId) await trackManagedTabId(firstTabId);
    return { tabId: firstTabId, windowId: createdWin.id };
  }

  // Fallback cuối nếu không tạo được window
  const fallbackTab = await new Promise((resolve) => {
    chrome.tabs.create({ url: targetUrl, active: true }, (t) => resolve(t || null));
  });
  if (fallbackTab && fallbackTab.id) await trackManagedTabId(fallbackTab.id);
  return { tabId: fallbackTab?.id || null, windowId: fallbackTab?.windowId || null };
}

async function closeWorkerWindowIfIdle() {
  const st = await storageGet('local', ['vg_worker_window_id', 'vg_group_share_queue', 'vg_active_group_job', 'vg_kept_failed_tab_ids']);
  const queue = Array.isArray(st.vg_group_share_queue) ? st.vg_group_share_queue : [];
  const keptFailed = Array.isArray(st.vg_kept_failed_tab_ids) ? st.vg_kept_failed_tab_ids : [];
  // Không đóng cửa sổ phụ nếu còn tab lỗi đang giữ lại để người dùng kiểm tra
  if (queue.length > 0 || st.vg_active_group_job || keptFailed.length > 0) return;

  if (st.vg_worker_window_id) {
    const winId = st.vg_worker_window_id;
    await storageRemove('local', ['vg_worker_window_id']);
    chrome.windows.remove(winId, () => { void chrome.runtime.lastError; });
  }
}

async function appendGroupLog(entry) {
  const st = await storageGet('local', ['vg_group_share_logs']);
  const logs = Array.isArray(st.vg_group_share_logs) ? st.vg_group_share_logs : [];
  logs.unshift({
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
    ...entry
  });
  await storageSet('local', { vg_group_share_logs: logs.slice(0, 60) });
}

function scheduleNextGroupCheck(delayMs) {
  const safeMs = Math.max(0, Number(delayMs) || 0);
  if (safeMs <= 25000) {
    setTimeout(() => {
      processNextGroupShare(true);
    }, Math.max(200, safeMs));
  }
  if (chrome.alarms) {
    const delayMins = Math.max(0.5, safeMs / 60000);
    chrome.alarms.create(ALARM_GROUP_IMMEDIATE, { delayInMinutes: delayMins });
  }
}

async function dispatchToFacebookTab(rawPayload, callback) {
  const payload = {
    ...rawPayload,
    content: ensureFanpageLink(rawPayload.content || '')
  };

  if (payload.isGroupPost && payload.groupUrl) {
    await storageSet('local', { vg_pending_personal_post: payload });
    const opened = await openTabInWorkerWindow(payload.groupUrl);
    if (callback) callback({ success: true, status: 'group_tab_opened', ...opened });
    return;
  }

  await storageSet('local', { vg_pending_personal_post: payload });
  if (payload.autoTriggered) {
    // Mở trong cửa sổ phụ chạy nền để không chiếm màn hình chính
    const opened = await openTabInWorkerWindow('https://www.facebook.com/');
    if (callback) callback({ success: true, status: 'worker_tab_opened', ...opened });
    return;
  }

  chrome.tabs.query({ url: '*://*.facebook.com/*' }, (tabs) => {
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
      chrome.tabs.create({ url: 'https://www.facebook.com/', active: true }, async (newTab) => {
        if (newTab && newTab.id) await trackManagedTabId(newTab.id);
        if (callback) callback({ success: true, status: 'new_tab_opened', tabId: newTab?.id });
      });
    }
  });
}

async function enqueueGroupSharesForPost(postPayload, overrideGroups = null) {
  const config = await getExtensionConfig();
  const groupPool = Array.isArray(overrideGroups) && overrideGroups.length > 0
    ? normalizeGroupUrls(overrideGroups)
    : config.targetGroupUrls;

  if ((!config.autoGroupShareEnabled && !overrideGroups) || groupPool.length === 0) {
    return { enqueued: 0, reason: groupPool.length === 0 ? 'no_groups' : 'disabled' };
  }

  const localState = await storageGet('local', ['vg_group_share_queue', 'vg_group_rotation_idx', 'vg_active_group_job']);
  const queue = Array.isArray(localState.vg_group_share_queue) ? localState.vg_group_share_queue : [];
  let rotIdx = Number.isInteger(localState.vg_group_rotation_idx) ? localState.vg_group_rotation_idx : 0;

  let chosenGroups = [];
  if (Array.isArray(overrideGroups) && overrideGroups.length > 0) {
    chosenGroups = groupPool;
  } else if (config.shareAllGroups) {
    chosenGroups = [...groupPool];
    rotIdx = 0;
  } else {
    const countToTake = Math.min(config.groupsPerPost, groupPool.length);
    for (let i = 0; i < countToTake; i++) {
      const idx = (rotIdx + i) % groupPool.length;
      chosenGroups.push(groupPool[idx]);
    }
    rotIdx = (rotIdx + countToTake) % groupPool.length;
  }

  const cleanContent = ensureFanpageLink(postPayload.content || '');
  const pId = postPayload.postId || `manual_${Date.now()}`;
  let added = 0;

  for (const gUrl of chosenGroups) {
    const inQueue = queue.some(q => q.groupUrl === gUrl && q.postId === pId);
    const inActive = localState.vg_active_group_job &&
      localState.vg_active_group_job.groupUrl === gUrl &&
      localState.vg_active_group_job.postId === pId;

    if (!inQueue && !inActive) {
      queue.push({
        id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        postId: pId,
        machineCode: postPayload.machineCode || 'MÁY',
        content: cleanContent,
        mediaUrls: postPayload.mediaUrls || [],
        groupUrl: gUrl,
        retryCount: 0,
        enqueuedAt: Date.now()
      });
      added++;
    }
  }

  await storageSet('local', {
    vg_group_share_queue: queue,
    vg_group_rotation_idx: rotIdx,
    vg_group_queue_paused: false,
    vg_group_pause_reason: ''
  });

  console.log(`[VG Group Share] 📢 Đã xếp hàng chia sẻ sang ${added} Hội Nhóm (Tổng chờ: ${queue.length}).`);
  return { enqueued: added, queueLength: queue.length };
}

async function processNextGroupShare(forceImmediate = false) {
  if (isTickRunning) {
    return { skipped: true, reason: 'tick_mutex_busy' };
  }
  isTickRunning = true;

  try {
    const config = await getExtensionConfig();
    const localState = await storageGet('local', [
      'vg_group_share_queue',
      'vg_active_group_job',
      'vg_next_group_at',
      'vg_group_queue_paused',
      'vg_group_pause_reason'
    ]);

    if (localState.vg_group_queue_paused) {
      return { skipped: true, reason: 'paused', pauseReason: localState.vg_group_pause_reason };
    }

    const activeJob = localState.vg_active_group_job || null;
    const now = Date.now();

    // 1. Khóa tuần tự nghiêm ngặt: KHÔNG ép đóng tab theo đồng hồ cứng — chỉ nhả khóa nếu tab thực sự đã không còn tồn tại
    if (activeJob) {
      const elapsedMs = now - (activeJob.startedAt || now);
      let tabStillExists = true;
      if (activeJob.tabId && chrome.tabs && typeof chrome.tabs.get === 'function') {
        tabStillExists = await new Promise((resolve) => {
          chrome.tabs.get(activeJob.tabId, (t) => {
            if (chrome.runtime.lastError || !t) return resolve(false);
            resolve(true);
          });
        });
      } else if (!activeJob.tabId && elapsedMs > 20000) {
        tabStillExists = false;
      }

      if (tabStillExists) {
        return {
          skipped: true,
          reason: 'active_job_running',
          activeJob,
          elapsedSeconds: Math.round(elapsedMs / 1000)
        };
      }

      // Chỉ khi tab đã bị crash / biến mất hẳn khỏi Chrome mới nhả khóa an toàn
      const delayMs = config.groupDelaySeconds * 1000;
      await storageSet('local', {
        vg_active_group_job: null,
        vg_next_group_at: now + delayMs
      });
      await appendGroupLog({
        postId: activeJob.postId,
        machineCode: activeJob.machineCode,
        groupUrl: activeJob.groupUrl,
        content: activeJob.content,
        mediaUrls: activeJob.mediaUrls,
        status: 'failed_tab_lost',
        success: false,
        reason: 'Tab nhóm không còn tồn tại trước khi hoàn tất đăng bài.'
      });

      const qAfter = (await storageGet('local', ['vg_group_share_queue'])).vg_group_share_queue || [];
      if (qAfter.length > 0) {
        scheduleNextGroupCheck(delayMs);
      } else {
        await closeWorkerWindowIfIdle();
      }
      return { recoveredLostTab: true, waitingSeconds: config.groupDelaySeconds };
    }

    const queue = Array.isArray(localState.vg_group_share_queue) ? localState.vg_group_share_queue : [];
    if (queue.length === 0) {
      await closeWorkerWindowIfIdle();
      return { empty: true };
    }

    if (!config.autoGroupShareEnabled && !forceImmediate) {
      return { skipped: true, reason: 'disabled' };
    }

    // 2. Bắt buộc tôn trọng thời gian chờ sau khi đóng tab trước (mặc định 10s)
    const nextGroupAt = Number(localState.vg_next_group_at) || 0;
    if (nextGroupAt > now) {
      const remainingMs = nextGroupAt - now;
      scheduleNextGroupCheck(remainingMs);
      return {
        skipped: true,
        reason: 'waiting_delay',
        waitRemainingSeconds: Math.ceil(remainingMs / 1000)
      };
    }

    // 3. Rút 1 nhóm tiếp theo và thiết lập khóa vg_active_group_job NGAY LẬP TỨC
    const nextTask = queue.shift();
    const newJob = {
      jobId: nextTask.id,
      postId: nextTask.postId,
      machineCode: nextTask.machineCode,
      groupUrl: nextTask.groupUrl,
      content: nextTask.content,
      mediaUrls: nextTask.mediaUrls,
      retryCount: Number(nextTask.retryCount) || 0,
      startedAt: now,
      tabId: null,
      status: 'running'
    };

    await storageSet('local', {
      vg_group_share_queue: queue,
      vg_active_group_job: newJob,
      vg_next_group_at: 0
    });

    console.log(`[VG Group Share] 🚀 Mở tuần tự 1 tab Hội Nhóm: ${nextTask.groupUrl} (Lần ${newJob.retryCount + 1}, còn lại: ${queue.length})`);
    await dispatchToFacebookTab(
      {
        postId: nextTask.postId,
        machineCode: nextTask.machineCode,
        content: nextTask.content,
        mediaUrls: nextTask.mediaUrls,
        groupUrl: nextTask.groupUrl,
        retryCount: newJob.retryCount,
        isGroupPost: true,
        autoTriggered: true
      },
      async (dispatchRes) => {
        if (dispatchRes && dispatchRes.tabId) {
          const cur = await storageGet('local', ['vg_active_group_job']);
          if (cur.vg_active_group_job && cur.vg_active_group_job.jobId === newJob.jobId) {
            cur.vg_active_group_job.tabId = dispatchRes.tabId;
            await storageSet('local', { vg_active_group_job: cur.vg_active_group_job });
          }
        }
      }
    );

    if (chrome.alarms) {
      chrome.alarms.create(ALARM_GROUP_WATCHDOG, { delayInMinutes: 1.3 });
    }

    return { dispatched: true, groupUrl: nextTask.groupUrl, remaining: queue.length };
  } finally {
    isTickRunning = false;
  }
}

async function checkAndRunDuePersonalPosts(forceManual = false) {
  const config = await getExtensionConfig();
  if (!config.autoPersonalEnabled && !forceManual) {
    return { skipped: true, reason: 'disabled' };
  }

  const localState = await storageGet('local', ['vg_dispatched_personal_ids', 'vg_last_auto_personal_at']);
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
    await storageSet('local', {
      vg_last_alarm_check: new Date().toISOString(),
      vg_last_due_count: dueList.length
    });

    if (dueList.length === 0) {
      return { checked: true, dueCount: 0 };
    }

    const nextPost = dueList[0];
    dispatchedMap[nextPost.id] = now;

    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    for (const [k, ts] of Object.entries(dispatchedMap)) {
      if (now - ts > sevenDaysMs) delete dispatchedMap[k];
    }

    await storageSet('local', {
      vg_dispatched_personal_ids: dispatchedMap,
      vg_last_auto_personal_at: now
    });

    console.log(`[VG Auto-Personal] 🤖 Đang tự động kích hoạt đăng bài #${nextPost.machineCode} (${nextPost.id}) lên Trang Cá Nhân...`);

    return await new Promise((resolve) => {
      dispatchToFacebookTab({
        postId: nextPost.id,
        machineCode: nextPost.machineCode || 'MÁY',
        content: ensureFanpageLink(nextPost.content),
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

function scanJoinedFacebookGroups() {
  return new Promise((resolve) => {
    chrome.tabs.create({ url: 'https://www.facebook.com/groups/joins/', active: false }, (tab) => {
      if (!tab || !tab.id) return resolve({ success: false, error: 'Không mở được tab danh sách nhóm.' });
      const targetTabId = tab.id;
      let settled = false;

      const finish = (result) => {
        if (settled) return;
        settled = true;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        setTimeout(() => {
          chrome.tabs.remove(targetTabId, () => { void chrome.runtime.lastError; });
        }, 400);
        resolve(result);
      };

      const onUpdated = (tabId, changeInfo) => {
        if (tabId !== targetTabId || changeInfo.status !== 'complete') return;
        setTimeout(() => {
          chrome.tabs.sendMessage(targetTabId, { action: 'scanJoinedLaptopGroups' }, async (resp) => {
            if (chrome.runtime.lastError || !resp || !resp.success) {
              return finish({ success: false, error: 'Hãy chắc chắn bạn đã đăng nhập Facebook trên trình duyệt.' });
            }
            const foundGroups = resp.groups || [];
            const config = await getExtensionConfig();
            const merged = normalizeGroupUrls([
              ...config.targetGroupUrls,
              ...foundGroups.map(g => g.url)
            ]);
            chrome.storage.sync.set({ targetGroupUrls: merged }, () => {
              finish({
                success: true,
                foundCount: foundGroups.length,
                totalSaved: merged.length,
                groups: foundGroups,
                targetGroupUrls: merged
              });
            });
          });
        }, 1200);
      };

      chrome.tabs.onUpdated.addListener(onUpdated);
      setTimeout(() => finish({ success: false, error: 'Quá thời gian chờ tải danh sách nhóm Facebook.' }), 16000);
    });
  });
}

// Theo dõi nếu người dùng đóng thủ công tab đang chạy của Robot -> nhả khóa an toàn
// (Bỏ qua nếu chính Extension đang đóng tab qua closingManagedTabIds để tránh ghi đúp log!)
chrome.tabs.onRemoved.addListener(async (closedTabId) => {
  const isClosedByBot = closingManagedTabIds.has(closedTabId);
  const st = await storageGet('local', ['vg_active_group_job', 'vg_auto_opened_tab_ids', 'vg_group_share_queue', 'vg_worker_window_id']);
  const ids = Array.isArray(st.vg_auto_opened_tab_ids) ? st.vg_auto_opened_tab_ids : [];
  if (ids.includes(closedTabId)) {
    await storageSet('local', { vg_auto_opened_tab_ids: ids.filter(id => id !== closedTabId) });
  }

  if (isClosedByBot) {
    return;
  }

  if (st.vg_active_group_job && st.vg_active_group_job.tabId === closedTabId) {
    const job = st.vg_active_group_job;
    const config = await getExtensionConfig();
    const delayMs = config.groupDelaySeconds * 1000;
    await storageSet('local', {
      vg_active_group_job: null,
      vg_next_group_at: Date.now() + delayMs
    });
    await appendGroupLog({
      postId: job.postId,
      machineCode: job.machineCode,
      groupUrl: job.groupUrl,
      content: job.content,
      mediaUrls: job.mediaUrls,
      status: 'cancelled_by_user',
      success: false,
      reason: 'Tab nhóm đã bị đóng trước khi xác nhận đăng xong.'
    });
    const remaining = Array.isArray(st.vg_group_share_queue) ? st.vg_group_share_queue : [];
    if (remaining.length > 0) {
      scheduleNextGroupCheck(delayMs);
    }
  }
});

chrome.windows.onRemoved.addListener(async (closedWindowId) => {
  const st = await storageGet('local', ['vg_worker_window_id']);
  if (st.vg_worker_window_id === closedWindowId) {
    await storageRemove('local', ['vg_worker_window_id']);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VG Zalo Extension v1.6.0] Background service worker đã khởi động!');
  ensureAlarmsConfigured();
  runOneTimeV160Migration();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarmsConfigured();
  runOneTimeV160Migration();
  setTimeout(() => checkAndRunDuePersonalPosts(false), 5000);
});

ensureAlarmsConfigured();
runOneTimeV160Migration();

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_PERSONAL) {
      checkAndRunDuePersonalPosts(false);
    }
    if (alarm.name === ALARM_GROUP || alarm.name === ALARM_GROUP_IMMEDIATE || alarm.name === ALARM_GROUP_WATCHDOG) {
      processNextGroupShare(false);
    }
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
        console.warn('[VG Extension SW] Lỗi fetch:', err);
        sendResponse({ success: false, error: err.message });
      });

    return true;
  }

  if (request.action === 'triggerPersonalRobot') {
    dispatchToFacebookTab(request.payload || {}, sendResponse);
    return true;
  }

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

      if (request.autoTriggered && sender && sender.tab && sender.tab.id) {
        const st = await storageGet('local', ['vg_auto_opened_tab_ids']);
        const ids = Array.isArray(st.vg_auto_opened_tab_ids) ? st.vg_auto_opened_tab_ids : [];
        if (ids.includes(sender.tab.id)) {
          await new Promise(r => setTimeout(r, 1000));
          await closeTabAndConfirm(sender.tab.id);
        }
      }

      if (request.success && request.content) {
        await storageSet('local', {
          vg_last_personal_post_payload: {
            postId: request.postId || `p_${Date.now()}`,
            machineCode: request.machineCode || 'MÁY',
            content: ensureFanpageLink(request.content),
            mediaUrls: request.mediaUrls || []
          }
        });

        const enqueueRes = await enqueueGroupSharesForPost(request);
        if (enqueueRes.enqueued > 0) {
          const delayMs = config.groupDelaySeconds * 1000;
          await storageSet('local', { vg_next_group_at: Date.now() + delayMs });
          scheduleNextGroupCheck(delayMs);
        } else {
          await closeWorkerWindowIfIdle();
        }
      } else {
        await closeWorkerWindowIfIdle();
      }

      sendResponse({ ok: true });
    })();
    return true;
  }

  if (request.action === 'groupShareCompleted') {
    (async () => {
      const config = await getExtensionConfig();
      const st = await storageGet('local', ['vg_active_group_job', 'vg_group_share_queue', 'vg_auto_opened_tab_ids', 'vg_kept_failed_tab_ids']);
      const activeJob = st.vg_active_group_job || null;
      const tabIdToClose = (sender && sender.tab && sender.tab.id) || (activeJob ? activeJob.tabId : null);

      // Chống xử lý trùng nếu tab đó đã vừa được đóng/hoàn tất bởi Robot
      if (!activeJob && tabIdToClose && closingManagedTabIds.has(tabIdToClose)) {
        return sendResponse({ ok: true, deduplicated: true });
      }

      const isSuccess = !!request.success;
      const finalStatus = request.status || (isSuccess ? 'posted' : 'failed_submit');
      const finalReason = request.reason || request.error || (isSuccess ? 'Đã xác nhận xuất bản thành công.' : 'Không đăng được bài.');
      const delayMs = config.groupDelaySeconds * 1000;
      const retryCount = Number(activeJob?.retryCount ?? request.retryCount ?? 0);
      const targetGroupUrl = request.groupUrl || activeJob?.groupUrl || '';
      const queue = Array.isArray(st.vg_group_share_queue) ? [...st.vg_group_share_queue] : [];

      const shouldAutoRetry =
        !isSuccess &&
        retryCount < MAX_AUTO_RETRIES_PER_GROUP &&
        !NON_RETRYABLE_STATUSES.has(finalStatus) &&
        Boolean(targetGroupUrl);

      const isBlocked = finalStatus === 'blocked_by_facebook';

      // Giải phóng khóa vg_active_group_job TRƯỚC mọi thao tác đóng/chuyển tab để tabs.onRemoved không bao giờ ghi đúp log lỗi!
      const preUpdates = { vg_active_group_job: null };
      if (isBlocked) {
        preUpdates.vg_group_queue_paused = true;
        preUpdates.vg_group_pause_reason = finalReason || 'Facebook tạm giới hạn tính năng đăng nhóm — hệ thống đã tự tạm dừng để bảo vệ tài khoản.';
        preUpdates.vg_next_group_at = 0;
      } else {
        preUpdates.vg_next_group_at = Date.now() + delayMs + 2000;
      }

      if (shouldAutoRetry) {
        // Thất bại lần 1 -> Tự động xếp lại đầu hàng đợi để thử lại tối đa 1 lần (attempt 2/2)
        if (tabIdToClose) markTabClosingByBot(tabIdToClose);
        queue.unshift({
          id: `grp_retry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          postId: request.postId || activeJob?.postId || null,
          machineCode: request.machineCode || activeJob?.machineCode || 'MÁY',
          content: request.content || activeJob?.content || '',
          mediaUrls: request.mediaUrls || activeJob?.mediaUrls || [],
          groupUrl: targetGroupUrl,
          retryCount: retryCount + 1,
          enqueuedAt: Date.now()
        });
        preUpdates.vg_group_share_queue = queue;
        await storageSet('local', preUpdates);

        await appendGroupLog({
          postId: request.postId || activeJob?.postId || null,
          machineCode: request.machineCode || activeJob?.machineCode || 'MÁY',
          groupUrl: targetGroupUrl,
          content: request.content || activeJob?.content || '',
          mediaUrls: request.mediaUrls || activeJob?.mediaUrls || [],
          status: 'retrying_once',
          success: false,
          reason: `Lần 1 thất bại (${finalReason}) — đang tự động thử lại lần 2/2.`
        });

        // Đóng tab lỗi lần 1 để mở lại tab sạch cho lần thử lại
        if (tabIdToClose) {
          await new Promise(r => setTimeout(r, 450));
          await closeTabAndConfirm(tabIdToClose);
        }

        const retryDelayMs = Math.max(3000, Math.min(delayMs, 5000));
        await storageSet('local', { vg_next_group_at: Date.now() + retryDelayMs });
        scheduleNextGroupCheck(retryDelayMs);
        return sendResponse({ ok: true, retrying: true, attempt: retryCount + 2, remaining: queue.length });
      }

      // Trường hợp Thành công HOẶC Thất bại cuối cùng (đã hết 1 lần thử lại -> bỏ qua)
      if (isSuccess && tabIdToClose) {
        markTabClosingByBot(tabIdToClose);
      }
      await storageSet('local', preUpdates);

      const displayReason = (!isSuccess && retryCount >= MAX_AUTO_RETRIES_PER_GROUP)
        ? `[Đã thử ${retryCount + 1} lần — Bỏ qua] ${finalReason}`
        : finalReason;

      await appendGroupLog({
        postId: request.postId || activeJob?.postId || null,
        machineCode: request.machineCode || activeJob?.machineCode || 'MÁY',
        groupUrl: targetGroupUrl,
        content: request.content || activeJob?.content || '',
        mediaUrls: request.mediaUrls || activeJob?.mediaUrls || [],
        status: finalStatus,
        success: isSuccess,
        reason: displayReason
      });

      if (isSuccess) {
        // CHỈ đóng tab khi ĐĂNG THÀNH CÔNG
        if (tabIdToClose) {
          await new Promise(r => setTimeout(r, 450));
          await closeTabAndConfirm(tabIdToClose);
        }
      } else if (tabIdToClose) {
        // Thất bại sau khi đã thử lại -> GIỮ NGUYÊN tab lỗi để người dùng kiểm tra (giới hạn giữ tối đa 5 tab để tránh nặng RAM)
        const managedIds = Array.isArray(st.vg_auto_opened_tab_ids) ? st.vg_auto_opened_tab_ids.filter(id => id !== tabIdToClose) : [];
        const keptFailed = Array.isArray(st.vg_kept_failed_tab_ids) ? [...st.vg_kept_failed_tab_ids] : [];
        if (!keptFailed.includes(tabIdToClose)) keptFailed.push(tabIdToClose);
        while (keptFailed.length > MAX_KEPT_FAILED_TABS) {
          const oldestTabId = keptFailed.shift();
          await closeTabAndConfirm(oldestTabId);
        }
        await storageSet('local', {
          vg_auto_opened_tab_ids: managedIds,
          vg_kept_failed_tab_ids: keptFailed
        });
      }

      if (isBlocked) {
        await closeWorkerWindowIfIdle();
        return sendResponse({ ok: true, paused: true, reason: preUpdates.vg_group_pause_reason });
      }

      if (queue.length > 0 && config.autoGroupShareEnabled) {
        await storageSet('local', { vg_next_group_at: Date.now() + delayMs });
        scheduleNextGroupCheck(delayMs);
      } else {
        await storageSet('local', { vg_next_group_at: 0 });
        await closeWorkerWindowIfIdle();
      }

      sendResponse({ ok: true, remaining: queue.length, tabKeptForInspection: !isSuccess && Boolean(tabIdToClose) });
    })();
    return true;
  }

  if (request.action === 'runAutoPersonalCheckNow') {
    checkAndRunDuePersonalPosts(true).then(sendResponse);
    return true;
  }

  if (request.action === 'scanJoinedGroupsNow') {
    scanJoinedFacebookGroups().then(sendResponse);
    return true;
  }

  if (request.action === 'shareLatestToGroupsNow' || request.action === 'shareSpecificPostToGroups') {
    (async () => {
      let postPayload = request.payload && request.payload.content ? {
        postId: request.payload.postId || request.payload.id || `p_${Date.now()}`,
        machineCode: request.payload.machineCode || 'MÁY',
        content: ensureFanpageLink(request.payload.content),
        mediaUrls: request.payload.mediaUrls || []
      } : null;

      if (!postPayload) {
        const localState = await storageGet('local', ['vg_last_personal_post_payload']);
        postPayload = localState.vg_last_personal_post_payload;
      }

      if (!postPayload) {
        const config = await getExtensionConfig();
        try {
          const res = await fetch(`${config.backendUrl}/api/posts`);
          const data = await res.json();
          const candidate = (Array.isArray(data) ? data : (data.posts || [])).find(p => p && p.content && p.mediaFiles && p.mediaFiles.length > 0);
          if (candidate) {
            postPayload = {
              postId: candidate.id,
              machineCode: candidate.machineCode || 'MÁY',
              content: ensureFanpageLink(candidate.content),
              mediaUrls: candidate.mediaFiles.map(m => typeof m === 'string' ? m : (m.url || m.path || '')).filter(u => u.startsWith('http'))
            };
          }
        } catch (e) {}
      }

      if (!postPayload) {
        return sendResponse({ success: false, error: 'Chưa có bài viết sẵn sàng để chia sẻ lên Hội Nhóm.' });
      }
      await storageSet('local', { vg_last_personal_post_payload: postPayload });
      const enqueueRes = await enqueueGroupSharesForPost(postPayload);
      if (enqueueRes.enqueued === 0 && !((await storageGet('local', ['vg_active_group_job'])).vg_active_group_job)) {
        const cfg = await getExtensionConfig();
        if (cfg.targetGroupUrls.length === 0) {
          return sendResponse({ success: false, error: 'Chưa có link Group Facebook nào. Hãy bấm Quét Nhóm hoặc dán link Group trước.' });
        }
        return sendResponse({ success: false, error: 'Tất cả nhóm đã được xếp hàng cho bài viết này rồi.' });
      }
      await storageSet('local', { vg_next_group_at: 0, vg_group_queue_paused: false, vg_group_pause_reason: '' });
      const runRes = await processNextGroupShare(true);
      sendResponse({ success: true, enqueueRes, runRes });
    })();
    return true;
  }

  if (request.action === 'stopGroupShareQueue') {
    (async () => {
      const st = await storageGet('local', ['vg_active_group_job', 'vg_auto_opened_tab_ids', 'vg_worker_window_id']);
      await storageSet('local', {
        vg_group_share_queue: [],
        vg_active_group_job: null,
        vg_kept_failed_tab_ids: [],
        vg_next_group_at: 0,
        vg_group_queue_paused: true,
        vg_group_pause_reason: 'Người dùng đã bấm Dừng hàng đợi thủ công.'
      });
      const ids = Array.isArray(st.vg_auto_opened_tab_ids) ? [...st.vg_auto_opened_tab_ids] : [];
      if (st.vg_active_group_job && st.vg_active_group_job.tabId && !ids.includes(st.vg_active_group_job.tabId)) {
        ids.push(st.vg_active_group_job.tabId);
      }
      for (const id of ids) {
        await closeTabAndConfirm(id);
      }
      await closeWorkerWindowIfIdle();
      sendResponse({ success: true, clearedTabs: ids.length });
    })();
    return true;
  }

  if (request.action === 'retryFailedGroupLogs') {
    (async () => {
      const st = await storageGet('local', ['vg_group_share_logs', 'vg_last_personal_post_payload']);
      const logs = Array.isArray(st.vg_group_share_logs) ? st.vg_group_share_logs : [];
      const failedLogs = logs.filter(l => !l.success && l.groupUrl);
      if (failedLogs.length === 0) {
        return sendResponse({ success: false, error: 'Không có nhóm lỗi nào cần thử lại.' });
      }

      const targetLog = request.logId ? failedLogs.find(l => l.id === request.logId) : null;
      const toRetry = targetLog ? [targetLog] : failedLogs;
      const seenUrls = new Set();
      let enqueuedCount = 0;

      for (const item of toRetry) {
        if (seenUrls.has(item.groupUrl)) continue;
        seenUrls.add(item.groupUrl);
        const payload = item.content ? item : (st.vg_last_personal_post_payload || null);
        if (!payload || !payload.content) continue;
        const r = await enqueueGroupSharesForPost({
          postId: `${payload.postId || 'retry'}_retry_${Date.now()}`,
          machineCode: payload.machineCode || 'MÁY',
          content: payload.content,
          mediaUrls: payload.mediaUrls || []
        }, [item.groupUrl]);
        enqueuedCount += r.enqueued;
      }

      const retriedIds = new Set(toRetry.map(l => l.id));
      await storageSet('local', {
        vg_group_share_logs: logs.filter(l => !retriedIds.has(l.id)),
        vg_next_group_at: 0,
        vg_group_queue_paused: false,
        vg_group_pause_reason: ''
      });

      const runRes = await processNextGroupShare(true);
      sendResponse({ success: true, retriedCount: enqueuedCount, runRes });
    })();
    return true;
  }

  if (request.action === 'removeGroupUrlFromList') {
    (async () => {
      const urlToRemove = String(request.groupUrl || '').trim();
      const config = await getExtensionConfig();
      const updatedUrls = config.targetGroupUrls.filter(u => u !== urlToRemove);
      await storageSet('sync', { targetGroupUrls: updatedUrls });

      const st = await storageGet('local', ['vg_group_share_queue', 'vg_group_share_logs']);
      const q = (Array.isArray(st.vg_group_share_queue) ? st.vg_group_share_queue : []).filter(item => item.groupUrl !== urlToRemove);
      const logs = (Array.isArray(st.vg_group_share_logs) ? st.vg_group_share_logs : []).filter(l => l.groupUrl !== urlToRemove);
      await storageSet('local', { vg_group_share_queue: q, vg_group_share_logs: logs });

      sendResponse({ success: true, targetGroupUrls: updatedUrls });
    })();
    return true;
  }

  if (request.action === 'clearGroupShareLogs') {
    storageSet('local', { vg_group_share_logs: [] }).then(() => sendResponse({ success: true }));
    return true;
  }

  if (request.action === 'getAutoPersonalStatus' || request.action === 'getFullExtensionState') {
    (async () => {
      const config = await getExtensionConfig();
      const st = await storageGet('local', [
        'vg_last_alarm_check',
        'vg_last_due_count',
        'vg_last_auto_personal_at',
        'vg_group_share_queue',
        'vg_active_group_job',
        'vg_next_group_at',
        'vg_group_queue_paused',
        'vg_group_pause_reason',
        'vg_group_share_logs',
        'vg_last_personal_post_payload'
      ]);
      sendResponse({
        success: true,
        version: chrome.runtime.getManifest().version,
        config,
        vg_last_alarm_check: st.vg_last_alarm_check || null,
        vg_last_due_count: typeof st.vg_last_due_count === 'number' ? st.vg_last_due_count : 0,
        lastAlarmCheck: st.vg_last_alarm_check || null,
        dueCount: typeof st.vg_last_due_count === 'number' ? st.vg_last_due_count : 0,
        groupQueueCount: Array.isArray(st.vg_group_share_queue) ? st.vg_group_share_queue.length : 0,
        activeGroupJob: st.vg_active_group_job || null,
        nextGroupAt: Number(st.vg_next_group_at) || 0,
        queuePaused: !!st.vg_group_queue_paused,
        pauseReason: st.vg_group_pause_reason || '',
        groupLogs: Array.isArray(st.vg_group_share_logs) ? st.vg_group_share_logs : [],
        lastPersonalPost: st.vg_last_personal_post_payload || null
      });
    })();
    return true;
  }

  if (request.action === 'saveExtensionConfig') {
    const incoming = request.config || {};
    const parsedPerPost = parseInt(incoming.groupsPerPost, 10);
    const parsedDelay = parseInt(incoming.groupDelaySeconds, 10);
    const toSave = { vg_migrated_v160: true };
    if (typeof incoming.autoPersonalEnabled === 'boolean') toSave.autoPersonalEnabled = incoming.autoPersonalEnabled;
    if (typeof incoming.autoPersonalIncludeFanpage === 'boolean') toSave.autoPersonalIncludeFanpage = incoming.autoPersonalIncludeFanpage;
    if (typeof incoming.autoGroupShareEnabled === 'boolean') toSave.autoGroupShareEnabled = incoming.autoGroupShareEnabled;
    if (typeof incoming.shareAllGroups === 'boolean') toSave.shareAllGroups = incoming.shareAllGroups;
    if (Array.isArray(incoming.targetGroupUrls)) toSave.targetGroupUrls = normalizeGroupUrls(incoming.targetGroupUrls);
    if (Number.isFinite(parsedPerPost) && parsedPerPost > 0) toSave.groupsPerPost = Math.min(parsedPerPost, 50);
    if (Number.isFinite(parsedDelay) && parsedDelay >= 0) toSave.groupDelaySeconds = Math.min(parsedDelay, 600);

    chrome.storage.sync.set(toSave, async () => {
      const updated = await getExtensionConfig();
      sendResponse({ success: true, config: updated });
    });
    return true;
  }
});
