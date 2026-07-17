---
phase: 2
title: Rust Backend & Database
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 2: Rust Backend & Database

## Overview

Implement SQLite database layer using rusqlite (bundled) with FTS5 and `rusqlite_migration` for schema versioning. Expose CRUD operations via `tauri::command` handlers. Store all meeting data, transcripts, summaries, and settings.

## Requirements

- **Functional:** Create/read/update/delete meetings, segments, summaries, settings. Full-text search across transcripts.
- **Non-functional:** Thread-safe DB access via `Mutex<Connection>`, migrations tracked by `user_version`, audio files stored on disk (paths in DB, no BLOBs)

## Architecture

```
src-tauri/src/
├── main.rs                 # Tauri entry, DB init
├── lib.rs                  # Plugin registration, command exports
├── db/
│   ├── mod.rs              # DB module, init, migration runner
│   ├── migrations.rs        # rusqlite_migration definitions
│   ├── models.rs           # Rust structs: Meeting, Segment, Summary, Settings
│   ├── meetings.rs         # Meeting CRUD commands
│   ├── segments.rs         # Segment CRUD commands
│   ├── summaries.rs         # Summary CRUD commands
│   ├── settings.rs         # Settings CRUD (API keys, provider config)
│   └── search.rs           # FTS5 search queries
└── commands/
    └── mod.rs              # Command module re-exports
```

### Data Model

```sql
-- meetings
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,        -- UUID
  title TEXT NOT NULL,
  audio_path TEXT,            -- relative to app_data_dir/audio/
  duration_secs REAL,         -- recording duration
  created_at TEXT NOT NULL,   -- ISO 8601
  updated_at TEXT NOT NULL,
  status TEXT DEFAULT 'draft' -- 'draft' | 'transcribed' | 'summarized'
);

-- transcript_segments
CREATE TABLE segments (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  speaker_label TEXT DEFAULT 'Speaker 1',
  text TEXT NOT NULL,
  start_secs REAL NOT NULL,
  end_secs REAL NOT NULL,
  sequence INTEGER NOT NULL
);

-- FTS5 virtual table for search
CREATE VIRTUAL TABLE segments_fts USING fts5(
  text, speaker_label,
  content='segments', content_rowid='rowid'
);

-- summaries
CREATE TABLE summaries (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'gemini',
  model TEXT,
  overview TEXT,
  key_decisions TEXT,
  action_items TEXT,
  risks TEXT,
  created_at TEXT NOT NULL
);

-- settings (key-value)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Key Rust Types

```rust
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Meeting {
    pub id: String,
    pub title: String,
    pub audio_path: Option<String>,
    pub duration_secs: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Segment {
    pub id: String,
    pub meeting_id: String,
    pub speaker_label: String,
    pub text: String,
    pub start_secs: f64,
    pub end_secs: f64,
    pub sequence: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Summary {
    pub id: String,
    pub meeting_id: String,
    pub provider: String,
    pub model: Option<String>,
    pub overview: Option<String>,
    pub key_decisions: Option<String>,
    pub action_items: Option<String>,
    pub risks: Option<String>,
    pub created_at: String,
}
```

### DB Initialization Pattern

```rust
use std::sync::Mutex;
use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub audio_dir: std::path::PathBuf,
}

fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up("CREATE TABLE meetings (...) STRICT;"),
        M::up("CREATE TABLE segments (...) STRICT;"),
        M::up("CREATE VIRTUAL TABLE segments_fts USING fts5(...);"),
        M::up("CREATE TABLE summaries (...) STRICT;"),
        M::up("CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;"),
        M::up("CREATE INDEX idx_segments_meeting ON segments(meeting_id, sequence);"),
    ])
}

pub fn init_db(app_data_dir: &Path) -> Result<Connection, Box<dyn Error>> {
    let db_path = app_data_dir.join("meeting.db");
    let mut conn = Connection::open(db_path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
    let migrations = get_migrations();
    migrations.to_latest(&mut conn)?;
    Ok(conn)
}
```

### FTS5 Search Pattern

```rust
#[tauri::command]
fn search_meetings(query: String, state: tauri::State<AppState>) -> Result<Vec<SearchResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db.prepare(
        "SELECT m.id, m.title, m.created_at, s.text, s.speaker_label
         FROM segments_fts fts
         JOIN segments s ON fts.rowid = s.rowid
         JOIN meetings m ON s.meeting_id = m.id
         WHERE segments_fts MATCH ?1
         LIMIT 20"
    ).map_err(|e| e.to_string())?;
    // ... map rows to SearchResult
}
```

## Implementation Steps

1. Add `rusqlite = { version = "0.31", features = ["bundled"] }` and `rusqlite_migration = "1"` to `Cargo.toml`
2. Add `uuid = { version = "1", features = ["v4"] }` to `Cargo.toml`
3. Create `db/mod.rs` with `init_db()` function, `AppState` struct, connection management
4. Create `db/migrations.rs` with all schema DDL
5. Create `db/models.rs` with Rust structs (derive Serialize, Deserialize, Clone)
6. Implement `db/meetings.rs`: `create_meeting`, `get_meeting`, `list_meetings`, `update_meeting`, `delete_meeting`
7. Implement `db/segments.rs`: `create_segments_batch`, `get_segments`, `update_segment`, `delete_segment`, `split_segment`, `merge_segments`
8. Implement `db/summaries.rs`: `create_summary`, `get_summary`, `update_summary`, `delete_summary`
9. Implement `db/settings.rs`: `get_setting`, `set_setting`, `get_all_settings`
10. Implement `db/search.rs`: `search_meetings` with FTS5 MATCH
11. Set up Tauri state management: `app.manage(AppState { db, audio_dir })` in `main.rs`
12. Export all commands in `lib.rs` via `#[tauri::command]` attribute
13. Verify: call `create_meeting` from frontend, read back via `list_meetings`

## Success Criteria

- [ ] SQLite database created in `app_data_dir` on first launch
- [ ] All migrations run successfully via `rusqlite_migration`
- [ ] CRUD operations for meetings, segments, summaries, settings work via Tauri commands
- [ ] FTS5 search returns matching meetings
- [ ] Audio directory created at `app_data_dir/audio/`
- [ ] `cargo build` compiles without warnings

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| rusqlite `bundled` feature compile time | Acceptable (~1-2 min first build); required for FTS5 guarantee |
| Mutex contention on DB | Single-connection Mutex is fine for desktop app; no concurrent writes expected |
| SQL injection | Use parameterized queries exclusively (rusqlite enforces this via `?1` params) |
| API key storage in plaintext | Acceptable for MVP (local DB, user's own machine); encrypt later if needed |
