require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase, upsertPostToDb, deleteFromSupabaseStorage } = require('../services/supabase');

const bannedList = [
  '064A_40_1793894195146-590284417.jpg',
  '064A_41_1793894195358-724376086.jpg',
  '064A_42_1793894195609-598779883.jpg',
  '064A_43_1793894195867-953736523.jpg',
  '065_85_1793894184140-999179617.jpg',
  '066_159_1793894163460-696710502.jpg',
  '068_72_1793894186548-157643045.jpg',
  '072B_76_1793894185479-385549849.jpg',
  '072B_77_1793894185761-167256595.jpg',
  '072B_78_1793894185996-836861565.jpg',
  '072B_79_1793894186223-292385782.jpg',
  '078A_44_1793894193667-803756828.jpg',
  '078A_45_1793894193818-669620337.jpg',
  '078A_46_1793894194520-168179667.jpg',
  '078A_47_1793894194819-160486181.jpg',
  '082_118_1793894174586-132270159.jpg',
  '088_150_1793894164940-439200208.jpg',
  '088_152_1793894165365-496146682.jpg',
  '090_158_1793894163730-965907557.jpg',
  '096_147_1793894166106-374465569.jpg',
  '097_143_1793894167020-963723676.jpg',
  '100_131_1793894170835-476867529.jpg',
  '101_128_1793894172662-191903242.jpg',
  '102_122_1793894173591-720037895.jpg',
  '109_90_1793894181663-269925638.jpg',
  '110_86_1793894182574-277625932.jpg',
  '113B_21_1793894201120-13326140.jpg',
  '114B_17_1793894202013-408863499.jpg',
  '115B_12_1793894202710-457015811.jpg',
  '116C_10_1793894204357-922800112.jpg',
  '116C_11_1793894204529-408912870.jpg',
  '116C_8_1793894203924-793013360.jpg',
  '116C_9_1793894204191-257097163.jpg',
  '117_5_1793894205034-675299802.jpg',
  '1_68_1793894187487-968827341.jpg',
  '2_64_1793894188540-658664853.jpg',
  '5_36_1793894196342-837545601.jpg',
  '742_154_1793894164071-643791065.jpg',
  '742_156_1793894164436-660184733.jpg',
  '934_28_1793894198578-552351819.jpg',
  '934_29_1793894198747-862531289.jpg',
  '934_30_1793894198924-303555740.jpg',
  '934_31_1793894199189-522058377.jpg',
  '945_24_1793894199614-969600700.jpg',
  '945_25_1793894199892-312542102.jpg',
  '945_26_1793894200074-443100911.jpg',
  '945_27_1793894200301-681821294.jpg',
  '990_81_1793894184736-819659650.jpg',
  '990_82_1793894184916-641343015.jpg',
  '990_83_1793894185155-289094836.jpg'
];

const bannedKeys = bannedList.map(fn => {
  const parts = fn.split('_');
  return parts.slice(2).join('_');
});

async function purgeBannedMedia() {
  console.log('🚀 Bắt đầu quá trình thanh lọc 50 ảnh cấm trong Hàng Đợi...');
  const postsPath = path.join(__dirname, '..', 'data', 'posts.json');
  const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

  let cleanedPostsCount = 0;
  let switchedToPendingMedia = 0;
  const updatedPosts = [];

  for (const post of posts) {
    if (!post.mediaFiles || post.mediaFiles.length === 0) continue;
    const initialCount = post.mediaFiles.length;

    const filteredMedia = post.mediaFiles.filter(m => {
      const url = typeof m === 'string' ? m : (m.url || '');
      return !bannedKeys.some(k => url.includes(k));
    });

    if (filteredMedia.length !== initialCount) {
      post.mediaFiles = filteredMedia;
      cleanedPostsCount++;

      if (filteredMedia.length === 0) {
        post.status = 'pending_media';
        post.notes = (post.notes ? post.notes + ' | ' : '') + 'Đã lọc bỏ ảnh đại diện Zalo / bảng Excel. Chờ nạp ảnh máy thật.';
        switchedToPendingMedia++;
        console.log(`⚠️ Bài #${post.code || post.machineCode} (ID: ${post.id}): 0 ảnh còn lại -> Chuyển sang "pending_media"`);
      } else {
        console.log(`✅ Bài #${post.code || post.machineCode} (ID: ${post.id}): Đã lọc bỏ ${initialCount - filteredMedia.length} ảnh cấm -> Còn lại ${filteredMedia.length} ảnh laptop chuẩn`);
      }

      updatedPosts.push(post);
    }
  }

  // Save to posts.json
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2), 'utf8');
  console.log(`💾 Đã lưu thay đổi vào data/posts.json. Tổng bài được làm sạch: ${cleanedPostsCount}`);

  // Sync with Supabase DB
  if (supabase) {
    console.log(`🌐 Đang đồng bộ ${updatedPosts.length} bài viết đã làm sạch lên Supabase Database...`);
    for (const post of updatedPosts) {
      try {
        await upsertPostToDb(post);
      } catch (err) {
        console.error(`Lỗi cập nhật post ${post.id} lên Supabase:`, err.message);
      }
    }
    console.log(`✨ Đã đồng bộ thành công toàn bộ bài viết lên Supabase Database!`);

    // Delete banned files from Supabase Storage bucket laptop-media
    console.log(`🗑️ Đang dọn dẹp các tệp ảnh cấm trên Supabase Storage bucket 'laptop-media'...`);
    try {
      const filesToDelete = bannedKeys.map(k => k);
      const { data, error } = await supabase.storage.from('laptop-media').remove(filesToDelete);
      if (error) {
        console.warn('Lỗi khi xóa khỏi Supabase Storage (bỏ qua nếu không có quyền):', error.message);
      } else {
        console.log(`🗑️ Đã xóa thành công các tệp ảnh cấm khỏi Supabase Storage.`);
      }
    } catch (errStorage) {
      console.warn('Cảnh báo xóa storage:', errStorage.message);
    }
  }

  console.log('\n================ TỔNG KẾT THANH LỌC ================');
  console.log(`- Tổng bài viết rà soát: ${posts.length}`);
  console.log(`- Số bài viết chứa ảnh cấm đã được thanh lọc: ${cleanedPostsCount}`);
  console.log(`- Số bài có ảnh chuẩn còn lại (1-3 ảnh laptop xịn): ${cleanedPostsCount - switchedToPendingMedia}`);
  console.log(`- Số bài chuyển trạng thái "pending_media" (để không đăng ảnh rác): ${switchedToPendingMedia}`);
  console.log(`- Số ảnh cấm bị tiêu hủy: ${bannedKeys.length}`);
}

purgeBannedMedia().catch(console.error);
