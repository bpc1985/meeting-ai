# Sprint 2 — Quality & Dead Code: P1/P2 cleanup and going fully offline

**Date**: 2026-07-18 16:03
**Severity**: Medium
**Component**: Monorepo layout, fonts/CSP, base64 encoder (Rust), recording error flow, LLM provider, transcription progress, meeting store
**Status**: Resolved

## What Happened

Sprint 1 closed the 8 P0 items and left 41 P1/P2 audit issues untriaged
(`plans/reports/ask-260718-1430-improvement-areas-report.md`). Sprint 2 scoped
the P1 + P2 work into three phases: dead code removal (Phase 2), fonts +
performance (Phase 1a), and quality fixes (Phase 1b). All three shipped.
Verification is green: `cargo build` ✓, `cargo test` 4/4 ✓, `npm run build` ✓,
`npm run test` 4/4 ✓, `npm run lint` ✓ (pre-existing warnings only).

The headline: the Google Fonts CDN was the **only external service the app
could not run without**. After this sprint, the app is fully offline — fonts
are bundled TTFs, and the two `fonts.g*` hosts are gone from the CSP.

## The Brutal Truth

The dead code we deleted should never have existed. `packages/ui/` was an empty
stub whose entire contents were `export {}`. `apps/desktop/packages/` was a
stale *copy* of five packages that already live at the repo root — a duplicate
tree that the build didn't use but that every grep, every IDE index, and every
future reader had to wade through. 295 lines of `App.css` + `index.css` were
untouched Vite template boilerplate. None of this was hard to remove; it was
just never removed. Scaffolding that "later" was supposed to clean up, and later
never came until the audit forced it.

The `selectedMeetingId` state in the store was dead too — set, never read.
Classic. And the `@meeting-ai/ui` alias in `vite.config.ts` and `tsconfig.json`
pointed at the empty stub we deleted, so it had to go with it.

## Technical Details

### Phase 2 — Dead code removal
- Deleted `packages/ui/` — empty stub, contents were `export {}`.
- Deleted `apps/desktop/packages/` — stale duplicate of 5 root packages, not
  referenced by the build.
- Deleted `App.css` + `index.css` — 295 lines of Vite template CSS, unused.
- Deleted empty `src-tauri/src/commands/` directory.
- Removed `selectedMeetingId` from `meeting-store.ts` — write-only dead state.
- Removed the `@meeting-ai/ui` alias from `vite.config.ts` and `tsconfig.json`
  (pointed at the deleted stub).

### Phase 1a — Fonts + performance
- Bundled Lexend + Atkinson Hyperlegible as local TTFs (6 weights total).
- Replaced the Google Fonts `@import` with local `@font-face` declarations — no
  CDN round-trip, no render-blocking external stylesheet.
- Tightened CSP: removed `fonts.googleapis.com` and `fonts.gstatic.com`.
- Rewrote base64 encoding to process in 8KB chunks. The old path did
  byte-by-byte string concatenation — O(n²) on the audio buffer size, which
  matters for full-meeting WAVs.

### Phase 1b — Quality fixes
- Recording errors now emit Tauri events; the UI shows a red error banner with a
  dismiss control instead of failing silently.
- Removed auto-start recording — the user must click "Start Recording". No more
  surprise mic capture on launch.
- `GeminiProvider` (LLM) now uses `withRetry` from `@meeting-ai/speech`; the
  duplicate `HttpError` definition was removed (DRY — one retry path, one error
  type).
- Transcription progress is plumbed to the UI — meeting detail shows
  "Transcribing 2/5..." instead of an opaque spinner.
- `AppState` now holds an `AppHandle` so backend code can emit events (this is
  what makes the recording-error banner possible).

## What We Tried

- The recording-error banner needed the backend to reach the frontend. The
  clean way was to stash the `AppHandle` in `AppState` at setup and emit from
  there, rather than threading a channel through every command. One field, every
  command can now emit.

## Root Cause Analysis

The dead code is a symptom of MVP-speed scaffolding: stub packages, template
CSS, and a duplicated package tree all got created "to fill in later" and were
never pruned. No lint or CI rule flagged unused files or duplicate package
trees, so they accumulated silently. The Google Fonts dependency was a
convenience default from the Vite template that quietly made the app require
network access to render correctly — nobody chose it deliberately.

## Lessons Learned

- Empty stubs and duplicate trees cost nothing to run and everything to read.
  Delete on sight; don't scaffold for a "later" that has no owner.
- A CDN font `@import` is a hidden hard dependency. It doesn't show up as an API
  call, but the app won't render right without it. Bundling was a small diff and
  removed the last external requirement.
- O(n²) string concat hides fine on small inputs and bites on real ones. The
  chunked encoder is the same code path, just not quadratic.

## Next Steps

- Owner: next session. Add a lint/CI rule for unused files and duplicate package
  trees so this dead code doesn't re-accumulate.
- Owner: next session. Triage the remaining audit items not covered by Sprint 1
  or 2.
- Unresolved: CSP still uses an allowlist for the API hosts (carried from Sprint
  1); the nonce/strict-policy review is still open.
- Unresolved: keychain remains macOS-only and subprocess-based (Sprint 1
  ceiling, untouched here).
