/**
 * LAPTOP VƯƠNG GIA // EXTENSION BACKGROUND SERVICE WORKER (MV3 v1.5.0)
 * - Bypass Zalo Web CSP for API pushes
 * - Auto-Schedule Personal Profile Alarm Runner
 * - Auto-Share to Related Facebook Groups (Instant / Configurable Delay, No Forced 3-Min Wait)
 * - Two-way state sync with Web App Dashboard (/app)
 */

const DEFAULT_BACKEND_URL = 'https://auto-post-fanpage-coral.vercel.app';
const DEFAULT_FANPAGE_URL = 'https://www.facebook.com/profile.php?id=61590327190720';
const ALARM_PERSONAL = 'vgAutoPersonalCheck';
const ALARM_GROUP = 'vgGroupShareTick';
const ALARM_GROUP_IMMEDIATE = 'vgGroupShareImmediate';
const MIN_AUTO_POST_GAP_MS = 15 * 1000; // 15s an toàn giữa 2 bài Cá Nhân

let isProcessingGroupShare = false;

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

async function getExtensionConfig() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(
      [
        'backendUrl',
        'autoPersonalEnabled',
        'autoPersonalIncludeFanpage',
        'autoGroupShareEnabled',
        'targetGroupUrls',
        'groupsPerPost',
        'groupDelaySeconds'
      ],
      (res) => {
        const parsedPerPost = parseInt(res.groupsPerPost, 10);
        const parsedDelay = parseInt(res.groupDelaySeconds, 10);
        resolve({
          backendUrl: (res.backendUrl || DEFAULT_BACKEND_URL).trim().replace(/\/$/, ''),
          autoPersonalEnabled: res.autoPersonalEnabled !== false,
          autoPersonalIncludeFanpage: res.autoPersonalIncludeFanpage !== false,
          autoGroupShareEnabled: res.autoGroupShareEnabled !== false,
          targetGroupUrls: normalizeGroupUrls(res.targetGroupUrls || []),
          groupsPerPost: Number.isFinite(parsedPerPost) && parsedPerPost > 0 ? Math.min(parsedPerPost, 20) : 3,
          // Mặc định 0 giây = đăng liên tục sang nhóm tiếp theo ngay, không bắt chờ 3 phút
          groupDelaySeconds: Number.isFinite(parsedDelay) && parsedDelay >= 0 ? Math.min(parsedDelay, 600) : 0
        });
      }
    );
  });
}

function dispatchToFacebookTab(rawPayload, callback) {
  const payload = {
    ...rawPayload,
    content: ensureFanpageLink(rawPayload.content || '')
  };

  if (payload.isGroupPost && payload.groupUrl) {
    chrome.storage.local.set({ vg_pending_personal_post: payload }, () => {
      chrome.tabs.create({ url: payload.groupUrl, active: true }, (newTab) => {
        if (newTab && newTab.id) {
          chrome.storage.local.set({ vg_auto_opened_tab_id: newTab.id });
        }
        if (callback) callback({ success: true, status: 'group_tab_opened', tabId: newTab?.id });
      });
    });
    return;
  }

  chrome.storage.local.set({ vg_pending_personal_post: payload }, () => {
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

async function enqueueGroupSharesForPost(postPayload) {
  const config = await getExtensionConfig();
  if (!config.autoGroupShareEnabled || config.targetGroupUrls.length === 0) {
    return { enqueued: 0, reason: config.targetGroupUrls.length === 0 ? 'no_groups' : 'disabled' };
  }

  const localState = await new Promise((resolve) => {
    chrome.storage.local.get(['vg_group_share_queue', 'vg_group_rotation_idx'], resolve);
  });

  const queue = Array.isArray(localState.vg_group_share_queue) ? localState.vg_group_share_queue : [];
  let rotIdx = Number.isInteger(localState.vg_group_rotation_idx) ? localState.vg_group_rotation_idx : 0;

  const countToTake = Math.min(config.groupsPerPost, config.targetGroupUrls.length);
  const chosenGroups = [];
  for (let i = 0; i < countToTake; i++) {
    const idx = (rotIdx + i) % config.targetGroupUrls.length;
    chosenGroups.push(config.targetGroupUrls[idx]);
  }
  rotIdx = (rotIdx + countToTake) % config.targetGroupUrls.length;

  const cleanContent = ensureFanpageLink(postPayload.content || '');
  let added = 0;
  for (const gUrl of chosenGroups) {
    const exists = queue.some(q => q.groupUrl === gUrl && q.postId && q.postId === postPayload.postId);
    if (!exists) {
      queue.push({
        id: `grp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        postId: postPayload.postId || null,
        machineCode: postPayload.machineCode || 'MÁY',
        content: cleanContent,
        mediaUrls: postPayload.mediaUrls || [],
        groupUrl: gUrl,
        enqueuedAt: Date.now()
      });
      added++;
    }
  }

  await new Promise((resolve) => {
    chrome.storage.local.set({
      vg_group_share_queue: queue,
      vg_group_rotation_idx: rotIdx
    }, resolve);
  });

  console.log(`[VG Group Share] 📢 Đã xếp hàng chia sẻ sang ${added} Hội Nhóm (Tổng hàng đợi nhóm: ${queue.length}).`);
  return { enqueued: added, queueLength: queue.length };
}

function scheduleNextGroupShare(delaySeconds) {
  const sec = Math.max(0, Number(delaySeconds) || 0);
  if (sec <= 20) {
    const waitMs = Math.max(1500, sec * 1000);
    setTimeout(() => processNextGroupShare(true), waitMs);
    if (chrome.alarms) {
      chrome.alarms.create(ALARM_GROUP_IMMEDIATE, { delayInMinutes: 0.5 });
    }
  } else if (chrome.alarms) {
    chrome.alarms.create(ALARM_GROUP_IMMEDIATE, { delayInMinutes: Math.max(0.5, sec / 60) });
  }
}

async function processNextGroupShare(forceImmediate = false) {
  if (isProcessingGroupShare) {
    return { skipped: true, reason: 'already_processing' };
  }
  isProcessingGroupShare = true;

  try {
    const config = await getExtensionConfig();
    if (!config.autoGroupShareEnabled && !forceImmediate) return { skipped: true };

    const localState = await new Promise((resolve) => {
      chrome.storage.local.get(['vg_group_share_queue', 'vg_last_group_share_at'], resolve);
    });

    const queue = Array.isArray(localState.vg_group_share_queue) ? localState.vg_group_share_queue : [];
    if (queue.length === 0) return { empty: true };

    const lastGroupAt = localState.vg_last_group_share_at || 0;
    const now = Date.now();
    const minGapMs = Math.max(0, config.groupDelaySeconds) * 1000;
    if (!forceImmediate && minGapMs > 0 && now - lastGroupAt < minGapMs) {
      return { skipped: true, reason: 'group_cooldown' };
    }

    const nextTask = queue.shift();
    await new Promise((resolve) => {
      chrome.storage.local.set({
        vg_group_share_queue: queue,
        vg_last_group_share_at: now
      }, resolve);
    });

    console.log(`[VG Group Share] 🚀 Đang tự động đăng lên Hội Nhóm: ${nextTask.groupUrl}`);
    return await new Promise((resolve) => {
      dispatchToFacebookTab({
        postId: nextTask.postId,
        machineCode: nextTask.machineCode,
        content: nextTask.content,
        mediaUrls: nextTask.mediaUrls,
        groupUrl: nextTask.groupUrl,
        isGroupPost: true,
        autoTriggered: true
      }, (res) => resolve({ dispatched: true, groupUrl: nextTask.groupUrl, remaining: queue.length, res }));
    });
  } finally {
    setTimeout(() => {
      isProcessingGroupShare = false;
    }, 2000);
  }
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

    const nextPost = dueList[0];
    dispatchedMap[nextPost.id] = now;

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

chrome.runtime.onInstalled.addListener(() => {
  console.log('[VG Zalo Extension v1.5.0] Background service worker đã khởi động!');
  ensureAlarmsConfigured();
});

chrome.runtime.onStartup.addListener(() => {
  ensureAlarmsConfigured();
  setTimeout(() => checkAndRunDuePersonalPosts(false), 5000);
});

ensureAlarmsConfigured();

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_PERSONAL) {
      checkAndRunDuePersonalPosts(false);
    }
    if (alarm.name === ALARM_GROUP) {
      processNextGroupShare(false);
    }
    if (alarm.name === ALARM_GROUP_IMMEDIATE) {
      processNextGroupShare(true);
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

      if (request.success && request.content) {
        await new Promise((r) => chrome.storage.local.set({
          vg_last_personal_post_payload: {
            postId: request.postId || `p_${Date.now()}`,
            machineCode: request.machineCode || 'MÁY',
            content: ensureFanpageLink(request.content),
            mediaUrls: request.mediaUrls || []
          }
        }, r));

        const enqueueRes = await enqueueGroupSharesForPost(request);
        if (enqueueRes.enqueued > 0) {
          scheduleNextGroupShare(Math.max(3, config.groupDelaySeconds));
        }
      }

      if (request.autoTriggered && request.success && sender && sender.tab && sender.tab.id) {
        chrome.storage.local.get(['vg_auto_opened_tab_id'], (st) => {
          if (st.vg_auto_opened_tab_id === sender.tab.id) {
            chrome.storage.local.remove(['vg_auto_opened_tab_id']);
            setTimeout(() => {
              chrome.tabs.remove(sender.tab.id, () => { void chrome.runtime.lastError; });
            }, 2200);
          }
        });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (request.action === 'groupShareCompleted') {
    (async () => {
      if (sender && sender.tab && sender.tab.id) {
        const tabId = sender.tab.id;
        chrome.storage.local.get(['vg_auto_opened_tab_id'], (st) => {
          if (st.vg_auto_opened_tab_id === tabId) {
            chrome.storage.local.remove(['vg_auto_opened_tab_id']);
            setTimeout(() => {
              chrome.tabs.remove(tabId, () => { void chrome.runtime.lastError; });
            }, 2200);
          }
        });
      }

      // Tự động chuyển tiếp sang Hội Nhóm tiếp theo trong hàng đợi (không phải chờ 3 phút nếu delay = 0)
      const config = await getExtensionConfig();
      const localState = await new Promise((r) => chrome.storage.local.get(['vg_group_share_queue'], r));
      const remainingQueue = Array.isArray(localState.vg_group_share_queue) ? localState.vg_group_share_queue : [];
      if (remainingQueue.length > 0 && config.autoGroupShareEnabled) {
        scheduleNextGroupShare(config.groupDelaySeconds);
      }

      sendResponse({ ok: true, remaining: remainingQueue.length });
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
        const localState = await new Promise((r) => chrome.storage.local.get(['vg_last_personal_post_payload'], r));
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
      const enqueueRes = await enqueueGroupSharesForPost(postPayload);
      if (enqueueRes.enqueued === 0) {
        return sendResponse({ success: false, error: 'Chưa có link Group Facebook nào. Hãy bấm Quét Nhóm hoặc dán link Group ở bên dưới.' });
      }
      const runRes = await processNextGroupShare(true);
      sendResponse({ success: true, enqueueRes, runRes });
    })();
    return true;
  }

  if (request.action === 'getAutoPersonalStatus') {
    chrome.storage.local.get(
      ['vg_last_alarm_check', 'vg_last_due_count', 'vg_last_auto_personal_at', 'vg_group_share_queue'],
      (st) => {
        sendResponse({
          ...(st || {}),
          groupQueueCount: Array.isArray(st?.vg_group_share_queue) ? st.vg_group_share_queue.length : 0
        });
      }
    );
    return true;
  }

  if (request.action === 'getFullExtensionState') {
    (async () => {
      const config = await getExtensionConfig();
      const st = await new Promise((r) => chrome.storage.local.get(
        ['vg_last_alarm_check', 'vg_last_due_count', 'vg_group_share_queue'],
        r
      ));
      sendResponse({
        success: true,
        version: chrome.runtime.getManifest().version,
        config,
        lastAlarmCheck: st?.vg_last_alarm_check || null,
        dueCount: typeof st?.vg_last_due_count === 'number' ? st.vg_last_due_count : 0,
        groupQueueCount: Array.isArray(st?.vg_group_share_queue) ? st.vg_group_share_queue.length : 0
      });
    })();
    return true;
  }

  if (request.action === 'saveExtensionConfig') {
    const incoming = request.config || {};
    const parsedPerPost = parseInt(incoming.groupsPerPost, 10);
    const parsedDelay = parseInt(incoming.groupDelaySeconds, 10);
    const toSave = {};
    if (typeof incoming.autoPersonalEnabled === 'boolean') toSave.autoPersonalEnabled = incoming.autoPersonalEnabled;
    if (typeof incoming.autoPersonalIncludeFanpage === 'boolean') toSave.autoPersonalIncludeFanpage = incoming.autoPersonalIncludeFanpage;
    if (typeof incoming.autoGroupShareEnabled === 'boolean') toSave.autoGroupShareEnabled = incoming.autoGroupShareEnabled;
    if (Array.isArray(incoming.targetGroupUrls)) toSave.targetGroupUrls = normalizeGroupUrls(incoming.targetGroupUrls);
    if (Number.isFinite(parsedPerPost) && parsedPerPost > 0) toSave.groupsPerPost = Math.min(parsedPerPost, 20);
    if (Number.isFinite(parsedDelay) && parsedDelay >= 0) toSave.groupDelaySeconds = Math.min(parsedDelay, 600);

    chrome.storage.sync.set(toSave, async () => {
      const updated = await getExtensionConfig();
      sendResponse({ success: true, config: updated });
    });
    return true;
  }
});
