const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || '';

let supabase = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  console.log('[Supabase] ⚡ Khởi tạo kết nối Supabase Cloud:', supabaseUrl);
}

const BUCKET_NAME = 'laptop-media';

/**
 * Upload a file Buffer directly to Supabase Storage
 */
async function uploadToSupabaseStorage(fileBuffer, originalFilename, mimetype) {
  if (!supabase) return null;

  try {
    const ext = path.extname(originalFilename) || '.jpg';
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uniqueName, fileBuffer, {
        contentType: mimetype || 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('[Supabase Storage Upload Error]', error.message);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(uniqueName);

    return {
      filename: uniqueName,
      originalname: originalFilename,
      mimetype: mimetype || 'image/jpeg',
      url: publicUrlData.publicUrl,
      size: fileBuffer.length,
      storage: 'supabase'
    };
  } catch (err) {
    console.error('[Supabase Storage Exception]', err.message);
    return null;
  }
}

/**
 * Delete a file from Supabase Storage
 */
async function deleteFromSupabaseStorage(filename) {
  if (!supabase || !filename) return;
  try {
    await supabase.storage.from(BUCKET_NAME).remove([filename]);
  } catch (e) {
    console.error('[Supabase Storage Delete Error]', e.message);
  }
}

/**
 * Fetch all posts from Supabase (falls back to local data/posts.json)
 */
async function fetchAllPostsFromDb() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        return data.map(row => ({
          id: row.id,
          machineCode: row.machine_code,
          machineName: row.machine_name,
          content: row.content,
          price: row.price,
          mediaFiles: row.media_files || [],
          scheduledTime: row.scheduled_time,
          status: row.status,
          mediaReminderSent: row.media_reminder_sent,
          cloudLink: row.cloud_link,
          createdAt: row.created_at,
          postedAt: row.posted_at,
          failedAt: row.failed_at,
          skippedAt: row.skipped_at,
          fbPostId: row.fb_post_id,
          fbPostUrl: row.fb_post_url,
          isSimulation: row.is_simulation,
          lastMessage: row.last_message,
          errorMessage: row.error_message
        }));
      }
    } catch (err) {
      // Supabase table might not exist yet, fallback
    }
  }

  // Fallback to local posts.json
  const localFile = path.join(__dirname, '..', 'data', 'posts.json');
  try {
    if (fs.existsSync(localFile)) {
      return JSON.parse(fs.readFileSync(localFile, 'utf8') || '[]');
    }
  } catch (e) {
    console.error('Error reading local posts:', e);
  }
  return [];
}

/**
 * Save / Upsert a single post to Supabase
 */
async function upsertPostToDb(post) {
  if (supabase) {
    try {
      const row = {
        id: post.id,
        machine_code: post.machineCode,
        machine_name: post.machineName,
        content: post.content,
        price: post.price,
        media_files: post.mediaFiles || [],
        scheduled_time: post.scheduledTime,
        status: post.status,
        media_reminder_sent: post.mediaReminderSent || false,
        cloud_link: post.cloudLink || null,
        created_at: post.createdAt || new Date().toISOString(),
        posted_at: post.postedAt || null,
        failed_at: post.failedAt || null,
        skipped_at: post.skippedAt || null,
        fb_post_id: post.fbPostId || null,
        fb_post_url: post.fbPostUrl || null,
        is_simulation: post.isSimulation || false,
        last_message: post.lastMessage || null,
        error_message: post.errorMessage || null
      };

      const { error } = await supabase.from('posts').upsert(row);
      if (error) {
        console.warn('[Supabase Upsert Post Notice]', error.message);
      }
    } catch (e) {
      // Ignore if table not created yet
    }
  }
}

/**
 * Delete a post from Supabase
 */
async function deletePostFromDb(postId) {
  if (supabase) {
    try {
      await supabase.from('posts').delete().eq('id', postId);
    } catch (e) {
      console.warn('[Supabase Delete Post Notice]', e.message);
    }
  }
}

/**
 * Fetch settings from Supabase
 */
async function fetchSettingsFromDb() {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'app_settings')
        .single();

      if (!error && data && data.data) {
        return data.data;
      }
    } catch (e) {}
  }
  return null;
}

/**
 * Save settings to Supabase
 */
async function saveSettingsToDb(settings) {
  if (supabase) {
    try {
      await supabase.from('settings').upsert({
        id: 'app_settings',
        data: settings,
        updated_at: new Date().toISOString()
      });
    } catch (e) {}
  }
}

module.exports = {
  supabase,
  uploadToSupabaseStorage,
  deleteFromSupabaseStorage,
  fetchAllPostsFromDb,
  upsertPostToDb,
  deletePostFromDb,
  fetchSettingsFromDb,
  saveSettingsToDb
};
