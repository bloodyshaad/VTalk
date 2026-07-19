use serde::{Deserialize, Serialize};

/// A locally-cached profile row (mirrors the Supabase `profiles` table).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedProfile {
    pub id: String,
    pub username: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub account_type: String,
    pub updated_at: String,
}

/// A locally-queued draft row (mirrors the Supabase `drafts` table).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalDraft {
    pub id: String,
    pub user_id: String,
    pub draft_type: String,
    pub content: String,
    pub media_paths: Option<String>,
    pub scheduled_at: Option<String>,
    pub updated_at: String,
}

/// A pending offline operation to flush when back online.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PendingOperation {
    pub id: String,
    pub entity: String,
    pub operation: String,
    pub payload: String,
    pub created_at: String,
}

/// A cached post row for offline feed rendering.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedPost {
    pub id: String,
    pub user_id: String,
    pub post_type: String,
    pub content: Option<String>,
    pub like_count: i64,
    pub comment_count: i64,
    pub created_at: String,
}
