pub mod migrations;
pub mod models;
pub mod meetings;
pub mod segments;
pub mod summaries;
pub mod settings;
pub mod search;

use crate::audio::recorder::RecordingState;
use chrono::Utc;
use rusqlite::Connection;
use rusqlite_migration::Migrations;
use std::path::Path;
use std::sync::Mutex;
use tauri::AppHandle;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub audio_dir: std::path::PathBuf,
    pub recording: Mutex<RecordingState>,
    pub app_handle: AppHandle,
}

impl AppState {
    pub fn new(db: Connection, audio_dir: std::path::PathBuf, app_handle: AppHandle) -> Self {
        Self {
            db: Mutex::new(db),
            audio_dir,
            recording: Mutex::new(RecordingState::default()),
            app_handle,
        }
    }
}

pub(crate) fn now_iso() -> String {
    Utc::now().to_rfc3339()
}

pub fn init_db(app_data_dir: &Path) -> Result<Connection, Box<dyn std::error::Error>> {
    std::fs::create_dir_all(app_data_dir)?;
    let db_path = app_data_dir.join("meeting.db");
    let mut conn = Connection::open(&db_path)?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA foreign_keys=ON;
         PRAGMA busy_timeout=5000;"
    )?;
    let migs = migrations::get_migrations();
    migs.to_latest(&mut conn)?;
    Ok(conn)
}

#[cfg(test)]
pub(crate) fn test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory db");
    conn.execute_batch("PRAGMA journal_mode=MEMORY; PRAGMA foreign_keys=ON;")
        .expect("pragmas");
    let migs = migrations::get_migrations();
    migs.to_latest(&mut conn).expect("migrations");
    conn
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn now_iso_returns_rfc3339() {
        let t = now_iso();
        assert!(t.contains('T'));
        assert!(t.contains('+') || t.contains('Z'));
        assert!(t.ends_with('Z') || t.contains(':'));
    }

    #[test]
    fn now_iso_is_monotonic() {
        let t1 = now_iso();
        let t2 = now_iso();
        assert!(t1 <= t2);
    }

    #[test]
    fn test_db_has_all_tables() {
        let conn = test_db();
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .map(|r| r.unwrap())
            .collect();
        assert!(tables.contains(&"meetings".into()));
        assert!(tables.contains(&"segments".into()));
        assert!(tables.contains(&"summaries".into()));
        assert!(tables.contains(&"settings".into()));
    }
}
