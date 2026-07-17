pub mod migrations;
pub mod models;
pub mod meetings;
pub mod segments;
pub mod summaries;
pub mod settings;
pub mod search;

use crate::audio::recorder::RecordingState;
use rusqlite::Connection;
use rusqlite_migration::Migrations;
use std::path::Path;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub audio_dir: std::path::PathBuf,
    pub recording: Mutex<RecordingState>,
}

impl AppState {
    pub fn new(db: Connection, audio_dir: std::path::PathBuf) -> Self {
        Self {
            db: Mutex::new(db),
            audio_dir,
            recording: Mutex::new(RecordingState::default()),
        }
    }
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
