use crate::db::models::Meeting;
use crate::db::{now_iso, AppState};
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn create_meeting(title: String, state: State<AppState>) -> Result<Meeting, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let now = now_iso();

    db.execute(
        "INSERT INTO meetings (id, title, created_at, updated_at, status) VALUES (?1, ?2, ?3, ?4, 'draft')",
        params![id, title, now, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Meeting {
        id: id.clone(),
        title,
        audio_path: None,
        duration_secs: None,
        created_at: now.clone(),
        updated_at: now,
        status: "draft".into(),
    })
}

#[tauri::command]
pub fn get_meeting(id: String, state: State<AppState>) -> Result<Meeting, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.query_row(
        "SELECT id, title, audio_path, duration_secs, created_at, updated_at, status FROM meetings WHERE id = ?1",
        params![id],
        |row| {
            Ok(Meeting {
                id: row.get(0)?,
                title: row.get(1)?,
                audio_path: row.get(2)?,
                duration_secs: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                status: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_meetings(offset: Option<i32>, limit: Option<i32>, state: State<AppState>) -> Result<Vec<Meeting>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let off = offset.unwrap_or(0);
    let lim = limit.unwrap_or(50);

    let mut stmt = db
        .prepare("SELECT id, title, audio_path, duration_secs, created_at, updated_at, status FROM meetings ORDER BY created_at DESC LIMIT ?1 OFFSET ?2")
        .map_err(|e| e.to_string())?;

    let meetings = stmt
        .query_map(params![lim, off], |row| {
            Ok(Meeting {
                id: row.get(0)?,
                title: row.get(1)?,
                audio_path: row.get(2)?,
                duration_secs: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
                status: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(meetings)
}

#[tauri::command]
pub fn update_meeting(
    id: String,
    title: Option<String>,
    status: Option<String>,
    audio_path: Option<String>,
    duration_secs: Option<f64>,
    state: State<AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let now = now_iso();

    // Build a single UPDATE with only the fields that are Some
    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(t) = title {
        sets.push(format!("title = ?{}", values.len() + 1));
        values.push(Box::new(t));
    }
    if let Some(s) = status {
        sets.push(format!("status = ?{}", values.len() + 1));
        values.push(Box::new(s));
    }
    if let Some(p) = audio_path {
        sets.push(format!("audio_path = ?{}", values.len() + 1));
        values.push(Box::new(p));
    }
    if let Some(d) = duration_secs {
        sets.push(format!("duration_secs = ?{}", values.len() + 1));
        values.push(Box::new(d));
    }

    if sets.is_empty() {
        return Ok(());
    }

    sets.push(format!("updated_at = ?{}", values.len() + 1));
    values.push(Box::new(now.clone()));
    values.push(Box::new(id));

    let sql = format!(
        "UPDATE meetings SET {} WHERE id = ?{}",
        sets.join(", "),
        values.len()
    );

    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    db.execute(&sql, params.as_slice()).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_meeting(id: String, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Fetch audio_path before deleting
    let audio_path: Option<String> = db
        .query_row(
            "SELECT audio_path FROM meetings WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .ok();

    db.execute("DELETE FROM meetings WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;

    // Delete WAV file from disk (best-effort, don't fail if already gone)
    if let Some(path) = audio_path {
        let _ = std::fs::remove_file(&path);
        // Also clean up cache-dir compressed files with same base id
        // ponytail: pattern match for leftover chunks too
        if let Some(parent) = std::path::Path::new(&path).parent() {
            if let Some(stem) = std::path::Path::new(&path).file_stem() {
                let _pattern = parent.join(format!("{}*", stem.to_string_lossy()));
                if let Ok(entries) = std::fs::read_dir(parent) {
                    for entry in entries.flatten() {
                        let name = entry.file_name();
                        let name_str = name.to_string_lossy();
                        if name_str.starts_with(stem.to_string_lossy().as_ref()) {
                            let _ = std::fs::remove_file(entry.path());
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
