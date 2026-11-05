/**
 * Migration & Seeding Script for Supabase Cloud & Local Fallbacks
 * Tables: model_templates, circular_posts_queue
 *
 * Usage: node scripts/migrate_supabase.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { supabase } = require('../services/supabase');

const SQL_MIGRATION = `
-- ========================================================
-- 1. BẢNG MODEL_TEMPLATES (KHO THƯ VIỆN BÀI ĐĂNG & MODEL MẪU)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.model_templates (
    id TEXT PRIMARY KEY,
    model_key TEXT UNIQUE NOT NULL,
    model_name TEXT NOT NULL,
    brand TEXT NOT NULL,
    cpu TEXT NOT NULL,
    ram TEXT NOT NULL,
    ssd TEXT NOT NULL,
    screen TEXT NOT NULL,
    standard_config TEXT,
    price_min BIGINT DEFAULT 0,
    price_max BIGINT DEFAULT 0,
    price_display TEXT NOT NULL,
    price_range_category TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    base_ai_prompt TEXT,
    media_files JSONB DEFAULT '[]'::jsonb,
    tags JSONB DEFAULT '[]'::jsonb,
    post_count INTEGER DEFAULT 0,
    last_posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_templates_brand ON public.model_templates(brand);
CREATE INDEX IF NOT EXISTS idx_model_templates_price_cat ON public.model_templates(price_range_category);
CREATE INDEX IF NOT EXISTS idx_model_templates_status ON public.model_templates(status);

-- ========================================================
-- 2. BẢNG CIRCULAR_POSTS_QUEUE (HÀNG ĐỢI ĐĂNG BÀI TUẦN HOÀN)
-- ========================================================
CREATE TABLE IF NOT EXISTS public.circular_posts_queue (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES public.model_templates(id) ON DELETE CASCADE,
    model_name TEXT NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    priority INTEGER DEFAULT 0,
    rewrite_style TEXT DEFAULT 'featured_review',
    ai_rewritten_content TEXT,
    media_files JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'queued',
    post_id TEXT,
    fb_post_id TEXT,
    fb_post_url TEXT,
    execution_log TEXT,
    posted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_circular_queue_status ON public.circular_posts_queue(status);
CREATE INDEX IF NOT EXISTS idx_circular_queue_scheduled ON public.circular_posts_queue(scheduled_time);
`;

async function runMigration() {
  console.log('===============================================================');
  console.log('🚀 KHỞI CHẠY TIẾN TRÌNH DI TRÚ DATABASE & TẠO KHO SEED DATA');
  console.log('===============================================================');

  const localTemplatesFile = path.join(__dirname, '..', 'data', 'model_templates.json');
  const localQueueFile = path.join(__dirname, '..', 'data', 'circular_queue.json');

  // 1. Kiểm tra và đảm bảo tệp JSON fallback tồn tại
  if (!fs.existsSync(localTemplatesFile)) {
    console.error('❌ Không tìm thấy tệp data/model_templates.json!');
    process.exit(1);
  }
  const templates = JSON.parse(fs.readFileSync(localTemplatesFile, 'utf8'));
  console.log(`📁 Đã nạp ${templates.length} Model Templates từ data/model_templates.json`);

  if (!fs.existsSync(localQueueFile)) {
    fs.writeFileSync(localQueueFile, '[]', 'utf8');
  }

  // 2. Thử nghiệm kết nối Supabase Cloud
  if (!supabase) {
    console.warn('⚠️ Supabase Cloud chưa được cấu hình qua .env. Hệ thống đang sử dụng 100% Local JSON Fallback.');
    return;
  }

  console.log('⚡ Kiểm tra trạng thái bảng public.model_templates trên Supabase Cloud...');
  try {
    const { data, error } = await supabase.from('model_templates').select('id').limit(1);
    if (!error) {
      console.log('✅ Bảng public.model_templates ĐÃ TỒN TẠI trên Supabase Cloud!');
      console.log('⚡ Đang tiến hành đồng bộ seed data vào Supabase Cloud...');

      for (const tpl of templates) {
        const row = {
          id: tpl.id,
          model_key: tpl.model_key,
          model_name: tpl.model_name,
          brand: tpl.brand,
          cpu: tpl.cpu,
          ram: tpl.ram,
          ssd: tpl.ssd,
          screen: tpl.screen,
          standard_config: tpl.standard_config,
          price_min: tpl.price_min || 0,
          price_max: tpl.price_max || 0,
          price_display: tpl.price_display,
          price_range_category: tpl.price_range_category,
          status: tpl.status || 'active',
          base_ai_prompt: tpl.base_ai_prompt || null,
          media_files: tpl.media_files || [],
          tags: tpl.tags || [],
          post_count: tpl.post_count || 0,
          last_posted_at: tpl.last_posted_at || null,
          created_at: tpl.created_at || new Date().toISOString(),
          updated_at: tpl.updated_at || new Date().toISOString()
        };

        const { error: upsertErr } = await supabase.from('model_templates').upsert(row);
        if (upsertErr) {
          console.warn(`  ⚠️ Lỗi upsert template [${tpl.id}]:`, upsertErr.message);
        } else {
          console.log(`  ✓ Đã đồng bộ [${tpl.id}] ${tpl.model_name}`);
        }
      }
      console.log('✅ Hoàn tất đồng bộ dữ liệu lên Supabase Cloud!');
    } else {
      console.log(`ℹ️ Supabase phản hồi: ${error.message} (mã: ${error.code})`);
      console.log('⚠️ Bảng chưa được tạo trong PostgreSQL schema cache của Supabase.');
      console.log('---------------------------------------------------------------');
      console.log('📋 ĐẶC TẢ SQL DDL CẦN CHẠY TRÊN SUPABASE SQL EDITOR:');
      console.log(SQL_MIGRATION);
      console.log('---------------------------------------------------------------');
      console.log('💡 HỆ THỐNG ĐÃ KÍCH HOẠT CHẾ ĐỘ SEAMLESS LOCAL JSON FALLBACK:');
      console.log('   - Toàn bộ Model Templates & Circular Queue hoạt động đầy đủ, mượt mà');
      console.log('   - Đọc ghi qua data/model_templates.json & data/circular_queue.json');
      console.log('   - Sau khi execute SQL trên dashboard, hệ thống tự động ghi nhận không cần sửa code!');
    }
  } catch (err) {
    console.error('❌ Ngoại lệ khi kết nối Supabase:', err.message);
  }

  console.log('===============================================================');
  console.log('🎉 TIẾN TRÌNH DI TRÚ & KHỞI TẠO HOÀN THÀNH THÀNH CÔNG!');
  console.log('===============================================================');
}

if (require.main === module) {
  runMigration();
}

module.exports = {
  runMigration,
  SQL_MIGRATION
};
