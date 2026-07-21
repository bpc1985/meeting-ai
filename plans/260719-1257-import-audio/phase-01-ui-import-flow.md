---
phase: 1
title: "UI Import Flow"
status: pending
priority: P2
dependencies: []
---

# Phase 1: UI Import Flow

## Overview

Add "Import Audio" button to meeting list and wire it to the native file picker. User picks a file → meeting created → audio copied to app data dir → navigate to meeting detail for transcription.

## Requirements

- Functional: User clicks "Import Audio" → native file picker filters for audio formats → on select, creates a meeting, copies audio, navigates to detail
- Non-functional: Uses existing `import_audio` Rust command, Tauri dialog `open` plugin, existing `create_meeting` + `update_meeting` commands. Zero new deps.

## Architecture

```
[Import Button] → dialog.open({ filters: [audio] })
                  → create_meeting(title)
                  → import_audio(sourcePath)
                  → update_meeting(id, audioPath)
                  → navigate(/meeting/:id)
```

## Related Code Files

- Modify: `apps/desktop/src/routes/meeting-list.tsx` — add Import button + handler
- Uses: `apps/desktop/src-tauri/src/audio/import.rs` — existing `import_audio` command
- Uses: `apps/desktop/src-tauri/src/lib.rs` — already registered

## Implementation Steps

1. Import `open` from `@tauri-apps/plugin-dialog` in meeting-list.tsx
2. Add `handleImportAudio` async function:
   - Call `open()` with audio file filters
   - If user cancels (null), return early
   - `create_meeting` with title "Imported — {filename}"
   - `import_audio` with selected path
   - `update_meeting` with audio_path + duration
   - `navigate` to meeting detail
3. Add "Import Audio" button next to "New Recording" with Upload icon

## Success Criteria

- [ ] Click "Import Audio" opens native file picker filtered to audio formats
- [ ] Selecting a file creates meeting, copies audio, navigates to detail
- [ ] Cancel dismisses cleanly with no side effects
- [ ] Transcribe button appears on imported meeting (audio_path set)
- [ ] Invalid file format shows error (caught by Rust `import_audio`)

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Tauri dialog `open` not available | Low | Plugin already in Cargo.toml + package.json |
| Large files slow copy | Low | `import_audio` does fs::copy — acceptable for MVP |
| Duplicate file names | Low | Rust uses UUID filenames to avoid collisions |
