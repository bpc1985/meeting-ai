# Sprint 1 — Stabilize: P0 hardening after the zero-test MVP

**Date**: 2026-07-18 15:14
**Severity**: High
**Component**: Audio merge (Rust), STT/LLM providers, React error handling, CSP, keychain, transcription hook
**Status**: Resolved

## What Happened

The MVP (commit 601b03d) shipped with 49 issues flagged in the audit
(`plans/reports/ask-260718-1430-improvement-areas-report.md`). Sprint 1 was
scoped to the 8 P0 items only. We closed all 8 plus a couple of build-blocking
pre-existing bugs. Verification is green across the board: `cargo build` ✓,
`cargo test` 4/4 ✓, `npm run build` ✓, `npm run test` 4/4 ✓, `npm run lint` ✓
(pre-existing warnings only).

## The Brutal Truth

Honestly, the most infuriating part was that we couldn't even start on the P0
list until we fixed a bug that wasn't on it. `SearchResult` was missing its
`Serialize` derive and the whole tree wouldn't compile — a latent landmine from
the MVP that nobody caught because there were no tests and the build gate was
`tsc --noEmit` on the frontend only, not the Rust↔TS command boundary. We
burned the first chunk of the session unblocking ourselves on someone else's
debt. The real kick in the teeth: the MVP "all gates green" claim was a lie of
omission — the Tauri command serialization contract was never checked.

The keychain work is also a half-measure I'm not proud of. We shell out to the
macOS `security` CLI rather than linking Security.framework. It works, but it's
a subprocess per read/write and it's macOS-only. If this ever goes cross-
platform, this whole module needs to be rewritten. I noted that as a ceiling,
not a fix.

## Technical Details

- `merge_wav_files` had a genuine dead-write bug: it wrote the merged WAV once,
  then a second pass overwrote the file completely — the first write was
  unreachable in effect. Removed the redundant second write.
- Gemini API key was being passed as a URL query param (`?key=...`) on the STT
  and LLM calls. Moved to the `x-goog-api-key` header on both providers.
- `ErrorBoundary` class component wraps `<Routes>` in `App.tsx`;
  `componentDidCatch` logs to console.
- CSP added to `tauri.conf.json`: allows Tauri IPC (`ipc:` / `http://ipc.localhost`),
  Google Fonts, and OpenAI/Gemini API hosts.
- `transcribeWithChunking` wired into `useTranscription`; progress state exposed
  to the UI. `findSilenceBoundaries` exported from `chunker.ts`.
- 4 Rust unit tests for `merge_wav_files` (single/multi chunk, empty chunks,
  invalid WAV) — all pass.
- 4 TS unit tests for `findSilenceBoundaries` (no-silence, with-silence, edge
  cases) — all pass; `vitest` added to the project.
- Keychain: `store_key_in_keychain` / `get_key_from_keychain` Rust commands
  shell to `security`. DB stores a `"keychain:"` marker; plaintext keys still
  read for backward compat.
- Settings API key inputs now save on blur, not `onChange` — avoids a keychain
  prompt per keystroke.
- Gemini speech provider MIME detection: autodetects webm/wav/m4a/ogg instead
  of hardcoding `audio/mp3` (which was silently wrong for our WAV output).
- `SearchResult` got `#[derive(Serialize)]` — without it the Tauri command
  returning search results wouldn't compile.
- Removed two unused `_pattern` bindings.

## What We Tried

- Started the P0 list directly, hit a compile wall on `SearchResult`. Fixed the
  derive first, then proceeded. No alternative was viable — the build was
  hard-blocked.

## Root Cause Analysis

The MVP's "green gates" were too narrow: frontend typecheck only, no Rust↔TS
command contract check, no tests. That let a missing `Serialize` derive and a
dead write in audio merge both survive to ship. The keychain-via-CLI choice is
a scope trade, not a bug — but it's a real ceiling we're accepting for Sprint 1.

## Lessons Learned

- A build gate that only checks one side of the FFI boundary is not a gate. The
  Tauri command layer needs its own compile/serialize check, or these landmines
  repeat.
- Dead I/O is the worst kind of bug: no error, just wrong output. The only net
  is a unit test on the bytes written — which is exactly why Sprint 1 added the
  4 Rust tests.
- Don't let "save on every keystroke" meet a keychain prompt. Blur-save is the
  obvious fix; we should have done it day one.

## Next Steps

- Owner: next session. Add a CI step that runs `cargo build` + `npm run build`
  so the FFI boundary is checked on push, not by luck.
- Owner: next session. The 41 remaining audit issues (P1/P2) are untriaged —
  need a Sprint 2 scoping pass.
- Unresolved: keychain is macOS-only and subprocess-based. Cross-platform or
  perf work requires a real Security.framework link or a Tauri plugin.
- Unresolved: CSP was set by allowlist; needs a real nonce/strict policy review
  before any web-content feature lands.
