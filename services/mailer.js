const nodemailer = require('nodemailer');

/**
 * Create Nodemailer transporter based on user settings or env
 */
function createTransporter(settings) {
  const user = settings.smtpUser || process.env.SMTP_USER || settings.email;
  const pass = settings.smtpPass || process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: user.trim(),
      pass: pass.trim().replace(/\s+/g, '') // remove spaces from Gmail app passwords
    }
  });
}

/**
 * Generate high-end HTML email template (Warm Neo-Brutalist Craft)
 */
function generateEmailHtml(post, settings) {
  const postUrl = post.fbPostUrl || `https://www.facebook.com/${settings.fanpageId}`;
  const publishTime = new Date(post.postedAt || new Date()).toLocaleString('vi-VN', {
    hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #FDFBF7; margin: 0; padding: 24px; color: #18181B; }
    .container { max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 2px solid #18181B; border-radius: 12px; box-shadow: 4px 4px 0px #18181B; overflow: hidden; }
    .header { background: #FDE047; border-bottom: 2px solid #18181B; padding: 20px 24px; text-align: left; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 900; letter-spacing: -0.5px; color: #18181B; }
    .header p { margin: 4px 0 0; font-size: 13px; font-weight: 600; color: #52525B; }
    .badge { display: inline-block; background: #DCFCE7; color: #166534; border: 1.5px solid #18181B; padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 12px; box-shadow: 1.5px 1.5px 0px #18181B; margin-bottom: 16px; }
    .body-content { padding: 24px; }
    .info-card { background: #FAF5EE; border: 1.5px solid #18181B; border-radius: 8px; padding: 16px; margin: 16px 0; box-shadow: 2px 2px 0px #18181B; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .info-label { font-weight: bold; color: #71717A; }
    .info-value { font-weight: 800; color: #18181B; }
    .post-snippet { background: #FFFFFF; border: 1.5px solid #E4E4E7; border-radius: 6px; padding: 12px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: #27272A; max-height: 160px; overflow: hidden; }
    .cta-btn { display: block; background: #2563EB; color: #FFFFFF !important; text-decoration: none; text-align: center; font-weight: 800; font-size: 15px; padding: 14px 20px; border-radius: 8px; border: 2px solid #18181B; box-shadow: 3px 3px 0px #18181B; margin: 24px 0 16px; }
    .footer { border-top: 2px solid #18181B; background: #FAFAFA; padding: 16px 24px; text-align: center; font-size: 12px; color: #71717A; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>LAPTOP VƯƠNG GIA // AUTOPOST</h1>
      <p>Thông báo xuất bản bài viết tự động lên Fanpage Facebook</p>
    </div>

    <div class="body-content">
      <div class="badge">✅ ĐÃ ĐĂNG THÀNH CÔNG</div>
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 800; color: #18181B;">
        Bài viết mã #${post.machineCode || 'MÁY'} đã lên sóng Facebook!
      </h2>

      <div class="info-card">
        <div class="info-row">
          <span class="info-label">Mã máy:</span>
          <span class="info-value">#${post.machineCode || 'N/A'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Giá niêm yết:</span>
          <span class="info-value" style="color: #B45309;">${post.price || 'Liên hệ'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Thời gian đăng:</span>
          <span class="info-value">${publishTime}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tài nguyên media:</span>
          <span class="info-value">${post.mediaFiles?.length || 0} tệp (Ảnh / Video)</span>
        </div>
        <div class="info-row" style="margin-bottom: 0;">
          <span class="info-label">Trang Fanpage:</span>
          <span class="info-value">${settings.fanpageName || 'Laptop Vương Gia'}</span>
        </div>
      </div>

      <p style="font-size: 13px; font-weight: bold; margin: 16px 0 6px; color: #52525B;">Trích đoạn bài viết:</p>
      <div class="post-snippet">${(post.content || '').slice(0, 320)}...</div>

      <a href="${postUrl}" class="cta-btn" target="_blank">
        👉 XEM BÀI VIẾT TRÊN FACEBOOK NGAY ➔
      </a>
    </div>

    <div class="footer">
      <div>DESIGN BY VUONGGIA /// HOTLINE / ZALO: 0876637806</div>
      <div style="margin-top: 4px; font-size: 11px;">Email nhận thông báo: ${settings.notificationEmail || settings.email}</div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Send email notification when a post is successfully published
 */
async function sendPostNotification(post, settings) {
  if (settings.emailNotificationEnabled === false) {
    console.log('[Mailer] 🔕 Thông báo email đang tắt theo cài đặt.');
    return { success: false, reason: 'disabled' };
  }

  const recipient = settings.notificationEmail || settings.email || 'nguyennhu19022008@gmail.com';
  const transporter = createTransporter(settings);

  if (!transporter) {
    console.log(`[Mailer - Simulation] 📧 Chuẩn bị thông báo gửi tới: ${recipient} (Chưa cấu hình Mật khẩu ứng dụng Gmail - smtpPass).`);
    return {
      success: true,
      isSimulation: true,
      message: `Đã mô phỏng thông báo tới ${recipient}. Thêm Mật khẩu ứng dụng Gmail trong Cài Đặt để nhận mail thật.`
    };
  }

  try {
    const sender = settings.smtpUser || settings.email || 'nguyennhu19022008@gmail.com';
    const mailOptions = {
      from: `"Laptop Vương Gia AutoPost" <${sender}>`,
      to: recipient,
      subject: `🔔 [Đã đăng bài] Mã #${post.machineCode || 'MÁY'} vừa xuất bản lên Fanpage!`,
      html: generateEmailHtml(post, settings)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] ✅ Đã gửi email thông báo thành công tới ${recipient} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer Error] Gửi email thất bại:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Send test email
 */
async function sendTestEmail(settings) {
  const recipient = settings.notificationEmail || settings.email || 'nguyennhu19022008@gmail.com';
  const transporter = createTransporter(settings);

  if (!transporter) {
    throw new Error('Vui lòng nhập Email và Mật khẩu ứng dụng Gmail (App Password 16 ký tự) trước khi gửi thử.');
  }

  const sender = settings.smtpUser || settings.email || 'nguyennhu19022008@gmail.com';
  const mailOptions = {
    from: `"Laptop Vương Gia AutoPost" <${sender}>`,
    to: recipient,
    subject: `🧪 [Kiểm thử kết nối Email] Hệ thống AutoPost Laptop Vương Gia`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px; border: 2px solid #18181B; border-radius: 8px; background: #FDFBF7;">
        <h2 style="color: #16A34A; margin-top: 0;">🎉 Kết nối Email thành công!</h2>
        <p>Hệ thống thông báo tự động của <strong>Laptop Vương Gia</strong> đã kết nối chính xác với hòm thư của bạn.</p>
        <p>Từ giờ, mỗi khi có bài viết được tự động đăng lên Fanpage theo lịch hẹn, bạn sẽ nhận được một email báo cáo chi tiết kèm link bài viết Facebook.</p>
        <hr style="border: none; border-top: 1px solid #18181B; margin: 16px 0;">
        <div style="font-size: 12px; color: #71717A;">DESIGN BY VUONGGIA /// Hotline: 0876637806</div>
      </div>
    `
  };

  const info = await transporter.sendMail(mailOptions);
  return { success: true, messageId: info.messageId };
}

module.exports = {
  sendPostNotification,
  sendTestEmail
};
