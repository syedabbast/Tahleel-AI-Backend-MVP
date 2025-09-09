// Supabase backend integration Test for TAHLEEL.ai (Node.js)
// Synchronous upsert for users, video_uploads, analyses

const { createClient } = require('@supabase/supabase-js');

// Load from environment
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Service role key is required for backend writes
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase URL or service role key missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { headers: { 'X-Client-Info': 'tahleel-ai-backend-mvp/1.0.0' } }
});

// Upsert user (used for registration/login)
async function upsertUser({ id, email, first_name, last_name, team, user_type = 'Professional Coach', profile_data = {}, is_active = true }) {
  try {
    const { data, error } = await supabase
      .from('users')
      .upsert([{
        id,
        email,
        first_name,
        last_name,
        user_type,
        is_active,
        profile_data: profile_data,
        updated_at: new Date().toISOString()
      }], { onConflict: ['email'] });
    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('❌ Supabase upsertUser failed:', err);
    throw err;
  }
}

// Upsert video upload (after upload/verify)
async function upsertVideoUpload({ id, organization_id, uploaded_by, file_name, file_type, file_size_bytes, storage_url, media_duration_seconds, opponent_team, match_date, processing_status, metadata = {} }) {
  try {
    const { data, error } = await supabase
      .from('video_uploads')
      .upsert([{
        id,
        organization_id,
        uploaded_by,
        file_name,
        file_type,
        file_size_bytes,
        storage_url,
        media_duration_seconds,
        opponent_team,
        match_date,
        processing_status,
        metadata,
        updated_at: new Date().toISOString()
      }], { onConflict: ['id'] });
    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('❌ Supabase upsertVideoUpload failed:', err);
    throw err;
  }
}

// Upsert analysis result
async function upsertAnalysis({ id, organization_id, created_by, opponent_team, analysis_type = 'tactical', analysis_data, weaknesses, strategies, formation_recommendation, key_players, recent_news, confidence_score, ai_enhanced, data_source, processing_time_seconds, is_favorite = false, shared_with_squad = false }) {
  try {
    const { data, error } = await supabase
      .from('analyses')
      .upsert([{
        id,
        organization_id,
        created_by,
        opponent_team,
        analysis_type,
        analysis_data,
        weaknesses,
        strategies,
        formation_recommendation,
        key_players,
        recent_news,
        confidence_score,
        ai_enhanced,
        data_source,
        processing_time_seconds,
        is_favorite,
        shared_with_squad,
        updated_at: new Date().toISOString()
      }], { onConflict: ['id'] });
    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('❌ Supabase upsertAnalysis failed:', err);
    throw err;
  }
}

module.exports = {
  upsertUser,
  upsertVideoUpload,
  upsertAnalysis,
  supabase
};
