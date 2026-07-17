use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use hound::{SampleFormat, WavSpec, WavWriter};
use std::fs::File;
use std::io::{BufWriter, Read, Write};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::State;

use crate::db::AppState;

// ponytail: cpal::Stream is not Send on macOS (CoreAudio callbacks).
// All recording access is serialized through RecordingState's Mutex,
// so wrapping with unsafe Send is safe — no concurrent stream access.
pub struct SendStream(pub Option<cpal::Stream>);
unsafe impl Send for SendStream {}

pub struct RecordingState {
    pub is_recording: bool,
    pub is_paused: bool,
    pub active_path: Option<PathBuf>,
    pub chunk_paths: Vec<PathBuf>,
    pub start_time: Option<std::time::Instant>,
    pub paused_duration: std::time::Duration,
    pub stream: SendStream,
}

impl Default for RecordingState {
    fn default() -> Self {
        Self {
            is_recording: false,
            is_paused: false,
            active_path: None,
            chunk_paths: Vec::new(),
            start_time: None,
            paused_duration: std::time::Duration::ZERO,
            stream: SendStream(None),
        }
    }
}

#[tauri::command]
pub fn start_recording(state: State<AppState>) -> Result<String, String> {
    let mut rec = state.recording.lock().map_err(|e| e.to_string())?;
    if rec.is_recording {
        return Err("Already recording".into());
    }

    let host = cpal::default_host();
    let device = host.default_input_device().ok_or("No microphone found")?;
    let config = device.default_input_config().map_err(|e| e.to_string())?;

    let file_path = state.audio_dir.join(format!("{}.wav", uuid::Uuid::new_v4()));
    let spec = WavSpec {
        channels: 1,
        sample_rate: config.sample_rate().0,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    // ponytail: BufWriter around File for better write perf
    let file = BufWriter::new(File::create(&file_path).map_err(|e| e.to_string())?);
    let writer = Arc::new(Mutex::new(Some(
        WavWriter::new(file, spec).map_err(|e| e.to_string())?,
    )));

    let writer_clone = writer.clone();
    let err_fn = |err| eprintln!("cpal stream error: {}", err);

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device
            .build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut guard) = writer_clone.lock() {
                        if let Some(ref mut w) = *guard {
                            for &sample in data {
                                let as_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                                // ponytail: ignore individual sample write errors — file stays open
                                let _ = w.write_sample(as_i16);
                            }
                        }
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| e.to_string())?,
        cpal::SampleFormat::I16 => device
            .build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut guard) = writer_clone.lock() {
                        if let Some(ref mut w) = *guard {
                            for &sample in data {
                                let _ = w.write_sample(sample);
                            }
                        }
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| e.to_string())?,
        _ => return Err("Unsupported sample format".into()),
    };

    stream.play().map_err(|e| e.to_string())?;

    rec.is_recording = true;
    rec.is_paused = false;
    rec.active_path = Some(file_path.clone());
    rec.chunk_paths = vec![file_path.clone()];
    rec.start_time = Some(std::time::Instant::now());
    rec.paused_duration = std::time::Duration::ZERO;
    rec.stream.0 = Some(stream);
    // ponytail: store writer in recording state so it lives as long as the stream
    // Don't impl Clone for WavWriter, just keep it alive via the stream callback's Arc

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn pause_recording(state: State<AppState>) -> Result<(), String> {
    let mut rec = state.recording.lock().map_err(|e| e.to_string())?;
    if !rec.is_recording || rec.is_paused {
        return Err("Not recording or already paused".into());
    }

    // Drop the stream (this finalizes the current WAV chunk)
    if let Some(stream) = rec.stream.0.take() {
        drop(stream);
    }

    if let Some(start) = rec.start_time {
        rec.paused_duration += start.elapsed();
    }
    rec.start_time = None;
    rec.is_paused = true;
    Ok(())
}

#[tauri::command]
pub fn resume_recording(state: State<AppState>) -> Result<(), String> {
    let mut rec = state.recording.lock().map_err(|e| e.to_string())?;
    if !rec.is_recording || !rec.is_paused {
        return Err("Not paused".into());
    }

    // Create new WAV chunk
    let file_path = state.audio_dir.join(format!("{}.wav", uuid::Uuid::new_v4()));

    let host = cpal::default_host();
    let device = host.default_input_device().ok_or("No microphone found")?;
    let config = device.default_input_config().map_err(|e| e.to_string())?;

    let spec = WavSpec {
        channels: 1,
        sample_rate: config.sample_rate().0,
        bits_per_sample: 16,
        sample_format: SampleFormat::Int,
    };

    let file = BufWriter::new(File::create(&file_path).map_err(|e| e.to_string())?);
    let writer = Arc::new(Mutex::new(Some(
        WavWriter::new(file, spec).map_err(|e| e.to_string())?,
    )));

    let writer_clone = writer.clone();
    let err_fn = |err| eprintln!("cpal stream error: {}", err);

    let stream = match config.sample_format() {
        cpal::SampleFormat::F32 => device
            .build_input_stream(
                &config.into(),
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut guard) = writer_clone.lock() {
                        if let Some(ref mut w) = *guard {
                            for &sample in data {
                                let as_i16 = (sample.clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
                                let _ = w.write_sample(as_i16);
                            }
                        }
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| e.to_string())?,
        cpal::SampleFormat::I16 => device
            .build_input_stream(
                &config.into(),
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut guard) = writer_clone.lock() {
                        if let Some(ref mut w) = *guard {
                            for &sample in data {
                                let _ = w.write_sample(sample);
                            }
                        }
                    }
                },
                err_fn,
                None,
            )
            .map_err(|e| e.to_string())?,
        _ => return Err("Unsupported sample format".into()),
    };

    stream.play().map_err(|e| e.to_string())?;

    rec.chunk_paths.push(file_path.clone());
    rec.active_path = Some(file_path);
    rec.stream.0 = Some(stream);
    rec.start_time = Some(std::time::Instant::now());
    rec.is_paused = false;
    Ok(())
}

#[tauri::command]
pub fn stop_recording(state: State<AppState>) -> Result<StopResult, String> {
    let mut rec = state.recording.lock().map_err(|e| e.to_string())?;
    if !rec.is_recording {
        return Err("Not recording".into());
    }

    // Drop stream to finalize current WAV
    if let Some(stream) = rec.stream.0.take() {
        drop(stream);
    }

    if !rec.is_paused {
        if let Some(start) = rec.start_time {
            rec.paused_duration += start.elapsed();
        }
    }

    let total_duration = rec.paused_duration.as_secs_f64();
    let chunk_paths = std::mem::take(&mut rec.chunk_paths);

    // Merge chunks if more than one
    let final_path = if chunk_paths.len() > 1 {
        let merged_path = state.audio_dir.join(format!("{}.wav", uuid::Uuid::new_v4()));
        merge_wav_files(&chunk_paths, &merged_path)?;
        // Delete individual chunks after merge
        for p in &chunk_paths {
            let _ = std::fs::remove_file(p);
        }
        merged_path.to_string_lossy().to_string()
    } else {
        chunk_paths
            .first()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default()
    };

    // Reset state
    rec.is_recording = false;
    rec.is_paused = false;
    rec.active_path = None;
    rec.start_time = None;
    rec.paused_duration = std::time::Duration::ZERO;

    Ok(StopResult {
        file_path: final_path,
        duration_secs: total_duration,
    })
}

fn merge_wav_files(chunks: &[PathBuf], output: &PathBuf) -> Result<(), String> {
    if chunks.is_empty() {
        return Err("No chunks to merge".into());
    }

    let mut output_file = File::create(output).map_err(|e| e.to_string())?;

    let mut first = true;
    let mut wav_header = Vec::new();
    let mut data_size: u32 = 0;

    for (i, chunk_path) in chunks.iter().enumerate() {
        let mut file = File::open(chunk_path).map_err(|e| e.to_string())?;
        let mut all_bytes = Vec::new();
        file.read_to_end(&mut all_bytes).map_err(|e| e.to_string())?;

        if all_bytes.len() < 44 {
            return Err(format!("Chunk {} too small to be valid WAV", i));
        }

        // WAV header is 44 bytes; data starts at byte 44
        if first {
            // Write header from first chunk (with placeholder data size)
            wav_header = all_bytes[..44].to_vec();
            first = false;
        }

        // Write audio data (skip 44-byte header)
        let audio_data = &all_bytes[44..];
        output_file
            .write_all(audio_data)
            .map_err(|e| e.to_string())?;
        data_size += audio_data.len() as u32;
    }

    // Now update the WAV header with correct data size
    // ponytail: WAV header bytes 4-7 = overall file size - 8, bytes 40-43 = data size
    let file_size = 44 + data_size;
    wav_header[4..8].copy_from_slice(&(file_size - 8).to_le_bytes());
    wav_header[40..44].copy_from_slice(&data_size.to_le_bytes());

    // Write header at beginning
    let mut final_file = File::create(output).map_err(|e| e.to_string())?;
    final_file.write_all(&wav_header).map_err(|e| e.to_string())?;

    // Re-read and re-write all audio data
    for chunk_path in chunks {
        let mut file = File::open(chunk_path).map_err(|e| e.to_string())?;
        let mut audio = Vec::new();
        file.read_to_end(&mut audio).map_err(|e| e.to_string())?;
        if audio.len() > 44 {
            final_file
                .write_all(&audio[44..])
                .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[derive(serde::Serialize, Clone)]
pub struct StopResult {
    pub file_path: String,
    pub duration_secs: f64,
}
