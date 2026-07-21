# Altitude Analysis: import_meeting Atomic Refactor

**Date**: 2026-07-19  
**Scope**: Architectural depth assessment of the `import_meeting` atomic refactor

## Verdict

**Correct depth** — The fix correctly addresses the root cause (IPC boundary splitting an atomic operation) by combining copy + DB insert into a single Tauri command with internal rollback. This is the right architectural boundary.

## 8 Special Cases Where Fix Isn't Deep Enough

| # | File | Line | Summary | Failure Scenario (Shared Infra Gap) |
|---|------|------|---------|-------------------------------------|
| 1 | `apps/desktop/src-tauri/src/audio/import.rs` | 11 | File format validation (ALLOWED_EXTS) lives only in import.rs — recording path bypasses it entirely | If drag-drop or another import vector is added later, it must manually reuse `validate_source()`. Recording uses native WAV via cpal/hound so format is implicit, but any future non-WAV recording format (Opus, etc.) would need shared validation. |
| 2 | `apps/desktop/src-tauri/src/audio/recorder.rs` | 54 | Recording uses UUID naming with hardcoded `.wav` extension; import preserves original extension | Inconsistent naming conventions across entry points. If a meeting created via recording later has imported audio attached (or vice versa), file naming patterns diverge. No shared naming utility exists. |
| 3 | `apps/desktop/src-tauri/src/lib.rs` | 20 | `audio_dir` created once at startup in `setup()` — no runtime existence check before use | If user deletes `~/Library/Application Support/meeting-ai/audio/` at runtime (or disk corruption), both `import_meeting` and `start_recording` fail with cryptic filesystem errors instead of auto-recreating or surfacing a clear error. |
| 4 | `apps/desktop/src-tauri/src/audio/recorder.rs` | 130 | `pause_recording`/`resume_recording` creates multiple WAV chunks merged on stop — import path has no equivalent complexity | Recording produces merged multi-chunk WAV; import is single file. If a feature needs to "append" imported audio to an existing recording (or vice versa), the chunking/merging logic is duplicated or missing. No shared "audio composition" abstraction. |
| 5 | `apps/desktop/src/hooks/use-recording.ts` | 50 | Recording flow: `create_meeting` → `stop_recording` → `update_meeting(audioPath, durationSecs)` — symmetric orphan window to old import flow | If `stop_recording` succeeds but `update_meeting` fails, meeting exists with audio file on disk but no DB link. The `import_meeting` fix didn't address this symmetric case for recordings. |
| 6 | `apps/desktop/src/routes/meeting-list.tsx` | 32 | UI import only via button click (open dialog) — no drag-drop handler wired to `import_meeting` | If drag-drop is added, it must call `import_meeting` manually. The atomic command exists but the UI entry point is singular. No shared "import from path" frontend helper exists. |
| 7 | `apps/desktop/src-tauri/src/audio/import.rs` | 36 | Rollback on DB failure deletes copied file — but `stop_recording` doesn't clean up WAV on `update_meeting` failure | Asymmetric cleanup: import is atomic with rollback; recording leaves orphan WAV if `update_meeting` fails after `stop_recording`. The fix depth stopped at the import boundary. |
| 8 | `apps/desktop/src-tauri/src/audio/import.rs` | 77 | `import_meeting_impl` is pure function taking `(sourcePath, title, db, audio_dir)` — but `audio_dir` comes from `AppState` at call site assuming it exists | Testability is good (pure function), but runtime call site in `lib.rs` passes `state.audio_dir` which assumes it's still accessible. No validation that `audio_dir` is still accessible at call time — same assumption as `recorder.rs`. |

## Root Cause Assessment

| Aspect | Assessment |
|--------|------------|
| Root cause addressed | **Yes** — IPC boundary splitting atomic operation across 3 commands (`import_audio` → `create_meeting` → UI linking) |
| Fix location | **Correct** — Single Tauri command with internal transaction (copy → DB insert → rollback on failure) |
| Shared infrastructure gaps | **8 identified** — validation, naming, dir existence, chunking, symmetric recording flow, UI entry points, asymmetric cleanup, runtime dir validation |

## Recommendation

The atomic command fix is **correct and complete for its scope**. The 8 gaps are **pre-existing architectural inconsistencies** across the audio pipeline (import vs recording) that the fix correctly did not try to solve — doing so would be scope creep.

**When to deepen**: If any of these scenarios materialize (drag-drop import, recording format change, append-audio feature, audio-dir deletion at runtime), extract shared utilities:
1. `audio_validation.rs` — shared `validate_format()` and `ALLOWED_EXTS`
2. `audio_naming.rs` — shared `generate_audio_path(extension?, uuid?)`
3. `audio_dir.rs` — `ensure_audio_dir(app_handle)` with runtime recreation
4. `audio_composition.rs` — shared `merge_audio_chunks()` / `append_audio()`
5. Frontend `useAudioImport(path)` hook wrapping `import_meeting` for reuse