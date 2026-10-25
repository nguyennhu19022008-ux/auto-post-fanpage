const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { generatePostWithGemini, sanitizeRawText } = require('./services/gemini');
const { verifyPageToken } = require('./services/facebook');
const {
  startScheduler,
  executePost,
  checkAndPublishDuePosts,
  getNextAvailableScheduleTime,
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

// 5. Upload Media Files (Images / Videos)
app.post('/api/upload-media', upload.array('files', 15), (req, res) => {
  try {
    const files = req.files.map(f => ({
      originalname: f.originalname,
      filename: f.filename,
      path: f.path,
      url: `/uploads/${f.filename}`,
      mimetype: f.mimetype,
      size: f.size
    }));
    res.json({ success: true, files });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  res.json({ success: true, post: updatedPost, message: 'Đã thực thi đăng bài thành công!' });
});

// 10. Delete a Post
app.delete('/api/posts/:id', (req, res) => {
  let posts = getPosts();
  const initialLength = posts.length;
  posts = posts.filter(p => p.id !== req.params.id);

  if (posts.length !== initialLength) {
    savePosts(posts);
    res.json({ success: true, message: 'Đã xóa bài viết khỏi danh sách.' });
  } else {
    res.status(404).json({ error: 'Không tìm thấy bài viết.' });
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
