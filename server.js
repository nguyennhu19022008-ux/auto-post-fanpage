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

// Cron trigger endpoint for Vercel Cron Jobs
app.get('/api/cron', async (req, res) => {
  try {
    await checkAndPublishDuePosts();
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 1. Get current settings
app.get('/api/settings', (req, res) => {
  res.json(getSettings());
});

// 2. Update settings
app.post('/api/settings', (req, res) => {
  const currentSettings = getSettings();
  const newSettings = { ...currentSettings, ...req.body };
  saveSettings(newSettings);
  res.json({ success: true, settings: newSettings, message: 'Đã lưu cấu hình thành công!' });
});

// 3. Test Facebook Page Connection
app.post('/api/test-fb', async (req, res) => {
  const settings = getSettings();
  const pageId = req.body.fanpageId || settings.fanpageId;
  const token = req.body.facebookPageToken || settings.facebookPageToken;

  const result = await verifyPageToken(pageId, token);
  res.json(result);
});

// 3.1. Test Email Connection
app.post('/api/test-email', async (req, res) => {
  try {
    const currentSettings = getSettings();
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
    const settings = getSettings();

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

// Parse Excel Stock Table Image into structured items
app.post('/api/parse-table', async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    const settings = getSettings();
    const items = await parseStockTableFromImage(imageBase64, settings);
    res.json({ success: true, count: items.length, items });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Batch schedule multiple items from stock table
app.post('/api/batch-schedule', async (req, res) => {
  try {
    const { items = [] } = req.body;
    if (items.length === 0) {
      return res.status(400).json({ success: false, error: 'Danh sách máy trống.' });
    }

    const posts = getPosts();
    const slots = getConsecutiveScheduleSlots(items.length);
    const newPosts = [];

    items.forEach((item, index) => {
      const scheduledTime = slots[index] || getNextAvailableScheduleTime();
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
    });

    savePosts(posts);
    for (const np of newPosts) {
      upsertPostToDb(np).catch(e => console.warn('Supabase post sync notice:', e.message));
    }

    res.json({
      success: true,
      count: newPosts.length,
      message: `Đã lên lịch hàng loạt thành công cho ${newPosts.length} máy!`,
      posts: newPosts
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single post details
app.get('/api/posts/:id', (req, res) => {
  const posts = getPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  res.json(post);
});

// Attach media to a post from Mobile Quick-Upload or Web (Up to 35 files)
app.post('/api/posts/:id/attach-media', upload.array('files', 35), async (req, res) => {
  try {
    const posts = getPosts();
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
    savePosts(posts);
    await upsertPostToDb(post);

    console.log(`[QuickUpload] 📸 Đã cập nhật ${newFiles.length} tệp media cho bài [${post.id}] - Mã #${post.machineCode}`);
    res.json({ success: true, post, message: 'Đã cập nhật hình ảnh thành công!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove a media file from a post
app.delete('/api/posts/:id/media/:filename', (req, res) => {
  const posts = getPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Không tìm thấy bài viết.' });

  if (post.mediaFiles) {
    post.mediaFiles = post.mediaFiles.filter(m => m.filename !== req.params.filename);
  }
  savePosts(posts);
  res.json({ success: true, post });
});

// 6. Get Next Suggested Schedule Slot
app.get('/api/next-slot', (req, res) => {
  const nextSlot = getNextAvailableScheduleTime();
  res.json({ nextSlot });
});

// 7. Get All Posts (Queued, Posted, Draft)
app.get('/api/posts', (req, res) => {
  const posts = getPosts();
  res.json(posts);
});

// 8. Create or Schedule a Post
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

    const posts = getPosts();
    const newPost = {
      id: 'post_' + Date.now(),
      machineCode: (machineCode || 'MÁY').toUpperCase(),
      machineName: machineName || 'Laptop Nhật Bãi',
      content: content || '',
      price: price || '',
      mediaFiles: mediaFiles || [],
      scheduledTime: publishImmediately ? new Date().toISOString() : (scheduledTime || getNextAvailableScheduleTime()),
      status: publishImmediately ? 'processing' : 'queued',
      createdAt: new Date().toISOString()
    };

    if (publishImmediately) {
      posts.unshift(newPost);
      savePosts(posts);
      // Run immediately
      executePost(newPost).then(() => {
        console.log(`[Instant Post] Hoàn tất đăng ngay bài ${newPost.id}`);
      });
      return res.json({ success: true, post: newPost, message: 'Đang tiến hành đăng bài lên Fanpage...' });
    } else {
      posts.unshift(newPost);
      savePosts(posts);
      upsertPostToDb(newPost).catch(e => console.warn('Supabase post sync notice:', e.message));
      return res.json({
        success: true,
        post: newPost,
        message: `Đã đưa bài vào hàng đợi lên lịch lúc: ${new Date(newPost.scheduledTime).toLocaleString('vi-VN')}`
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Trigger Post Immediately
app.post('/api/posts/:id/publish-now', async (req, res) => {
  const posts = getPosts();
  const post = posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  }

  const updatedPost = await executePost(post);
  upsertPostToDb(updatedPost).catch(e => console.warn('Supabase post sync notice:', e.message));
  res.json({ success: true, post: updatedPost, message: 'Đã thực thi đăng bài thành công!' });
});

// 10. Delete a Post
app.delete('/api/posts/:id', (req, res) => {
  let posts = getPosts();
  const initialLength = posts.length;
  posts = posts.filter(p => p.id !== req.params.id);

  if (posts.length !== initialLength) {
    savePosts(posts);
    deletePostFromDb(req.params.id).catch(e => console.warn('Supabase delete notice:', e.message));
    res.json({ success: true, message: 'Đã xóa bài viết khỏi danh sách.' });
  } else {
    res.status(404).json({ error: 'Không tìm thấy bài viết.' });
  }
});

// 11. External Cron Check Trigger (for cron-job.org / GitHub Actions / Vercel Serverless)
app.get('/api/cron-check', async (req, res) => {
  const key = req.query.key || req.headers['authorization'];
  const expected = process.env.CRON_SECRET || 'vg_cron_2026_laptop';
  if (key !== expected && key !== `Bearer ${expected}`) {
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
