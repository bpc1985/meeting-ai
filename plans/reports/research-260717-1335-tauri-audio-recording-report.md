# Research: Tauri v2 Audio Recording for Meeting Transcription

Date: 2026-07-17 | Scope: mic capture → WAV → transcription pipeline on desktop

## 1. Plugin / Library Landscape

| Option | Type | Verdict |
|--------|------|---------|
| `tauri-plugin-audio` | Community crate | Exists as a name but no stable, maintained Tauri v2 audio-capture plugin. Not recommended. |
| `cpal` | Audio I/O lib (RustAudio) | **Primary choice.** Cross-platform (macOS/Windows/Linux) low-level audio capture. Mature, widely used. |
| `symphonia` | Decode/encode media | **Wrong tool for capture.** Pure Rust media (codec/container) demux/dec/enc. Not for mic input. Skip for recording; only relevant if you later decode compressed meeting files. |
| `hound` | WAV codec | **Use for WAV.** Minimal, correct WAV writer/reader. De-facto std for raw→WAV. |
| `rubato` | Resampling | Optional: cpal may not give your target sample rate exactly; resample if model needs fixed rate. |

**No official Tauri v2 audio/mic plugin exists.** Tauri's official plugin set (fs, http, shell, etc.) has no audio capture. Recording is done by calling `cpal` directly from the Rust backend behind a Tauri command — Tauri is just the window/runtime shell.

## 2. Capture Mic + Save WAV (Rust backend)

Canonical pattern (cpal `record_wav.rs` example + hound):
```
1. host = cpal::default_host()
2. device = host.default_input_device()  // or enumerate & pick
3. config = device.default_input_config()  // gives sample_rate, channels, sample_format (often f32/i16)
4. WavWriter::create(path, WavSpec{channels, sample_rate, bits_per_sample, SampleFormat::Int})
5. stream = device.build_input_stream(&config, |data, _| write samples to WavWriter, err_cb, None)
6. stream.play(); record for N sec; drop(stream) → flush/clip WAV
```
Expose a Tauri command (`#[tauri::command] fn start_recording(path)`) that spawns this on a thread and returns a handle/stop signal. Frontend triggers via `invoke()`.

## 3. Format Handling

- **Sample format:** cpal default is commonly `f32` (or `i16`). Convert to `i16` for WAV (`bits_per_sample: 16`). Whisper/most ASR wants 16kHz mono 16-bit PCM.
- **Sample rate:** capture native (e.g. 44.1k/48k), then resample to 16k with `rubato` if target model requires it. Don't trust device to support 16k directly.
- **Channels:** request mono (`config.channels()` → sum/avg to 1) for transcription; smaller files, better ASR.
- **WAV:** `hound` writes standard PCM WAV. No compression — fine for short meetings; transcribe then delete.

## 4. Platform Considerations

| Platform | Mic permission | Notes |
|----------|---------------|-------|
| **macOS** | **Required.** Add `NSMicrophoneUsageDescription` to `Info.plist` (Tauri: `tauri.conf.json` → `bundle.macOS.info.plist` or `src-tauri/Info.plist`). System TCC prompt appears on first capture. Without it, capture silently fails/hangs. |
| **Windows** | Generally none for desktop app (mic access governed by OS settings, not manifest). |
| **Linux** | Needs PulseAudio/ALSA runtime; may need `pulseaudio` present. PipeWire usually works via ALSA compat. |

macOS is the main friction point — get the `Info.plist` key in before testing or you'll debug a phantom failure.

## 5. Examples / Templates

- cpal repo `examples/record_wav.rs` — reference implementation (cpal + hound).
- No turnkey "Tauri meeting recorder" template found; pattern is cpal-in-command + React/Vue frontend.
- tauri-apps official plugins: no audio. Build your own thin command wrapper.

## Recommendation (ranked)

1. **cpal + hound in a Tauri command** — only path that works today. Minimal deps, correct WAV, cross-platform.
2. Add `rubato` only when ASR needs fixed 16k — skip until proven.
3. Skip `tauri-plugin-audio` (unmaintained/immature) and `symphonia` (decode-only, not for capture).

## Limitations / Unresolved
- Could not verify `tauri-plugin-audio`/`tauri-plugin-mic` crate maturity via crates.io (fetch returned generic homepage). Re-check at implementation time.
- Did not benchmark cpal callback latency or test actual macOS TCC prompt behavior.
- ASR target sample rate/format assumed (16k mono 16-bit) — confirm against chosen transcription model.
- No investigation of speaker separation / system-audio (meeting app may need loopback capture, which cpal supports only on some platforms).

Sources:
- [cpal (RustAudio)](https://github.com/RustAudio/cpal) — input stream API, record_wav example
- [hound crate docs](https://docs.rs/hound/latest/hound/) — WAV writer API
- [Tauri v2 Plugins](https://v2.tauri.app/plugin/) — no official audio plugin
- [Apple AVFoundation capture authorization](https://developer.apple.com/documentation/avfoundation/requesting_authorization_to_access_capture_devices) — NSMicrophoneUsageDescription / TCC
