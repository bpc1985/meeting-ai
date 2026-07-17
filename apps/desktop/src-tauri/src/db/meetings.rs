use crate::db::models::Meeting;
use crate::db::AppState;
use rusqlite::params;
use tauri::State;

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}

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
pub fn list_meetings(state: State<AppState>) -> Result<Vec<Meeting>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, title, audio_path, duration_secs, created_at, updated_at, status FROM meetings ORDER BY created_at DESC")
        .map_err(|e| e.to_string())?;

    let meetings = stmt
        .query_map([], |row| {
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

    if let Some(t) = title {
        db.execute(
            "UPDATE meetings SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![t, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(s) = status {
        db.execute(
            "UPDATE meetings SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![s, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(p) = audio_path {
        db.execute(
            "UPDATE meetings SET audio_path = ?1, updated_at = ?2 WHERE id = ?3",
            params![p, now, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(d) = duration_secs {
        db.execute(
            "UPDATE meetings SET duration_secs = ?1, updated_at = ?2 WHERE id = ?3",
            params![d, now, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn delete_meeting(id: String, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM meetings WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
