//! SQLite schema migrations for the local offline store.
//! Each migration is an idempotent DDL statement. `run_migrations` applies all
//! of them in order; the `schema_migrations` table tracks which have run.

pub const MIGRATIONS: &[&str] = &[
    r#"
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
    );
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS cached_profiles (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        display_name TEXT,
        avatar_url TEXT,
        account_type TEXT NOT NULL DEFAULT 'public',
        updated_at TEXT NOT NULL
    );
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS cached_posts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        post_type TEXT NOT NULL,
        content TEXT,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
    );
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS local_drafts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        draft_type TEXT NOT NULL,
        content TEXT NOT NULL,
        media_paths TEXT,
        scheduled_at TEXT,
        updated_at TEXT NOT NULL
    );
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS pending_operations (
        id TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    "#,
    r#"
    CREATE TABLE IF NOT EXISTS upload_queue (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_type TEXT NOT NULL,
        bucket TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        error TEXT,
        updated_at TEXT NOT NULL
    );
    "#,
];

/// Apply all pending migrations to the given connection.
pub fn run_migrations(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        );",
    )
    .map_err(|e| e.to_string())?;

    let applied: Vec<i64> = conn
        .prepare("SELECT version FROM schema_migrations")
        .map_err(|e| e.to_string())?
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for (i, sql) in MIGRATIONS.iter().enumerate() {
        let version = (i + 1) as i64;
        if applied.contains(&version) {
            continue;
        }
        conn.execute_batch(sql)
            .map_err(|e| format!("migration {version} failed: {e}"))?;
        conn.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (?1, ?2)",
            rusqlite::params![version, now()],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn now() -> String {
    chrono::Utc::now().to_rfc3339()
}
