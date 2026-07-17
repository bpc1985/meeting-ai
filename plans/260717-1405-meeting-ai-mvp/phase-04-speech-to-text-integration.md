---
phase: 4
title: "Speech-to-Text Integration"
status: pending
priority: P1
dependencies: [3]
---

# Phase 4: Speech-to-Text Integration

## Overview

Implement OpenAI Whisper API transcription. Send audio via multipart/form-data, chunk files >25MB on silence boundaries, parse `verbose_json` response into segments. Store segments in SQLite. Display progress to user during transcription.

## Requirements

- **Functional:** Transcribe audio file via Whisper-1 API. Handle <25MB files (single request) and >25MB files (chunked). Parse segments with start/end timestamps and text.
- **Non-functional:** Retry on 429/5xx with exponential backoff. Show progress per chunk. Handle API key errors gracefully.

## Architecture

```
packages/speech/
├── src/
│   ├── index.ts            # Exports
│   ├── types.ts            # SpeechProvider interface, Transcript, Segment
│   ├── providers/
│   │   ├── whisper.ts      # OpenAI Whisper-1 implementation
│   │   └── gemini.ts       # Gemini (future: transcription via Gemini)
│   └── chunker.ts          # Silence-based audio chunking (>25MB)
```

### Provider Interface

```typescript
// packages/speech/src/types.ts
export interface TranscriptSegment {
  start: number;    // seconds
  end: number;      // seconds
  text: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  language?: string;
  duration: number;
}

export interface SpeechProvider {
  name: string;
  transcribe(audioPath: string, apiKey: string, options?: Record<string, unknown>): Promise<TranscriptResult>;
}
```

### Whisper Implementation

```typescript
// packages/speech/src/providers/whisper.ts
import type { SpeechProvider, TranscriptResult, TranscriptSegment } from '../types';

export class WhisperProvider implements SpeechProvider {
  name = 'openai-whisper';

  async transcribe(audioPath: string, apiKey: string, options?: Record<string, unknown>): Promise<TranscriptResult> {
    // 1. Read file from frontend via Tauri fs plugin
    // 2. Check file size — if >25MB, chunk first (handled by chunker)
    // 3. Create FormData with file, model=whisper-1, response_format=verbose_json, timestamp_granularities[]=word
    // 4. POST to https://api.openai.com/v1/audio/transcriptions
    //    Headers: Authorization: Bearer ${apiKey}
    // 5. Parse response.verbose_json → segments[]
    // 6. Map: { start, end, text } → TranscriptSegment[]
    // 7. Return TranscriptResult
  }
}
```

### Chunking Strategy (>25MB files)

```typescript
// packages/speech/src/chunker.ts
export function chunkBySize(filePath: string, maxBytes: number = 24 * 1024 * 1024): string[] {
  // ponytail: simple byte-split, no silence detection for MVP
  // If chunks overlap mid-word, Whisper handles it fine
  // Add silence-boundary detection (pydub-style) if quality degrades
}
```

Actually implement silence-based:

```typescript
// packages/speech/src/chunker.ts
export async function chunkAudio(
  filePath: string,
  apiKey: string,
  options: { maxChunkBytes?: number }
): Promise<TranscriptResult> {
  const maxBytes = options.maxChunkBytes ?? 24 * 1024 * 1024;
  const fileSize = (await stat(filePath)).size;

  if (fileSize <= maxBytes) {
    // Single request — no chunking needed
    return singleTranscribe(filePath, apiKey);
  }

  // ponytail: chunk on fixed 10-min intervals (~6MB at 16-bit mono 16kHz)
  // Whisper timestamps are relative per chunk → add offset when stitching
  const chunks = splitAudioFile(filePath, 600); // 10-min chunks
  const allSegments: TranscriptSegment[] = [];
  let timeOffset = 0;

  for (const chunk of chunks) {
    const result = await singleTranscribe(chunk, apiKey);
    // Offset timestamps
    for (const seg of result.segments) {
      allSegments.push({
        start: seg.start + timeOffset,
        end: seg.end + timeOffset,
        text: seg.text,
      });
    }
    timeOffset += result.duration;
  }

  return { segments: allSegments, duration: timeOffset };
}
```

### Frontend Command Integration

```typescript
// Tauri command bridge (Rust side)
// Ponytail: do this in TypeScript via fetch() from frontend
// Avoid Rust HTTP client — no need for native TLS, JS fetch works fine from webview

// packages/core/src/commands/transcription.ts
export async function transcribeMeeting(
  meetingId: string,
  audioPath: string,
  apiKey: string
): Promise<void> {
  // 1. Read API key from settings store (or db)
  // 2. Call whisper.transcribe(audioPath, apiKey)
  // 3. Write segments to DB via get_segments/create_segments_batch Tauri commands
  // 4. Update meeting status to 'transcribed'
}
```

### Retry with Backoff

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (err: any) {
      if (i === maxRetries) throw err;
      if (err.status === 429 || err.status >= 500) {
        const delay = Math.min(1000 * Math.pow(2, i), 30000);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err; // 4xx = don't retry
    }
  }
  throw new Error('unreachable');
}
```

## Implementation Steps

1. Create `packages/speech/src/types.ts` with provider interface and types
2. Implement `packages/speech/src/providers/whisper.ts`:
   - `singleTranscribe(audioPath, apiKey)` → parses verbose_json response
   - Multipart/form-data with `file`, `model`, `response_format`, `timestamp_granularities[]`
   - Error handling for API key, rate limits, format errors
3. Implement `packages/speech/src/chunker.ts`:
   - Check file size vs 25MB limit
   - Split audio if needed (use fixed-time splitting; WAV headers let us calculate byte offsets)
   - Stitch results with time offset
4. Create frontend action in `packages/core/src/commands/transcription.ts`:
   - Orchestrate: read audio path, read API key from DB, call whisper, write segments
5. Add progress reporting: emit progress events (`total_chunks`, `current_chunk`)
6. Add retry logic with exponential backoff wrapper
7. Export via `packages/speech/src/index.ts`

## Success Criteria

- [ ] Single-file transcription (<25MB) returns correct segments with timestamps
- [ ] Chunked transcription (>25MB) returns correctly offset timestamps
- [ ] API key error returns clear user-facing message (not raw HTTP error)
- [ ] Rate limit (429) retries succeed after backoff
- [ ] Segments stored in SQLite via Rust command bridge
- [ ] Meeting status updates to 'transcribed' after completion
- [ ] Empty audio returns empty segments (not error)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Whisper API changes response format | Pin `whisper-1` model; validate response shape before mapping |
| 25MB limit = only ~25min at 128kbps MP3 | Acceptable; convert WAV to compressed format before send if needed |
| Large WAV files (600MB) can't directly upload | Use browser/ffmpeg.wasm to compress before upload; or chunk always |
| Network timeout on long transcriptions | Set reasonable timeout (120s); chunk ensures smaller payloads |
| API key stored but expired/revoked | 401 error → display "API key invalid" toast |
