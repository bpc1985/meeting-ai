---
phase: 3
title: Audio Recording & Import
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 3: Audio Recording & Import

## Overview

Implement microphone recording using cpal + hound in Rust, exposed via Tauri commands (start/stop/pause). Pause implemented by stopping WAV + starting new file; WAV chunks merged on final stop. Support drag-and-drop import of existing audio files. Save recordings as 16-bit PCM mono WAV to `app_data_dir/audio/`.
<!-- Updated: Validation Session 1 - Pause via stop+merge pattern -->

## Requirements

- **Functional:** Record mic to WAV, pause/resume, stop. Display duration, waveform, mic level. Import WAV/MP3/M4A files via drag-drop or file dialog.
- **Non-functional:** WAV 16-bit PCM mono, 44.1kHz (or configurable). Robust error handling for missing mic permission. macOS TCC microphone prompt.

## Architecture

```
src-tauri/src/audio/
├── mod.rs          # Audio module, recording state
├── recorder.rs     # cpal + hound recording logic
└── import.rs       # File import validation + copy
```

### Recording Flow

```
[Frontend] -- tauri::command --> [Rust recorder] -- cpal --> [mic input stream]
                                      |
                                      v
                                 hound::WavWriter
                                      |
                                      v
                           app_data_dir/audio/{uuid}.wav
```

### Key Rust Types

```rust
use std::sync::{Arc, Mutex};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::WavWriter;
use std::path::PathBuf;

pub struct RecordingState {
    pub is_recording: bool,
    pub is_paused: bool,
    pub start_time: Option<std::time::Instant>,
    pub paused_duration: std::time::Duration,
    pub file_path: Option<PathBuf>,
    pub stream: Option<cpal::Stream>,
}

#[tauri::command]
fn start_recording(state: tauri::State<AppState>) -> Result<String, String> {
    let host = cpal::default_host();
    let device = host.default_input_device()
        .ok_or("No microphone found")?;
    let config = device.default_input_config()
        .map_err(|e| e.to_string())?;

    let file_path = state.audio_dir.join(format!("{}.wav", uuid::Uuid::new_v4()));
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: config.sample_rate().0,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let writer = Arc::new(Mutex::new(
        WavWriter::create(&file_path, spec).map_err(|e| e.to_string())?
    ));

    // ... build cpal stream, write samples in callback ...
    // Store RecordingState in AppState
}
```

### File Import

```rust
#[tauri::command]
fn import_audio(source_path: String, state: tauri::State<AppState>) -> Result<String, String> {
    // Validate file extension (wav, mp3, m4a)
    // Copy to app_data_dir/audio/{uuid}.{ext}
    // Return destination path
}
```

### Frontend Command Invocation

```typescript
// packages/core/src/commands/recording.ts
import { invoke } from '@tauri-apps/api/core';

export const startRecording = () => invoke<string>('start_recording');
export const pauseRecording = () => invoke<void>('pause_recording');
export const resumeRecording = () => invoke<void>('resume_recording');
export const stopRecording = () => invoke<void>('stop_recording');
export const importAudio = (path: string) => invoke<string>('import_audio', { sourcePath: path });
```

## Implementation Steps

1. Add `cpal = "0.15"` and `hound = "3.5"` to `Cargo.toml`
2. Create `audio/mod.rs` with module structure
3. Implement `audio/recorder.rs`:
   - `start_recording` command: get default input device, build WAV spec, create stream with sample callback
   - `stop_recording` command: drop stream, finalize WAV, merge pause chunks if any, return file path and duration
   - `pause_recording`: drop cpal stream, finalize current WAV chunk, push path to `chunks: Vec<PathBuf>`
   - `resume_recording`: create new WAV file, start new cpal stream, push path to chunks vec
   - `merge_wav_files(chunks: &[PathBuf], output: &Path)`: concatenate WAV data chunks into single final file (skip headers from subsequent files)
4. Implement `audio/import.rs`:
   - Validate file extension, copy to audio dir via `std::fs::copy`
   - Return destination path
5. Add `RecordingState` to `AppState`:
   ```rust
   pub struct AppState {
       pub db: Mutex<Connection>,
       pub audio_dir: PathBuf,
       pub recording: Mutex<RecordingState>,
   }
   ```
6. Register all audio commands in `lib.rs`
7. Create frontend command wrappers in `packages/core/src/commands/`
8. macOS: verify `NSMicrophoneUsageDescription` in `tauri.conf.json` bundle config
9. Test: start recording, speak, stop, verify WAV file created with valid audio

## Success Criteria

- [ ] Microphone recording produces valid WAV file (playable, non-zero audio)
- [ ] Pause/resume creates WAV chunks, merged into single file on stop (no gaps, no overlaps)
- [ ] Duration tracked accurately as total non-paused time (within 0.5s)
- [ ] Import copies audio file to app data directory
- [ ] No recording = clear error message (not crash)
- [ ] macOS: TCC microphone permission dialog appears on first record
- [ ] Windows/Linux: recording works without additional setup

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| cpal sample format mismatch (f32 vs i16) | Convert in callback: `(sample * i16::MAX as f32) as i16` |
| hound can't write after crash | Wrap WavWriter in Arc<Mutex<>>, finalize on stop/drop |
| No mic on headless systems | Return clear error string, display in UI |
| Large WAV files (>1GB for long meetings) | 16-bit mono 44.1kHz = ~10MB/min. 1-hour meeting = ~600MB. Acceptable for MVP; signal user if disk low |
