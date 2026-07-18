# Sprint 2 — Quality & Dead Code: Code Review

**Date**: 2026-07-18
**Reviewer**: code-reviewer (Ponytail full)
**Scope**: Full working tree vs acceptance criteria
**Verification**: cargo build (3 warnings), cargo test (4/4), npm build, npm test (4/4), npm lint (1 pre-existing warning)

## Acceptance Criteria Matrix

| # | Criterion | Verdict |
|---|-----------|---------|
| 1 | Deleted: packages/ui/, App.css, index.css, commands/ | PARTIAL — root `packages/ui/` staged as deleted; `apps/desktop/packages/ui/` still tracked (stub); App.css+index.css deleted |
| 2 | Removed dead selectedMeetingId from meeting-store.ts | PASS |
| 3 | No remaining references to dead code | PASS (source imports clean) — config aliases to deleted `@meeting-ai/ui` remain |
| 4 | Fonts bundled locally — @font-face, TTF files, no @import | PASS |
| 5 | CSP updated — no Google Fonts CDN entries | PASS — `font-src 'self'` |
| 6 | Chunked base64 encoding in Gemini speech provider (8KB chunks) | PASS |
| 7 | Recording errors emit Tauri events — both start_recording and resume_recording | PASS |
| 8 | Recording page has "Start Recording" button, no auto-start | PASS |
| 9 | Recording page listens for recording-error events with error banner | PASS |
| 10 | LLM GeminiProvider uses withRetry from @meeting-ai/speech, duplicate HttpError removed | PASS |
| 11 | Transcription progress shown in meeting-detail — "Transcribing X/Y." | PASS |
| 12 | HttpError exported from packages/speech/src/index.ts | PASS |
| 13 | AppState holds app_handle: AppHandle for event emission | PASS |
| 14 | lib.rs imports Emitter, passes app_handle to AppState::new | PASS — Emitter imported but unused |

## Findings by Severity

### Critical

None.

### High

**H1. `apps/desktop/packages/` is a stale duplicate of root `packages/` — contradicts criterion #1**

The root `packages/ui/` is staged for deletion. But `apps/desktop/packages/ui/` exists with stub content (`export {}`), is git-tracked, and is never resolved by any import path. Same for all 5 sub-packages (`core`, `export`, `llm`, `speech`, `ui`). Root `packages/` is the canonical source. A developer editing `apps/desktop/packages/speech/src/index.ts` would expect it to work — it doesn't.

Fix: `git rm -r apps/desktop/packages/`

**H2. `RecordingState.errors` field is dead code — never populated, never read**

`recorder.rs:25` adds `pub errors: Vec<String>`, initialized to `Vec::new()`, but no code pushes errors into it. The `err_fn` closures emit directly via `app_handle.emit("recording-error", &msg)` without buffering. Cargo warns: `field 'errors' is never read`.

Fix: either push into `rec.errors` in `err_fn` closures, or remove the field.

### Medium

**M1. Stale `@meeting-ai/ui` alias in vite.config.ts:14 and tsconfig.json:21**

Both resolve to `../../packages/ui/src` — directory is deleted. No build error because no source imports from it. If any code later imports `@meeting-ai/ui`, build breaks.

Fix: remove the alias and tsconfig path entry.

**M2. `merge_wav_files` reads each WAV chunk from disk twice (recorder.rs:280-328)**

First pass reads chunks to compute header+cumulative size then discards the buffers. Second pass re-opens and re-reads every file to write audio data. For multi-chunk recordings (pause/resume cycles), double I/O per chunk. Not incorrect, just wasteful.

Fix: collect audio buffers in first pass, reuse in second pass.

**M3. Error banner exposes raw Rust error strings to user (recording.tsx:22)**

The payload is `"Microphone error: {cpal internals}"`. Users see internal error formatting with the `"Microphone error: "` prefix. Not a security leak, UX rough edge.

Fix: strip prefix on frontend, or emit structured `{ kind, detail }` events from Rust.

### Low

**L1. Unused import: `Emitter` in lib.rs:5** — Cargo warning. Only `Manager` is needed there.

**L2. Unused import: `Migrations` in db/mod.rs:11** — Cargo warning. Pre-existing.

**L3. Pre-existing lint warning: `src/hooks/use-settings.ts:47`** — react-hooks/exhaustive-deps. Outside sprint scope.

## Regression Risk — Recording Route

`recording.tsx` was rewritten (auto-start removed, error listener added). Risk: **low**.

- Auto-start removed → manual "Start Recording" button gated by `ready && state === "idle"`
- `start()` await+try/catch restores `ready=true` on failure
- `useEffect` cleanup properly tears down error listener
- `use-recording.ts` hook unchanged
- Edge: if `micError` fires mid-recording, banner shows but recording continues — error channel is decoupled from recording state. Acceptable UX.

## Build Verification

```
cargo build  : PASS (3 warnings — errors field, Emitter, Migrations unused)
cargo test   : PASS (4 passed)
npm run build: PASS
npm run test : PASS (4 passed)
npm run lint : 1 pre-existing (exhaustive-deps in use-settings.ts)
```

## Recommended Actions (priority order)

1. Delete `apps/desktop/packages/` from git tracking — all 5 sub-packages are stale stubs
2. Wire `RecordingState.errors` push into `err_fn` closures, or remove the field
3. Remove `@meeting-ai/ui` alias from vite.config.ts and tsconfig.json
4. Remove unused `Emitter` import from lib.rs
5. Remove unused `Migrations` import from db/mod.rs

## Unresolved Questions

- Was `apps/desktop/packages/` intentionally kept as fallback or is it a leftover? It's git-tracked, differs from root packages, and no import resolves to it.
- Is `RecordingState.errors` intended to buffer errors for later retrieval? It is initialized but never written.
