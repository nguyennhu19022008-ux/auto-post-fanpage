/**
 * Diagnostic Test Suite: Extension Group Auto-Share Failure Modes
 * Tests current extension/background.js & extension/fb_robot.js behavior
 * across 10 real-world Facebook Group posting scenarios to pinpoint root causes.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const BG_PATH = path.join(ROOT, 'extension', 'background.js');
const ROBOT_PATH = path.join(ROOT, 'extension', 'fb_robot.js');

const bgCode = fs.readFileSync(BG_PATH, 'utf8');
const robotCode = fs.readFileSync(ROBOT_PATH, 'utf8');

const results = [];

function record(id, name, status, detail) {
  results.push({ id, name, status, detail });
  const icon = status === 'PASS' ? 'PASS' : (status === 'BUG_FOUND' ? 'BUG_FOUND' : 'WARN');
  console.log(`[${icon}] ${id}: ${name}\n       -> ${detail}`);
}

function createMockBgHarness(initialLocal = {}, initialSync = {}) {
  const storageData = {
    local: {
      vg_group_share_queue: [],
      vg_group_share_logs: [],
      vg_auto_opened_tab_ids: [],
      ...initialLocal
    },
    sync: {
      targetGroupUrls: [
        'https://www.facebook.com/groups/971164961167185/',
        'https://www.facebook.com/groups/1389764649734744/'
      ],
      groupDelaySeconds: 10,
      autoGroupShareEnabled: true,
      ...initialSync
    }
  };

  let onMessageCb = null;
  let onRemovedCb = null;
  const closedTabs = [];
  const createdTabs = [];
  const createdAlarms = [];

  const sandbox = {
    console: { log: () => {}, warn: () => {}, error: () => {} },
    setTimeout: (fn, ms) => (ms <= 1000 ? setTimeout(fn, 10) : { fn, ms }),
    clearTimeout: () => {},
    Date, Math, Array, Object, String, Number, Boolean, Set, Promise, URL, Error,
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    chrome: {
      runtime: {
        lastError: null,
        getManifest: () => ({ version: '1.6.1' }),
        onInstalled: { addListener: () => {} },
        onStartup: { addListener: () => {} },
        onMessage: { addListener: (cb) => { onMessageCb = cb; } }
      },
      alarms: {
        get: (n, cb) => cb && cb(true),
        create: (name, info) => createdAlarms.push({ name, info }),
        onAlarm: { addListener: () => {} }
      },
      storage: {
        local: {
          get: (keys, cb) => {
            const out = {};
            (Array.isArray(keys) ? keys : [keys]).forEach(k => { out[k] = storageData.local[k]; });
            cb(out);
          },
          set: (obj, cb) => { Object.assign(storageData.local, obj); cb && cb(); },
          remove: (keys, cb) => {
            (Array.isArray(keys) ? keys : [keys]).forEach(k => { delete storageData.local[k]; });
            cb && cb();
          }
        },
        sync: {
          get: (keys, cb) => {
            const out = {};
            (Array.isArray(keys) ? keys : [keys]).forEach(k => { out[k] = storageData.sync[k]; });
            cb(out);
          },
          set: (obj, cb) => { Object.assign(storageData.sync, obj); cb && cb(); }
        }
      },
      tabs: {
        create: (opts, cb) => {
          const tab = { id: 900 + createdTabs.length, windowId: opts.windowId || 100, url: opts.url };
          createdTabs.push(tab);
          cb && cb(tab);
        },
        remove: (tabId, cb) => {
          closedTabs.push(tabId);
          Promise.resolve().then(() => onRemovedCb && onRemovedCb(tabId));
          cb && cb();
        },
        onRemoved: { addListener: (cb) => { onRemovedCb = cb; } }
      },
      windows: {
        get: (id, cb) => cb && cb({ id }),
        create: (opts, cb) => {
          const tab = { id: 900 + createdTabs.length, windowId: 100, url: opts.url };
          createdTabs.push(tab);
          cb && cb({ id: 100, tabs: [tab] });
        },
        onRemoved: { addListener: () => {} },
        remove: (id, cb) => cb && cb()
      }
    }
  };

  vm.runInNewContext(bgCode, sandbox);
  return { sandbox, storageData, closedTabs, createdTabs, createdAlarms, getOnMessage: () => onMessageCb, getOnRemoved: () => onRemovedCb };
}

async function runDiagnostics() {
  console.log('=== DIAGNOSTIC TEST SUITE: EXTENSION GROUP AUTO-SHARE ===\n');

  // CASE 1: Watchdog forced tab-close timeout (JOB_WATCHDOG_MS)
  {
    const watchdogMatch = bgCode.match(/const\s+JOB_WATCHDOG_MS\s*=\s*([^;]+);/);
    const hasHardWatchdogClose = bgCode.includes('elapsedMs < JOB_WATCHDOG_MS') && bgCode.includes('await closeTabAndConfirm(activeJob.tabId)');
    if (hasHardWatchdogClose) {
      record(
        'CASE-01',
        'Watchdog ép đóng tab theo thời gian cứng (JOB_WATCHDOG_MS)',
        'BUG_FOUND',
        `background.js đang đặt JOB_WATCHDOG_MS = ${watchdogMatch ? watchdogMatch[1].trim() : 'unknown'} và ép đóng tab khi quá hạn, kể cả khi bài nhiều ảnh đang upload chậm ở cửa sổ nền.`
      );
    } else {
      record('CASE-01', 'Watchdog ép đóng tab', 'PASS', 'Không còn ép đóng tab theo giới hạn thời gian cứng.');
    }
  }

  // CASE 2: Upload wait timeout (maxUploadWait) exits without verifying upload actually finished
  {
    const uploadMatch = robotCode.match(/const\s+maxUploadWait\s*=\s*(\d+)/);
    const maxUploadMs = uploadMatch ? Number(uploadMatch[1]) : 0;
    const checksAfterLoop = robotCode.includes('if (isUploading)') || robotCode.includes('stillUploading');
    if (maxUploadMs > 0 && maxUploadMs <= 30000 && !checksAfterLoop) {
      record(
        'CASE-02',
        'Hết giờ chờ upload ảnh (30s) vẫn bấm Đăng hoặc thoát thiếu kiểm tra',
        'BUG_FOUND',
        `fb_robot.js chỉ chờ tối đa ${maxUploadMs}ms (30s) cho upload ảnh và sau vòng lặp không kiểm tra xem ảnh đã lên đủ chưa trước khi bấm Đăng.`
      );
    } else {
      record('CASE-02', 'Kiểm tra upload ảnh trước khi bấm Đăng', 'PASS', `maxUploadWait=${maxUploadMs}ms có kiểm tra trạng thái sau upload.`);
    }
  }

  // CASE 3: Confirmation timeout cuts off active "Đang đăng..." submissions
  {
    const confirmFn = robotCode.slice(robotCode.indexOf('async function waitForPublishConfirmation'), robotCode.indexOf('function isCreatePostModal'));
    const confirmMatch = confirmFn.match(/const\s+maxConfirmMs\s*=\s*(\d+)/);
    const confirmMs = confirmMatch ? Number(confirmMatch[1]) : 0;
    const extendsWhileSubmitting = confirmFn.includes('deadlineMs') || confirmFn.includes('lastProgressMs') || confirmFn.includes('maxConfirmMs +=');
    if (!extendsWhileSubmitting) {
      record(
        'CASE-03',
        'Cắt ngang quá trình "Đang đăng..." khi quá mốc thời gian cố định',
        'BUG_FOUND',
        `waitForPublishConfirmation dùng mốc cứng maxConfirmMs = ${confirmMs}ms; nếu Facebook đang hiện spinner "Đang đăng..." ở tab nền quá ${confirmMs / 1000}s sẽ bị báo lỗi oan và đóng mất tab.`
      );
    } else {
      record('CASE-03', 'Gia hạn thời gian khi Facebook đang đăng', 'PASS', 'Có gia hạn khi modal đang ở trạng thái Đang đăng.');
    }
  }

  // CASE 4: Wrong Facebook tab / redirect steals global vg_pending_personal_post
  {
    const bootIdx = robotCode.indexOf("chrome.storage.local.get(['vg_pending_personal_post']");
    const bootBlock = bootIdx !== -1 ? robotCode.slice(bootIdx) : robotCode.slice(robotCode.lastIndexOf('vg_pending_personal_post'));
    const validatesUrl = bootBlock.includes('matchesPayloadTargetUrl') || bootBlock.includes('window.location.href') || bootBlock.includes('groupUrl');
    if (!validatesUrl) {
      record(
        'CASE-04',
        'Xung đột payload vg_pending_personal_post khi mở nhiều tab Facebook hoặc redirect',
        'BUG_FOUND',
        'fb_robot.js tự lấy và xóa ngay vg_pending_personal_post trên BẤT KỲ tab facebook.com nào vừa tải, KHÔNG kiểm tra URL tab có khớp payload.groupUrl hay không -> tab khác hoặc trang redirect có thể ăn mất lệnh đăng.'
      );
    } else {
      record('CASE-04', 'Kiểm tra khớp URL trước khi nhận payload', 'PASS', 'Có kiểm tra URL khớp groupUrl qua matchesPayloadTargetUrl() trước khi nhận payload.');
    }
  }

  // CASE 5: Automatic max-1 retry on group share failure
  {
    const h = createMockBgHarness({
      vg_active_group_job: {
        jobId: 'grp_1',
        postId: 'p1',
        machineCode: '142B',
        groupUrl: 'https://www.facebook.com/groups/971164961167185/',
        tabId: 701,
        content: 'Test Laptop',
        mediaUrls: ['https://example.com/1.jpg'],
        startedAt: Date.now()
      },
      vg_auto_opened_tab_ids: [701],
      vg_group_share_queue: []
    });

    await new Promise((resolve) => {
      h.getOnMessage()(
        {
          action: 'groupShareCompleted',
          postId: 'p1',
          machineCode: '142B',
          groupUrl: 'https://www.facebook.com/groups/971164961167185/',
          success: false,
          status: 'failed_modal_stuck',
          reason: 'Hộp thoại không đóng.'
        },
        { tab: { id: 701 } },
        resolve
      );
    });

    const requeued = h.storageData.local.vg_group_share_queue.some(
      q => q.groupUrl === 'https://www.facebook.com/groups/971164961167185/'
    );
    if (!requeued) {
      record(
        'CASE-05',
        'Tự động thử lại tối đa 1 lần khi đăng thất bại',
        'BUG_FOUND',
        'Hiện tại khi nhóm lỗi lần 1, background.js bỏ luôn (queue rỗng) thay vì tự xếp lại tối đa 1 lần thử (attempt 2/2).'
      );
    } else {
      record('CASE-05', 'Tự động thử lại tối đa 1 lần khi đăng thất bại', 'PASS', 'Đã tự xếp lại nhóm lỗi để thử lại lần 2.');
    }
  }

  // CASE 6: Tab closing behavior on failure vs success (behavioral test)
  {
    const hFail = createMockBgHarness({
      vg_active_group_job: {
        jobId: 'grp_2',
        postId: 'p1',
        machineCode: '142B',
        groupUrl: 'https://www.facebook.com/groups/971164961167185/',
        tabId: 702,
        content: 'Test Laptop',
        mediaUrls: [],
        startedAt: Date.now(),
        retryCount: 1
      },
      vg_auto_opened_tab_ids: [702],
      vg_kept_failed_tab_ids: [],
      vg_group_share_queue: []
    });

    await new Promise((resolve) => {
      hFail.getOnMessage()(
        {
          action: 'groupShareCompleted',
          postId: 'p1',
          machineCode: '142B',
          groupUrl: 'https://www.facebook.com/groups/971164961167185/',
          success: false,
          status: 'failed_modal_stuck',
          reason: 'Thất bại lần 2.'
        },
        { tab: { id: 702 } },
        resolve
      );
    });

    const failTabClosed = hFail.closedTabs.includes(702);
    const failTabKept = (hFail.storageData.local.vg_kept_failed_tab_ids || []).includes(702);

    const hSucc = createMockBgHarness({
      vg_active_group_job: {
        jobId: 'grp_3',
        postId: 'p1',
        machineCode: '142B',
        groupUrl: 'https://www.facebook.com/groups/971164961167185/',
        tabId: 704,
        content: 'Test Laptop',
        mediaUrls: [],
        startedAt: Date.now(),
        retryCount: 0
      },
      vg_auto_opened_tab_ids: [704],
      vg_group_share_queue: []
    });

    await new Promise((resolve) => {
      hSucc.getOnMessage()(
        {
          action: 'groupShareCompleted',
          postId: 'p1',
          machineCode: '142B',
          groupUrl: 'https://www.facebook.com/groups/971164961167185/',
          success: true,
          status: 'posted',
          reason: 'Đã đăng thành công.'
        },
        { tab: { id: 704 } },
        resolve
      );
    });

    const succTabClosed = hSucc.closedTabs.includes(704);

    if (failTabClosed || !failTabKept || !succTabClosed) {
      record(
        'CASE-06',
        'Chính sách đóng tab khi đăng thành công vs thất bại',
        'BUG_FOUND',
        `failTabClosed=${failTabClosed}, failTabKept=${failTabKept}, succTabClosed=${succTabClosed}.`
      );
    } else {
      record('CASE-06', 'Chính sách đóng tab theo kết quả đăng', 'PASS', 'Thành công đóng tab (704), thất bại cuối giữ tab (702) để đối chiếu.');
    }
  }

  // CASE 7: Duplicate log guard when bot closes tab on success
  {
    const hOk = createMockBgHarness({
      vg_active_group_job: {
        jobId: 'grp_ok',
        postId: 'p1',
        machineCode: '142B',
        groupUrl: 'https://www.facebook.com/groups/971164961167185/',
        tabId: 703,
        content: 'Test Laptop',
        mediaUrls: [],
        startedAt: Date.now()
      },
      vg_auto_opened_tab_ids: [703]
    });
    // Use real short setTimeout for this async check
    const bgWithRealTimer = bgCode.replace('setTimeout(r, 450)', 'setTimeout(r, 10)');
    let onMsg = null;
    let onRem = null;
    const localData = hOk.storageData.local;
    const syncData = hOk.storageData.sync;
    const sb = {
      console: { log: () => {}, warn: () => {}, error: () => {} },
      setTimeout, clearTimeout, Date, Math, Array, Object, String, Number, Boolean, Set, Promise, URL, Error,
      fetch: async () => ({ ok: true, json: async () => ({}) }),
      chrome: {
        runtime: { lastError: null, getManifest: () => ({ version: '1.6.1' }), onInstalled: { addListener: () => {} }, onStartup: { addListener: () => {} }, onMessage: { addListener: (cb) => { onMsg = cb; } } },
        alarms: { get: (n, cb) => cb && cb(true), create: () => {}, onAlarm: { addListener: () => {} } },
        storage: {
          local: {
            get: (keys, cb) => { const o = {}; (Array.isArray(keys) ? keys : [keys]).forEach(k => o[k] = localData[k]); cb(o); },
            set: (obj, cb) => { Object.assign(localData, obj); cb && cb(); },
            remove: (keys, cb) => { (Array.isArray(keys) ? keys : [keys]).forEach(k => delete localData[k]); cb && cb(); }
          },
          sync: {
            get: (keys, cb) => { const o = {}; (Array.isArray(keys) ? keys : [keys]).forEach(k => o[k] = syncData[k]); cb(o); },
            set: (obj, cb) => { Object.assign(syncData, obj); cb && cb(); }
          }
        },
        tabs: {
          remove: (tabId, cb) => { Promise.resolve().then(() => onRem && onRem(tabId)); cb && cb(); },
          onRemoved: { addListener: (cb) => { onRem = cb; } }
        },
        windows: { onRemoved: { addListener: () => {} }, remove: (id, cb) => cb && cb() }
      }
    };
    vm.runInNewContext(bgWithRealTimer, sb);
    await new Promise((resolve) => {
      onMsg({ action: 'groupShareCompleted', postId: 'p1', machineCode: '142B', groupUrl: 'https://www.facebook.com/groups/971164961167185/', success: true, status: 'posted', reason: 'OK' }, { tab: { id: 703 } }, resolve);
    });
    await new Promise(r => setTimeout(r, 40));
    if (localData.vg_group_share_logs.length === 1) {
      record('CASE-07', 'Chống ghi đúp log khi bot tự đóng tab', 'PASS', 'Chỉ ghi đúng 1 dòng log khi bot tự đóng tab.');
    } else {
      record('CASE-07', 'Chống ghi đúp log khi bot tự đóng tab', 'BUG_FOUND', `Ghi tới ${localData.vg_group_share_logs.length} dòng log.`);
    }
  }

  // CASE 8: Group Composer Open Timeout (9s) on slow / background tab
  {
    const openMatch = robotCode.match(/const\s+openTimeout\s*=\s*isGroupPost\s*\?\s*(\d+)\s*:\s*(\d+)/);
    const groupOpenMs = openMatch ? Number(openMatch[1]) : 0;
    if (groupOpenMs > 0 && groupOpenMs < 15000) {
      record(
        'CASE-08',
        'Thời gian chờ mở khung soạn bài trong Group (openTimeout)',
        'BUG_FOUND',
        `openTimeout cho Group chỉ có ${groupOpenMs}ms (9s) — thấp hơn cả Trang Cá Nhân (12s), trong khi Group nhiều ảnh bìa + chuyển tab Thảo luận trong cửa sổ nền dễ tải chậm 10–15s.`
      );
    } else {
      record('CASE-08', 'Thời gian chờ mở khung soạn bài trong Group', 'PASS', `openTimeout=${groupOpenMs}ms.`);
    }
  }

  // CASE 9: Non-Group-Discussion / Buy-Sell button selector gap ("Bán gì đó" / "Tạo bài viết")
  {
    const checksDisabledAncestor = robotCode.includes('closest(\'[aria-disabled="true"]\')');
    if (!checksDisabledAncestor) {
      record(
        'CASE-09',
        'Kiểm tra trạng thái vô hiệu hóa nút Đăng trên thẻ cha (aria-disabled)',
        'BUG_FOUND',
        'fb_robot.js chỉ kiểm tra b.getAttribute("aria-disabled") !== "true" trên chính node b, chưa kiểm tra b.closest(\'[aria-disabled="true"]\') nên có thể bấm nhầm vào nút Đăng đang bị khóa.'
      );
    } else {
      record('CASE-09', 'Kiểm tra aria-disabled trên thẻ cha nút Đăng', 'PASS', 'Đã kiểm tra cả thẻ cha.');
    }
  }

  // CASE 10: Background tab startup race (fb_robot.js runs at document_idle before SPA finishes rendering Group)
  {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension', 'manifest.json'), 'utf8'));
    const fbScript = (manifest.content_scripts || []).find(cs => (cs.js || []).includes('fb_robot.js'));
    const waitMainMatch = robotCode.match(/waitForElement\('\[role="main"\]',\s*document,\s*(\d+)\)/);
    const waitMainMs = waitMainMatch ? Number(waitMainMatch[1]) : 0;
    if (waitMainMs > 0 && waitMainMs <= 4000) {
      record(
        'CASE-10',
        'Chờ trang Group SPA dựng xong [role="main"]',
        'BUG_FOUND',
        `prepareGroupComposerEnvironment chỉ chờ [role="main"] tối đa ${waitMainMs}ms (3.5s) tại ${fbScript?.run_at || 'document_idle'} — nếu mạng hơi chậm ở tab nền sẽ bỏ lỡ nút chuyển tab Thảo luận.`
      );
    } else {
      record('CASE-10', 'Chờ trang Group SPA dựng xong [role="main"]', 'PASS', `Chờ ${waitMainMs}ms.`);
    }
  }

  const bugs = results.filter(r => r.status === 'BUG_FOUND');
  const passed = results.filter(r => r.status === 'PASS');
  console.log(`\n=== SUMMARY: ${results.length} diagnostic cases | ${bugs.length} ROOT CAUSES FOUND | ${passed.length} PASSED ===`);
  process.exit(0);
}

runDiagnostics().catch(err => {
  console.error(err);
  process.exit(1);
});
