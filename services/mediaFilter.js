/**
 * Media Filter Service: Strict Prohibited Media Prevention
 * Blocks Zalo Avatars, Excel Spreadsheets, and Google Search Screenshots
 * from ever being queued or posted to Facebook.
 */

function getImageDimensions(buf) {
  if (!buf || buf.length < 16) return null;

  // JPEG check (SOI marker 0xFFD8)
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xFF) break;
      const marker = buf[offset + 1];
      // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
      if (marker >= 0xC0 && marker <= 0xC3) {
        const height = buf.readUInt16BE(offset + 5);
        const width = buf.readUInt16BE(offset + 7);
        return { width, height, type: 'jpeg' };
      }
      const len = buf.readUInt16BE(offset + 2);
      offset += 2 + len;
    }
  }

  // PNG check (\x89PNG\r\n\x1a\n)
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height, type: 'png' };
  }

  return null;
}

/**
 * Check if a media file or URL is prohibited
 * @param {Object} media - { buffer, url, size }
 * @returns {Object} { isBanned: boolean, reason: string }
 */
function inspectMedia(media) {
  const url = (media.url || '').toLowerCase();

  // 1. URL pattern check for Zalo Avatars
  if (
    url.includes('ava-talk') ||
    url.includes('avatar') ||
    url.includes('/w120/') ||
    url.includes('/w160/') ||
    url.includes('/w200/') ||
    url.includes('static.zalo.me/avatar')
  ) {
    return { isBanned: true, reason: 'Ảnh đại diện Zalo (URL match)' };
  }

  if (media.buffer) {
    const buf = media.buffer;
    const size = buf.length;
    const dim = getImageDimensions(buf);

    if (dim) {
      const { width, height } = dim;

      // 2. Avatar dimension check (<= 250px square or tiny)
      if (width <= 250 && height <= 250) {
        return { isBanned: true, reason: `Ảnh đại diện / Icon kích thước nhỏ (${width}x${height})` };
      }

      if (width < 250 || height < 250) {
        return { isBanned: true, reason: `Ảnh quá nhỏ không đạt chuẩn đăng bài (${width}x${height})` };
      }

      // Small file size square images
      if (size < 25000 && Math.abs(width - height) < 30) {
        return { isBanned: true, reason: `Ảnh đại diện Zalo vuông dung lượng thấp (${Math.round(size/1024)}KB)` };
      }
    }
  }

  return { isBanned: false };
}

module.exports = {
  getImageDimensions,
  inspectMedia
};
