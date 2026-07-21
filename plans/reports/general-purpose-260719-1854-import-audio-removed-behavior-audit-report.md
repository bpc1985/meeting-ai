# Import Audio Removed-Behavior Audit Report

## Summary
Reviewed commit `1fcd218` (feat: add Import Audio button to meeting list) which replaced the old `import_audio` command with `import_meeting`. Analyzed all removed/replaced behaviors and checked if new code re-establishes them.

## Findings: 7 Candidate Findings

```json
[
  {
    "file": "/Users/hungho/Code/study/meeting-ai/apps/desktop/src/routes/meeting-list.tsx",
    "line": 38,
    "summary": "Frontend expects Meeting object but only uses id/title for navigation; audio_path, duration_secs, created_at, updated_at, status fields from new Meeting return are ignored in navigation",
    "failure_scenario": "If Meeting struct schema changes (e.g., status values change, new required fields added), frontend navigation may silently pass invalid/incomplete Meeting to meeting-detail page which expects full Meeting struct"
  },
  {
    "file": "/Users/hungho/Code/study/meeting-ai/apps/desktop/src-tauri/src/audio/import.rs",
    "line": 42,
    "summary": "New code uses state.audio_dir.clone() + import_meeting_impl pure function instead of direct state.audio_dir access",
    "failure_scenario": "If AppState.audio_dir changes after clone (e.g., config reload), import uses stale path — but AppState.audio_dir is set once at startup so this is a theoretical concern only (ponytail: cloning avoids lock contention, acceptable)"
  },
  {
    "file": "/Users/hungho/Code/study/meeting-ai/apps/desktop/src-tauri/src/audio/import.rs",
    "line": 57,
    "summary": "New code wraps error messages with context (\"Failed to copy file: {}\", \"Failed to insert meeting: {}\") — old returned raw error strings",
    "failure_scenario": "Frontend error display (meeting-list.tsx line 51) shows raw error string; wrapped errors change format from \"Source file does not exist\" to \"Failed to copy file: Source file does not exist\" — frontend error banner shows different text, breaking any error-string matching in tests or user-facing copy"
  },
  {
    "file": "/Users/hungho/Code/study/meeting-ai/apps/desktop/src-tauri/src/audio/import.rs",
    "line": 68,
    "summary": "New code validates UTF-8 on destination path with `dest.to_str().ok_or(\"Invalid UTF-8 in destination path\")?` — old code used `dest.to_string_lossy().to_string()` which never fails",
    "failure_scenario": "On systems with non-UTF-8 filesystem paths (rare on macOS/Windows, possible on Linux with legacy mounts), import now fails with \"Invalid UTF-8 in destination path\" instead of lossily converting — old behavior silently mangled paths, new behavior fails fast (arguably correct but behavior change)"
  },
  {
    "file": "/Users/hungho/Code/study/meeting-ai/apps/desktop/src-tauri/src/audio/import.rs",
    "line": 21,
    "summary": "New error message format: \"Unsupported file format: .{ext}\" (with leading dot) vs old \"Unsupported file format: {ext}\" (no dot)",
    "failure_scenario": "Frontend error banner displays different text; any automated test matching error strings or user-facing copy matching breaks"
  },
  {
    "file": "/Users/hungho/Code/study/meeting-ai/apps/desktop/src/routes/meeting-list.tsx",
    "line": 38,
    "summary": "Frontend calls invoke<Meeting>(\"import_meeting\", {...}) but only uses meeting.id and meeting.title for navigation; Meeting.audio_path, duration_secs, created_at, updated_at, status are ignored",
    "failure_scenario": "If import_meeting returns Meeting with status='draft' but meeting-detail page expects status='transcribed' to enable transcription UI, detail page shows wrong UI state — old flow: import_audio returned path, then create_meeting created 'draft' meeting, then transcription updated status"
  },
  {
    "file": "/Users/hungho/Code/study/meeting-ai/apps/desktop/src-tauri/src/audio/import.rs",
    "line": 77,
    "summary": "New atomic import_meeting_impl does copy + DB insert with cleanup on DB failure — old code had no DB insert, meeting created separately via create_meeting (orphan file possible if create_meeting failed after import_audio succeeded)",
    "failure_scenario": "Behavior CHANGED (improved): atomicity is NEW behavior, not a removal. Old orphan-file-on-DB-failure scenario is FIXED. Listed for completeness as behavior change."
  }
]
```

## Summary by Category

### Frontend Contract Changes (2 findings)
1. **Meeting struct return vs path string** — Frontend navigates with `meeting.id` + `meeting.title` only, ignores other fields. If `meeting-detail` page expects full `Meeting` with specific `status`/`audio_path`, it may render incorrectly.
2. **Error message format changed** — Frontend displays raw error string; wrapped errors change user-facing text and break string-matching tests.

### Backend Behavior Changes (4 findings, 1 improvement)
3. **Error message format: format string with dot** — `"Unsupported file format: .{ext}"` vs `"Unsupported file format: {ext}"`
4. **UTF-8 path validation** — New strict UTF-8 check vs old lossy conversion (correctness improvement but behavior change)
5. **Error wrapping with context** — `"Failed to copy file: {}"` / `"Failed to insert meeting: {}"` wraps original errors
6. **Atomic copy+insert with cleanup** — **IMPROVEMENT**: Old code had orphan-file risk; new code cleans up on DB failure

### Theoretical Concern (1 finding)
7. **audio_dir clone staleness** — Theoretical; AppState.audio_dir immutable after startup.

## Recommendations
1. **Frontend**: Update `meeting-list.tsx` to use full `Meeting` from `import_meeting` when navigating, or fetch fresh meeting via `get_meeting` after import
2. **Tests**: Update any error-string matching in tests
3. **Documentation**: Note error message format change in changelog if user-facing copy depends on it
4. **UTF-8 path**: Acceptable correctness improvement; document as known behavior change for Linux edge cases