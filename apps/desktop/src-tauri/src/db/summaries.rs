use crate::db::models::Summary;
use crate::db::{now_iso, AppState};
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn create_summary(
    meeting_id: String,
    overview: String,
    key_decisions: String,
    action_items: String,
    risks: String,
    provider: Option<String>,
    model: Option<String>,
    state: State<AppState>,
) -> Result<Summary, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Delete existing summary for this meeting (replace on regenerate)
    db.execute(
        "DELETE FROM summaries WHERE meeting_id = ?1",
        params![meeting_id],
    )
    .map_err(|e| e.to_string())?;

    let id = uuid::Uuid::new_v4().to_string();
    let now = now_iso();
    let p = provider.unwrap_or_else(|| "gemini".into());
    let m = model.unwrap_or_else(|| "gemini-2.5-flash".into());

    db.execute(
        "INSERT INTO summaries (id, meeting_id, provider, model, overview, key_decisions, action_items, risks, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![id, meeting_id, p, m, overview, key_decisions, action_items, risks, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(Summary {
        id: id.clone(),
        meeting_id,
        provider: p,
        model: Some(m),
        overview: Some(overview),
        key_decisions: Some(key_decisions),
        action_items: Some(action_items),
        risks: Some(risks),
        created_at: now,
    })
}

#[tauri::command]
pub fn get_summary(meeting_id: String, state: State<AppState>) -> Result<Option<Summary>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let result = db.query_row(
        "SELECT id, meeting_id, provider, model, overview, key_decisions, action_items, risks, created_at
         FROM summaries WHERE meeting_id = ?1 ORDER BY created_at DESC LIMIT 1",
        params![meeting_id],
        |row| {
            Ok(Summary {
                id: row.get(0)?,
                meeting_id: row.get(1)?,
                provider: row.get(2)?,
                model: row.get(3)?,
                overview: row.get(4)?,
                key_decisions: row.get(5)?,
                action_items: row.get(6)?,
                risks: row.get(7)?,
                created_at: row.get(8)?,
            })
        },
    );

    match result {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}
