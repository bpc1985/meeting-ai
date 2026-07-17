use rusqlite_migration::{Migrations, M};

pub fn get_migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(
            "CREATE TABLE meetings (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                audio_path TEXT,
                duration_secs REAL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'draft'
            ) STRICT;"
        ),
        M::up(
            "CREATE TABLE segments (
                id TEXT PRIMARY KEY,
                meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
                speaker_label TEXT NOT NULL DEFAULT 'Speaker 1',
                text TEXT NOT NULL,
                start_secs REAL NOT NULL,
                end_secs REAL NOT NULL,
                sequence INTEGER NOT NULL
            ) STRICT;"
        ),
        M::up(
            "CREATE VIRTUAL TABLE segments_fts USING fts5(
                text, speaker_label,
                content='segments', content_rowid='rowid'
            );"
        ),
        M::up(
            "CREATE TABLE summaries (
                id TEXT PRIMARY KEY,
                meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
                provider TEXT NOT NULL DEFAULT 'gemini',
                model TEXT,
                overview TEXT,
                key_decisions TEXT,
                action_items TEXT,
                risks TEXT,
                created_at TEXT NOT NULL
            ) STRICT;"
        ),
        M::up(
            "CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            ) STRICT;"
        ),
        M::up(
            "CREATE INDEX idx_segments_meeting ON segments(meeting_id, sequence);"
        ),
        M::up(
            "CREATE INDEX idx_summaries_meeting ON summaries(meeting_id);"
        ),
        // Rebuild FTS triggers after initial create
        M::up(
            "CREATE TRIGGER segments_ai AFTER INSERT ON segments BEGIN
                INSERT INTO segments_fts(rowid, text, speaker_label)
                VALUES (new.rowid, new.text, new.speaker_label);
            END;"
        ),
        M::up(
            "CREATE TRIGGER segments_ad AFTER DELETE ON segments BEGIN
                INSERT INTO segments_fts(segments_fts, rowid, text, speaker_label)
                VALUES ('delete', old.rowid, old.text, old.speaker_label);
            END;"
        ),
        M::up(
            "CREATE TRIGGER segments_au AFTER UPDATE ON segments BEGIN
                INSERT INTO segments_fts(segments_fts, rowid, text, speaker_label)
                VALUES ('delete', old.rowid, old.text, old.speaker_label);
                INSERT INTO segments_fts(rowid, text, speaker_label)
                VALUES (new.rowid, new.text, new.speaker_label);
            END;"
        ),
    ])
}
