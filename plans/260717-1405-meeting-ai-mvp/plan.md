---
title: Meeting AI - Desktop Meeting Transcription App MVP
description: >-
  Cross-platform desktop meeting transcription app with mic recording, OpenAI
  Whisper + Gemini STT, Gemini summarization, editable transcripts with speaker
  renaming, and local SQLite storage
status: completed
priority: P1
branch: main
tags:
  - tauri
  - react
  - typescript
  - sqlite
  - whisper
  - gemini
  - desktop
blockedBy: []
blocks: []
created: '2026-07-17T07:11:36.574Z'
createdBy: 'ck:plan'
source: skill
---

# Meeting AI - Desktop Meeting Transcription App MVP

## Overview

Privacy-first desktop meeting transcription app. Users record mic audio, transcribe via their own OpenAI/Gemini API keys, edit transcripts, export to TXT/SRT, and generate AI meeting summaries. All data stays local in SQLite.

**Stack:** Tauri v2 + React 19 + TypeScript + Vite + TailwindCSS 4 + shadcn/ui + Zustand + TanStack Query + rusqlite + cpal/hound

## Key Architectural Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Recording | cpal + hound (Rust) | No Tauri audio plugin exists; cpal is cross-platform, hound writes valid WAV. Pause via stop WAV + merge on resume. |
| Database | rusqlite bundled + FTS5 | Full control over SQL, FTS5 requires bundled feature; tauri-plugin-sql too limited |
| STT | OpenAI Whisper-1 + Gemini 2.5 Flash | Whisper for accurate timestamps/SRT; Gemini as alternative STT provider. Both configurable. |
| Audio upload | Compress to MP3 before upload | Raw WAV ~10MB/min, 25MB limit = 2.5 min. MP3 64kbps mono = ~50 min fits. |
| Chunking | Silence-based chunker | Full silence detection for >25MB files. Better quality chunk boundaries. |
| LLM Summary | Gemini 2.5 Flash API | Cheap ($0.002/min), good summarization, prompt-driven |
| Export | Hand-rolled formatters | ~30 lines each; no library needed for write-only SRT/TXT |
| Audio storage | Files on disk, paths in DB | No BLOBs in SQLite; app_data_dir/audio/ per platform |
| Speaker labels | Renameable Speaker 1/2 | Click to rename, persists across segments. No diarization yet. |

## Phases

| Phase | Name | Status |
|-------|------|--------|
| 1 | [Project Scaffolding](./phase-01-project-scaffolding.md) | Completed |
| 2 | [Rust Backend & Database](./phase-02-rust-backend-database.md) | Completed |
| 3 | [Audio Recording & Import](./phase-03-audio-recording-import.md) | Completed |
| 4 | [Speech-to-Text Integration](./phase-04-speech-to-text-integration.md) | Completed |
| 5 | [AI Summary & LLM Integration](./phase-05-ai-summary-llm-integration.md) | Completed |
| 6 | [Frontend UI - Core](./phase-06-frontend-ui-core.md) | Completed |
| 7 | [Frontend UI - Recording & Transcript](./phase-07-frontend-ui-recording-transcript.md) | Completed |
| 8 | [Export & Polish](./phase-08-export-polish.md) | Completed |
| 9 | [Integration & Testing](./phase-09-integration-testing.md) | Completed |

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

## Validation Log

### Session 1 — 2026-07-17
**Trigger:** ck:plan validate after `--hard` plan creation
**Questions asked:** 5

#### Questions & Answers

1. **[Architecture]** Phase 4 has two conflicting chunking strategies for >25MB audio. Which for MVP?
   - **Answer:** Full silence-based chunker
   - **Rationale:** Quality matters for transcription accuracy at chunk boundaries. Worth the implementation cost.

2. **[Architecture]** Settings UI shows Gemini as STT provider but plan only implements Whisper for transcription.
   - **Answer:** Add Gemini STT now — implement both Whisper and Gemini as STT providers
   - **Rationale:** Provides user choice, Gemini is cheaper ($0.002 vs $0.006/min), aligns with settings UI wireframe.

3. **[Architecture]** Raw WAV ~10MB/min, Whisper 25MB limit = only 2.5 min fits. How to handle?
   - **Answer:** Compress to MP3 before upload (64kbps mono = ~50 min fits in 25MB)
   - **Rationale:** Essential for real meeting lengths. Use browser AudioContext or Tauri-side encoding.

4. **[Architecture]** cpal doesn't natively pause streams. How to implement pause?
   - **Answer:** Stop current WAV, start new file on resume. Merge all chunks into one WAV on final stop.
   - **Rationale:** Clean WAV files, accurate duration. ~50 lines of WAV concatenation.

5. **[Scope]** Should MVP include speaker renaming (Speaker 1/2 → actual names)?
   - **Answer:** Yes, simple rename. Click speaker pill, type name. Persists across segments.
   - **Rationale:** High UX value for ~20 lines of code.

#### Confirmed Decisions
- Chunking: silence-based detection (not byte-split)
- Gemini: add as STT provider alongside Whisper (not summary-only)
- Audio upload: compress to MP3 before sending (not raw WAV)
- Pause: stop WAV + merge chunks on resume (not write silence, not remove pause)
- Speaker labels: renameable (not fixed Speaker 1/2)

#### Impact on Phases
- Phase 1: No change
- Phase 3: Update pause implementation to stop WAV + merge pattern. Add `merge_wav_files` function. Update audio section to document WAV merge approach.
- Phase 4: Add Gemini STT provider implementation. Add `AudioCompressor`/MP3 encoding step before upload. Implement silence-based chunker. Update speech package to export both providers.
- Phase 5: No structural change (Gemini summarization stays; Gemini STT is separate in Phase 4)
- Phase 6: Settings page now shows both Whisper and Gemini as transcription options (no disabled placeholder)
- Phase 7: Add speaker rename functionality to TranscriptSegment/SpeakerPill
- Phase 8: No change
- Phase 9: Add Gemini STT test case, MP3 compression test, pause merge test, speaker rename test

### Verification Results
- **Tier:** Full (9 phases)
- **Claims checked:** 15
- **Verified:** 12 | **Failed:** 0 | **Unverified:** 3
- **Unverified tags:** Plan references `research-260717-1335-tauri-sqlite` but actual file is `researcher-260717-1338-tauri-sqlite` — plan.md already uses correct filename. File exists and is referenced correctly.

### Whole-Plan Consistency Sweep
- **Files reread:** plan.md, phase-01 through phase-09
- **Decision deltas checked:** 5 (chunking strategy, Gemini STT, MP3 compression, pause implementation, speaker renaming)
- **Reconciled stale references:** 0 (all propagated cleanly)
- **Unresolved contradictions:** 0

All phase files updated with validation decisions. No stale terms remain. Plan ready for implementation.
