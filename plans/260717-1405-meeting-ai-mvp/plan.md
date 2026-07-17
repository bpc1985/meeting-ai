---
title: "Meeting AI - Desktop Meeting Transcription App MVP"
description: "Cross-platform desktop meeting transcription app with mic recording, OpenAI Whisper STT, Gemini summarization, editable transcripts, and local SQLite storage"
status: pending
priority: P1
branch: "main"
tags: [tauri, react, typescript, sqlite, whisper, gemini, desktop]
blockedBy: []
blocks: []
created: "2026-07-17T07:11:36.574Z"
createdBy: "ck:plan"
source: skill
---

# Meeting AI - Desktop Meeting Transcription App MVP

## Overview

Privacy-first desktop meeting transcription app. Users record mic audio, transcribe via their own OpenAI/Gemini API keys, edit transcripts, export to TXT/SRT, and generate AI meeting summaries. All data stays local in SQLite.

**Stack:** Tauri v2 + React 19 + TypeScript + Vite + TailwindCSS 4 + shadcn/ui + Zustand + TanStack Query + rusqlite + cpal/hound

## Key Architectural Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Recording | cpal + hound (Rust) | No Tauri audio plugin exists; cpal is cross-platform, hound writes valid WAV |
| Database | rusqlite bundled + FTS5 | Full control over SQL, FTS5 requires bundled feature; tauri-plugin-sql too limited |
| STT | OpenAI Whisper-1 API | Native timestamps, SRT/VTT output, $0.006/min, structured segments |
| LLM Summary | Gemini 2.5 Flash API | Cheap ($0.002/min), good summarization, prompt-driven |
| Export | Hand-rolled formatters | ~30 lines each; no library needed for write-only SRT/TXT |
| Audio storage | Files on disk, paths in DB | No BLOBs in SQLite; app_data_dir/audio/ per platform |
| State | Zustand (UI) + TanStack Query (API) | Zustand for app state, TanStack for async data fetching from Rust commands |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Project Scaffolding](./phase-01-project-scaffolding.md) | Pending |
| 2 | [Rust Backend & Database](./phase-02-rust-backend-database.md) | Pending |
| 3 | [Audio Recording & Import](./phase-03-audio-recording-import.md) | Pending |
| 4 | [Speech-to-Text Integration](./phase-04-speech-to-text-integration.md) | Pending |
| 5 | [AI Summary & LLM Integration](./phase-05-ai-summary-llm-integration.md) | Pending |
| 6 | [Frontend UI - Core](./phase-06-frontend-ui-core.md) | Pending |
| 7 | [Frontend UI - Recording & Transcript](./phase-07-frontend-ui-recording-transcript.md) | Pending |
| 8 | [Export & Polish](./phase-08-export-polish.md) | Pending |
| 9 | [Integration & Testing](./phase-09-integration-testing.md) | Pending |

## Dependencies

- Phase 1 must complete first (scaffolding)
- Phases 2, 3 are independent after 1
- Phase 4 depends on 3 (needs recorded audio)
- Phase 5 depends on 4 (needs transcript text)
- Phase 6 is independent after 1
- Phase 7 depends on 3, 4, 6
- Phase 8 depends on 4, 7
- Phase 9 depends on all

## References

- [Design Guidelines](../../docs/design-guidelines.md)
- [Wireframes](../../docs/wireframes/)
- [STT API Research](../../plans/reports/research-260717-1335-speech-api-report.md)
- [Audio Recording Research](../../plans/reports/research-260717-1335-tauri-audio-recording-report.md)
- [SQLite Research](../../plans/reports/researcher-260717-1338-tauri-sqlite-report.md)
- [Export Formats Research](../../plans/reports/research-260717-1335-export-formats-report.md)
- [UI Trends Research](../../plans/reports/research-260717-1342-ui-trends-report.md)
