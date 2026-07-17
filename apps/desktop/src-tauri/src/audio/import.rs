use crate::db::AppState;
use std::path::Path;
use tauri::State;

#[tauri::command]
pub fn import_audio(source_path: String, state: State<AppState>) -> Result<String, String> {
    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("Source file does not exist".into());
    }

    let ext = source
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let allowed = ["wav", "mp3", "m4a", "aac", "ogg", "flac", "webm"];
    if !allowed.contains(&ext.as_str()) {
        return Err(format!("Unsupported file format: .{}", ext));
    }

    let dest = state
        .audio_dir
        .join(format!("{}.{}", uuid::Uuid::new_v4(), ext));

    std::fs::copy(&source, &dest).map_err(|e| e.to_string())?;

    Ok(dest.to_string_lossy().to_string())
}
