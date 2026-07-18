use crate::db::models::SearchResult;
use crate::db::AppState;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn search_meetings(query: String, state: State<AppState>) -> Result<Vec<SearchResult>, String> {
    // Guard: empty or whitespace-only query returns empty results
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let db = state.db.lock().map_err(|e| e.to_string())?;

    // Escape FTS5 special chars and add prefix matching
    let escaped = trimmed.replace(|c: char| !c.is_alphanumeric() && c != ' ', " ");
    let escaped_trimmed = escaped.trim();
    // If after escaping there's nothing left, return empty
    if escaped_trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let fts_query = format!("{}*", escaped_trimmed);

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

#[cfg(test)]
mod tests {
    use crate::db::test_db;
    use rusqlite::params;

    fn setup_search_data(db: &rusqlite::Connection) {
        db.execute("INSERT INTO meetings (id, title, created_at, updated_at, status) VALUES (?1, ?2, ?3, ?4, ?5)",
            params!["m1", "Sprint Planning", "2024-01-01T00:00:00Z", "2024-01-01T00:00:00Z", "transcribed"]).unwrap();
        db.execute("INSERT INTO segments (id, meeting_id, speaker_label, text, start_secs, end_secs, sequence) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params!["s1", "m1", "Alice", "We need to refactor the auth module", 0.0, 5.0, 0]).unwrap();
        db.execute("INSERT INTO segments (id, meeting_id, speaker_label, text, start_secs, end_secs, sequence) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params!["s2", "m1", "Bob", "And add tests for the database layer", 5.0, 10.0, 1]).unwrap();
    }

    #[test]
    fn search_matches_text() {
        let db = test_db();
        setup_search_data(&db);
        let mut stmt = db.prepare(
            "SELECT m.id FROM segments_fts fts JOIN segments s ON fts.rowid = s.rowid JOIN meetings m ON s.meeting_id = m.id WHERE segments_fts MATCH ?1 GROUP BY m.id"
        ).unwrap();
        let ids: Vec<String> = stmt.query_map(params!["refactor*"], |row| row.get(0)).unwrap().map(|r| r.unwrap()).collect();
        assert_eq!(ids, vec!["m1"]);
    }

    #[test]
    fn search_prefix_matches() {
        let db = test_db();
        setup_search_data(&db);
        let mut stmt = db.prepare(
            "SELECT m.id FROM segments_fts fts JOIN segments s ON fts.rowid = s.rowid JOIN meetings m ON s.meeting_id = m.id WHERE segments_fts MATCH ?1 GROUP BY m.id"
        ).unwrap();
        let ids: Vec<String> = stmt.query_map(params!["database*"], |row| row.get(0)).unwrap().map(|r| r.unwrap()).collect();
        assert_eq!(ids, vec!["m1"]);
    }

    #[test]
    fn search_no_match_returns_empty() {
        let db = test_db();
        setup_search_data(&db);
        let mut stmt = db.prepare(
            "SELECT m.id FROM segments_fts fts JOIN segments s ON fts.rowid = s.rowid JOIN meetings m ON s.meeting_id = m.id WHERE segments_fts MATCH ?1 GROUP BY m.id"
        ).unwrap();
        let ids: Vec<String> = stmt.query_map(params!["nonexistent*"], |row| row.get(0)).unwrap().map(|r| r.unwrap()).collect();
        assert_eq!(ids.len(), 0);
    }
}
