# What to improve next — Meeting AI

**Date:** 2026-07-18
**Source:** /ask — full codebase review (manual + scout agent)
**Files reviewed:** 13 Rust (1,064 LOC), 17 TypeScript/TSX (1,340 LOC), 6 packages (667 LOC), config files, docs (516 LOC), plans (2,082 LOC)

---

## Summary

MVP shipped. It works. But zero tests, no CI, plaintext API keys, dead I/O in the audio merge, chunking not wired, duplicate code everywhere, unused Vite template files in the CSS bundle, and an empty workspace package. The next thing to build is **not a feature** — it's the safety net.

---

## Ranked by impact × urgency

### P0 — Fix now (data loss, security, silent failure)

| # | Issue | File | Why it matters |
|---|-------|------|---------------|
| 1 | **Zero automated tests** | entire repo | Not one `*_test.rs`, `*.test.ts`, or `*.spec.ts`. `merge_wav_files` and silence chunker are ~100 lines of fragile bit logic. |
| 2 | **API keys in plaintext SQLite** | `db/settings.rs` | `openai_api_key` / `gemini_api_key` stored as raw strings. Machine compromise = keys leaked. Use OS keychain. |
| 3 | **API key in URL query param** | `speech/providers/gemini.ts:22` | `${GEMINI_API_URL}?key=${apiKey}` — key visible in server logs. Gemini docs recommend header-based auth. |
| 4 | **No CI/CD** | — | `cargo build`, `tsc --noEmit`, `oxlint` run only locally. No GitHub Actions. |
| 5 | **Dead I/O in `merge_wav_files`** | `audio/recorder.rs:273-322` | Audio data written to file twice — first pass (lines 273-301) completely overwritten by second pass (lines 309-322). Works correctly but confusing + wastes I/O. |
| 6 | **Chunking not wired** | `hooks/use-summary.ts:94` | `transcribeWithChunking` exists in speech package but `useTranscription` calls `provider.transcribe()` directly. Files >25MB after compression will fail with API limit errors. |
| 7 | **No error boundary** | `App.tsx` | Any component crash = white screen. Wrap `<Routes>` in error boundary. |
| 8 | **`csp: null`** | `tauri.conf.json:25` | Content Security Policy disabled entirely. Even for local app, risky with Google Fonts CDN + API calls. |

### P1 — High impact, low effort

| # | Issue | File | Why it matters |
|---|-------|------|---------------|
| 9 | **Recording errors silent** | `audio/recorder.rs:67,169` | cpal stream errors hit `eprintln!`. User sees "Recording" while mic is dead. Surface via Tauri event. |
| 10 | **Settings save on every keystroke** | `routes/settings.tsx:33,44` | `onChange` calls `saveSetting.mutate()` which hits SQLite on every char. Debounce or save on blur. |
| 11 | **Auto-start recording on mount** | `routes/recording.tsx:17-21` | `useEffect` starts mic immediately. Navigate there accidentally = mic hot. Add "Start Recording" button. |
| 12 | **No retry on LLM summarize** | `llm/providers/gemini.ts` | Zero retry logic. `withRetry` exists in speech package but unused here. Network hiccup = failed summary. |
| 13 | **No transcription progress in UI** | `hooks/use-summary.ts` | Spinner for minutes with no feedback. `onProgress` param wired in chunker but never plumbed to UI. |
| 14 | **Font import blocks rendering** | `globals.css:1` | Google Fonts `@import` is render-blocking. No offline fallback. Desktop app with no text until CDN responds. |
| 15 | **`arrayBufferToBase64` O(n²) string concat** | `speech/providers/gemini.ts:86-93` | Byte-by-byte `String.fromCharCode` for potentially 50MB audio. Needs chunked approach. |

### P2 — Dead code & waste

| # | Issue | File | Why it matters |
|---|-------|------|---------------|
| 16 | **`@meeting-ai/ui` empty stub** | `packages/ui/src/index.ts` | `export {};` — zero components. All UI lives in `apps/desktop/src/components/`. Either populate or delete the workspace package. |
| 17 | **`App.css` + `index.css` unused** | `apps/desktop/src/` | Vite template boilerplate. Hero, counter, social styles. 295 lines of dead CSS in the bundle. |
| 18 | **`selectedMeetingId` dead state** | `stores/meeting-store.ts` | Set but never read anywhere in the codebase. |
| 19 | **Empty `commands/` directory** | `src-tauri/src/commands/` | Directory exists, contains zero files. Leftover from plan that moved commands into db/ and audio/ modules. |

### P3 — Duplicated code

| # | Issue | Files | Why it matters |
|---|-------|-------|---------------|
| 20 | **`extractJson` defined twice** | `llm/providers/gemini.ts` + `speech/providers/gemini.ts` | Same function, same fallback logic. Extract to shared util. |
| 21 | **`HttpError` class defined 3 times** | `speech/retry.ts`, `llm/providers/gemini.ts`, `speech/providers/whisper.ts` (dynamic import) | whisper.ts imports from retry.ts, Gemini LLM redefines it. |
| 22 | **`audioBufferToWav` + `writeStringWav` duplicated** | `speech/compressor.ts` + `speech/chunker.ts` | 45 lines copy-pasted. Comment says "ponytail: shared audio-utils later" — later is now. |
| 23 | **`now_iso()` defined twice** | `db/meetings.rs` + `db/summaries.rs` | Identical 3-line function. |
| 24 | **`fmtDuration` defined twice** | `routes/meeting-list.tsx:151` + `routes/meeting-detail.tsx:175` | Same logic. Extract to shared util. |
| 25 | **Hardcoded model name `gemini-2.5-flash`** | `db/summaries.rs:33`, `llm/providers/gemini.ts:14`, `speech/providers/gemini.ts:5` | 3 files. Model update touches all 3. |

### P4 — Quality & correctness

| # | Issue | File | Why it matters |
|---|-------|------|---------------|
| 26 | **`create_segments_batch` not transactional** | `db/segments.rs:15-33` | N individual INSERTs, lock/unlock per row. Wrap in transaction — 10x for large transcripts. |
| 27 | **`update_segment` runs 1 UPDATE per field** | `db/segments.rs:83-104` | Up to 4 separate UPDATE statements. Batch like `update_meeting` does. |
| 28 | **Divergent `MeetingSummary` types** | `core/types.ts` vs `llm/types.ts` | Same name, different shapes (snake_case DB vs camelCase API). `meeting-detail.tsx:38-43` does manual mapping in ternaries. |
| 29 | **Gemini STT MIME mismatch** | `speech/providers/gemini.ts:31` | Sends `audio/mp3` but compressor produces WebM/Opus. Works via Gemini auto-detection, but it's wrong. |
| 30 | **`compressToMp3` misleading name** | `speech/compressor.ts` | Produces WebM/Opus, not MP3. Comment acknowledges it. Function name + all callers lie. |
| 31 | **`writer` Arc not stored in RecordingState** | `audio/recorder.rs:62-117` | Comment on line 116-117 says "store writer in state" — never done. Works by accident (callback holds clone). |
| 32 | **Device change mid-recording not handled** | `audio/recorder.rs` | `default_input_device()` on resume might return different device with different sample rate → mismatched WAV specs between chunks. |
| 33 | **`delete_meeting` glob cleanup fragile** | `db/meetings.rs:154-167` | `starts_with` on file stem could match unrelated files sharing UUID prefix. |
| 34 | **No pagination on `list_meetings`** | `db/meetings.rs:55` | Returns all rows. After 200 meetings, noticeable lag. |
| 35 | **`search_meetings` no offset** | `db/search.rs:36` | LIMIT 20 hardcoded. 50 matching meetings → user sees at most 20. |
| 36 | **No mic device selection** | `audio/recorder.rs:48` | Uses `default_host()` + `default_input_device()`. Multi-mic setups (laptop + headset) can't choose. |
| 37 | **No audio playback before transcribe** | `routes/meeting-detail.tsx` | Can't listen to recording before spending API credits. `<audio>` element with file path is trivial. |
| 38 | **Export uses hidden DOM link** | `routes/meeting-detail.tsx:31-35` | Creates invisible `<a>`, clicks it. Tauri `dialog` plugin can show native Save dialog — more trustworthy for privacy-first app. |
| 39 | **No undo for transcript edits** | `routes/meeting-detail.tsx:146-156` | Double-click → edit → blur → saved. No undo. |
| 40 | **No keyboard shortcuts** | — | Cmd+N new recording, Cmd+F search, Space play/pause. Desktop app without shortcuts feels broken. |
| 41 | **`vite-env.d.ts` manual Tauri types** | `apps/desktop/src/vite-env.d.ts` | Manual module declarations missing generic constraints. Official `@tauri-apps/api` ships types. |
| 42 | **`tailwindcss` listed in both deps** | `apps/desktop/package.json` | `tailwindcss` v4 in devDependencies + `@tailwindcss/vite` v4. Redundant. |

### P5 — Known scope cuts (deferred)

| # | Feature | Notes |
|---|---------|-------|
| 43 | Dark/light mode toggle | Design says dark only for MVP. Confirm for accessibility (some users can't read dark mode). |
| 44 | System audio capture | Loopback driver per OS. |
| 45 | Speaker diarization | Separate ML model. |
| 46 | Live transcription | Streaming API work. |
| 47 | Cloud sync | Multi-device. |
| 48 | No logging crate in Rust | No `log`, `tracing`, or `env_logger`. Debugging is `eprintln!`. |
| 49 | No Rust dev-dependencies | No `rstest`, `mockall`, or test framework configured. |

---

## What to do next — recommended sequence

**Sprint 1 (stabilize — ~2-3 days):**
1. Add unit tests for `merge_wav_files` + silence chunker (the journal's own recommendation)
2. Add CI (GitHub Actions: `cargo build`, `tsc --noEmit`, `oxlint`, `cargo test`)
3. Fix dead I/O in `merge_wav_files` (remove first write pass)
4. Wire `transcribeWithChunking` into `useTranscription` hook
5. Add React error boundary
6. Move API keys to OS keychain
7. Fix API key in URL query param → use header
8. Set basic CSP

**Sprint 2 (quality — ~1-2 days):**
9. Surface recording errors to UI (Tauri events)
10. Debounce settings save
11. Fix auto-start recording UX (add confirmation button)
12. Add retry to LLM summarize
13. Surface transcription progress to UI
14. Remove unused CSS files + empty `@meeting-ai/ui` package + dead `commands/` dir + dead `selectedMeetingId`

**Sprint 3 (dedup — ~1 day):**
15-20. Extract shared `extractJson`, `HttpError`, `audioBufferToWav`, `now_iso`, `fmtDuration`. Single source for model name.

**Sprint 4 (polish):**
21-34. Transactional batch inserts, batch UPDATE, MIME fix, mic device selection, pagination, audio playback, undo, keyboard shortcuts, native Save dialog, logging.

**Later:**
Dark mode, system audio, diarization, live transcription, cloud sync.

---

## Unresolved

- `tauri-plugin-keychain` or `keyring` crate compatibility with Tauri v2?
- Light mode for accessibility? Design doc says no, but some users need it.
- Google Fonts offline bundling vs. system font fallback? `@import` blocks render in a desktop app.
