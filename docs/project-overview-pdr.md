# Project Overview & Product Development Requirements (PDR)

## Overview

Meeting AI is a macOS desktop application (Tauri) that records meetings, transcribes them locally or via cloud speech providers, and lets users review/edit transcripts. The frontend is React + Vite (TypeScript); the backend is Rust (`src-tauri`). A shared TypeScript library (`packages/speech`) provides transcription and audio-chunking logic used by both.

## Goals

- Capture system/meeting audio with low overhead.
- Transcribe audio via pluggable providers (Whisper / OpenAI, Gemini speech).
- Produce and store searchable, editable transcripts.
- Keep API keys secure (no plaintext storage).

## Non-Goals (current scope)

- Cross-platform support beyond macOS (keychain integration is macOS-only).
- Real-time streaming transcription UI (current flow is record-then-transcribe).
- Cloud sync / multi-device.

## Architecture

```
apps/desktop/src        React UI (routes, hooks, components)
apps/desktop/src-tauri  Rust backend: audio capture, DB (rusqlite), Tauri commands
packages/speech         TS: chunking (findSilenceBoundaries), providers (Gemini, Whisper), transcribeWithChunking
```

### Key Flows

- **Recording**: `src-tauri/src/audio/recorder.rs` captures chunks and merges WAVs via `merge_wav_files`.
- **Transcription**: `useTranscription` (frontend hook in `use-summary.ts`) calls `transcribeWithChunking` from `packages/speech`, which splits audio at silence boundaries and dispatches to a configured provider.
- **Storage**: settings/transcripts in a local SQLite DB (`rusqlite`); API keys in the macOS keychain.

### Security Posture

- API keys → macOS keychain via `security` CLI (`store_key_in_keychain` / `get_key_from_keychain` in `src-tauri/src/db/settings.rs`).
- Gemini auth via `x-goog-api-key` header; key sourced from keychain.
- CSP defined in `tauri.conf.json` restricts `connect-src` to `ipc:` and the OpenAI / Google Generative Language hosts.

## Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-1 | Record meeting audio and merge chunks into a single WAV | Done |
| FR-2 | Transcribe via chunked silence-based splitting | Done |
| FR-3 | Pluggable providers (Gemini, Whisper) | Done |
| FR-4 | Store transcripts + settings in local DB | Done |
| FR-5 | Store API keys in macOS keychain, not plaintext | Done |
| FR-6 | Editable transcript view | Done |

## Non-Functional Requirements

- **Security**: No secrets in plaintext or VCS. (Met via keychain.)
- **Testability**: Unit tests for audio merge (Rust) and silence detection (TS). (Met.)
- **Maintainability**: Co-located tests, documented CSP/keychain boundaries.

## Acceptance Criteria (Sprint 1 — Stabilize)

- `cargo test` passes (4 `merge_wav_files` tests).
- `npm test` (vitest) passes (`findSilenceBoundaries` tests present).
- Settings API key inputs persist to keychain on blur, not per keystroke.
- App boots under CSP without console violations for allowed hosts.

## Dependencies

- Tauri, rusqlite, `hound` (WAV I/O) — Rust.
- React, Vite, vitest — frontend.
- `@meeting-ai/speech` — shared transcription package.
- macOS `security` CLI (keychain).

## Open Questions

- Keychain strategy for non-macOS targets (if cross-platform is later required).
- Provider fallback behavior when one speech provider fails mid-transcription.
