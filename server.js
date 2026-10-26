process.env.TZ = 'Asia/Ho_Chi_Minh';
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { generatePostWithGemini, sanitizeRawText } = require('./services/gemini');
const { verifyPageToken } = require('./services/facebook');
const { sendTestEmail } = require('./services/mailer');
const { parseStockTableFromImage } = require('./services/tableParser');
const {
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
  upsertPostToDb,
  deletePostFromDb
} = require('./services/supabase');
const { normalizeMachineCode, isValidMachineCode, deduplicateItemsByCode } = require('./utils/dedup');
const {
  startScheduler,
  executePost,
  checkAndPublishDuePosts,
  getNextAvailableScheduleTime,
  getConsecutiveScheduleSlots,
  getPosts,
  savePosts,
  getSettings,
  saveSettings
} = require('./services/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Storage configuration for media uploads (supports local & Vercel /tmp)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadDir = path.join(__dirname, 'public', 'uploads');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (e) {
      uploadDir = path.join('/tmp', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 } // 200MB max per video/image
});

// ======================== API ROUTES ========================

// 1. Get current settings
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Update settings
app.post('/api/settings', async (req, res) => {
  try {
    const currentSettings = await getSettings();
    const newSettings = { ...currentSettings, ...req.body };
    await saveSettings(newSettings);
    res.json({ success: true, settings: newSettings, message: 'Đã lưu cấu hình thành công!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Test Facebook Page Connection
app.post('/api/test-fb', async (req, res) => {
  try {
    const settings = await getSettings();
    const pageId = req.body.fanpageId || settings.fanpageId;
    const token = req.body.facebookPageToken || settings.facebookPageToken;

    const result = await verifyPageToken(pageId, token);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3.1. Test Email Connection
app.post('/api/test-email', async (req, res) => {
  try {
    const currentSettings = await getSettings();
    const testConfig = { ...currentSettings, ...req.body };
    const result = await sendTestEmail(testConfig);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// 4. AI Generate Post Content
app.post('/api/generate-content', async (req, res) => {
  try {
    const { rawText, customPrice, imageBase64 } = req.body;
    const settings = await getSettings();

    const result = await generatePostWithGemini(rawText, settings, customPrice, imageBase64);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Upload Media Files (Images / Videos - Up to 35 files)
app.post('/api/upload-media', upload.array('files', 35), async (req, res) => {
  try {
    const files = [];
    for (const f of (req.files || [])) {
      let publicUrl = `/uploads/${f.filename}`;
      try {
        const buffer = fs.readFileSync(f.path);
        const supaRes = await uploadToSupabaseStorage(buffer, f.originalname, f.mimetype);
        if (supaRes && supaRes.url) {
          publicUrl = supaRes.url;
        }
      } catch (err) {
        console.warn('[Storage] Fallback to local file:', err.message);
      }

      files.push({
        originalname: f.originalname,
        filename: f.filename,
        path: f.path,
        url: publicUrl,
        mimetype: f.mimetype,
        size: f.size
      });
    }
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Route: Quick Upload Page for mobile 1-click photo upload from email
app.get('/quick-upload', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'quick-upload.html'));
});

// Parse Excel Stock Table Image into structured items (with auto-deduplication)
app.post('/api/parse-table', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    const settings = await getSettings();
    const rawItems = await parseStockTableFromImage(imageBase64, settings);

    // Auto-deduplicate parsed items: if duplicate machine codes exist in table/images, keep newest!
    const { dedupedItems, replacedCount, replacedCodes } = deduplicateItemsByCode(rawItems);

    res.json({
      success: true,
      count: dedupedItems.length,
      replacedCount,
      replacedCodes,
      items: dedupedItems
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch schedule multiple items from stock table (with auto-deduplication & old queue replacement)
app.post('/api/batch-schedule', async (req, res) => {
  try {
    const { items = [] } = req.body;
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'Danh sách máy trống.' });
    }

    // 1. Deduplicate inside the incoming items: if user selected duplicate codes, keep the newest one!
    const { dedupedItems } = deduplicateItemsByCode(items);

    let posts = await getPosts();
    const replacedCodes = [];

    // 2. Check against existing queue: If any item code is already in queue (queued or pending_media),
    // delete the old post so the new post replaces it cleanly!
    for (const item of dedupedItems) {
      const norm = normalizeMachineCode(item.machineCode);
      if (isValidMachineCode(norm)) {
        const oldIndex = posts.findIndex(p => 
          (p.status === 'queued' || p.status === 'pending_media' || p.status === 'skipped_no_media') &&
          normalizeMachineCode(p.machineCode) === norm
        );
        if (oldIndex !== -1) {
          const oldPost = posts[oldIndex];
          console.log(`[Deduplicate] 🗑️ Tự động xóa bài cũ #${norm} (ID: ${oldPost.id}) trong hàng đợi để thay bằng bài mới.`);
          posts.splice(oldIndex, 1);
          await deletePostFromDb(oldPost.id);
          if (!replacedCodes.includes(norm)) replacedCodes.push(norm);
        }
      }
    }

    const slots = await getConsecutiveScheduleSlots(dedupedItems.length);
    const newPosts = [];

    for (let index = 0; index < dedupedItems.length; index++) {
      const item = dedupedItems[index];
      const scheduledTime = slots[index] || (await getNextAvailableScheduleTime());
      const newPost = {
        id: 'post_' + (Date.now() + index),
        machineCode: (item.machineCode || 'MÁY').toUpperCase(),
        machineName: item.machineName || 'Laptop Nhật Bãi',
        content: item.postContent || '',
        price: item.price || '',
        mediaFiles: [], // Starts empty, waiting for photos
        scheduledTime,
        status: 'pending_media', // Waiting for media from email reminder
        mediaReminderSent: false,
        createdAt: new Date().toISOString()
      };
      posts.unshift(newPost);
      newPosts.push(newPost);
    }

    await savePosts(posts);
    for (const np of newPosts) {
      await upsertPostToDb(np);
    }

    let message = `Đã lên lịch hàng loạt thành công cho ${newPosts.length} máy!`;
    if (replacedCodes.length > 0) {
      message += ` (Đã tự động xóa ${replacedCodes.length} mã cũ bị trùng: #${replacedCodes.join(', #')}, thay bằng mã mới)`;
    }

    res.json({
      success: true,
      count: newPosts.length,
      replacedCount: replacedCodes.length,
      replacedCodes,
      message,
      posts: newPosts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single post details
app.get('/api/posts/:id', async (req, res) => {
  try {
    const posts = await getPosts();
    const post = posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
    res.json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Attach media to a post from Mobile Quick-Upload or Web (Up to 35 files)
app.post('/api/posts/:id/attach-media', upload.array('files', 35), async (req, res) => {
  try {
    const posts = await getPosts();
    const post = posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });

    const newFiles = [];
    for (const f of (req.files || [])) {
      let publicUrl = `/uploads/${f.filename}`;
      try {
        const buffer = fs.readFileSync(f.path);
        const supaRes = await uploadToSupabaseStorage(buffer, f.originalname, f.mimetype);
        if (supaRes && supaRes.url) {
          publicUrl = supaRes.url;
        }
      } catch (err) {
        console.warn('[Storage] Fallback to local file:', err.message);
      }

      newFiles.push({
        originalname: f.originalname,
        filename: f.filename,
        path: f.path,
        url: publicUrl,
        mimetype: f.mimetype,
        size: f.size
      });
    }

    if (!post.mediaFiles) post.mediaFiles = [];
    post.mediaFiles = [...post.mediaFiles, ...newFiles];

    if (req.body.cloudLink) {
      post.cloudLink = req.body.cloudLink;
    }

    // Now that media is supplied, move post to queued (ready to publish)
    if (post.mediaFiles.length > 0 || post.cloudLink) {
      post.status = 'queued';
    }

    post.mediaReminderSent = true;
    await savePosts(posts);
    await upsertPostToDb(post);

    console.log(`[QuickUpload] 📸 Đã cập nhật ${newFiles.length} tệp media cho bài [${post.id}] - Mã #${post.machineCode}`);
    res.json({ success: true, post, message: 'Đã cập nhật hình ảnh thành công!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove a media file from a post
app.delete('/api/posts/:id/media/:filename', async (req, res) => {
  try {
    const posts = await getPosts();
    const post = posts.find(p => p.id === req.params.id);
    if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });

    if (post.mediaFiles) {
      post.mediaFiles = post.mediaFiles.filter(m => m.filename !== req.params.filename);
    }
    await savePosts(posts);
    await upsertPostToDb(post);
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Get Next Suggested Schedule Slot
app.get('/api/next-slot', async (req, res) => {
  try {
    const nextSlot = await getNextAvailableScheduleTime();
    res.json({ nextSlot });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get All Posts (Queued, Posted, Draft)
app.get('/api/posts', async (req, res) => {
  try {
    const posts = await getPosts();
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Create or Schedule a Post (with auto-deduplication: replaces old post if same machine code is in queue)
app.post('/api/posts', async (req, res) => {
  try {
    const {
      machineCode,
      machineName,
      content,
      price,
      mediaFiles = [],
      scheduledTime,
      publishImmediately = false
    } = req.body;

    let posts = await getPosts();
    const normCode = normalizeMachineCode(machineCode);
    let replacedOldPost = null;

    // Auto-deduplication: Check if an existing queued post has the exact same machine code
    if (isValidMachineCode(normCode)) {
      const oldIndex = posts.findIndex(p => 
        (p.status === 'queued' || p.status === 'pending_media' || p.status === 'skipped_no_media') &&
        normalizeMachineCode(p.machineCode) === normCode
      );
      if (oldIndex !== -1) {
        replacedOldPost = posts[oldIndex];
        console.log(`[Deduplicate] 🗑️ Tìm thấy bài cũ trùng mã #${normCode} (ID: ${replacedOldPost.id}). Xóa mã cũ để thay thế bằng mã mới.`);
        posts.splice(oldIndex, 1);
        await deletePostFromDb(replacedOldPost.id);
      }
    }

    const nextAvailableTime = await getNextAvailableScheduleTime();
    const newPost = {
      id: 'post_' + Date.now(),
      machineCode: (machineCode || 'MÁY').toUpperCase(),
      machineName: machineName || 'Laptop Nhật Bãi',
      content: content || '',
      price: price || '',
      mediaFiles: mediaFiles || [],
      scheduledTime: publishImmediately ? new Date().toISOString() : (scheduledTime || nextAvailableTime),
      status: publishImmediately ? 'processing' : 'queued',
      createdAt: new Date().toISOString()
    };

    if (publishImmediately) {
      posts.unshift(newPost);
      await savePosts(posts);
      await upsertPostToDb(newPost);
      // Run immediately
      executePost(newPost).then(async (executedPost) => {
        console.log(`[Instant Post] Hoàn tất đăng ngay bài ${newPost.id}`);
        await upsertPostToDb(executedPost);
      });
      return res.json({
        success: true,
        post: newPost,
        replacedOldPost: !!replacedOldPost,
        message: replacedOldPost
          ? `Đã đăng ngay mã #${newPost.machineCode}! (Đã tự động xóa bài cũ trùng mã trong hàng đợi)`
          : 'Đang tiến hành đăng bài lên Fanpage...'
      });
    } else {
      posts.unshift(newPost);
      await savePosts(posts);
      await upsertPostToDb(newPost);
      return res.json({
        success: true,
        post: newPost,
        replacedOldPost: !!replacedOldPost,
        message: replacedOldPost
          ? `Đã xếp mã #${newPost.machineCode} vào hàng đợi lúc ${new Date(newPost.scheduledTime).toLocaleString('vi-VN')}! (Đã tự động xóa bài cũ trùng mã)`
          : `Đã đưa bài vào hàng đợi lên lịch lúc: ${new Date(newPost.scheduledTime).toLocaleString('vi-VN')}`
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Trigger Post Immediately
app.post('/api/posts/:id/publish-now', async (req, res) => {
  try {
    const posts = await getPosts();
    const post = posts.find(p => p.id === req.params.id);
    if (!post) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
    }

    const updatedPost = await executePost(post);
    await upsertPostToDb(updatedPost);
    res.json({ success: true, post: updatedPost, message: 'Đã thực thi đăng bài thành công!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Delete a Post
app.delete('/api/posts/:id', async (req, res) => {
  try {
    let posts = await getPosts();
    const initialLength = posts.length;
    posts = posts.filter(p => p.id !== req.params.id);

    if (posts.length !== initialLength) {
      await savePosts(posts);
      await deletePostFromDb(req.params.id);
      res.json({ success: true, message: 'Đã xóa bài viết khỏi danh sách.' });
    } else {
      res.status(404).json({ error: 'Không tìm thấy bài viết.' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 11. External Cron Check Trigger (for cron-job.org / GitHub Actions / Vercel Serverless)
app.get(['/api/cron', '/api/cron-check'], async (req, res) => {
  const key = req.query.key || req.headers['authorization'];
  const expected = process.env.CRON_SECRET || 'vg_cron_2026_laptop';
  // Allow Vercel native cron (sends CRON_SECRET in header) or secret key query param
  const authHeader = req.headers['authorization'];
  const isVercelCron = authHeader === `Bearer ${expected}` || req.headers['x-vercel-cron'] === '1';

  if (!isVercelCron && key !== expected && authHeader !== `Bearer ${expected}`) {
    return res.status(401).json({ error: 'Unauthorized: Sai mã CRON_SECRET key.' });
  }

  console.log('[CronCheck] ⏰ Đã nhận tín hiệu quét tự động từ dịch vụ Cron bên ngoài!');
  try {
    await checkAndPublishDuePosts();
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Đã quét và xử lý đăng bài thành công!'
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server and Scheduler if running as standalone Node process
if (require.main === module) {
  startScheduler();
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Hệ thống Autopost Laptop Zalo -> Facebook đang chạy!`);
    console.log(`🌐 Truy cập giao diện tại: http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
