---
phase: 9
title: "Integration & Testing"
status: pending
priority: P1
dependencies: [1, 2, 3, 4, 5, 6, 7, 8]
---

# Phase 9: Integration & Testing

## Overview

End-to-end integration testing of the complete MVP workflow. Verify Rust commands, frontend components, and cross-platform builds. Run typecheck, lint, and Cargo test. Fix regressions. Document known issues.

## Requirements

- **Functional:** Complete recording → transcription → editing → summary → export workflow works end-to-end
- **Non-functional:** TypeScript strict mode passes, Cargo builds clean, Cargo tests pass, cross-platform build verification

## Test Plan

### Workflow Tests (Manual + Automated)

| # | Flow | Steps | Expected |
|---|------|-------|----------|
| 1 | **Record + Transcribe** | Start recording → speak 30s → stop → click Transcribe → wait | WAV saved, segments appear in editor, status → 'transcribed' |
| 2 | **Import + Transcribe** | Drag WAV file to app → click Transcribe | Imported audio transcribed, segments display |
| 3 | **Edit Transcript** | Double-click segment → edit text → blur | Text updated in DB |
| 4 | **Speaker rename** | Click speaker pill → rename | Speaker label updates on all segments |
| 5 | **Split segment** | Hover segment → click split icon | Segment splits into two at cursor position |
| 6 | **Delete segment** | Hover segment → click delete → confirm | Segment removed |
| 7 | **Generate summary** | Click "Generate AI Summary" → wait | Summary tabs populate, status → 'summarized' |
| 8 | **Regenerate summary** | Click "Regenerate" | New summary replaces old |
| 9 | **Export TXT** | Click Export → TXT → choose path | TXT file with speaker labels creates |
| 10 | **Export SRT** | Click Export → SRT → choose path | SRT file with timestamps creates, playable in video player |
| 11 | **Search** | Type keyword in search bar | Matching meetings appear |
| 12 | **Delete meeting** | Right-click meeting → Delete → confirm | Meeting + audio + segments + summary deleted |
| 13 | **Settings persist** | Enter API key → restart app | API key still set |
| 14 | **Empty state** | Fresh install → no meetings | Empty state with CTA displays |

### Rust Unit Tests

```rust
// src-tauri/src/db/tests.rs
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_create_and_get_meeting() {
        let dir = tempdir().unwrap();
        let db = init_db(dir.path()).unwrap();
        // ... test CRUD
    }

    #[test]
    fn test_search_fts5() {
        // Insert segments, verify MATCH query returns results
    }

    #[test]
    fn test_migrations_run() {
        // Verify all migrations apply without error
    }

    #[test]
    fn test_record_wav_creation() {
        // Start/stop recording, verify WAV file exists and is valid
    }
}
```

### Frontend Tests

```typescript
// packages/export/src/__tests__/txt.test.ts
import { describe, it, expect } from 'vitest';
import { formatAsTxt } from '../txt';

describe('TXT formatter', () => {
  it('formats segments with speaker labels', () => {
    const segments = [
      { speaker_label: 'Speaker 1', text: 'Hello', start_secs: 0, end_secs: 2 },
      { speaker_label: 'Speaker 2', text: 'Hi', start_secs: 2, end_secs: 4 },
    ];
    const result = formatAsTxt(segments, 'Test Meeting');
    expect(result).toContain('Speaker 1:\nHello');
    expect(result).toContain('Speaker 2:\nHi');
  });

  it('handles empty segments array', () => {
    const result = formatAsTxt([], 'Empty');
    expect(result).toContain('Empty');
  });
});
```

```typescript
// packages/export/src/__tests__/srt.test.ts
import { describe, it, expect } from 'vitest';
import { formatAsSrt } from '../srt';

describe('SRT formatter', () => {
  it('formats segments with correct timestamps', () => {
    const segments = [
      { speaker_label: 'Speaker 1', text: 'Hello', start_secs: 1.5, end_secs: 5.2 },
    ];
    const result = formatAsSrt(segments);
    expect(result).toContain('00:00:01,500 --> 00:00:05,200');
    expect(result).toContain('Speaker 1: Hello');
  });

  it('handles hour rollover', () => {
    const segments = [
      { speaker_label: 'S1', text: 'Late', start_secs: 3661.0, end_secs: 3720.0 },
    ];
    const result = formatAsSrt(segments);
    expect(result).toContain('01:01:01,000 --> 01:02:00,000');
  });

  it('indexes from 1', () => {
    const segments = [
      { speaker_label: 'S1', text: 'A', start_secs: 0, end_secs: 1 },
      { speaker_label: 'S1', text: 'B', start_secs: 1, end_secs: 2 },
    ];
    const result = formatAsSrt(segments);
    expect(result).toMatch(/^1\n/m);
    expect(result).toMatch(/\n2\n/m);
  });
});
```

## Implementation Steps

1. Add Rust unit tests for DB operations in `src-tauri/src/db/tests.rs`
2. Add Rust unit test for recording (mock cpal device if possible, or integration test)
3. Install `vitest` in root workspace
4. Write frontend unit tests for export formatters
5. Write component tests for `TranscriptSegment` (editing behavior)
6. Write component tests for `SummaryPanel` (tab switching)
7. Manual end-to-end run of the complete workflow (14 scenarios above)
8. Run `cargo test` → fix failures
9. Run `npx tsc --noEmit` across all packages → fix type errors
10. Run `npx vitest run` → fix failures
11. Add `cargo clippy` to catch Rust warnings
12. Document any known issues or limitations in `docs/` or plan report

## Quality Gates

```bash
# Must all pass before phase is complete:
cargo build           # Rust compiles
cargo test            # Rust tests pass
cargo clippy          # No Rust warnings
npx tsc --noEmit      # TypeScript compiles
npx vitest run        # Frontend tests pass
```

## Success Criteria

- [ ] All 14 workflow scenarios pass manually
- [ ] `cargo test` → all tests pass
- [ ] `cargo clippy` → no warnings
- [ ] `npx tsc --noEmit` → no type errors across all packages
- [ ] `npx vitest run` → all tests pass
- [ ] TXT and SRT formatter tests pass
- [ ] No console errors during normal usage
- [ ] Recording timer accurate to within 0.5s over 5 minutes
- [ ] Cross-platform build verified (`cargo tauri build` on at least 1 platform)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| cpal test unavailable without real hardware | Mark recording tests `#[ignore]` or use mock; document manual test steps |
| Tauri dialog plugin flaky in test | Test export formatting in isolation; verify dialog manually |
| CI unavailable for Rust cross-compile | Manual build test on macOS; document Windows/Linux build steps |
| Gemini/Whisper API keys needed for E2E tests | Skip API-bound tests without keys; use mock for formatter tests |
