# MVP shipped: 115 files, 11K lines, all gates green — and what we deliberately cut

**Date**: 2026-07-17 15:40
**Severity**: Low
**Component**: Whole app (commit 601b03d, main)
**Status**: Resolved

## What Happened

From empty repo to a working macOS desktop app: recording → transcription →
editing → summary → export. Tauri v2 + React 19 + TS + Vite + Tailwind 4 +
Rust, SQLite with FTS5, cpal/hound audio, Whisper + Gemini STT, Gemini
summaries, dark theme with Lexend + Atkinson Hyperlegible. `cargo build`,
`tsc --noEmit`, and `.app` + `.dmg` bundling all pass. Skipped: system audio,
live transcription, diarization, automated tests, cloud sync.

## The Brutal Truth

It works, but "all gates green" is a half-truth. The gates are build/type/bundle
gates. There is **zero automated test coverage** — not one unit test, not one
integration test. We verified by running the app and eyeballing. That is fine
for an MVP we ship to ourselves, but the first regression that slips through
will be a silent one, and we'll have no net to catch it. The thing that should
worry the 2am inheritor isn't a missing feature — it's that nothing will tell
them when they break the WAV merge or the FTS5 query.

## Technical Details

- 9 phases, 115 files, ~11K lines.
- Quality gates: `cargo build` ✓, `tsc --noEmit` ✓, bundle `.app`/`.dmg` ✓.
- Deliberately skipped: system audio capture, realtime/live STT, speaker
  diarization, test suite, cloud sync.

## What We Tried

N/A — build succeeded. The discipline question is what we chose NOT to build.

## Root Cause Analysis

Scope discipline, not failure. Each cut was a conscious YAGNI call for an MVP:
system audio needs extra entitlements/loopback, live STT needs streaming API
work, diarization needs a separate model, tests were traded for speed-to-working
app. The risk is that "temporary skip" becomes permanent with no follow-up
ticket tracking it.

## Lessons Learned

Ship the MVP, but write down the cut list as tracked debt, not memory. The
biggest gap is the missing test net around the two fragile Rust pieces
(`SendStream` wrapper and `merge_wav_files`). Those deserve at least a couple of
unit tests before anyone refactors audio.

## Next Steps

- Owner: next dev session. Add unit tests for `merge_wav_files` and the silence
  chunker first — pure Rust, cheap to test, highest regression risk.
- Open question: do we want diarization before cloud sync, or vice versa, for v2?
- Unresolved: no CI configured; gates run only locally. Add a minimal CI running
  the three gates on push.
