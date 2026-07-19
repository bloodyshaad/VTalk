use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant};

struct CacheEntry {
    path: PathBuf,
    inserted_at: Instant,
    ttl: Duration,
    size: u64,
}

/// LRU-ish disk cache keyed by URL hash. Entries carry a TTL and the cache is
/// bounded by a total size budget; when exceeded, oldest entries are evicted.
pub struct CacheManager {
    dir: PathBuf,
    capacity_bytes: u64,
    entries: Mutex<HashMap<u64, CacheEntry>>,
}

impl CacheManager {
    pub fn new(cache_dir: &str, capacity_bytes: u64) -> Result<Self, String> {
        let dir = PathBuf::from(cache_dir).join("media_cache");
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        Ok(Self {
            dir,
            capacity_bytes,
            entries: Mutex::new(HashMap::new()),
        })
    }

    fn key_for(url: &str) -> u64 {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        url.hash(&mut hasher);
        hasher.finish()
    }

    /// Return the local path for a cached URL, or None if missing/expired.
    pub fn get(&self, url: &str) -> Option<PathBuf> {
        let key = Self::key_for(url);
        let mut entries = self.entries.lock().unwrap();
        if let Some(entry) = entries.get(&key) {
            if entry.inserted_at.elapsed() > entry.ttl {
                let _ = std::fs::remove_file(&entry.path);
                entries.remove(&key);
                return None;
            }
            return Some(entry.path.clone());
        }
        None
    }

    /// Store bytes for a URL, returning the local cache path.
    pub fn put(&self, url: &str, data: &[u8], ttl: Duration) -> Result<PathBuf, String> {
        let key = Self::key_for(url);
        let path = self.dir.join(format!("{:016x}.bin", key));
        std::fs::write(&path, data).map_err(|e| e.to_string())?;
        let size = data.len() as u64;
        self.entries.lock().unwrap().insert(
            key,
            CacheEntry {
                path: path.clone(),
                inserted_at: Instant::now(),
                ttl,
                size,
            },
        );
        self.evict_if_needed();
        Ok(path)
    }

    fn current_size(&self) -> u64 {
        self.entries.lock().unwrap().values().map(|e| e.size).sum()
    }

    fn evict_if_needed(&self) {
        let mut entries = self.entries.lock().unwrap();
        while entries.values().map(|e| e.size).sum::<u64>() > self.capacity_bytes
            && !entries.is_empty()
        {
            // Evict the oldest entry.
            if let Some(oldest_key) = entries
                .iter()
                .min_by_key(|(_, e)| e.inserted_at)
                .map(|(k, _)| *k)
            {
                if let Some(entry) = entries.remove(&oldest_key) {
                    let _ = std::fs::remove_file(&entry.path);
                }
            } else {
                break;
            }
        }
    }

    pub fn clear(&self) -> Result<(), String> {
        std::fs::remove_dir_all(&self.dir).map_err(|e| e.to_string())?;
        std::fs::create_dir_all(&self.dir).map_err(|e| e.to_string())?;
        self.entries.lock().unwrap().clear();
        Ok(())
    }
}
