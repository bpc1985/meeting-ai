
use crate::db::AppState;
use rusqlite::params;
use std::process::Command;
use tauri::State;

#[tauri::command]
pub fn get_setting(key: String, state: State<AppState>) -> Result<Option<String>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let result = db.query_row(
        "SELECT value FROM settings WHERE key = ?1",
        params![key],
        |row| row.get::<_, String>(0),
    );
    match result {
        Ok(v) => Ok(Some(v)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_setting(key: String, value: String, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Store an API key in the macOS keychain.
/// Uses the `security` CLI — macOS only.
#[tauri::command]
pub fn store_key_in_keychain(service: String, account: String, key: String) -> Result<(), String> {
    let output = Command::new("security")
        .args([
            "add-generic-password",
            "-s", &service,
            "-a", &account,
            "-w", &key,
            "-U",
        ])
        .output()
        .map_err(|e| format!("security CLI failed: {}", e))?;

    if !output.status.success() {
        // Entry may already exist — delete and retry
        let _ = Command::new("security")
            .args([
                "delete-generic-password",
                "-s", &service,
                "-a", &account,
            ])
            .output();

        let retry = Command::new("security")
            .args([
                "add-generic-password",
                "-s", &service,
                "-a", &account,
                "-w", &key,
                "-U",
            ])
            .output()
            .map_err(|e| format!("security CLI failed: {}", e))?;

        if !retry.status.success() {
            let stderr = String::from_utf8_lossy(&retry.stderr);
            return Err(format!("Keychain store failed: {}", stderr));
        }
    }
    Ok(())
}

/// Retrieve an API key from the macOS keychain.
/// Returns None if the entry doesn't exist.
#[tauri::command]
pub fn get_key_from_keychain(service: String, account: String) -> Result<Option<String>, String> {
    let output = Command::new("security")
        .args([
            "find-generic-password",
            "-s", &service,
            "-a", &account,
            "-w",
        ])
        .output()
        .map_err(|e| format!("security CLI failed: {}", e))?;

    if output.status.success() {
        let key = String::from_utf8_lossy(&output.stdout).trim().to_string();
        Ok(Some(key))
    } else {
        Ok(None)
    }
}
