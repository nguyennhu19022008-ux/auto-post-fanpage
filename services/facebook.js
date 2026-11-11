const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const GRAPH_API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const { IS_TEST_MODE } = require('../utils/runtime');

// Mã lỗi Graph API mang tính tạm thời (an toàn để thử lại):
// 1 = Unknown, 2 = Service temporarily unavailable, 4 = App rate limit,
// 17 = User rate limit, 32 = Page rate limit, 341 = Application limit reached
const TRANSIENT_FB_CODES = new Set([1, 2, 4, 17, 32, 341]);

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Phân loại lỗi để quyết định có thử lại hay không.
 * @param {Error} error
 * @param {boolean} idempotent - true nếu gửi lại KHÔNG tạo bài trùng (vd: upload ảnh unpublished)
 */
function isRetryableError(error, idempotent) {
  const fbCode = error.response?.data?.error?.code;
  const status = error.response?.status;

  // Facebook đã trả lời và báo lỗi tạm thời -> request chưa được thực hiện -> an toàn thử lại
  if (fbCode !== undefined) return TRANSIENT_FB_CODES.has(fbCode);
  if (status >= 500) return true;

  // Không có response (timeout / mất mạng): request CÓ THỂ đã thành công phía Facebook.
  // Chỉ thử lại nếu thao tác idempotent, tránh đăng trùng bài lên Fanpage.
  if (!error.response) return idempotent;

  return false;
}

/**
 * Bọc một lời gọi Graph API với cơ chế thử lại tối đa 3 lần (backoff 1.5s -> 3s).
 */
async function withRetry(label, fn, { idempotent = false, attempts = 3 } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === attempts || !isRetryableError(error, idempotent)) throw error;
      const wait = 1500 * i;
      const reason = error.response?.data?.error?.message || error.code || error.message;
      console.warn(`[FB API] ${label} lỗi tạm thời (lần ${i}/${attempts}): ${reason}. Thử lại sau ${wait}ms...`);
      await sleepMs(wait);
    }
  }
  throw lastError;
}

/**
 * Verify Facebook Page Access Token and retrieve page info
 */
async function verifyPageToken(pageId, pageToken) {
  if (!pageToken || pageToken.trim() === '') {
    return { valid: false, error: 'Chưa nhập Page Access Token.' };
  }

  try {
    const response = await axios.get(`${BASE_URL}/${pageId}`, {
      params: {
        fields: 'id,name,link,picture{url}',
        access_token: pageToken
      },
      timeout: 10000
    });
    return {
      valid: true,
      pageInfo: response.data
    };
  } catch (error) {
    const fbError = error.response?.data?.error?.message || error.message;
    return {
      valid: false,
      error: `Lỗi kết nối Facebook: ${fbError}`
    };
  }
}

function resolveMediaFilePath(filePath) {
  if (filePath && fs.existsSync(filePath)) return filePath;
  if (filePath) {
    const filename = path.basename(filePath);
    const candidate = path.join(__dirname, '..', 'public', 'uploads', filename);
    if (fs.existsSync(candidate)) return candidate;
  }
  return filePath;
}

/**
 * Upload an un-published photo to get photo ID (for multi-image album)
 * Supports both public HTTPS URLs (Supabase Storage) and local file streams
 */
async function uploadUnpublishedPhoto(pageId, pageToken, filePath, fileUrl = '') {
  // FormData stream chỉ dùng được 1 lần -> dựng lại form ở mỗi lần thử
  const buildForm = () => {
    const form = new FormData();
    form.append('published', 'false');
    form.append('access_token', pageToken);
    if (fileUrl && fileUrl.startsWith('http')) {
      form.append('url', fileUrl);
    } else {
      form.append('source', fs.createReadStream(resolveMediaFilePath(filePath)));
    }
    return form;
  };

  // Ảnh unpublished không hiển thị trên Fanpage -> thử lại không gây trùng bài
  const response = await withRetry('Upload ảnh album', () => {
    const form = buildForm();
    return axios.post(`${BASE_URL}/${pageId}/photos`, form, {
      headers: form.getHeaders(),
      timeout: 30000
    });
  }, { idempotent: true });

  return response.data.id;
}

/**
 * Upload a video to the Fanpage
 */
async function uploadVideo(pageId, pageToken, filePath, description, title = '', fileUrl = '') {
  // If a public Cloud URL (Supabase) is provided, Facebook downloads the video directly
  if (fileUrl && fileUrl.startsWith('http')) {
    console.log(`[FB API] 🎬 Đang đăng video trực tiếp từ Cloud URL: ${fileUrl}`);
    const response = await axios.post(
      `${BASE_URL}/${pageId}/videos`,
      null,
      {
        params: {
          file_url: fileUrl,
          description: description,
          title: title || 'Laptop Vương Gia',
          access_token: pageToken
        },
        timeout: 180000 // 3 minutes timeout for video processing
      }
    );
    return response.data;
  }

  // Fallback: Local stream upload
  const form = new FormData();
  form.append('access_token', pageToken);
  form.append('description', description);
  if (title) form.append('title', title);

  const resolved = resolveMediaFilePath(filePath);
  form.append('source', fs.createReadStream(resolved));

  const response = await axios.post(`${BASE_URL}/${pageId}/videos`, form, {
    headers: form.getHeaders(),
    timeout: 180000 // 3 minutes timeout
  });

  return response.data;
}

/**
 * Publish post to Fanpage (handles text, single photo, multiple photos, or video)
 */
async function publishPostToFanpage(postData, userSettings = {}) {
  const pageId = userSettings.fanpageId || process.env.FANPAGE_ID || '1154184381110692';
  const pageToken = userSettings.facebookPageToken;
  const { content, mediaFiles = [] } = postData;
  const videoTitle = postData.title || (postData.machineName ? `Laptop ${postData.machineName}` : 'Laptop Vương Gia');

  // Check if credentials are present; if not, run in Test/Simulation Mode
  // VG_TEST_MODE: bộ test E2E không bao giờ được đăng bài thật lên Fanpage
  if (IS_TEST_MODE || !pageToken || pageToken.trim() === '') {
    console.log(IS_TEST_MODE
      ? '[FB SIMULATION] VG_TEST_MODE đang bật: mô phỏng đăng bài, không gọi Facebook thật.'
      : '[FB SIMULATION] Đang chạy chế độ kiểm thử nội bộ (chưa cài Facebook Token).');
    return {
      success: true,
      isSimulation: true,
      postId: `simulated_${Date.now()}`,
      postUrl: `${userSettings.fanpageUrl || 'https://www.facebook.com/profile.php?id=' + pageId}`,
      message: 'Đã hoàn tất đăng mô phỏng (Chưa nhập Facebook Page Token). Bạn có thể thêm Token trong mục Cài Đặt bất cứ lúc nào.'
    };
  }

  try {
    // 1. If there's a video file among media
    const videoFile = mediaFiles.find(f => 
      f.mimetype?.startsWith('video/') || 
      /\.(mp4|mov|avi|mkv|webm|3gp)$/i.test(f.filename || f.path || f.url || f.originalname)
    );
    if (videoFile) {
      console.log(`[FB API] 🎬 Đang xử lý đăng video: ${videoFile.url || videoFile.path}`);
      const videoResult = await uploadVideo(pageId, pageToken, videoFile.path, content, videoTitle, videoFile.url);
      const videoId = videoResult.id;
      return {
        success: true,
        postId: videoId,
        postUrl: `https://www.facebook.com/${videoId}`,
        message: 'Đã đăng thành công video kèm bài viết lên Fanpage!'
      };
    }

    // Filter image files
    const imageFiles = mediaFiles.filter(f => 
      !f.mimetype?.startsWith('video/') && 
      !/\.(mp4|mov|avi|mkv|webm|3gp)$/i.test(f.filename || f.path || f.url || f.originalname)
    );

    // 2. Single photo post
    if (imageFiles.length === 1) {
      const img = imageFiles[0];
      const form = new FormData();
      form.append('message', content);
      form.append('access_token', pageToken);

      if (img.url && img.url.startsWith('http')) {
        console.log(`[FB API] Đang đăng 1 ảnh từ Supabase Cloud URL: ${img.url}`);
        form.append('url', img.url);
      } else {
        const resolved = resolveMediaFilePath(img.path);
        console.log(`[FB API] Đang đăng 1 ảnh từ file cục bộ: ${resolved}`);
        form.append('source', fs.createReadStream(resolved));
      }

      const response = await axios.post(`${BASE_URL}/${pageId}/photos`, form, {
        headers: form.getHeaders(),
        timeout: 45000
      });

      const photoId = response.data.id;
      const postFbId = response.data.post_id || photoId;
      return {
        success: true,
        postId: postFbId,
        postUrl: `https://www.facebook.com/${postFbId}`,
        message: 'Đã đăng thành công bài viết và 1 ảnh lên Fanpage!'
      };
    }

    // 3. Multi-photo post (Album)
    if (imageFiles.length > 1) {
      console.log(`[FB API] Đang tải lên album ${imageFiles.length} ảnh...`);
      const mediaFbidList = [];
      for (const img of imageFiles) {
        const photoId = await uploadUnpublishedPhoto(pageId, pageToken, img.path, img.url);
        mediaFbidList.push({ media_fbid: photoId });
      }

      // Create multi-photo feed post (chỉ retry khi Facebook trả lỗi tạm thời rõ ràng)
      const response = await withRetry('Xuất bản album', () => axios.post(
        `${BASE_URL}/${pageId}/feed`,
        null,
        {
          params: {
            message: content,
            attached_media: JSON.stringify(mediaFbidList),
            access_token: pageToken
          },
          timeout: 45000
        }
      ));

      const postId = response.data.id;
      return {
        success: true,
        postId: postId,
        postUrl: `https://www.facebook.com/${postId}`,
        message: `Đã đăng thành công bài viết cùng album ${imageFiles.length} ảnh lên Fanpage!`
      };
    }

    // 4. Text-only post
    console.log('[FB API] Đang đăng bài viết thuần text...');
    const response = await withRetry('Đăng bài text', () => axios.post(
      `${BASE_URL}/${pageId}/feed`,
      null,
      {
        params: {
          message: content,
          access_token: pageToken
        },
        timeout: 30000
      }
    ));

    const postId = response.data.id;
    return {
      success: true,
      postId: postId,
      postUrl: `https://www.facebook.com/${postId}`,
      message: 'Đã đăng thành công bài viết lên Fanpage!'
    };

  } catch (error) {
    const errorData = error.response?.data?.error;
    const errorMsg = errorData ? `${errorData.message} (Code: ${errorData.code})` : error.message;
    console.error('[FB API Error]', errorMsg);
    throw new Error(`Đăng Facebook thất bại: ${errorMsg}`);
  }
}

module.exports = {
  verifyPageToken,
  publishPostToFanpage
};
