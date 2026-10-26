process.env.TZ = 'Asia/Ho_Chi_Minh';
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');
const { publishPostToFanpage } = require('./facebook');
const { sendPostNotification, sendMediaReminderEmail } = require('./mailer');
const {
  upsertPostToDb,
  fetchAllPostsFromDb,
  fetchSettingsFromDb,
  saveSettingsToDb
} = require('./supabase');

const POSTS_FILE = path.join(__dirname, '..', 'data', 'posts.json');
const POSTS_TMP_FILE = path.join('/tmp', 'posts.json');
const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');
const SETTINGS_TMP_FILE = path.join('/tmp', 'settings.json');

/**
 * Fetch all posts: Supabase is Single Source of Truth, falls back to /tmp & local file
 */
async function getPosts() {
  try {
    const dbPosts = await fetchAllPostsFromDb();
    if (Array.isArray(dbPosts) && dbPosts.length > 0) {
      return dbPosts;
    }
    // If Supabase returned an empty array, verify if local has posts as fallback
    if (Array.isArray(dbPosts)) {
      return dbPosts;
    }
  } catch (e) {
    console.error('[Scheduler] Error fetching posts from Supabase in getPosts:', e.message);
  }

  // Fallback if Supabase is unavailable
  try {
    if (fs.existsSync(POSTS_TMP_FILE)) {
      const data = fs.readFileSync(POSTS_TMP_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
    if (fs.existsSync(POSTS_FILE)) {
      const data = fs.readFileSync(POSTS_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (errFallback) {
    console.error('[Scheduler] Error reading fallback posts.json:', errFallback.message);
  }
  return [];
}

/**
 * Save posts to local/temporary storage as cache
 */
async function savePosts(posts) {
  try {
    fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2), 'utf8');
  } catch (e) {
    // If running on Vercel read-only filesystem, save to /tmp
    try {
      fs.writeFileSync(POSTS_TMP_FILE, JSON.stringify(posts, null, 2), 'utf8');
    } catch (errTmp) {
      console.error('[Scheduler] Error saving posts to /tmp:', errTmp.message);
    }
  }
}

/**
 * Get settings: Supabase merged with local fallback & environment variables
 */
async function getSettings() {
  let settings = {};

  // 1. Read local file as base defaults
  try {
    if (fs.existsSync(SETTINGS_TMP_FILE)) {
      const data = fs.readFileSync(SETTINGS_TMP_FILE, 'utf8');
      settings = JSON.parse(data || '{}');
    } else if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      settings = JSON.parse(data || '{}');
    }
  } catch (e) {
    console.error('[Scheduler] Error reading local settings.json:', e.message);
  }

  // 2. Merge with Supabase settings
  try {
    const dbSettings = await fetchSettingsFromDb();
    if (dbSettings && typeof dbSettings === 'object') {
      settings = { ...settings, ...dbSettings };
    }
  } catch (e) {
    console.warn('[Scheduler] Notice: Could not read settings from Supabase:', e.message);
  }

  // 3. Override or fallback with environment variables if set (useful on Vercel)
  if (process.env.FB_PAGE_TOKEN) settings.facebookPageToken = process.env.FB_PAGE_TOKEN;
  if (process.env.FANPAGE_ID) settings.fanpageId = process.env.FANPAGE_ID;
  if (process.env.GEMINI_API_KEY) settings.geminiApiKey = process.env.GEMINI_API_KEY;
  if (process.env.SMTP_USER) {
    settings.smtpUser = settings.smtpUser || process.env.SMTP_USER;
    if (!settings.notificationEmail) settings.notificationEmail = process.env.SMTP_USER;
  }
  if (process.env.SMTP_PASS) {
    settings.smtpPass = settings.smtpPass || process.env.SMTP_PASS;
  }

  return settings;
}

/**
 * Save settings to both Supabase and local/tmp file
 */
async function saveSettings(newSettings) {
  // 1. Save to Supabase
  try {
    await saveSettingsToDb(newSettings);
  } catch (errDb) {
    console.warn('[Scheduler] Notice: Error saving settings to Supabase:', errDb.message);
  }

  // 2. Save locally / /tmp
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(newSettings, null, 2), 'utf8');
  } catch (e) {
    try {
      fs.writeFileSync(SETTINGS_TMP_FILE, JSON.stringify(newSettings, null, 2), 'utf8');
    } catch (errTmp) {
      console.error('[Scheduler] Error saving settings to /tmp:', errTmp.message);
    }
  }
}

/**
 * Execute posting a specific item
 */
async function executePost(post) {
  const settings = await getSettings();
  console.log(`[Scheduler] 🚀 Đang tiến hành đăng bài [${post.id}] - Mã máy: ${post.machineCode || 'N/A'}`);
  
  try {
    const result = await publishPostToFanpage(post, settings);
    post.status = 'posted';
    post.postedAt = new Date().toISOString();
    post.fbPostId = result.postId;
    post.fbPostUrl = result.postUrl;
    post.isSimulation = result.isSimulation || false;
    post.lastMessage = result.message;
    console.log(`[Scheduler] ✅ Đăng thành công bài [${post.id}]! Link: ${result.postUrl}`);

    // Gửi email thông báo tự động tới người dùng
    sendPostNotification(post, settings).catch(err => {
      console.error('[Scheduler] Gửi email thông báo bị lỗi:', err.message);
    });
  } catch (error) {
    post.status = 'failed';
    post.failedAt = new Date().toISOString();
    post.errorMessage = error.message;
    console.error(`[Scheduler] ❌ Thất bại đăng bài [${post.id}]:`, error.message);
  }

  // Update in posts list & Supabase
  const posts = await getPosts();
  const index = posts.findIndex(p => p.id === post.id);
  if (index !== -1) {
    posts[index] = post;
  } else {
    posts.push(post);
  }
  await savePosts(posts);
  try {
    await upsertPostToDb(post);
  } catch (e) {
    console.warn('[Scheduler] Supabase post sync notice:', e.message);
  }

  return post;
}

/**
 * Check and publish queued posts whose scheduledTime has arrived
 * AND send 20-minute media reminder emails for posts missing photos
 */
async function checkAndPublishDuePosts() {
  const settings = await getSettings();
  if (settings.autoPostEnabled === false) return;

  const posts = await getPosts();
  const now = new Date();
  let hasUpdates = false;

  for (const post of posts) {
    if (!post.scheduledTime) continue;
    const scheduledDate = new Date(post.scheduledTime);
    const diffMs = scheduledDate.getTime() - now.getTime();
    const diffMins = diffMs / (60 * 1000);

    // 1. T - 20 minutes check: Send reminder email if media is missing
    // Active window: between 1 and 25 minutes prior to scheduledTime
    const hasMedia = (post.mediaFiles && post.mediaFiles.length > 0) || Boolean(post.cloudLink);

    if (
      diffMins > 0 &&
      diffMins <= 25 &&
      !hasMedia &&
      !post.mediaReminderSent
    ) {
      console.log(`[Scheduler] 📸 Phát hiện bài [${post.id}] (Mã #${post.machineCode}) còn ${Math.round(diffMins)} phút nữa đăng nhưng chưa có ảnh.`);
      const baseUrl = process.env.BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://auto-post-fanpage-coral.vercel.app');
      const quickUploadUrl = `${baseUrl}/quick-upload?id=${post.id}`;
      
      try {
        await sendMediaReminderEmail(post, quickUploadUrl, settings);
        post.mediaReminderSent = true;
        hasUpdates = true;
      } catch (err) {
        console.error('[Scheduler] Gửi mail nhắc ảnh thất bại:', err.message);
      }
    }

    // 2. T (Due time): Check if scheduledTime has arrived
    if (now >= scheduledDate && (post.status === 'queued' || post.status === 'pending_media')) {
      // Safety check: Does it have at least 1 image or video or cloud link?
      if (!hasMedia) {
        console.log(`[Scheduler] ⏭️ BỎ QUA bài [${post.id}] (Mã #${post.machineCode}): Đến giờ đăng nhưng chưa được cấp ảnh/video.`);
        post.status = 'skipped_no_media';
        post.skippedAt = new Date().toISOString();
        post.lastMessage = 'Tự động bỏ qua không đăng lên Facebook do chưa nhận được hình ảnh/video.';
        hasUpdates = true;
      } else {
        // If has cloudLink and no local mediaFiles, append link to content
        if (post.cloudLink && (!post.mediaFiles || post.mediaFiles.length === 0)) {
          if (!post.content.includes(post.cloudLink)) {
            post.content += `\n\n📸 Xem toàn bộ ảnh & video máy thực tế: ${post.cloudLink}`;
          }
        }
        // Has media, proceed with publishing!
        await executePost(post);
      }
    }
  }

  if (hasUpdates) {
    await savePosts(posts);
    for (const p of posts) {
      try {
        await upsertPostToDb(p);
      } catch (e) {
        console.warn('[Scheduler] Supabase post sync notice:', e.message);
      }
    }
  }
}

/**
 * Calculate consecutive available slots for batch queueing
 */
async function getConsecutiveScheduleSlots(count = 1) {
  const settings = await getSettings();
  const scheduleTimes = settings.scheduleTimes || ['08:30', '11:45', '15:30', '20:00'];
  const posts = await getPosts();
  const queuedTimes = posts
    .filter(p => (p.status === 'queued' || p.status === 'pending_media') && p.scheduledTime)
    .map(p => new Date(p.scheduledTime).getTime());

  const slots = [];
  const now = new Date();
  let dayOffset = 0;

  while (slots.length < count && dayOffset < 30) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + dayOffset);

    for (const timeStr of scheduleTimes) {
      if (slots.length >= count) break;
      const [hours, minutes] = timeStr.split(':').map(Number);
      const slotTime = new Date(targetDate);
      slotTime.setHours(hours, minutes, 0, 0);

      // Must be in future (at least 20 mins from now)
      if (slotTime.getTime() > now.getTime() + 20 * 60 * 1000) {
        // Not already taken
        const isTaken = queuedTimes.some(t => Math.abs(t - slotTime.getTime()) < 10 * 60 * 1000) ||
                        slots.some(s => Math.abs(new Date(s).getTime() - slotTime.getTime()) < 10 * 60 * 1000);
        if (!isTaken) {
          slots.push(slotTime.toISOString());
        }
      }
    }
    dayOffset++;
  }

  return slots;
}

/**
 * Start the scheduler background runner
 */
function startScheduler() {
  console.log('[Scheduler] ⏰ Bộ lập lịch tự động đăng bài đã khởi chạy (quét mỗi phút 1 lần).');
  // Check every minute
  cron.schedule('* * * * *', async () => {
    await checkAndPublishDuePosts();
  });
}

/**
 * Calculate the next available slot for a new post
 */
async function getNextAvailableScheduleTime() {
  const settings = await getSettings();
  const scheduleTimes = settings.scheduleTimes || ['08:30', '11:45', '15:30', '20:00'];
  const posts = await getPosts();
  const queuedTimes = posts
    .filter(p => (p.status === 'queued' || p.status === 'pending_media') && p.scheduledTime)
    .map(p => new Date(p.scheduledTime).getTime());

  const now = new Date();
  
  // Look forward up to 7 days for the first unfilled slot
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() + dayOffset);

    for (const timeStr of scheduleTimes) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      const slotTime = new Date(targetDate);
      slotTime.setHours(hours, minutes, 0, 0);

      // Slot must be in future (at least 2 mins from now)
      if (slotTime.getTime() > now.getTime() + 2 * 60 * 1000) {
        // And not already taken by another queued post (within 10 mins window)
        const isTaken = queuedTimes.some(t => Math.abs(t - slotTime.getTime()) < 10 * 60 * 1000);
        if (!isTaken) {
          return slotTime.toISOString();
        }
      }
    }
  }

  // Fallback: 1 hour from now
  return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
}

module.exports = {
  startScheduler,
  executePost,
  checkAndPublishDuePosts,
  getNextAvailableScheduleTime,
  getConsecutiveScheduleSlots,
  getPosts,
  savePosts,
  getSettings,
  saveSettings
};
