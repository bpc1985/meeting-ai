use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Meeting {
    pub id: String,
    pub title: String,
    pub audio_path: Option<String>,
    pub duration_secs: Option<f64>,
    pub created_at: String,
    pub updated_at: String,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Segment {
    pub id: String,
    pub meeting_id: String,
    pub speaker_label: String,
    pub text: String,
    pub start_secs: f64,
    pub end_secs: f64,
    pub sequence: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Summary {
    pub id: String,
    pub meeting_id: String,
    pub provider: String,
    pub model: Option<String>,
    pub overview: Option<String>,
    pub key_decisions: Option<String>,
    pub action_items: Option<String>,
    pub risks: Option<String>,
    pub created_at: String,
}

pub struct SearchResult {
    pub id: String,
    pub title: String,
    pub created_at: String,
    pub snippet: String,
    pub speaker_label: String,
}
