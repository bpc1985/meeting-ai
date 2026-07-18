mod audio;
mod db;

use db::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");

            let audio_dir = app_data_dir.join("audio");
            std::fs::create_dir_all(&audio_dir).expect("failed to create audio dir");

            let conn = db::init_db(&app_data_dir).expect("failed to initialize database");

            app.manage(AppState::new(conn, audio_dir));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // meetings
            db::meetings::create_meeting,
            db::meetings::get_meeting,
            db::meetings::list_meetings,
            db::meetings::update_meeting,
            db::meetings::delete_meeting,
            // segments
            db::segments::create_segments_batch,
            db::segments::get_segments,
            db::segments::update_segment,
            db::segments::rename_speaker,
            db::segments::delete_segment,
            // summaries
            db::summaries::create_summary,
            db::summaries::get_summary,
            // settings
            db::settings::get_setting,
            db::settings::set_setting,
            db::settings::store_key_in_keychain,
            db::settings::get_key_from_keychain,
            // search
            db::search::search_meetings,
            // audio recording
            audio::recorder::start_recording,
            audio::recorder::pause_recording,
            audio::recorder::resume_recording,
            audio::recorder::stop_recording,
            // audio import
            audio::import::import_audio,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
