require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { upsertPostToDb } = require('../services/supabase');

const postsPath = path.join(__dirname, '../data/posts.json');
const posts = JSON.parse(fs.readFileSync(postsPath, 'utf8'));

// Common verified media definitions
const MEDIA_HP_630_G9 = [
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894205828-460585548.jpg',
    size: 106074,
    storage: 'supabase',
    filename: '1793894205828-460585548.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_630_g9_front.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894206023-647079728.jpg',
    size: 61493,
    storage: 'supabase',
    filename: '1793894206023-647079728.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_630_g9_keyboard.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894206207-956020253.jpg',
    size: 60697,
    storage: 'supabase',
    filename: '1793894206207-956020253.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_630_g9_side.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894206383-838322703.jpg',
    size: 64583,
    storage: 'supabase',
    filename: '1793894206383-838322703.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_630_g9_overview.jpg'
  }
];

const MEDIA_HP_630_G10 = [
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894200885-412765707.jpg',
    size: 169988,
    storage: 'supabase',
    filename: '1793894200885-412765707.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_630_g10_front.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894201325-345828914.jpg',
    size: 99319,
    storage: 'supabase',
    filename: '1793894201325-345828914.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_630_g10_keyboard.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894201518-126048980.jpg',
    size: 113963,
    storage: 'supabase',
    filename: '1793894201518-126048980.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_630_g10_side.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894205828-460585548.jpg',
    size: 106074,
    storage: 'supabase',
    filename: '1793894205828-460585548.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_630_g10_overview.jpg'
  }
];

const MEDIA_HP_PROBOOK = [
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793879874885-241298331.jpg',
    size: 128586,
    storage: 'supabase',
    filename: '1793879874885-241298331.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_probook_front.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793879876309-686407318.jpg',
    size: 100865,
    storage: 'supabase',
    filename: '1793879876309-686407318.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_probook_keyboard.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793879876936-58142258.jpg',
    size: 81208,
    storage: 'supabase',
    filename: '1793879876936-58142258.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_probook_side.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793879878078-330176826.jpg',
    size: 74079,
    storage: 'supabase',
    filename: '1793879878078-330176826.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_probook_ports.jpg'
  }
];

const MEDIA_DELL_LATITUDE = [
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793880660069-501070229.jpg',
    size: 153510,
    storage: 'supabase',
    filename: '1793880660069-501070229.jpg',
    mimetype: 'image/jpeg',
    originalname: 'dell_lat_front.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793880660931-902780702.jpg',
    size: 126192,
    storage: 'supabase',
    filename: '1793880660931-902780702.jpg',
    mimetype: 'image/jpeg',
    originalname: 'dell_lat_keyboard.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793880661635-696976523.jpg',
    size: 89473,
    storage: 'supabase',
    filename: '1793880661635-696976523.jpg',
    mimetype: 'image/jpeg',
    originalname: 'dell_lat_side.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793880662760-738318432.jpg',
    size: 96470,
    storage: 'supabase',
    filename: '1793880662760-738318432.jpg',
    mimetype: 'image/jpeg',
    originalname: 'dell_lat_overview.jpg'
  }
];

const MEDIA_THINKPAD = [
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894167783-615881886.jpg',
    size: 135743,
    storage: 'supabase',
    filename: '1793894167783-615881886.jpg',
    mimetype: 'image/jpeg',
    originalname: 'thinkpad_front.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894168046-858979558.jpg',
    size: 78671,
    storage: 'supabase',
    filename: '1793894168046-858979558.jpg',
    mimetype: 'image/jpeg',
    originalname: 'thinkpad_keyboard.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894168258-811196868.jpg',
    size: 103011,
    storage: 'supabase',
    filename: '1793894168258-811196868.jpg',
    mimetype: 'image/jpeg',
    originalname: 'thinkpad_side.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894168557-216547744.jpg',
    size: 91644,
    storage: 'supabase',
    filename: '1793894168557-216547744.jpg',
    mimetype: 'image/jpeg',
    originalname: 'thinkpad_overview.jpg'
  }
];

const MEDIA_HP_ENVY = [
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793096590975-411484908.jpg',
    size: 137337,
    storage: 'supabase',
    filename: '1793096590975-411484908.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_envy_13_front.jpg'
  },
  {
    url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793096591867-523181260.jpg',
    size: 136018,
    storage: 'supabase',
    filename: '1793096591867-523181260.jpg',
    mimetype: 'image/jpeg',
    originalname: 'hp_envy_13_keyboard.jpg'
  }
];

// Configuration for replenishing each of the 12 target machines
const REPLENISH_CONFIG = {
  '116C': {
    modelName: 'HP ELITEBOOK 630 G9',
    brand: 'HP',
    strategy: 'replace_all',
    media: MEDIA_HP_630_G9
  },
  '945': {
    modelName: 'HP ELITEBOOK 630 G10',
    brand: 'HP',
    strategy: 'replace_all',
    media: MEDIA_HP_630_G10
  },
  '934': {
    modelName: 'HP ELITEBOOK 630 G9',
    brand: 'HP',
    strategy: 'replace_all',
    media: MEDIA_HP_630_G9
  },
  '064A': {
    modelName: 'HP ProBook 450 G10',
    brand: 'HP',
    strategy: 'replace_all',
    media: MEDIA_HP_PROBOOK
  },
  '078A': {
    modelName: 'HP ELITEBOOK 630 G10',
    brand: 'HP',
    strategy: 'replace_all',
    media: MEDIA_HP_630_G10
  },
  '072B': {
    modelName: 'HP ELITEBOOK 630 G9',
    brand: 'HP',
    strategy: 'replace_all',
    media: MEDIA_HP_630_G9
  },
  '090': {
    modelName: 'Dell Latitude 5330',
    brand: 'Dell',
    strategy: 'replace_all',
    media: MEDIA_DELL_LATITUDE
  },
  '066': {
    modelName: 'ThinkPad X13 Yoga Gen 2',
    brand: 'Lenovo ThinkPad',
    strategy: 'replace_all',
    media: MEDIA_THINKPAD
  },
  '990': {
    modelName: 'HP ELITEBOOK 630 G9',
    brand: 'HP',
    strategy: 'supplement',
    media: [
      MEDIA_HP_630_G9[1],
      MEDIA_HP_630_G9[2],
      MEDIA_HP_630_G9[3]
    ]
  },
  '065': {
    modelName: 'Dell Latitude 5310',
    brand: 'Dell',
    strategy: 'supplement',
    media: [
      MEDIA_DELL_LATITUDE[1],
      MEDIA_DELL_LATITUDE[2],
      MEDIA_DELL_LATITUDE[3]
    ]
  },
  '088': {
    modelName: 'Toshiba Dynabook R63',
    brand: 'Toshiba Dynabook',
    strategy: 'supplement',
    media: [
      {
        url: 'https://egjxezhoohzgpbyukfwr.supabase.co/storage/v1/object/public/laptop-media/1793894166485-881715868.jpg',
        size: 90061,
        storage: 'supabase',
        filename: '1793894166485-881715868.jpg',
        mimetype: 'image/jpeg',
        originalname: 'dynabook_r63_side.jpg'
      }
    ]
  },
  '742': {
    modelName: 'HP Envy x360 13.3',
    brand: 'HP',
    strategy: 'supplement',
    media: MEDIA_HP_ENVY
  }
};

async function replenish() {
  console.log('======================================================================');
  console.log('🚀 BẮT ĐẦU CẬP NHẬT ẢNH THẬT & PHỤC HỒI HÀNG ĐỢI CHO CÁC MÃ MÁY');
  console.log('======================================================================\n');

  const updatedPosts = [];

  for (const post of posts) {
    const code = post.machineCode || post.code;
    if (!code || !REPLENISH_CONFIG[code]) continue;

    const conf = REPLENISH_CONFIG[code];
    const prevMediaCount = (post.mediaFiles || []).length;
    const prevStatus = post.status;

    // 1. Update Media
    if (conf.strategy === 'replace_all') {
      post.mediaFiles = [...conf.media];
    } else if (conf.strategy === 'supplement') {
      const existingUrls = new Set((post.mediaFiles || []).map(m => m.url));
      for (const m of conf.media) {
        if (!existingUrls.has(m.url)) {
          post.mediaFiles.push(m);
        }
      }
    }

    // 2. Update Machine Name
    post.machineName = conf.modelName;
    if (conf.brand) post.brand = conf.brand;

    // 3. Update Content header if generic
    if (post.content) {
      // Replace "[SIÊU PHẨM GIÁ TỐT] - MÃ #xyz: LAPTOP #xyz" with proper model name
      post.content = post.content.replace(
        new RegExp(`(MÃ\\s*#${code}:\\s*)LAPTOP\\s*#${code}`, 'i'),
        `$1${conf.modelName.toUpperCase()}`
      );
      post.content = post.content.replace(
        new RegExp(`(MÃ\\s*#${code}:\\s*)[^–\n]+(–\\s*CHUẨN NỘI ĐỊA)`, 'i'),
        `$1${conf.modelName.toUpperCase()} $2`
      );
    }

    // 4. Restore Status to 'queued' if pending_media
    if (post.status === 'pending_media') {
      post.status = 'queued';
    }

    // 5. Update Timestamps & Notes
    post.updatedAt = new Date().toISOString();
    post.updated_at = post.updatedAt;
    post.notes = `Đã cập nhật ${post.mediaFiles.length} ảnh laptop thật HD chuẩn nội địa Nhật Bản.`;

    updatedPosts.push(post);

    console.log(`✅ Mã #${code} [${conf.modelName}]:`);
    console.log(`   - Trạng thái: ${prevStatus} ➔ ${post.status}`);
    console.log(`   - Số lượng ảnh: ${prevMediaCount} ➔ ${post.mediaFiles.length} ảnh HD`);
    console.log(`   - Lịch đăng: ${post.scheduledTime || 'N/A'}`);
    console.log(`   - Ảnh đầu tiên: ${post.mediaFiles[0].url}`);
    console.log('----------------------------------------------------------------------');
  }

  // Save back to posts.json
  fs.writeFileSync(postsPath, JSON.stringify(posts, null, 2), 'utf8');
  console.log(`\n💾 Đã lưu thành công ${updatedPosts.length} bài vào data/posts.json`);

  // Sync to Supabase Database
  console.log('\n☁️ Đang đồng bộ cập nhật lên Supabase Database (bảng posts)...');
  let syncSuccess = 0;
  for (const post of updatedPosts) {
    try {
      await upsertPostToDb(post);
      syncSuccess++;
      console.log(`  ✓ Synced #${post.machineCode || post.code} (ID: ${post.id}) to Supabase`);
    } catch (err) {
      console.error(`  ✗ Error syncing #${post.machineCode || post.code}:`, err.message);
    }
  }

  console.log(`\n🎉 HOÀN THÀNH: Đã đồng bộ ${syncSuccess}/${updatedPosts.length} bài lên Supabase!`);
}

replenish().catch(err => {
  console.error('Lỗi thực thi:', err);
  process.exit(1);
});
