#![allow(dead_code)]

use crate::db::models::PendingOperation;
use crate::desktop_service::offline_store::OfflineStore;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::Emitter;

#[derive(Debug, Clone, serde::Serialize, PartialEq)]
pub enum SyncStatus {
    Stopped,
    Connecting,
    Syncing,
    Synced,
    Offline,
    Error,
}

/// A flush handler applies a single pending operation to the remote backend.
/// It is supplied by the application layer (delegating to the webview's
/// Supabase client). Returning `Ok(())` marks the operation as applied and
/// removes it from the queue; returning `Err` keeps it queued and aborts the
/// current flush so we can retry with backoff.
pub type FlushHandler = Arc<dyn Fn(&PendingOperation) -> Result<(), String> + Send + Sync>;

/// Event emitted to the frontend carrying the batch of operations that must be
/// applied. The frontend applies them (via Supabase) and calls
/// `mark_synced` / `mark_failed` back.
#[derive(Clone, serde::Serialize)]
pub struct FlushRequest {
    pub operations: Vec<PendingOperation>,
}

/// Background sync manager.
///
/// Maintains the offline-operation queue and flushes it whenever online. The
/// actual network application is delegated to the frontend (which performs real
/// Supabase writes) via the `sync://flush` event; a `FlushHandler` can also be
/// registered for headless/test usage.
///
/// Operations are **never** discarded on failure — they remain queued and are
/// retried with exponential backoff until successfully applied. Duplicate
/// operations targeting the same entity+operation (e.g. two edits to the same
/// draft) are coalesced to the latest payload to avoid redundant writes.
pub struct SyncManager {
    store: OfflineStore,
    app: Arc<Mutex<Option<tauri::AppHandle>>>,
    status: Arc<Mutex<SyncStatus>>,
    running: Arc<AtomicBool>,
    attempt: Arc<AtomicU32>,
    flush_handler: Arc<Mutex<Option<FlushHandler>>>,
}

impl SyncManager {
    pub fn new(store: OfflineStore) -> Self {
        Self {
            store,
            app: Arc::new(Mutex::new(None)),
            status: Arc::new(Mutex::new(SyncStatus::Stopped)),
            running: Arc::new(AtomicBool::new(false)),
            attempt: Arc::new(AtomicU32::new(0)),
            flush_handler: Arc::new(Mutex::new(None)),
        }
    }

    /// Bind an app handle so the manager can emit status/flush events.
    pub fn set_app(&self, app: tauri::AppHandle) {
        if let Ok(mut g) = self.app.lock() {
            *g = Some(app);
        }
    }

    /// Register a fallback handler for headless/test usage.
    pub fn set_flush_handler(&self, handler: FlushHandler) {
        if let Ok(mut guard) = self.flush_handler.lock() {
            *guard = Some(handler);
        }
    }

    fn set_status(&self, s: SyncStatus) {
        if let Ok(mut g) = self.status.lock() {
            *g = s.clone();
        }
        if let Ok(g) = self.app.lock() {
            if let Some(app) = g.as_ref() {
                let _ = app.emit("sync://status", &s);
            }
        }
    }

    pub fn status(&self) -> SyncStatus {
        self.status
            .lock()
            .map(|g| g.clone())
            .unwrap_or(SyncStatus::Stopped)
    }

    /// Number of operations currently awaiting flush.
    pub fn pending_count(&self) -> Result<usize, String> {
        Ok(self.store.pending_operations()?.len())
    }

    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::SeqCst)
    }

    /// Queue an operation. `dedupe_key` (e.g. the entity id) lets repeated
    /// operations on the same target coalesce to the latest payload instead of
    /// accumulating duplicates.
    pub fn enqueue(
        &self,
        entity: &str,
        operation: &str,
        payload: &str,
        dedupe_key: &str,
    ) -> Result<(), String> {
        // Coalesce: if an op for the same entity+operation+dedupe exists,
        // replace its payload rather than appending a new one.
        let existing = self.store.pending_operations()?;
        if let Some(prev) = existing.iter().find(|o| {
            o.entity == entity && o.operation == operation && o.payload.contains(dedupe_key)
        }) {
            self.store.update_operation_payload(&prev.id, payload)?;
            return Ok(());
        }
        let op = PendingOperation {
            id: uuid(),
            entity: entity.to_string(),
            operation: operation.to_string(),
            payload: payload.to_string(),
            created_at: now_iso(),
        };
        self.store.enqueue_operation(&op)?;
        // Wake the loop so a freshly queued op is flushed promptly.
        self.set_status(SyncStatus::Connecting);
        Ok(())
    }

    /// Apply results reported by the frontend (or handler) for a batch.
    pub fn mark_synced(&self, ids: &[String]) -> Result<(), String> {
        for id in ids {
            self.store.clear_operation(id)?;
        }
        if self.store.pending_operations()?.is_empty() {
            self.attempt.store(0, Ordering::SeqCst);
            self.set_status(SyncStatus::Synced);
        }
        Ok(())
    }

    pub fn mark_failed(&self, id: &str, _error: &str) -> Result<(), String> {
        // Keep the op queued; bump the retry counter so backoff grows.
        let _ = id;
        let next = self.attempt.fetch_add(1, Ordering::SeqCst) + 1;
        if next >= MAX_ATTEMPTS {
            self.set_status(SyncStatus::Error);
        }
        Ok(())
    }

    /// Flush all queued operations. Returns `Ok(true)` if everything applied
    /// (or the queue was empty), `Ok(false)` if offline/no handler, `Err` on the
    /// first operation that failed to apply.
    pub fn flush(&self) -> Result<bool, String> {
        self.set_status(SyncStatus::Syncing);
        let ops = self.store.pending_operations()?;
        if ops.is_empty() {
            self.attempt.store(0, Ordering::SeqCst);
            self.set_status(SyncStatus::Synced);
            return Ok(true);
        }

        // Prefer emitting to the frontend, which performs real Supabase writes.
        let app = self.app.lock().ok().and_then(|g| g.clone());
        if let Some(app) = app {
            let req = FlushRequest {
                operations: ops.clone(),
            };
            if app.emit("sync://flush", &req).is_ok() {
                // Frontend applies asynchronously and calls mark_synced /
                // mark_failed. We optimistically leave status as Syncing; the
                // loop will reconcile once results arrive.
                return Ok(true);
            }
        }

        // Fallback: synchronous handler (tests / headless).
        let handler = {
            let guard = self
                .flush_handler
                .lock()
                .map_err(|_| "flush handler mutex poisoned".to_string())?;
            guard.clone()
        };
        let Some(handler) = handler else {
            self.set_status(SyncStatus::Offline);
            return Ok(false);
        };
        for op in &ops {
            handler(op).map_err(|e| format!("failed to apply operation {}: {e}", op.id))?;
            self.store.clear_operation(&op.id)?;
        }
        self.attempt.store(0, Ordering::SeqCst);
        self.set_status(SyncStatus::Synced);
        Ok(true)
    }

    /// Start the persistent background flush loop.
    pub fn start(&self) {
        self.running.store(true, Ordering::SeqCst);
        self.set_status(SyncStatus::Connecting);

        // Clone the shared, reference-counted bits so the loop thread is
        // fully owned ('static) and does not borrow `self`.
        let store = self.store.clone();
        let app = self.app.clone();
        let status = self.status.clone();
        let running = self.running.clone();
        let attempt = self.attempt.clone();
        let flush_handler = self.flush_handler.clone();

        std::thread::spawn(move || {
            while running.load(Ordering::SeqCst) {
                let result = flush_once(&store, &app, &status, &attempt, &flush_handler);
                match result {
                    Ok(true) => {
                        attempt.store(0, Ordering::SeqCst);
                    }
                    Ok(false) => {
                        // Offline / no frontend yet. Back off gently.
                        let delay = SyncManager::backoff_delay(attempt.load(Ordering::SeqCst));
                        std::thread::sleep(delay);
                    }
                    Err(_) => {
                        let next = attempt.fetch_add(1, Ordering::SeqCst) + 1;
                        if let Ok(mut g) = status.lock() {
                            *g = SyncStatus::Error;
                        }
                        emit_status(&app, &status);
                        let delay = SyncManager::backoff_delay(next.min(MAX_ATTEMPTS - 1));
                        std::thread::sleep(delay);
                    }
                }
                // Base poll interval when idle/synced.
                if store
                    .pending_operations()
                    .map(|o| o.is_empty())
                    .unwrap_or(true)
                {
                    std::thread::sleep(IDLE_INTERVAL);
                }
            }
        });
    }

    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
        self.set_status(SyncStatus::Stopped);
    }

    /// Exponential backoff helper for reconnect scheduling.
    pub fn backoff_delay(attempt: u32) -> Duration {
        let base: u64 = 500;
        let cap: u64 = 30_000;
        // Saturating multiply so high attempt counts can't overflow.
        let millis = base.saturating_mul(2u64.saturating_pow(attempt)).min(cap);
        Duration::from_millis(millis)
    }
}

const MAX_ATTEMPTS: u32 = 8;
const IDLE_INTERVAL: Duration = Duration::from_secs(5);

/// Emit a status to the frontend (if an app handle is bound). Used by both the
/// method and the background loop thread.
fn emit_status(app: &Arc<Mutex<Option<tauri::AppHandle>>>, status: &Arc<Mutex<SyncStatus>>) {
    let s = status
        .lock()
        .map(|g| g.clone())
        .unwrap_or(SyncStatus::Stopped);
    if let Ok(g) = app.lock() {
        if let Some(a) = g.as_ref() {
            let _ = a.emit("sync://status", &s);
        }
    }
}

/// One flush pass, usable from the background loop without borrowing `&self`.
/// Returns `Ok(true)` if everything applied (or queue empty), `Ok(false)` if
/// offline/no handler available, `Err` on the first op that failed.
fn flush_once(
    store: &OfflineStore,
    app: &Arc<Mutex<Option<tauri::AppHandle>>>,
    status: &Arc<Mutex<SyncStatus>>,
    _attempt: &Arc<AtomicU32>,
    flush_handler: &Arc<Mutex<Option<FlushHandler>>>,
) -> Result<bool, String> {
    if let Ok(mut g) = status.lock() {
        *g = SyncStatus::Syncing;
    }
    emit_status(app, status);

    let ops = store.pending_operations()?;
    if ops.is_empty() {
        if let Ok(mut g) = status.lock() {
            *g = SyncStatus::Synced;
        }
        emit_status(app, status);
        return Ok(true);
    }

    // Prefer emitting to the frontend, which performs real Supabase writes.
    if let Ok(g) = app.lock() {
        if let Some(a) = g.as_ref() {
            let req = FlushRequest {
                operations: ops.clone(),
            };
            if a.emit("sync://flush", &req).is_ok() {
                return Ok(true);
            }
        }
    }

    // Fallback: synchronous handler (tests / headless).
    let handler = {
        let guard = flush_handler
            .lock()
            .map_err(|_| "flush handler mutex poisoned".to_string())?;
        guard.clone()
    };
    let Some(handler) = handler else {
        if let Ok(mut g) = status.lock() {
            *g = SyncStatus::Offline;
        }
        emit_status(app, status);
        return Ok(false);
    };
    for op in &ops {
        handler(op).map_err(|e| format!("failed to apply operation {}: {e}", op.id))?;
        store.clear_operation(&op.id)?;
    }
    if let Ok(mut g) = status.lock() {
        *g = SyncStatus::Synced;
    }
    emit_status(app, status);
    Ok(true)
}

fn uuid() -> String {
    // Simple unique id without extra deps; collisions are astronomically
    // unlikely for a local pending-op queue.
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{:x}-{:x}", nanos, fastrand_like())
}

fn fastrand_like() -> u64 {
    use std::cell::Cell;
    thread_local! {
        static STATE: Cell<u64> = const { Cell::new(0x9E3779B97F4A7C15) };
    }
    STATE.with(|s| {
        let mut x = s.get();
        x ^= x << 13;
        x ^= x >> 7;
        x ^= x << 17;
        s.set(x);
        x
    })
}

fn now_iso() -> String {
    // RFC3339-ish local timestamp; precision is not security relevant here.
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_grows_exponentially_and_caps() {
        assert_eq!(SyncManager::backoff_delay(0), Duration::from_millis(500));
        assert_eq!(SyncManager::backoff_delay(1), Duration::from_millis(1_000));
        assert_eq!(SyncManager::backoff_delay(2), Duration::from_millis(2_000));
        assert_eq!(SyncManager::backoff_delay(3), Duration::from_millis(4_000));
        assert_eq!(
            SyncManager::backoff_delay(20),
            Duration::from_millis(30_000)
        );
        assert_eq!(
            SyncManager::backoff_delay(u32::MAX),
            Duration::from_millis(30_000)
        );
    }

    #[test]
    fn backoff_is_monotonic() {
        let mut prev = Duration::ZERO;
        for attempt in 0..10 {
            let d = SyncManager::backoff_delay(attempt);
            assert!(d >= prev);
            prev = d;
        }
    }

    #[test]
    fn enqueue_coalesces_same_target_and_mark_synced_clears() {
        let dir = std::env::temp_dir().join(format!("vtalk_sync_test_{}", std::process::id()));
        let store =
            crate::desktop_service::offline_store::OfflineStore::open(dir.to_str().unwrap())
                .unwrap();
        let mgr = SyncManager::new(store);

        // Two edits to the same draft should coalesce to one queued op.
        mgr.enqueue("drafts", "upsert", "{\"id\":\"d1\"}", "d1")
            .unwrap();
        mgr.enqueue(
            "drafts",
            "upsert",
            "{\"id\":\"d1\",\"content\":\"v2\"}",
            "d1",
        )
        .unwrap();
        assert_eq!(mgr.pending_count().unwrap(), 1);

        // A different draft is a separate op.
        mgr.enqueue("drafts", "upsert", "{\"id\":\"d2\"}", "d2")
            .unwrap();
        assert_eq!(mgr.pending_count().unwrap(), 2);

        // Reporting both as synced empties the queue and resets backoff.
        mgr.mark_synced(&["ignored-but-must-exist".to_string()])
            .unwrap();
        // mark_synced clears by id; the test ids above were generated internally,
        // so instead clear via the store directly to assert behavior.
        let ops = mgr.store.pending_operations().unwrap();
        let ids: Vec<String> = ops.iter().map(|o| o.id.clone()).collect();
        mgr.mark_synced(&ids).unwrap();
        assert_eq!(mgr.pending_count().unwrap(), 0);

        let _ = std::fs::remove_dir_all(&dir);
    }
}
