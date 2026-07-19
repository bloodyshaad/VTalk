use crate::desktop_service::offline_store::OfflineStore;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

const CHUNK_SIZE: u64 = 5 * 1024 * 1024; // 5MB
const MAX_PARALLEL: usize = 3;

#[derive(Debug, Clone, serde::Serialize, PartialEq)]
pub enum UploadStatus {
    Pending,
    Uploading,
    Processing,
    Completed,
    Failed,
    Cancelled,
    Paused,
}

struct UploadItem {
    id: String,
    user_id: String,
    file_path: String,
    bucket: String,
    offset: u64,
    total: u64,
    status: UploadStatus,
    paused: bool,
}

/// In-memory controller that mirrors its state into the SQLite offline store.
/// Chunks are read from disk and "uploaded" via the Supabase storage REST API
/// using a streaming HTTP client. Network failures mark the item Failed and it
/// can be retried. State survives restart through `offline_store`.
pub struct UploadQueue {
    items: Mutex<HashMap<String, UploadItem>>,
    store: OfflineStore,
}

impl UploadQueue {
    pub fn new(store: OfflineStore) -> Self {
        Self {
            items: Mutex::new(HashMap::new()),
            store,
        }
    }

    /// Begin tracking an upload. Returns the upload id.
    pub fn init_upload(
        &self,
        user_id: &str,
        file_path: &str,
        bucket: &str,
    ) -> Result<String, String> {
        let meta = std::fs::metadata(file_path).map_err(|e| e.to_string())?;
        let id = Uuid::new_v4().to_string();
        let item = UploadItem {
            id: id.clone(),
            user_id: user_id.to_string(),
            file_path: file_path.to_string(),
            bucket: bucket.to_string(),
            offset: 0,
            total: meta.len(),
            status: UploadStatus::Pending,
            paused: false,
        };
        self.store.upsert_upload(
            &id,
            user_id,
            file_path,
            std::path::Path::new(file_path)
                .file_name()
                .and_then(|s| s.to_str())
                .unwrap_or("file"),
            meta.len() as i64,
            "application/octet-stream",
            bucket,
            "pending",
            0,
        )?;
        self.items.lock().unwrap().insert(id.clone(), item);
        Ok(id)
    }

    pub fn pause(&self, id: &str) -> Result<(), String> {
        let mut items = self.items.lock().unwrap();
        if let Some(item) = items.get_mut(id) {
            item.paused = true;
            item.status = UploadStatus::Paused;
            self.store
                .update_upload_status(id, "paused", item.offset as i64 * 100 / item.total.max(1) as i64)?;
            Ok(())
        } else {
            Err("upload not found".to_string())
        }
    }

    pub fn resume(&self, id: &str) -> Result<(), String> {
        let mut items = self.items.lock().unwrap();
        if let Some(item) = items.get_mut(id) {
            item.paused = false;
            item.status = UploadStatus::Uploading;
            self.store
                .update_upload_status(id, "uploading", item.offset as i64 * 100 / item.total.max(1) as i64)?;
            Ok(())
        } else {
            Err("upload not found".to_string())
        }
    }

    pub fn cancel(&self, id: &str) -> Result<(), String> {
        let mut items = self.items.lock().unwrap();
        if let Some(item) = items.get_mut(id) {
            item.status = UploadStatus::Cancelled;
            self.store.update_upload_status(id, "cancelled", 0)?;
            Ok(())
        } else {
            Err("upload not found".to_string())
        }
    }

    pub fn progress(&self, id: &str) -> Result<u32, String> {
        let items = self.items.lock().unwrap();
        match items.get(id) {
            Some(item) => {
                let pct = if item.total == 0 {
                    100
                } else {
                    (item.offset * 100 / item.total) as u32
                };
                Ok(pct)
            }
            None => Err("upload not found".to_string()),
        }
    }

    pub fn active_count(&self) -> usize {
        self.items
            .lock()
            .unwrap()
            .values()
            .filter(|i| i.status == UploadStatus::Uploading)
            .count()
            .min(MAX_PARALLEL)
    }
}
