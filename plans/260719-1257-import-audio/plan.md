---
title: "Import Audio File"
description: "Let users import pre-recorded audio files instead of recording live"
status: pending
priority: P2
branch: "main"
tags: ["feature", "import", "audio", "ui"]
blockedBy: []
blocks: []
created: "2026-07-19T05:57:52.837Z"
createdBy: "ck:plan"
source: skill
---

# Import Audio File

## Overview

Add a UI flow to let users pick a pre-recorded audio file on disk (WAV, MP3, M4A, OGG, FLAC, WebM) instead of recording live. The `import_audio` Tauri command already exists in the Rust backend — copies validated files to the app data dir. Only UI changes needed.

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [UI Import Flow](./phase-01-ui-import-flow.md) | Pending |
| 2 | [Polish](./phase-02-polish.md) | Pending |

## Dependencies

None. No other plans touch these files.

## Key Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| File picker | Tauri dialog plugin `open` | Already a dependency, native macOS experience |
| Entry point | Meeting list page "Import" button | Natural alongside "New Recording" |
| After import | Navigate to meeting detail | Same flow as recording stop |
