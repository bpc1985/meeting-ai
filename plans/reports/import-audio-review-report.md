# Import Audio Feature Review

## Summary
The new `import_meeting` command in `import.rs` provides an atomic import (validate → copy → DB insert) that replaces a theoretical 3-command flow. However, the old commands (`create_meeting`, `update_meeting`) are **still actively used** elsewhere in the codebase, making the "replaces old trio" claim misleading.

---

## F - Reuse: Does new code re-implement something the codebase already has?

| File | Line | Summary | Failure Scenario |
|------|------|---------|------------------|
| `apps/desktop/src-tauri/src/audio/import.rs` | 7 | `ALLOWED_EXTS` constant defined locally | If audio validation needed elsewhere (recording, transcription), this constant must be duplicated or imported. No shared audio validation utilities exist in `packages/`. |
| `apps/desktop/src-tauri/src/audio/import.rs` | 48, 30 | `uuid::Uuid::new_v4()` called twice per import (file name + meeting ID) | Intentional (separate IDs), but pattern duplicated across `recorder.rs`, `meetings.rs`, `segments.rs`, `summaries.rs` — no shared UUID helper. |

---

## G - Simplification: Unnecessary complexity added?

| File | Line | Summary | Failure Scenario |
|------|------|---------|------------------|
| `apps/desktop/src-tauri/src/audio/import.rs` | 9-35 | `validate_source` split as pure function | Reasonable separation, but only used once. Could inline without loss. |
| `apps/desktop/src-tauri/src/audio/import.rs` | 37-55 | `copy_to_audio_dir` split as pure function | Reasonable separation, but only used once. Could inline without loss. |
| `apps/desktop/src-tauri/src/audio/import.rs` | 57-93 | `import_meeting_impl` as pure function | Good for testing, but adds indirection for a single caller. |

---

## H - Efficiency: Wasted work?

| File | Line | Summary | Failure Scenario |
|------|------|---------|------------------|
| `apps/desktop/src-tauri/src/audio/import.rs` | 84 | Sequential validate → copy → DB insert | Cannot parallelize (copy must complete before DB insert), so no wasted work here. |
| `apps/desktop/src-tauri/src/audio/import.rs` | 84 | `state.db.lock()` mutex lock per import | Unavoidable for SQLite; acceptable for low-throughput desktop app. |

---

## I - Altitude: Right depth?

| File | Line | Summary | Failure Scenario |
|------|------|---------|------------------|
| `apps/desktop/src-tauri/src/audio/import.rs` | 76 | Comment claims "replaces old create_meeting + import_audio + update_meeting IPC trio" | **Misleading**: `create_meeting` and `update_meeting` are still registered in `lib.rs` and actively used in `meeting-list.tsx` (new recording), `use-recording.ts`, `use-summary.ts`. They are NOT dead code. |
| `apps/desktop/src-tauri/src/lib.rs` | 30, 33 | Old `create_meeting` and `update_meeting` commands still registered | If intent was to remove them, they're not removed. If kept for other uses, the import.rs comment is wrong. |

---

## Conventions (CLAUDE.md)

| File | Line | Summary | Failure Scenario |
|------|------|---------|------------------|
| `apps/desktop/src-tauri/src/audio/import.rs` | (none) | No ponytail comments marking deliberate simplifications | Per CLAUDE.md: "Ponytail comments mark deliberate simplifications and their upgrade paths." New code has none. |
| `apps/desktop/src-tauri/src/audio/import.rs` | 7 | `ALLOWED_EXTS` as local constant | Convention: "Shared code: packages/...". If this list grows or is needed elsewhere, should live in shared package. |
| `apps/desktop/src-tauri/src/audio/import.rs` | 48 | `uuid::Uuid::new_v4().to_string()` inline | Pattern repeated in 5+ files. Could use a tiny helper in `db/mod.rs` alongside `now_iso()`. |

---

## Unresolved Questions

1. **Are `create_meeting` and `update_meeting` intentionally kept for non-import flows?** If yes, update the misleading comment in import.rs line 76.
2. **Should `ALLOWED_EXTS` be moved to a shared location** (e.g., `packages/core/src/constants.ts` or a new `packages/audio/src/validation.ts`)?
3. **Is there a plan to migrate `use-recording.ts` and `use-summary.ts` away from `update_meeting`**, or are those legitimate separate use cases?
4. **Should a `generate_id()` helper be added to `db/mod.rs`** to consolidate the `uuid::Uuid::new_v4().to_string()` pattern used in 6+ places?