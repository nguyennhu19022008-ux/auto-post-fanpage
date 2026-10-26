process.env.TZ = 'Asia/Ho_Chi_Minh';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Thiếu SUPABASE_URL hoặc SUPABASE_KEY trong file .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

const TARGET_CODES = [
  '636', '742', '781', '784', '795',
  '802', '811', '831', '842', '869',
  '881', '887', '904'
];

// 13 slots starting tomorrow (2026-10-27) in Vietnam Time (+07:00)
const SLOTS_VN = [
  '2026-10-27T08:30:00+07:00',
  '2026-10-27T11:45:00+07:00',
  '2026-10-27T15:30:00+07:00',
  '2026-10-27T20:00:00+07:00',
  '2026-10-28T08:30:00+07:00',
  '2026-10-28T11:45:00+07:00',
  '2026-10-28T15:30:00+07:00',
  '2026-10-28T20:00:00+07:00',
  '2026-10-29T08:30:00+07:00',
  '2026-10-29T11:45:00+07:00',
  '2026-10-29T15:30:00+07:00',
  '2026-10-29T20:00:00+07:00',
  '2026-10-30T08:30:00+07:00'
];

async function cleanupDuplicates() {
  console.log('🔄 Đang kết nối Supabase và quét danh sách bài viết...');
  const { data: allPosts, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Lỗi truy vấn Supabase:', error.message);
    process.exit(1);
  }

  console.log(`📊 Tổng số bài viết hiện tại trong Supabase: ${allPosts.length}`);

  const postsToDelete = [];
  const keptPostsByCode = {};

  // 1. Process 13 warehouse machines
  for (const code of TARGET_CODES) {
    const matchingPosts = allPosts.filter(p => p.machine_code === code);
    if (matchingPosts.length > 0) {
      // Sort newest first
      matchingPosts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const keep = matchingPosts[0];
      keptPostsByCode[code] = keep;

      // Rest are duplicates to delete
      for (let i = 1; i < matchingPosts.length; i++) {
        postsToDelete.push(matchingPosts[i]);
      }
    }
  }

  // 2. Also check machine '047' test duplicate (keep posted version, delete pending duplicate)
  const matching047 = allPosts.filter(p => p.machine_code === '047');
  if (matching047.length > 1) {
    const unposted047 = matching047.filter(p => p.status !== 'posted');
    postsToDelete.push(...unposted047);
  }

  console.log(`🗑️ Phát hiện ${postsToDelete.length} bản ghi trùng lặp cần xóa.`);

  // Execute deletion
  let deletedCount = 0;
  for (const p of postsToDelete) {
    const { error: delErr } = await supabase.from('posts').delete().eq('id', p.id);
    if (delErr) {
      console.error(`  ❌ Lỗi xóa bài ${p.id} (#${p.machine_code}):`, delErr.message);
    } else {
      deletedCount++;
      console.log(`  ✅ Đã xóa bản ghi trùng: [${p.id}] (#${p.machine_code}) tạo lúc ${p.created_at}`);
    }
  }

  console.log(`\n📅 Đang dời lịch hẹn (scheduled_time) cho 13 máy sang các khung giờ từ ngày mai (27/10)...`);

  // Update schedule times for the 13 kept warehouse posts
  let updatedScheduleCount = 0;
  for (let i = 0; i < TARGET_CODES.length; i++) {
    const code = TARGET_CODES[i];
    const post = keptPostsByCode[code];
    if (post && SLOTS_VN[i]) {
      const newSlotIso = new Date(SLOTS_VN[i]).toISOString();
      const { error: updErr } = await supabase
        .from('posts')
        .update({
          scheduled_time: newSlotIso,
          status: 'pending_media',
          media_reminder_sent: false
        })
        .eq('id', post.id);

      if (updErr) {
        console.error(`  ❌ Lỗi cập nhật bài #${code}:`, updErr.message);
      } else {
        updatedScheduleCount++;
        const vnDateStr = new Date(SLOTS_VN[i]).toLocaleString('vi-VN');
        console.log(`  ⏰ Đã đặt lịch mã #${code} (ID: ${post.id}) -> ${vnDateStr} (${newSlotIso})`);
      }
    }
  }

  // Final verification check
  const { data: finalPosts, error: finalErr } = await supabase
    .from('posts')
    .select('id, machine_code, machine_name, status, scheduled_time, created_at')
    .order('scheduled_time', { ascending: true });

  if (finalErr) {
    console.error('❌ Lỗi truy vấn kiểm tra cuối:', finalErr.message);
  } else {
    console.log('\n=======================================================');
    console.log(`🎉 HOÀN TẤT DỌN DẸP SUPABASE!`);
    console.log(`- Đã xóa thành công: ${deletedCount} bản ghi trùng lặp.`);
    console.log(`- Đã cập nhật khung giờ mới: ${updatedScheduleCount} bài.`);
    console.log(`- Tổng số bài còn lại trên Supabase: ${finalPosts.length} bài.`);
    console.log('=======================================================');
    console.log('📋 Danh sách bài viết hiện tại:');
    finalPosts.forEach((p, idx) => {
      const timeStr = p.scheduled_time ? new Date(p.scheduled_time).toLocaleString('vi-VN') : 'Không có';
      console.log(`  ${idx + 1}. [${p.machine_code}] ${p.machine_name} | Trạng thái: ${p.status} | Hẹn đăng: ${timeStr} | ID: ${p.id}`);
    });
  }
}

cleanupDuplicates().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
