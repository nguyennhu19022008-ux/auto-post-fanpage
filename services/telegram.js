const axios = require('axios');
const { generatePostWithGemini } = require('./gemini');
const { uploadToSupabaseStorage, saveSettingsToDb } = require('./supabase');
const { publishPostToFanpage } = require('./facebook');

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';

// In-memory buffer to debounce and accumulate media group (Album) updates
// Map<media_group_id, { chatId, caption, items: [], timer, postTime }>
const mediaGroupBuffer = new Map();

/**
 * Escape HTML special characters for Telegram HTML parse mode
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send a message via Telegram Bot API
 */
async function sendTelegramMessage(token, chatId, text, options = {}) {
  if (!token || !chatId) {
    console.warn('[Telegram] Thiếu token hoặc chatId để gửi tin nhắn');
    return null;
  }

  try {
    const payload = {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: options.disable_web_page_preview || false,
      ...options
    };

    const response = await axios.post(`${TELEGRAM_API_BASE}${token}/sendMessage`, payload, {
      timeout: 15000
    });
    return response.data;
  } catch (error) {
    console.error('[Telegram] Gửi tin nhắn thất bại:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * Answer an inline callback query
 */
async function answerCallbackQuery(token, callbackQueryId, text = '', showAlert = false) {
  if (!token || !callbackQueryId) return;
  try {
    await axios.post(`${TELEGRAM_API_BASE}${token}/answerCallbackQuery`, {
      callback_query_id: callbackQueryId,
      text: text,
      show_alert: showAlert
    }, { timeout: 10000 });
  } catch (err) {
    console.error('[Telegram] answerCallbackQuery error:', err.message);
  }
}

/**
 * Edit existing message text
 */
async function editTelegramMessageText(token, chatId, messageId, text, options = {}) {
  if (!token || !chatId || !messageId) return;
  try {
    await axios.post(`${TELEGRAM_API_BASE}${token}/editMessageText`, {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      ...options
    }, { timeout: 15000 });
  } catch (err) {
    console.error('[Telegram] editMessageText error:', err.message);
  }
}

/**
 * Register webhook with Telegram
 */
async function setTelegramWebhook(token, webhookUrl) {
  try {
    const response = await axios.post(`${TELEGRAM_API_BASE}${token}/setWebhook`, {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query']
    }, { timeout: 15000 });
    return response.data;
  } catch (error) {
    console.error('[Telegram] setWebhook error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.description || error.message);
  }
}

/**
 * Get webhook info from Telegram
 */
async function getTelegramWebhookInfo(token) {
  try {
    const response = await axios.get(`${TELEGRAM_API_BASE}${token}/getWebhookInfo`, {
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.error('[Telegram] getWebhookInfo error:', error.response?.data || error.message);
    throw new Error(error.response?.data?.description || error.message);
  }
}

/**
 * Download a file from Telegram and upload to Supabase Storage
 */
async function downloadAndUploadTelegramFile(token, fileId, originalName, mimeType) {
  try {
    // 1. Get file path from Telegram
    const fileInfoRes = await axios.get(`${TELEGRAM_API_BASE}${token}/getFile?file_id=${fileId}`, {
      timeout: 15000
    });
    const filePath = fileInfoRes.data?.result?.file_path;
    if (!filePath) throw new Error('Không lấy được đường dẫn file từ Telegram');

    // 2. Download file buffer
    const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const fileDownloadRes = await axios.get(fileUrl, {
      responseType: 'arraybuffer',
      timeout: 45000
    });
    const buffer = Buffer.from(fileDownloadRes.data);

    // 3. Upload to Supabase Storage
    const uploaded = await uploadToSupabaseStorage(buffer, originalName, mimeType);
    return uploaded;
  } catch (err) {
    console.error('[Telegram] Lỗi tải file media lên Supabase:', err.message);
    throw err;
  }
}

/**
 * Helper: Calculate next golden schedule slot (08:30, 11:45, 15:30, 20:00)
 */
function calculateNextScheduleTime(scheduleTimes = ['08:30', '11:45', '15:30', '20:00']) {
  const now = new Date();
  const currentTotalMins = now.getHours() * 60 + now.getMinutes();

  for (const slot of scheduleTimes) {
    const [h, m] = slot.split(':').map(Number);
    const slotTotalMins = h * 60 + m;
    // Add slot if at least 15 minutes in future
    if (slotTotalMins > currentTotalMins + 15) {
      const scheduled = new Date(now);
      scheduled.setHours(h, m, 0, 0);
      return scheduled.toISOString();
    }
  }

  // Next day first slot
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [firstH, firstM] = (scheduleTimes[0] || '08:30').split(':').map(Number);
  tomorrow.setHours(firstH, firstM, 0, 0);
  return tomorrow.toISOString();
}

/**
 * Main Webhook Dispatcher
 */
async function handleTelegramUpdate(update, settings, { getPosts, savePosts, upsertPostToDb, publishPost }) {
  const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.warn('[Telegram Webhook] Chưa cấu hình telegramBotToken');
    return;
  }

  // 1. Handle Inline Button Callback Queries (Đăng ngay, Hủy...)
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, token, settings, { getPosts, savePosts, upsertPostToDb, publishPost });
    return;
  }

  const message = update.message || update.channel_post;
  if (!message) return;

  const chatId = message.chat.id;
  const text = (message.text || '').trim();
  const caption = (message.caption || '').trim();
  const mediaGroupId = message.media_group_id;

  // Auto-record chatId in settings so user never has to copy-paste it manually
  if (chatId && (!settings.telegramChatId || settings.telegramChatId !== String(chatId))) {
    settings.telegramChatId = String(chatId);
    saveSettingsToDb(settings).catch(e => console.warn('[Telegram] Auto-save chatId notice:', e.message));
  }

  // 2. Handle Slash Commands
  if (text.startsWith('/')) {
    await handleCommands(message, token, settings, { getPosts, savePosts });
    return;
  }

  // 3. Handle Album (Media Group) - 1 video + N photos sent together with Caption
  if (mediaGroupId) {
    await handleMediaGroupUpdate(message, token, settings, { getPosts, savePosts, upsertPostToDb });
    return;
  }

  // 4. Handle Single Photo or Video
  if (message.photo || message.video || message.document) {
    await handleSingleMediaMessage(message, token, settings, { getPosts, savePosts, upsertPostToDb });
    return;
  }

  // 5. Handle Raw Text (Zalo post text pasted without media)
  if (text) {
    await handleRawTextMessage(message, token, settings, { getPosts, savePosts, upsertPostToDb });
  }
}

/**
 * Handle Slash Commands: /start, /queue, /status, /help
 */
async function handleCommands(message, token, settings, { getPosts }) {
  const chatId = message.chat.id;
  const text = message.text.trim();
  const command = text.split(' ')[0].toLowerCase();

  if (command === '/start') {
    const welcomeText = `
👋 <b>Chào mừng Anh Vương Gia đến với Bot Trợ Lý Fanpage!</b>
────────────────────────
Bot giúp anh tự động hóa 100% quy trình đăng bài lên <b>Laptop Vương Gia</b>:

🚀 <b>CÁCH DÙNG SIÊU ĐƠN GIẢN:</b>
1️⃣ <b>Cách nhanh nhất (1 nốt nhạc)</b>: Chọn video/ảnh từ thư viện, dán bài viết Zalo vào phần <i>Chú thích (Caption)</i> rồi bấm <b>Gửi</b>!
2️⃣ <b>Gửi bài thô</b>: Chỉ cần dán nội dung bài Zalo vào đây, AI sẽ tự động chuẩn hóa cấu hình và lên lịch.
3️⃣ <b>Bổ sung media</b>: Thả trực tiếp ảnh/video vào đây, Bot sẽ tự gắn vào bài viết đang chờ.

📌 <b>LỆNH HỖ TRỢ:</b>
• /queue : Xem hàng đợi các bài viết đang chờ đăng
• /status : Kiểm tra kết nối Fanpage và cấu hình
• /help : Xem hướng dẫn chi tiết
────────────────────────
✅ <i>Tài khoản Telegram của anh đã được tự động liên kết thành công!</i>
(Chat ID: <code>${chatId}</code>)
    `.trim();

    await sendTelegramMessage(token, chatId, welcomeText, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📋 Xem Hàng Đợi (/queue)', callback_data: 'cmd:queue' },
            { text: '⚡ Trạng Thái (/status)', callback_data: 'cmd:status' }
          ]
        ]
      }
    });
    return;
  }

  if (command === '/queue' || command === '/hangdoi') {
    const posts = await getPosts();
    const queued = posts.filter(p => p.status === 'queued' || p.status === 'pending_media');

    if (queued.length === 0) {
      await sendTelegramMessage(token, chatId, '📭 <b>Hàng đợi hiện đang trống!</b>\n\nAnh hãy gửi bài viết Zalo hoặc chọn ảnh/video kèm chú thích để lên lịch nhé.');
      return;
    }

    let msg = `📋 <b>DANH SÁCH BÀI VIẾT CHỜ ĐĂNG (${queued.length} bài):</b>\n────────────────────────\n`;
    const keyboard = [];

    queued.slice(0, 5).forEach((p, i) => {
      const timeStr = new Date(p.scheduledTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
      const mCount = p.mediaFiles?.length || 0;
      const statusIcon = p.status === 'queued' ? '⏳' : '📬 Chờ ảnh';
      msg += `<b>${i + 1}. #${p.machineCode || 'N/A'}</b>: ${escapeHtml(p.machineName || p.content.slice(0, 35))}...\n`;
      msg += `   ⏰ Hẹn: <b>${timeStr}</b> · 📁 ${mCount} media · ${statusIcon}\n\n`;

      keyboard.push([
        { text: `⚡ Đăng ngay #${p.machineCode}`, callback_data: `action:publish_now:${p.id}` },
        { text: `❌ Hủy #${p.machineCode}`, callback_data: `action:cancel_post:${p.id}` }
      ]);
    });

    await sendTelegramMessage(token, chatId, msg.trim(), {
      reply_markup: { inline_keyboard: keyboard }
    });
    return;
  }

  if (command === '/status') {
    const fanpageName = settings.fanpageName || 'Laptop Vương Gia';
    const fanpageId = settings.fanpageId || '1154184381110692';
    const hasToken = Boolean(settings.facebookPageToken || process.env.FB_PAGE_TOKEN);

    const msg = `
📊 <b>TRẠNG THÁI HỆ THỐNG AUTOPOST</b>
────────────────────────
• <b>Fanpage:</b> ${escapeHtml(fanpageName)}
• <b>ID:</b> <code>${fanpageId}</code>
• <b>Token Facebook:</b> ${hasToken ? '✅ Đã kích hoạt (Vĩnh viễn)' : '❌ Chưa có'}
• <b>Tự động đăng:</b> ${settings.autoPostEnabled !== false ? '✅ Bật' : '⏸ Tạm dừng'}
• <b>Khung giờ vàng:</b> ${(settings.scheduleTimes || ['08:30', '11:45', '15:30', '20:00']).join(', ')}
• <b>Hotline:</b> ${settings.hotline || '0876637806'}
────────────────────────
    `.trim();

    await sendTelegramMessage(token, chatId, msg);
    return;
  }

  if (command === '/help') {
    const helpMsg = `
📖 <b>HƯỚNG DẪN ĐĂNG BÀI 1 CHẠM QUA TELEGRAM:</b>
────────────────────────
1️⃣ <b>Đăng cả Album ảnh + Video + Bài viết:</b>
- Trên điện thoại, mở Telegram vào ô chat này.
- Bấm chọn 1 video + nhiều ảnh máy.
- Dán đoạn text bài Zalo vào phần Chú thích (Caption).
- Bấm Gửi. Bot sẽ tự bóc cấu hình và lên lịch tự động!

2️⃣ <b>Dán bài trước, gửi ảnh sau:</b>
- Dán bài viết Zalo vào chat.
- Bot tạo bài và báo đang chờ ảnh.
- Bạn gửi ảnh hoặc video vào là Bot tự gom lại.

3️⃣ <b>Đăng ngay không cần chờ:</b>
- Dưới mỗi bài Bot gửi, bấm nút <b>[⚡ Đăng ngay]</b> là bài bay thẳng lên Fanpage Facebook tức thì!
    `.trim();
    await sendTelegramMessage(token, chatId, helpMsg);
  }
}

/**
 * Handle Media Group (Album with caption)
 */
async function handleMediaGroupUpdate(message, token, settings, { getPosts, savePosts, upsertPostToDb }) {
  const mediaGroupId = message.media_group_id;
  const chatId = message.chat.id;

  // Extract media item from message
  let mediaItem = null;
  if (message.video) {
    mediaItem = {
      type: 'video',
      fileId: message.video.file_id,
      fileName: `telegram_${Date.now()}.mp4`,
      mimeType: message.video.mime_type || 'video/mp4'
    };
  } else if (message.photo) {
    // Pick the largest photo resolution
    const largestPhoto = message.photo[message.photo.length - 1];
    mediaItem = {
      type: 'photo',
      fileId: largestPhoto.file_id,
      fileName: `telegram_${Date.now()}.jpg`,
      mimeType: 'image/jpeg'
    };
  }

  if (!mediaGroupBuffer.has(mediaGroupId)) {
    mediaGroupBuffer.set(mediaGroupId, {
      chatId,
      caption: message.caption || '',
      items: mediaItem ? [mediaItem] : [],
      timer: null
    });
  } else {
    const existing = mediaGroupBuffer.get(mediaGroupId);
    if (mediaItem) existing.items.push(mediaItem);
    if (!existing.caption && message.caption) existing.caption = message.caption;
  }

  const group = mediaGroupBuffer.get(mediaGroupId);
  if (group.timer) clearTimeout(group.timer);

  // Set debounce timer to 1500ms to allow all items in the album to arrive
  group.timer = setTimeout(async () => {
    mediaGroupBuffer.delete(mediaGroupId);
    await processCompleteMediaGroup(group, token, settings, { getPosts, savePosts, upsertPostToDb });
  }, 1500);
}

/**
 * Process gathered media group after debounce
 */
async function processCompleteMediaGroup(group, token, settings, { getPosts, savePosts, upsertPostToDb }) {
  const { chatId, caption, items } = group;

  try {
    await sendTelegramMessage(token, chatId, `⏳ <b>Đang tải và xử lý ${items.length} tệp media lên Supabase...</b>`);

    // 1. Download and upload all media files to Supabase
    const uploadedMediaFiles = [];
    for (const item of items) {
      try {
        const uploaded = await downloadAndUploadTelegramFile(token, item.fileId, item.fileName, item.mimeType);
        uploadedMediaFiles.push(uploaded);
      } catch (uploadErr) {
        console.error('[Telegram] Bỏ qua 1 tệp bị lỗi khi upload:', uploadErr.message);
      }
    }

    // 2. Process caption or raw text
    const rawText = caption || 'Laptop Nhật xách tay chất lượng cao';
    let machineCode = '';
    const codeMatch = rawText.match(/(?:mã|ms|code|#)\s*[:.]?\s*([a-zA-Z0-9]+)/i);
    if (codeMatch) machineCode = codeMatch[1].toUpperCase();

    // AI or fallback generation
    const generated = await generatePostWithGemini(rawText, settings);
    const finalContent = generated.content;
    const finalMachineCode = machineCode || generated.machineCode || String(Date.now()).slice(-4);
    const scheduledTime = calculateNextScheduleTime(settings.scheduleTimes);

    const newPost = {
      id: `post_${Date.now()}`,
      machineCode: finalMachineCode,
      machineName: generated.machineName || `Laptop #${finalMachineCode}`,
      content: finalContent,
      price: generated.price || '',
      mediaFiles: uploadedMediaFiles,
      scheduledTime: scheduledTime,
      status: uploadedMediaFiles.length > 0 ? 'queued' : 'pending_media',
      mediaReminderSent: false,
      cloudLink: null,
      createdAt: new Date().toISOString(),
      postedAt: null,
      failedAt: null,
      skippedAt: null,
      fbPostId: null,
      fbPostUrl: null,
      isSimulation: false,
      lastMessage: 'Đã lên lịch đăng từ Telegram Bot'
    };

    // Save post
    const posts = await getPosts();
    posts.unshift(newPost);
    await savePosts(posts);
    await upsertPostToDb(newPost);

    const timeStr = new Date(scheduledTime).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
    });

    const vCount = uploadedMediaFiles.filter(f => f.mimetype?.startsWith('video/') || /\.(mp4|mov)$/i.test(f.url)).length;
    const pCount = uploadedMediaFiles.length - vCount;

    const replyMsg = `
🎉 <b>ĐÃ TẠO BÀI VIẾT & MEDIA THÀNH CÔNG!</b>
────────────────────────
🏷️ <b>Mã máy:</b> <code>#${finalMachineCode}</code>
💻 <b>Tên máy:</b> ${escapeHtml(newPost.machineName)}
📁 <b>Đã nhận:</b> ${vCount > 0 ? `<b>${vCount} video</b> · ` : ''}<b>${pCount} ảnh</b>
⏰ <b>Giờ hẹn lên sóng:</b> <b>${timeStr}</b>
────────────────────────
📝 <b>Bản xem trước:</b>
${escapeHtml(finalContent.slice(0, 220))}...
────────────────────────
    `.trim();

    await sendTelegramMessage(token, chatId, replyMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⚡ Đăng Facebook Ngay', callback_data: `action:publish_now:${newPost.id}` },
            { text: '❌ Hủy Bài', callback_data: `action:cancel_post:${newPost.id}` }
          ]
        ]
      }
    });

  } catch (err) {
    console.error('[Telegram] Lỗi xử lý media group:', err);
    await sendTelegramMessage(token, chatId, `❌ <b>Lỗi khi xử lý bài viết:</b> ${escapeHtml(err.message)}`);
  }
}

/**
 * Handle Single Photo or Video
 */
async function handleSingleMediaMessage(message, token, settings, { getPosts, savePosts, upsertPostToDb }) {
  const chatId = message.chat.id;
  const caption = (message.caption || '').trim();

  let mediaItem = null;
  if (message.video) {
    mediaItem = {
      fileId: message.video.file_id,
      fileName: `telegram_${Date.now()}.mp4`,
      mimeType: message.video.mime_type || 'video/mp4'
    };
  } else if (message.photo) {
    const largestPhoto = message.photo[message.photo.length - 1];
    mediaItem = {
      fileId: largestPhoto.file_id,
      fileName: `telegram_${Date.now()}.jpg`,
      mimeType: 'image/jpeg'
    };
  }

  if (!mediaItem) return;

  // Case A: Single media WITH caption -> create new post immediately
  if (caption) {
    await processCompleteMediaGroup({
      chatId,
      caption,
      items: [mediaItem]
    }, token, settings, { getPosts, savePosts, upsertPostToDb });
    return;
  }

  // Case B: Media WITHOUT caption -> attach to most recent pending post
  try {
    await sendTelegramMessage(token, chatId, '⏳ <i>Đang tải tệp media lên Supabase...</i>');
    const uploaded = await downloadAndUploadTelegramFile(token, mediaItem.fileId, mediaItem.fileName, mediaItem.mimeType);

    const posts = await getPosts();
    // Find post with pending_media, or most recently created queued post in last 2 hours
    const targetPost = posts.find(p => p.status === 'pending_media') ||
      posts.find(p => p.status === 'queued' && (Date.now() - new Date(p.createdAt).getTime() < 2 * 3600 * 1000));

    if (targetPost) {
      if (!Array.isArray(targetPost.mediaFiles)) targetPost.mediaFiles = [];
      targetPost.mediaFiles.push(uploaded);
      if (targetPost.status === 'pending_media') {
        targetPost.status = 'queued';
      }
      await savePosts(posts);
      await upsertPostToDb(targetPost);

      const total = targetPost.mediaFiles.length;
      await sendTelegramMessage(token, chatId, `
✅ <b>Đã bổ sung media vào Mã #${targetPost.machineCode}!</b>
📁 Tổng cộng hiện có: <b>${total} ảnh/video</b>.
Trạng thái: <b>⏳ Sẵn sàng xuất bản</b>.
      `.trim(), {
        reply_markup: {
          inline_keyboard: [
            [{ text: `⚡ Đăng ngay #${targetPost.machineCode}`, callback_data: `action:publish_now:${targetPost.id}` }]
          ]
        }
      });
    } else {
      await sendTelegramMessage(token, chatId, `
📁 <b>Đã tải media lên thành công!</b>
Nhưng hiện chưa có bài viết nào đang chờ ảnh. Anh hãy gửi bài viết Zalo kèm mã máy trước hoặc gửi ảnh kèm Chú thích nhé.
      `.trim());
    }
  } catch (err) {
    await sendTelegramMessage(token, chatId, `❌ <b>Lỗi lưu media:</b> ${escapeHtml(err.message)}`);
  }
}

/**
 * Handle Raw Text Message (Zalo post text)
 */
async function handleRawTextMessage(message, token, settings, { getPosts, savePosts, upsertPostToDb }) {
  const chatId = message.chat.id;
  const rawText = message.text.trim();

  try {
    await sendTelegramMessage(token, chatId, '🤖 <i>AI đang bóc tách cấu hình bài Zalo...</i>');

    const generated = await generatePostWithGemini(rawText, settings);
    const finalContent = generated.content;

    let machineCode = '';
    const codeMatch = rawText.match(/(?:mã|ms|code|#)\s*[:.]?\s*([a-zA-Z0-9]+)/i);
    if (codeMatch) machineCode = codeMatch[1].toUpperCase();
    const finalMachineCode = machineCode || generated.machineCode || String(Date.now()).slice(-4);
    const scheduledTime = calculateNextScheduleTime(settings.scheduleTimes);

    const newPost = {
      id: `post_${Date.now()}`,
      machineCode: finalMachineCode,
      machineName: generated.machineName || `Laptop #${finalMachineCode}`,
      content: finalContent,
      price: generated.price || '',
      mediaFiles: [],
      scheduledTime: scheduledTime,
      status: 'pending_media',
      mediaReminderSent: false,
      cloudLink: null,
      createdAt: new Date().toISOString(),
      postedAt: null,
      failedAt: null,
      skippedAt: null,
      fbPostId: null,
      fbPostUrl: null,
      isSimulation: false,
      lastMessage: 'Chờ nạp ảnh từ Telegram'
    };

    const posts = await getPosts();
    posts.unshift(newPost);
    await savePosts(posts);
    await upsertPostToDb(newPost);

    const timeStr = new Date(scheduledTime).toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit'
    });

    const replyMsg = `
✅ <b>ĐÃ TẠO BÀI VIẾT TỪ ZALO!</b>
────────────────────────
🏷️ <b>Mã máy:</b> <code>#${finalMachineCode}</code>
💻 <b>Tên máy:</b> ${escapeHtml(newPost.machineName)}
⏰ <b>Giờ hẹn đăng:</b> <b>${timeStr}</b>
📸 <b>Trạng thái:</b> <i>Đang chờ ảnh/video máy thực tế</i>
────────────────────────
📝 <b>Nội dung đã tối ưu:</b>
${escapeHtml(finalContent.slice(0, 220))}...
────────────────────────
👉 <b>Anh chỉ cần gửi trực tiếp ảnh/video vào đây, Bot sẽ tự gắn vào bài này!</b>
    `.trim();

    await sendTelegramMessage(token, chatId, replyMsg, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⚡ Đăng Ngay (Không ảnh)', callback_data: `action:publish_now:${newPost.id}` },
            { text: '❌ Hủy Bài', callback_data: `action:cancel_post:${newPost.id}` }
          ]
        ]
      }
    });

  } catch (err) {
    console.error('[Telegram] Lỗi tạo bài từ text:', err);
    await sendTelegramMessage(token, chatId, `❌ <b>Lỗi tạo bài viết:</b> ${escapeHtml(err.message)}`);
  }
}

/**
 * Handle Inline Button Callbacks
 */
async function handleCallbackQuery(callbackQuery, token, settings, { getPosts, savePosts, upsertPostToDb, publishPost }) {
  const queryId = callbackQuery.id;
  const data = callbackQuery.data || '';
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const messageId = message.message_id;

  if (data === 'cmd:queue') {
    await answerCallbackQuery(token, queryId);
    await handleCommands({ chat: { id: chatId }, text: '/queue' }, token, settings, { getPosts });
    return;
  }

  if (data === 'cmd:status') {
    await answerCallbackQuery(token, queryId);
    await handleCommands({ chat: { id: chatId }, text: '/status' }, token, settings, { getPosts });
    return;
  }

  // Action: Publish Now
  if (data.startsWith('action:publish_now:')) {
    const postId = data.replace('action:publish_now:', '');
    await answerCallbackQuery(token, queryId, '⚡ Đang xuất bản lên Facebook Fanpage...');

    try {
      const posts = await getPosts();
      const post = posts.find(p => p.id === postId);
      if (!post) {
        await editTelegramMessageText(token, chatId, messageId, '❌ <i>Không tìm thấy bài viết này trong hệ thống.</i>');
        return;
      }

      await editTelegramMessageText(token, chatId, messageId, `⏳ <i>Đang tiến hành đẩy bài #${post.machineCode} lên Fanpage...</i>`);
      const published = await publishPost(post);

      if (published.status === 'posted') {
        const postLink = published.fbPostUrl || `https://facebook.com/${settings.fanpageId}`;
        await editTelegramMessageText(token, chatId, messageId, `
🎉 <b>ĐÃ ĐĂNG BÀI LÊN FANPAGE THÀNH CÔNG!</b>
────────────────────────
🏷️ <b>Mã máy:</b> #${published.machineCode}
🔗 <b>Link bài viết:</b> <a href="${postLink}">${postLink}</a>
⏰ <b>Thời gian:</b> ${new Date().toLocaleTimeString('vi-VN')}
        `.trim(), { disable_web_page_preview: false });
      } else {
        await editTelegramMessageText(token, chatId, messageId, `
❌ <b>Đăng Facebook thất bại:</b>
${escapeHtml(published.errorMessage || 'Lỗi không xác định')}
        `.trim());
      }
    } catch (err) {
      await editTelegramMessageText(token, chatId, messageId, `❌ <b>Lỗi:</b> ${escapeHtml(err.message)}`);
    }
    return;
  }

  // Action: Cancel Post
  if (data.startsWith('action:cancel_post:')) {
    const postId = data.replace('action:cancel_post:', '');
    await answerCallbackQuery(token, queryId, 'Đã hủy bài viết.');

    const posts = await getPosts();
    const updated = posts.filter(p => p.id !== postId);
    await savePosts(updated);

    await editTelegramMessageText(token, chatId, messageId, '🗑️ <i>Bài viết đã được xóa khỏi hàng đợi.</i>');
  }
}

/**
 * Send Media Reminder via Telegram (T - 20 minutes)
 */
async function sendMediaReminderTelegram(post, quickUploadUrl, settings) {
  const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = settings.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const scheduledDate = new Date(post.scheduledTime);
  const timeStr = scheduledDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  const msg = `
🔔 <b>[NHẮC NẠP ẢNH / VIDEO]</b>
────────────────────────
Mã máy: <b>#${post.machineCode}</b> (${escapeHtml(post.machineName || 'Laptop')})
⏰ Sắp lên sóng lúc: <b>${timeStr}</b> (còn ~20 phút)

👉 <b>Anh Vương Gia ơi, hãy gửi trực tiếp ảnh hoặc video máy này vào đây nhé!</b>
Hoặc bấm vào link nếu muốn nạp qua web:
🔗 <a href="${quickUploadUrl}">Trang nạp nhanh Mobile</a>
────────────────────────
  `.trim();

  await sendTelegramMessage(token, chatId, msg, {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '🌐 Mở trang Nạp Nhanh', url: quickUploadUrl },
          { text: '⚡ Đăng ngay không ảnh', callback_data: `action:publish_now:${post.id}` }
        ]
      ]
    }
  });
}

/**
 * Send Post Published Notification via Telegram
 */
async function sendPostPublishedTelegram(post, settings) {
  const token = settings.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN;
  const chatId = settings.telegramChatId || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  const postUrl = post.fbPostUrl || `https://www.facebook.com/${settings.fanpageId}`;
  const mCount = post.mediaFiles?.length || 0;

  const msg = `
🎉 <b>[BÀI VIẾT ĐÃ LÊN SÓNG FACEBOOK]</b>
────────────────────────
🏷️ <b>Mã máy:</b> #${post.machineCode}
💻 <b>Tên máy:</b> ${escapeHtml(post.machineName || 'Laptop')}
📁 <b>Media:</b> ${mCount} ảnh/video
⏰ <b>Thời gian:</b> ${new Date().toLocaleTimeString('vi-VN')}
🔗 <b>Link bài viết:</b> <a href="${postUrl}">${postUrl}</a>
────────────────────────
  `.trim();

  await sendTelegramMessage(token, chatId, msg);
}

module.exports = {
  sendTelegramMessage,
  setTelegramWebhook,
  getTelegramWebhookInfo,
  handleTelegramUpdate,
  sendMediaReminderTelegram,
  sendPostPublishedTelegram
};
