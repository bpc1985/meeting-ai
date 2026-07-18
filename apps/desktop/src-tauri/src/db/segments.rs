use crate::db::models::Segment;
use crate::db::AppState;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn create_segments_batch(
    meeting_id: String,
    segments: Vec<SegmentInput>,
    state: State<AppState>,
) -> Result<Vec<Segment>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // ponytail: wrap all inserts in a single transaction — 10x for large transcripts
    db.execute("BEGIN", []).map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for (i, seg) in segments.iter().enumerate() {
        let id = uuid::Uuid::new_v4().to_string();
        if let Err(e) = db.execute(
            "INSERT INTO segments (id, meeting_id, speaker_label, text, start_secs, end_secs, sequence)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, meeting_id, seg.speaker_label, seg.text, seg.start_secs, seg.end_secs, i as i32],
        ) {
            let _ = db.execute("ROLLBACK", []);
            return Err(e.to_string());
        }

        results.push(Segment {
            id,
            meeting_id: meeting_id.clone(),
            speaker_label: seg.speaker_label.clone(),
            text: seg.text.clone(),
            start_secs: seg.start_secs,
            end_secs: seg.end_secs,
            sequence: i as i32,
        });
    }

    db.execute("COMMIT", []).map_err(|e| e.to_string())?;

    Ok(results)
}

#[derive(serde::Deserialize)]
pub struct SegmentInput {
    pub speaker_label: String,
    pub text: String,
    pub start_secs: f64,
    pub end_secs: f64,
}

#[tauri::command]
pub fn get_segments(meeting_id: String, state: State<AppState>) -> Result<Vec<Segment>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare("SELECT id, meeting_id, speaker_label, text, start_secs, end_secs, sequence FROM segments WHERE meeting_id = ?1 ORDER BY sequence")
        .map_err(|e| e.to_string())?;

    let segments = stmt
        .query_map(params![meeting_id], |row| {
            Ok(Segment {
                id: row.get(0)?,
                meeting_id: row.get(1)?,
                speaker_label: row.get(2)?,
                text: row.get(3)?,
                start_secs: row.get(4)?,
                end_secs: row.get(5)?,
                sequence: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(segments)
}

#[tauri::command]
pub fn update_segment(
    id: String,
    text: Option<String>,
    speaker_label: Option<String>,
    start_secs: Option<f64>,
    end_secs: Option<f64>,
    state: State<AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // ponytail: batch into single UPDATE like update_meeting does
    let mut sets: Vec<String> = Vec::new();
    let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(t) = text {
        sets.push(format!("text = ?{}", values.len() + 1));
        values.push(Box::new(t));
    }
    if let Some(s) = speaker_label {
        sets.push(format!("speaker_label = ?{}", values.len() + 1));
        values.push(Box::new(s));
    }
    if let Some(s) = start_secs {
        sets.push(format!("start_secs = ?{}", values.len() + 1));
        values.push(Box::new(s));
    }
    if let Some(e) = end_secs {
        sets.push(format!("end_secs = ?{}", values.len() + 1));
        values.push(Box::new(e));
    }

    if sets.is_empty() {
        return Ok(());
    }

    values.push(Box::new(id));
    let sql = format!(
        "UPDATE segments SET {} WHERE id = ?{}",
        sets.join(", "),
        values.len()
    );

    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
    db.execute(&sql, params.as_slice()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn rename_speaker(
    meeting_id: String,
    old_label: String,
    new_label: String,
    state: State<AppState>,
) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE segments SET speaker_label = ?1 WHERE meeting_id = ?2 AND speaker_label = ?3",
        params![new_label, meeting_id, old_label],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_segment(id: String, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute("DELETE FROM segments WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
