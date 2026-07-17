---
phase: 8
title: Export & Polish
status: completed
priority: P1
dependencies:
  - 4
  - 7
---

# Phase 8: Export & Polish

## Overview

Implement TXT and SRT export formatters. Add export button UI in transcript editor. Polish UI details: keyboard shortcuts, toast notifications, empty states, loading skeletons, error boundaries.

## Requirements

- **Functional:** Export transcript to TXT (speaker-labeled plain text) and SRT (subtitle format with timestamps). Download via native save dialog.
- **Non-functional:** Formatters in `packages/export/`, pure functions (no side effects), well-typed.

## Architecture

```
packages/export/
├── src/
│   ├── index.ts
│   ├── txt.ts            # TXT formatter
│   ├── srt.ts            # SRT formatter
│   └── types.ts          # Shared types
```

### TXT Formatter

```typescript
// packages/export/src/txt.ts
import type { Segment } from '@meeting-ai/core';

/**
 * Format transcript segments as speaker-labeled plain text.
 *
 * Output:
 *   Speaker 1:
 *   Hello everyone.
 *
 *   Speaker 2:
 *   Good morning. Let's start the meeting.
 */
export function formatAsTxt(segments: Segment[], meetingTitle: string): string {
  const header = `${meetingTitle}\n${'='.repeat(meetingTitle.length)}\n\n`;

  const body = segments
    .map(s => `${s.speaker_label}:\n${s.text}`)
    .join('\n\n');

  return header + body;
}
```

### SRT Formatter

```typescript
// packages/export/src/srt.ts
import type { Segment } from '@meeting-ai/core';

/**
 * Format transcript segments as SRT subtitle file.
 *
 * Output:
 *   1
 *   00:00:01,500 --> 00:00:05,200
 *   Speaker 1: Hello everyone.
 *
 *   2
 *   00:00:05,200 --> 00:00:09,800
 *   Speaker 2: Good morning.
 */
export function formatAsSrt(segments: Segment[]): string {
  return segments
    .map((seg, i) => {
      const index = i + 1;
      const start = secondsToSrtTime(seg.start_secs);
      const end = secondsToSrtTime(seg.end_secs);
      const text = `${seg.speaker_label}: ${seg.text}`;
      return `${index}\n${start} --> ${end}\n${text}`;
    })
    .join('\n\n') + '\n';
}

/** Convert seconds to SRT timestamp: HH:MM:SS,mmm */
function secondsToSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor((totalSeconds % 1) * 1000);

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':') + ',' + String(millis).padStart(3, '0');
}
```

### Export Flow (Frontend)

```typescript
// apps/desktop/src/hooks/use-export.ts
import { formatAsTxt, formatAsSrt } from '@meeting-ai/export';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';

export function useExport(meetingId: string) {
  const { data: meeting } = useMeeting(meetingId);
  const { data: segments } = useSegments(meetingId);

  const exportAs = async (format: 'txt' | 'srt') => {
    if (!segments || !meeting) return;

    const content = format === 'txt'
      ? formatAsTxt(segments, meeting.title)
      : formatAsSrt(segments);

    const ext = format === 'txt' ? 'txt' : 'srt';
    const defaultName = `${slugify(meeting.title)}--${formatDate(meeting.created_at)}.${ext}`;

    const filePath = await save({
      defaultPath: defaultName,
      filters: [{
        name: format === 'txt' ? 'Text File' : 'Subtitle File',
        extensions: [ext],
      }],
    });

    if (filePath) {
      await writeTextFile(filePath, content);
      toast.success(`Exported as ${format.toUpperCase()}`);
    }
  };

  return { exportAs };
}
```

### Export Button UI

```tsx
// In transcript editor header
<div className="flex items-center gap-2">
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="secondary" size="sm">
        <Download className="w-4 h-4 mr-2" />
        Export
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem onClick={() => exportAs('txt')}>
        Export as TXT
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => exportAs('srt')}>
        Export as SRT
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

### Polish Items

1. **Toast notifications**: success/error toasts for transcription, summary, export, recording
2. **Empty states**: "No meetings yet. Record your first meeting." with CTA button
3. **Loading skeletons**: skeleton cards for meeting list, skeleton segment rows for transcript
4. **Error boundaries**: per-route error boundary with "Something went wrong" + retry button
5. **Keyboard shortcuts tooltip**: `Space` to start/pause recording, `Cmd+S` to export
6. **Meeting deletion**: confirmation dialog, cascade delete from SQLite
7. **Recording info bar**: show provider name, format, file size during recording
8. **Scroll-to-bottom**: auto-scroll transcript panel when new segments arrive (after transcription)

## Implementation Steps

1. Create `packages/export/src/types.ts` with shared types
2. Implement `packages/export/src/txt.ts` → `formatAsTxt()`
3. Implement `packages/export/src/srt.ts` → `formatAsSrt()` + `secondsToSrtTime()`
4. Add unit tests for formatters:
   - TXT: empty segments, single segment, multiple segments, special chars
   - SRT: timestamp formatting edge cases (hour rollover, millisecond precision)
5. Create `useExport` hook connecting to Tauri save dialog
6. Add Export dropdown button to transcript editor header
7. Add toasts: install `sonner` or use shadcn/ui toast
8. Add delete meeting functionality: confirmation dialog + cascade DB delete
9. Add loading skeletons for meeting list and transcript
10. Add empty state for meeting list
11. Add error boundary wrapper in App.tsx

## Success Criteria

- [ ] TXT export produces readable speaker-labeled text file
- [ ] SRT export produces valid subtitle file (test with VLC/QuickTime)
- [ ] Export uses native OS save dialog (Tauri dialog plugin)
- [ ] Filename defaults to `{meeting-title}--{date}.{ext}`
- [ ] SRT timestamps correctly formatted (HH:MM:SS,mmm with comma)
- [ ] Toast notifications work for all async operations
- [ ] Empty state shows "Record your first meeting" CTA
- [ ] Meeting deletion with confirmation dialog works
- [ ] Loading skeletons display during data fetch
- [ ] Error boundary catches and displays React errors gracefully

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| SRT timestamp overflow (hours > 99) | Cap at realistic meeting lengths; SRT spec allows hours ≥ 2 digits |
| Special characters in transcript breaking export | Use UTF-8 (SRT requires it); TXT is raw UTF-8 |
| Tauri save dialog not available on all platforms | `tauri-plugin-dialog` covers all 3 platforms |
| Very long meeting names → invalid filenames | `slugify()` sanitizes: remove special chars, limit length |
