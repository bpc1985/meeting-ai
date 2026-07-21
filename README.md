# Meeting AI

Privacy-first desktop meeting transcription app for macOS. Record mic audio, transcribe via OpenAI Whisper or Gemini, edit transcripts, generate AI summaries, export to TXT/SRT. All data stored locally in SQLite.

## Features

- **Record** mic audio with pause/resume support
- **Import** audio files (WAV, MP3, M4A, AAC, OGG, FLAC, WebM)
- **Transcribe** via OpenAI Whisper or Gemini 2.5 Flash with automatic chunking for large files
- **Summarize** with Gemini — overview, key decisions, action items, risks
- **Search** full-text across all transcripts (FTS5)
- **Edit** transcripts inline with speaker renaming and undo
- **Export** to TXT and SRT via native save dialog
- **Privacy-first** — API keys in macOS keychain, all data local

## Prerequisites

- macOS (keychain dependency)
- Node.js 18+ and npm
- Rust toolchain (`rustup`)

## Quick Start

```bash
# Install dependencies
cd apps/desktop
npm install

# Development (hot reload)
npx tauri dev

# Run tests
npm test                    # Frontend tests (vitest)
cd src-tauri && cargo test  # Rust tests
```

## Commands

```bash
# From apps/desktop/
npm run dev              # Vite dev server (port 5173) — frontend only, Tauri APIs unavailable
npm run build            # Vite production build
npm run test             # vitest — 50 tests
npm run lint             # oxlint

# From apps/desktop/src-tauri/
cargo build              # Rust debug build
cargo test               # 4 Rust tests (merge_wav_files)
cargo build --release    # Production binary

# Full Tauri app
npx tauri dev            # Dev with hot reload
npx tauri build          # Production .app/.dmg bundle
```

## Architecture

```
apps/desktop/                  # Tauri + React app
├── src-tauri/                 # Rust backend
│   └── src/
│       ├── lib.rs             # App builder + command registration
│       ├── audio/             # cpal/hound recording + audio import
│       └── db/                # SQLite + FTS5 (models, CRUD, settings, search)
├── src/                       # React frontend
│   ├── routes/                # meeting-list, recording, meeting-detail, settings
│   ├── hooks/                 # TanStack Query hooks + useTranscription
│   ├── stores/                # Zustand (settings, meeting pagination)
│   └── components/            # ErrorBoundary, AppShell (sidebar layout)
packages/                      # Shared TypeScript packages
├── core/                      # Types + constants
├── speech/                    # STT providers, chunker, compressor, retry
├── llm/                       # Gemini summarization
└── export/                    # TXT + SRT formatters
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 |
| Frontend | React 19, TypeScript, Vite, TailwindCSS 4 |
| State | Zustand, TanStack Query |
| Backend | Rust (cpal, hound, rusqlite, chrono) |
| Database | SQLite with WAL + FTS5 |
| Security | macOS keychain (`security` CLI), CSP |
| Testing | vitest (frontend), cargo test (Rust) |
| Linting | oxlint |

## Settings

| Setting | Description |
|---------|-------------|
| Speech Provider | OpenAI Whisper or Gemini 2.5 Flash |
| OpenAI API Key | `sk-...` — stored in macOS keychain |
| Gemini API Key | `AIza...` — stored in macOS keychain |

Settings load on app startup. API keys are never stored in plaintext.

## License

MIT
