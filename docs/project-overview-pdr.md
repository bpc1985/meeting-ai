# Project Overview & Product Development Requirements (PDR)

## Overview

Meeting AI is a desktop application (Tauri v2 + React 19 + Rust) that records meetings, transcribes via OpenAI Whisper or Gemini, generates AI summaries, and lets users edit/export transcripts. All data stored locally in SQLite. Privacy-first — no cloud sync, API keys in platform keychain. CI builds for macOS, Windows, and Linux.

## Goals

- Capture mic audio with low overhead (cpal + hound WAV).
- Transcribe via pluggable providers (Whisper, Gemini speech) with automatic chunking for large files.
- Generate AI meeting summaries (Gemini 2.5 Flash) with overview, key decisions, action items, risks.
- Searchable, editable transcripts with speaker renaming.
- Export to TXT and SRT.
- Keep API keys secure (macOS keychain, no plaintext).
- Fully offline font rendering (no CDN dependency).

## Non-Goals (current scope)

- Keychain abstraction for non-macOS platforms (macOS `security` CLI only — Windows/Linux builds exist but key storage falls back to DB).
- Cross-compilation from a single host (build per-platform via CI).
- Real-time streaming transcription (record-then-transcribe flow).
- System audio capture (mic only).
- Speaker diarization.
- Cloud sync / multi-device.
- Light mode toggle (dark mode only).

## Architecture

```
apps/desktop/src          React UI (routes, hooks, components, stores, lib)
apps/desktop/src-tauri    Rust backend: audio capture (cpal/hound), DB (rusqlite + FTS5), Tauri commands
packages/core             Shared types + constants (GEMINI_MODEL)
packages/speech            STT providers (Whisper, Gemini), chunker, compressor, retry, shared extractJson
packages/llm              LLM summarization (Gemini provider + prompt)
packages/export           TXT + SRT formatters
```

### Key Flows

- **Recording**: `recorder.rs` captures via cpal → hound writes WAV chunks → `merge_wav_files` concatenates on stop. Pause stops WAV, resume starts new WAV.
- **Transcription**: `useTranscription` hook → `transcribeWithChunking` → `compressAudio` (WebM Opus via MediaRecorder) → silence-based chunking for files >25MB → provider-specific API call.
- **Summary**: `useSummary` → `GeminiProvider.summarize` with `withRetry`, stores result in DB, updates meeting status.
- **Storage**: Local SQLite with WAL pragmas, FTS5 full-text search, key-value settings table.
- **Security**: API keys → macOS keychain (DB stores `keychain:` marker), Gemini auth via `x-goog-api-key` header, CSP enforced.

## Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-1 | Record mic audio and merge chunks into a single WAV | Done |
| FR-2 | Transcribe via chunked silence-based splitting (>25MB support) | Done |
| FR-3 | Pluggable providers: Gemini speech, OpenAI Whisper | Done |
| FR-4 | Store transcripts + settings in local SQLite with FTS5 search | Done |
| FR-5 | Store API keys in macOS keychain, not plaintext | Done |
| FR-6 | Editable transcript with speaker renaming + undo (Escape) | Done |
| FR-7 | AI meeting summary with overview, decisions, actions, risks | Done |
| FR-8 | Export transcripts to TXT and SRT via native save dialog | Done |
| FR-9 | Audio playback before transcribing | Done |
| FR-10 | Keyboard shortcuts (Cmd+N, Cmd+F, Escape) | Done |
| FR-11 | Pagination for meeting list | Done |
| FR-12 | Error boundary + recording error surfacing to UI | Done |

## Non-Functional Requirements

- **Security**: No secrets in plaintext or VCS. (Met: keychain, CSP, header auth.)
- **Testability**: 4 Rust tests (merge_wav_files) + 4 TS tests (findSilenceBoundaries). (Met.)
- **Performance**: Transactional batch inserts, batch UPDATE, chunked base64 encoding. (Met.)
- **Offline**: Local fonts, no CDN dependencies. (Met.)
- **Maintainability**: Co-located tests, shared utilities, documented patterns in CLAUDE.md.

## Acceptance Criteria (Sprint 1-6)

- `cargo test` — Rust tests pass.
- `npm test` (vitest) — frontend tests pass.
- `cargo build` + `npm run build` — both pass.
- CI passes on push/PR (Rust tests + frontend tests + lint + build).
- Settings API key inputs persist to keychain on blur.
- App boots under CSP without console violations.
- Recording errors surface as dismissable red banner.
- "Start Recording" button required before mic activates.
- Keyboard shortcuts work (suppressed when typing).
- Pagination "Load More" button appears when >50 meetings.
- Release builds produce platform bundles via GitHub Actions on version tags.

## Dependencies

- **Rust**: Tauri v2, cpal 0.15, hound 3.5, rusqlite 0.31 (bundled), chrono 0.4, uuid 1
- **Frontend**: React 19, Vite, TailwindCSS 4, vitest, oxlint, Zustand, TanStack Query
- **Shared**: TypeScript packages (core, speech, llm, export)
- **System**: macOS `security` CLI (keychain)

## Open Questions

- Keychain strategy for non-macOS targets (if cross-platform later).
- Provider fallback behavior when one speech provider fails mid-transcription.
