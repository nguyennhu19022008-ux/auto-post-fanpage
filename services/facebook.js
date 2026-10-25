const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const GRAPH_API_VERSION = 'v21.0';
const BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

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
 */
async function uploadUnpublishedPhoto(pageId, pageToken, filePath) {
  const resolved = resolveMediaFilePath(filePath);
  const form = new FormData();
  form.append('published', 'false');
  form.append('access_token', pageToken);
  form.append('source', fs.createReadStream(resolved));

  const response = await axios.post(`${BASE_URL}/${pageId}/photos`, form, {
    headers: form.getHeaders(),
    timeout: 30000
  });

  return response.data.id;
}

/**
 * Upload a video to the Fanpage
 */
async function uploadVideo(pageId, pageToken, filePath, description, title = '') {
  const resolved = resolveMediaFilePath(filePath);
  const form = new FormData();
  form.append('access_token', pageToken);
  form.append('description', description);
  if (title) form.append('title', title);
  form.append('source', fs.createReadStream(resolved));

  const response = await axios.post(`${BASE_URL}/${pageId}/videos`, form, {
    headers: form.getHeaders(),
    timeout: 120000 // Videos may take longer
  });

  return response.data;
}

/**
 * Publish post to Fanpage (handles text, single photo, multiple photos, or video)
 */
async function publishPostToFanpage(postData, userSettings) {
  const pageId = userSettings.fanpageId;
  const pageToken = userSettings.facebookPageToken;
  const { content, mediaFiles = [], title = '' } = postData;

  // Check if credentials are present; if not, run in Test/Simulation Mode
  if (!pageToken || pageToken.trim() === '') {
    console.log('[FB SIMULATION] Đang chạy chế độ kiểm thử nội bộ (chưa cài Facebook Token).');
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
    const videoFile = mediaFiles.find(f => f.mimetype?.startsWith('video/') || /\.(mp4|mov|avi|mkv)$/i.test(f.filename || f.path));
    if (videoFile) {
      console.log(`[FB API] Đang tải lên video: ${videoFile.path}`);
      const videoResult = await uploadVideo(pageId, pageToken, videoFile.path, content, title);
      const videoId = videoResult.id;
      return {
        success: true,
        postId: videoId,
        postUrl: `https://www.facebook.com/${videoId}`,
        message: 'Đã đăng thành công video kèm bài viết lên Fanpage!'
      };
    }

    // Filter image files
    const imageFiles = mediaFiles.filter(f => !f.mimetype?.startsWith('video/') && !/\.(mp4|mov|avi|mkv)$/i.test(f.filename || f.path));

    // 2. Single photo post
    if (imageFiles.length === 1) {
      const resolved = resolveMediaFilePath(imageFiles[0].path);
      console.log(`[FB API] Đang đăng 1 ảnh lên Fanpage: ${resolved}`);
      const form = new FormData();
      form.append('message', content);
      form.append('access_token', pageToken);
      form.append('source', fs.createReadStream(resolved));

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
        const photoId = await uploadUnpublishedPhoto(pageId, pageToken, img.path);
        mediaFbidList.push({ media_fbid: photoId });
      }

      // Create multi-photo feed post
      const response = await axios.post(
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
      );

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
    const response = await axios.post(
      `${BASE_URL}/${pageId}/feed`,
      null,
      {
        params: {
          message: content,
          access_token: pageToken
        },
        timeout: 30000
      }
    );

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
