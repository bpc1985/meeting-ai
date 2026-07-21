---
phase: 2
title: "Polish"
status: pending
priority: P3
dependencies: [1]
---

# Phase 2: Polish

## Overview

Handle edge cases: empty meeting list import, error feedback for unsupported formats, import during recording state conflict.

## Requirements

- Functional: Error messages shown as UI toast/banner. Import from meeting detail page itself as alternative entry point. Duration detection for imported files.
- Non-functional: Snappy feedback on format errors. No state leaks.

## Architecture

```
[Import from empty state] → Same flow as meeting list button (code reuse)
[Import from meeting detail] → "Import Another" in empty transcript view
[Error handling] → Try/catch around invoke, show error text below button
```

## Related Code Files

- Modify: `apps/desktop/src/routes/meeting-list.tsx` — error state + empty-state button
- Modify: `apps/desktop/src/routes/meeting-detail.tsx` — import-from-detail (optional, P3)

## Implementation Steps

1. Add `importError` state to meeting-list, display red text below button on failure
2. Add "Import Audio" option to empty state UI (alongside "Start Recording")
3. (Optional) Add "Import Another" button on meeting detail page when no audio exists

## Success Criteria

- [ ] Unsupported format shows clear error message (not raw Rust string)
- [ ] Error clears on next successful import or button click
- [ ] Import available from empty state (no meetings yet)

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Error message UX | Low | Already handled by Rust validation in import_audio |
| State conflict with recording | Low | Import button hidden when recording state is active |
