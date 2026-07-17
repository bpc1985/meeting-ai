# Tauri v2 + SQLite Integration Research

Date: 2026-07-17 | Scope: meeting transcription desktop app

## 1. SQLite plugins available

- **tauri-plugin-sql (v2)**: official Tauri plugin. Backed by **sqlx**, supports SQLite / MySQL / PostgreSQL selected via Cargo feature (`--features sqlite`). Exposes a JS API (`@tauri-apps/plugin-sql`): `Database.load('sqlite:meeting.db')`, then `db.execute`, `db.select`, `db.batch`. Queries run against the bundled sqlx connection pool on the Rust side; the frontend issues raw SQL strings.
- **rusqlite**: direct, mature Rust SQLite binding (not a Tauri plugin). You call it from your own `#[tauri::command]`s. Bundled feature compiles SQLite from source (no system dep). This is the lower-level path; tauri-plugin-sql does not use it.
- **sql.js / sql.js via WASM**: runs SQLite entirely in the webview (frontend). No Rust involvement.

## 2. Best pattern — recommendation: backend rusqlite behind tauri::command

| Pattern | Pros | Cons | Verdict |
|---|---|---|---|
| Frontend sql.js (WASM) | Pure JS, portable | DB lives in memory/webview; file I/O needs Tauri FS plugin; no native FTS5 build guaranteed; harder to enforce schema | Avoid for persisted app data |
| tauri-plugin-sql | Fast to start, raw SQL from JS | Ships raw SQL to client; coarse capabilities; sqlx async pool overhead; limited FTS/migration control | OK for prototypes |
| **Backend rusqlite + commands** | Typed CRUD in Rust; full FTS5; migrations; single source of truth; native file location | More boilerplate per command | **Recommended** |

Hybrid is YAGNI here — pick backend rusqlite. FTS5, migrations, and audio/offline concerns all favor a Rust-owned DB.

## 3. Rust-side CRUD with tauri::command

- Define `Connection` (opened once, held in `app.state()` or a lazy `Mutex`/pool) with `rusqlite::Connection::open(path)`.
- `#[tauri::command] fn create_meeting(conn: tauri::State<Db>, title: String) -> Result<i64, String>` using `conn.execute("INSERT ...", params![title])` and `conn.last_insert_rowid()`.
- Register `generate_handler![create_meeting, ...]` in `lib.rs`.
- Frontend: `import { invoke } from '@tauri-apps/api/core'; await invoke('create_meeting', { title })`.
- Return `serde::Serialize` rows; wrap errors so the promise rejects. Async commands need owned args.

## 4. Schema migration patterns

- **rusqlite_migration**: migrations defined as `Migrations::from_slice(&[M::up("SQL...")])`; call `Migrations::to_latest(&mut conn)` at startup. Tracks version via SQLite `user_version` (not a table). No external migration table to manage. Best fit for desktop.
- Alternative: a hand-rolled `PRAGMA user_version` check + ordered `.sql` files. More code, skip unless you need SQL-file tooling.
- Apply once at launch, before any command runs.

## 5. FTS5 for transcripts

- Enable `rusqlite` `"bundled"` feature (bundles SQLite; FTS5 included in the bundled build). Do NOT rely on system SQLite for FTS5.
- `CREATE VIRTUAL TABLE transcript_fts USING fts5(segment_text, content='transcript_segments', content_rowid='id');` then `INSERT` trigger or manual sync. Query: `SELECT ... FROM transcript_fts WHERE transcript_fts MATCH ?`.
- External-content table keeps the FTS index separate from source rows; rebuild via `INSERT INTO transcript_fts(transcript_fts) VALUES('rebuild')`.
- Note: FTS5 is NOT available through tauri-plugin-sql's sqlx path reliably — another reason to use rusqlite directly.

## 6. Data model patterns

- **meetings**: id, title, created_at, duration_ms, audio_path, source (upload/live), status.
- **transcript_segments**: id, meeting_id FK, speaker, start_ms, end_ms, text, confidence.
- **summaries**: id, meeting_id FK, kind (brief/detailed/action_items), text, model, created_at.
- **settings**: key PRIMARY KEY, value (JSON or typed columns).
- **Audio files**: store on disk in `app_data_dir/audio/<id>.webm`; keep only the path in DB. Never blob large audio into SQLite (bloat, no streaming). Small thumbnails/embeddings can be BLOB if <1MB.
- Indexes: `transcript_segments(meeting_id)`, FTS table for search.

## 7. App data directory patterns (Tauri v2)

- `app_data_dir` (BaseDirectory::Data) — primary DB + audio files. Resolved via `app.path().app_data_dir()` (Rust) or `await appDataDir()` from `@tauri-apps/api/path` (JS).
- `app_config_dir` (BaseDirectory::Config) — settings; here settings could live in DB instead, so config dir is optional.
- `app_cache_dir` — temp transcode/export scratch, clearable.
- `app_log_dir` — logs.
- Put `meeting.db` at `<app_data_dir>/meeting.db`. Create dir if missing on first launch.

## 8. DB file location per platform (Tauri BaseDirectory::Data)

- **macOS**: `~/Library/Application Support/<bundle_id>/meeting.db`
- **Windows**: `C:\Users\<user>\AppData\Roaming\<bundle_id>\meeting.db`
- **Linux**: `~/.local/share/<bundle_id>/meeting.db` (or `$XDG_DATA_HOME`)
- These follow OS conventions; user-data is roamed on Windows, preserved on macOS Time Machine.

## Recommendation (ranked)
1. **Backend rusqlite ("bundled") + typed tauri::command CRUD + rusqlite_migration + FTS5** — full control, offline-safe, production-grade.
2. tauri-plugin-sql — only if you want fastest prototype and accept raw-SQL-from-JS and weaker FTS.
3. sql.js WASM — reject; wrong model for persisted desktop data.

## Limitations / unresolved
- Tauri v2 `app_*_dir` exact platform paths were sourced from documented BaseDirectory behavior; cross-check against current Tauri path docs (could not fetch live — 404 on docs site during research).
- Did not benchmark command-call overhead vs plugin-sql; negligible at meeting-app scale.
- Encryption (SQLCipher via `bundled-sqlcipher`) not evaluated — add if transcripts are sensitive.
- No sample repo inspected; patterns are from official docs/crates, not a running build.
