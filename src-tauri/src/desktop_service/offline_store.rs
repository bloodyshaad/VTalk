use crate::db::migrations;
use crate::db::models::{CachedPost, CachedProfile, LocalDraft, PendingOperation};
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Local SQLite-backed offline store. Wraps a single connection guarded by a
/// mutex. Used for draft persistence, cached profiles/posts, the upload queue,
/// and the pending-operation queue for offline-first sync.
///
/// Cheaply cloneable: clones share the same underlying connection via `Arc`.
#[derive(Clone)]
pub struct OfflineStore {
    conn: Arc<Mutex<Connection>>,
}

impl OfflineStore {
    /// Lock the connection, returning an error instead of panicking if the
    /// mutex is poisoned (e.g. another thread panicked while holding it).
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.conn.lock().map_err(|_| "offline store mutex poisoned".to_string())
    }

    /// Open (and migrate) the offline database inside the app data directory.
    pub fn open(app_data_dir: &str) -> Result<Self, String> {
        let mut path = PathBuf::from(app_data_dir);
        std::fs::create_dir_all(&path).map_err(|e| e.to_string())?;
        path.push("vtalk_offline.db");
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        migrations::run_migrations(&conn)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    // --- Profiles -----------------------------------------------------------
    pub fn upsert_profile(&self, p: &CachedProfile) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT OR REPLACE INTO cached_profiles
             (id, username, display_name, avatar_url, account_type, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                p.id,
                p.username,
                p.display_name,
                p.avatar_url,
                p.account_type,
                p.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_profile(&self, id: &str) -> Result<Option<CachedProfile>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, username, display_name, avatar_url, account_type, updated_at
                 FROM cached_profiles WHERE id = ?1",
            )
            .map_err(|e| e.to_string())?;
        let mut rows = stmt
            .query_map(params![id], |row| {
                Ok(CachedProfile {
                    id: row.get(0)?,
                    username: row.get(1)?,
                    display_name: row.get(2)?,
                    avatar_url: row.get(3)?,
                    account_type: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        match rows.next() {
            Some(Ok(p)) => Ok(Some(p)),
            Some(Err(e)) => Err(e.to_string()),
            None => Ok(None),
        }
    }

    // --- Posts --------------------------------------------------------------
    pub fn upsert_post(&self, p: &CachedPost) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT OR REPLACE INTO cached_posts
             (id, user_id, post_type, content, like_count, comment_count, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                p.id,
                p.user_id,
                p.post_type,
                p.content,
                p.like_count,
                p.comment_count,
                p.created_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn recent_posts(&self, limit: i64) -> Result<Vec<CachedPost>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, user_id, post_type, content, like_count, comment_count, created_at
                 FROM cached_posts ORDER BY created_at DESC LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(CachedPost {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    post_type: row.get(2)?,
                    content: row.get(3)?,
                    like_count: row.get(4)?,
                    comment_count: row.get(5)?,
                    created_at: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    // --- Drafts -------------------------------------------------------------
    pub fn insert_draft(&self, d: &LocalDraft) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT OR REPLACE INTO local_drafts
             (id, user_id, draft_type, content, media_paths, scheduled_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                d.id,
                d.user_id,
                d.draft_type,
                d.content,
                d.media_paths,
                d.scheduled_at,
                d.updated_at
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_drafts(&self, user_id: &str) -> Result<Vec<LocalDraft>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, user_id, draft_type, content, media_paths, scheduled_at, updated_at
                 FROM local_drafts WHERE user_id = ?1 ORDER BY updated_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![user_id], |row| {
                Ok(LocalDraft {
                    id: row.get(0)?,
                    user_id: row.get(1)?,
                    draft_type: row.get(2)?,
                    content: row.get(3)?,
                    media_paths: row.get(4)?,
                    scheduled_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn delete_draft(&self, id: &str) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute("DELETE FROM local_drafts WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    // --- Pending operations -------------------------------------------------
    pub fn enqueue_operation(&self, op: &PendingOperation) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT OR REPLACE INTO pending_operations
             (id, entity, operation, payload, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![op.id, op.entity, op.operation, op.payload, op.created_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn pending_operations(&self) -> Result<Vec<PendingOperation>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, entity, operation, payload, created_at FROM pending_operations
                 ORDER BY created_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(PendingOperation {
                    id: row.get(0)?,
                    entity: row.get(1)?,
                    operation: row.get(2)?,
                    payload: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }

    pub fn clear_operation(&self, id: &str) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute("DELETE FROM pending_operations WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Replace the payload of an existing pending operation (used to coalesce
    /// repeated edits to the same entity instead of enqueuing duplicates).
    pub fn update_operation_payload(&self, id: &str, payload: &str) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "UPDATE pending_operations SET payload = ?1, created_at = ?2 WHERE id = ?3",
            params![payload, now_iso(), id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    // --- Upload queue -------------------------------------------------------
    pub fn upsert_upload(
        &self,
        id: &str,
        user_id: &str,
        file_path: &str,
        file_name: &str,
        file_size: i64,
        file_type: &str,
        bucket: &str,
        status: &str,
        progress: i64,
    ) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "INSERT OR REPLACE INTO upload_queue
             (id, user_id, file_path, file_name, file_size, file_type, bucket, status, progress, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                id,
                user_id,
                file_path,
                file_name,
                file_size,
                file_type,
                bucket,
                status,
                progress,
                migrations::now()
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_upload_status(
        &self,
        id: &str,
        status: &str,
        progress: i64,
    ) -> Result<(), String> {
        let conn = self.lock()?;
        conn.execute(
            "UPDATE upload_queue SET status = ?1, progress = ?2, updated_at = ?3 WHERE id = ?4",
            params![status, progress, migrations::now(), id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_uploads(&self, user_id: &str) -> Result<Vec<UploadRow>, String> {
        let conn = self.lock()?;
        let mut stmt = conn
            .prepare(
                "SELECT id, file_name, file_size, bucket, status, progress FROM upload_queue
                 WHERE user_id = ?1 ORDER BY updated_at DESC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![user_id], |row| {
                Ok(UploadRow {
                    id: row.get(0)?,
                    file_name: row.get(1)?,
                    file_size: row.get(2)?,
                    bucket: row.get(3)?,
                    status: row.get(4)?,
                    progress: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
    }
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct UploadRow {
    pub id: String,
    pub file_name: String,
    pub file_size: i64,
    pub bucket: String,
    pub status: String,
    pub progress: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::models::CachedProfile;

    fn sample_profile() -> CachedProfile {
        CachedProfile {
            id: "u1".into(),
            username: "alice".into(),
            display_name: Some("Alice".into()),
            avatar_url: None,
            account_type: "personal".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
        }
    }

    #[test]
    fn open_and_roundtrip_profile() {
        let dir = std::env::temp_dir().join(format!("vtalk_test_{}", std::process::id()));
        let store = OfflineStore::open(dir.to_str().unwrap()).unwrap();

        store.upsert_profile(&sample_profile()).unwrap();
        let loaded = store.get_profile("u1").unwrap();
        assert!(loaded.is_some());
        let p = loaded.unwrap();
        assert_eq!(p.username, "alice");
        assert_eq!(p.display_name.as_deref(), Some("Alice"));

        // Missing id returns None rather than erroring.
        assert!(store.get_profile("nope").unwrap().is_none());

        let _ = std::fs::remove_dir_all(&dir);
    }
}

/// Current unix timestamp as a string (used for `created_at`/`updated_at` on
/// local pending operations — precision is not security relevant here).
fn now_iso() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs)
}
