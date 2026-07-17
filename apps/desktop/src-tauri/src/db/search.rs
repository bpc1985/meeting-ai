use crate::db::models::SearchResult;
use crate::db::AppState;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn search_meetings(query: String, state: State<AppState>) -> Result<Vec<SearchResult>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Escape FTS5 special chars and add prefix matching
    let escaped = query.replace(|c: char| !c.is_alphanumeric() && c != ' ', " ");
    let fts_query = format!("{}*", escaped.trim());

    let mut stmt = db
        .prepare(
            "SELECT m.id, m.title, m.created_at,
                    snippet(segments_fts, 0, '<mark>', '</mark>', '...', 32) as snip,
                    s.speaker_label
             FROM segments_fts fts
             JOIN segments s ON fts.rowid = s.rowid
             JOIN meetings m ON s.meeting_id = m.id
             WHERE segments_fts MATCH ?1
             GROUP BY m.id
             ORDER BY rank
             LIMIT 20",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(params![fts_query], |row| {
            Ok(SearchResult {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                snippet: row.get(3)?,
                speaker_label: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}
