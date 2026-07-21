# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Meeting AI — privacy-first desktop meeting transcription app. Record mic audio, transcribe via OpenAI Whisper or Gemini, edit transcripts, generate AI summaries, export to TXT/SRT. All data stored locally in SQLite.

**Stack:** Tauri v2 + React 19 + TypeScript + Vite + TailwindCSS 4 + Rust (cpal/hound/rusqlite)

## Essential commands

```bash
# From apps/desktop/src-tauri/
cargo build              # Rust build (cargo on PATH at ~/.cargo/bin/cargo)
cargo test               # 4 Rust tests (merge_wav_files)
cargo build --release    # Production binary

# From apps/desktop/
npm run dev              # Vite dev server (port 5173)
npm run build            # Vite production build
npm run test             # vitest — 4 chunker tests
npm run lint             # oxlint
npx tauri dev            # Full Tauri app with hot reload
npx tauri build          # Production .app/.dmg bundle
```

No CI. All gates run locally. No git remote configured — `git push` will fail until one is added.

## Architecture

```
apps/desktop/                  # Tauri + React app
├── src-tauri/                 # Rust backend
│   └── src/
│       ├── lib.rs             # Tauri builder + command registration + AppState setup
│       ├── main.rs            # Binary entry point
│       ├── audio/
│       │   ├── recorder.rs    # cpal + hound recording (start/pause/resume/stop + WAV merge)
│       │   └── import.rs      # Audio file import with format validation
│       └── db/
│           ├── mod.rs         # AppState struct + init_db + shared now_iso()
│           ├── migrations.rs  # SQL schema + FTS5 triggers
│           ├── models.rs      # Meeting, Segment, Summary, SearchResult structs
│           ├── meetings.rs    # CRUD with dynamic partial UPDATE
│           ├── segments.rs    # CRUD + batch INSERT (transactional) + speaker rename
│           ├── summaries.rs   # Create (replace-on-regenerate) + get
│           ├── settings.rs    # Key-value store + keychain commands (macOS security CLI)
│           └── search.rs      # FTS5 search with snippet highlighting
├── src/                       # React frontend
│   ├── App.tsx                # Route tree wrapped in ErrorBoundary
│   ├── components/
│   │   ├── error-boundary.tsx # Crash fallback with reload
│   │   └── layout/app-shell.tsx # Sidebar + outlet layout
│   ├── routes/                # 4 pages: meeting-list, recording, meeting-detail, settings
│   ├── hooks/                 # TanStack Query hooks: useMeetings, useSegments, useRecording, etc.
│   ├── stores/                # Zustand: meetingStore (search query + pagination offset), settingsStore
│   └── lib/format.ts          # Shared fmtDuration, fmtTimestamp
packages/                      # Shared TypeScript packages (resolved via tsconfig paths)
├── core/src/                  # Shared types (Meeting, TranscriptSegment) + GEMINI_MODEL constant
├── speech/src/                # STT providers (Whisper, Gemini), chunker, compressor, retry, shared extractJson
├── llm/src/                   # LLM summarization (Gemini provider + prompt template)
└── export/src/                # TXT and SRT formatters
```

## Key patterns

**Rust:**
- All commands in `generate_handler!` macro in lib.rs — register new commands there
- AppState holds `db: Mutex<Connection>`, `audio_dir: PathBuf`, `recording: Mutex<RecordingState>`, `app_handle: AppHandle`
- SQLite with WAL, foreign_keys, busy_timeout=5000ms pragmas
- Recording pauses via stop WAV + merge on resume (`merge_wav_files` in recorder.rs)
- cpal Stream is NOT Send on macOS — uses `SendStream` wrapper with `unsafe impl Send`
- Keychain commands shell to macOS `security` CLI (macOS-only)

**TypeScript:**
- All Tauri commands invoked via `invoke<T>(cmd, args)` from `@tauri-apps/api/core`
- Zustand stores for client state, TanStack Query for server state (staleTime: 30s, retry: 1)
- Settings loaded on app startup via `useLoadSettings()` in `AppShell` — API keys fetched from keychain before any page renders
- Settings load: detect `keychain:` marker → fetch from keychain, backward compat for plaintext
- Settings save: API keys go to keychain via `store_key_in_keychain`, DB gets `keychain:` marker
- CSS: Tailwind v4 via `@tailwindcss/vite`, design tokens in `globals.css` `@theme` block
- Fonts: local TTF files in `assets/fonts/` (Lexend + Atkinson Hyperlegible), `@font-face` in globals.css
- Playback: `readFile` via Tauri FS → `Blob` with extension-derived MIME → `URL.createObjectURL` → `<audio>` element

**Tauri FS permissions (`capabilities/default.json`):**
- `fs:default` + `fs:allow-stat` + `fs:allow-create` + `fs:allow-read-file` + `fs:allow-write-file`
- Scoped: `fs:scope-document-recursive` (audio dir), `fs:scope-appcache-recursive` (compressed files), `fs:scope-appdata-recursive` (DB), `fs:scope-temp-recursive` (chunks)

**Transcription overlay (`meeting-detail.tsx`):**
- 3 phases: "Preparing audio…" (compression) → "Sending to API…" (single-shot) / "Chunk N/M (X%)" (chunked)
- Centered overlay with `backdrop-blur-sm` blocks all interactions during transcription

**Audio pipeline:**
1. `start_recording` → cpal captures mic → hound writes WAV chunks
2. On stop → `merge_wav_files` concatenates chunks, writes final WAV with correct header
3. Import (`import.rs`): 7 formats (WAV, MP3, M4A, AAC, OGG, FLAC, WebM) — copied to `~/Documents/meeting-ai/audio/`, symlinks rejected, orphan cleanup on DB failure
4. Frontend `useTranscription` → `transcribeWithChunking` → `compressAudio` → provider-specific API call
   - WAV/FLAC: decoded + re-encoded to WebM Opus via MediaRecorder (64kbps mono)
   - MP3/M4A/AAC/OGG/WebM: pass through as-is (no re-encode)
   - Returns `{ path: string; size: number }` — size used for chunk decision
5. Whisper: FormData POST to `/v1/audio/transcriptions` with `verbose_json` + segment timestamps
6. Gemini: `generateContent` with `inlineData` (base64), `x-goog-api-key` header auth
7. Chunker: RMS silence detection in 100ms windows → split at silence gaps → transcribe chunks in parallel
   - Single-shot (< ~50 min): `onProgress(1, 1)` called once — overlay shows "Sending to API…"
   - Chunked: `onProgress(N, total)` per chunk — overlay shows "Chunk N/M (X%)" with progress bar

**DB schema (6 tables):** meetings, segments, segments_fts (FTS5 virtual), summaries, settings. FTS triggers on INSERT/DELETE/UPDATE for segments_fts.

## File conventions

- Kebab-case for JS/TS files
- Snake_case for Rust files
- Shared code: `packages/speech/src/json.ts` (extractJson), `packages/core/src/constants.ts` (GEMINI_MODEL), `apps/desktop/src/lib/format.ts` (fmtDuration/fmtTimestamp), `db/mod.rs` (now_iso)
- Ponytail comments (`// ponytail: ...`) mark deliberate simplifications and their upgrade paths

## CSP

`tauri.conf.json` has Content Security Policy — if adding new API endpoints, update `connect-src`. Google Fonts removed (fonts are local). Current policy: `default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' ipc: http://ipc.localhost https://api.openai.com https://generativelanguage.googleapis.com`
