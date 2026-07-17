---
phase: 4
title: Speech-to-Text Integration
status: completed
priority: P1
dependencies:
  - 3
---

# Phase 4: Speech-to-Text Integration

## Overview

Implement OpenAI Whisper-1 and Gemini 2.5 Flash STT providers via shared `SpeechProvider` interface. Compress raw WAV to MP3 (64kbps mono) before upload to fit 25MB Whisper limit; silence-based chunker for >25MB files. Parse responses into timestamped segments, store in SQLite.
<!-- Updated: Validation Session 1 - Added Gemini STT provider + MP3 compression + silence chunker -->

## Requirements

- **Functional:** Transcribe audio via Whisper-1 or Gemini 2.5 Flash. Compress WAV to MP3 before upload (64kbps mono). Chunk >25MB files on silence boundaries. Parse segments with start/end timestamps and text.
- **Non-functional:** Retry on 429/5xx with exponential backoff. Show progress per chunk. Handle API key errors gracefully. Shared provider interface for easy extension.

## Architecture

```
packages/speech/
├── src/
│   ├── index.ts            # Exports
│   ├── types.ts            # SpeechProvider interface, Transcript, Segment
│   ├── providers/
│   │   ├── whisper.ts      # OpenAI Whisper-1 implementation
│   │   └── gemini.ts       # Gemini 2.5 Flash STT implementation
│   ├── chunker.ts          # Silence-based audio chunking (>25MB)
│   └── compressor.ts       # WAV → MP3 compression (64kbps mono)
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

/**
 * Chunk audio on silence boundaries for clean transcription splits.
 * Uses Web Audio API to detect silence regions (RMS below threshold for >500ms).
 * Each chunk stays under maxBytes (~24MB to leave headroom under 25MB limit).
 */
export async function chunkOnSilence(
  audioBuffer: AudioBuffer,
  maxChunkBytes: number = 24 * 1024 * 1024
): Promise<AudioBuffer[]> {
  // 1. Compute RMS energy in 100ms windows
  // 2. Mark windows where RMS < threshold as silence
  // 3. Split at longest silence regions that keep chunks under size limit
  // 4. Return array of non-overlapping AudioBuffers
}

export async function transcribeWithChunking(
  audioPath: string,
  provider: SpeechProvider,
  apiKey: string,
): Promise<TranscriptResult> {
  // 1. Compress to MP3 (see compressor.ts)
  const mp3Path = await compressToMp3(audioPath);
  const fileSize = (await stat(mp3Path)).size;

  if (fileSize <= maxChunkBytes) {
    return provider.transcribe(mp3Path, apiKey);
  }

  // 2. Decode MP3 to AudioBuffer for silence analysis
  // 3. Split on silence boundaries
  // 4. Transcribe each chunk, offset timestamps
  // 5. Merge segments
}
```

### Gemini STT Provider

```typescript
// packages/speech/src/providers/gemini.ts
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export class GeminiSpeechProvider implements SpeechProvider {
  name = 'gemini';

  async transcribe(audioPath: string, apiKey: string): Promise<TranscriptResult> {
    // Gemini accepts audio inline (base64) or via Files API
    // For MVP: use inline base64 (files under ~20MB after compression)

    const audioBytes = await readFile(audioPath);
    const base64Audio = Buffer.from(audioBytes).toString('base64');

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inlineData: { mimeType: 'audio/mp3', data: base64Audio } },
            { text: 'Transcribe this audio. Return JSON with this structure: {"segments": [{"start": number_seconds, "end": number_seconds, "text": "transcript text"}]}. Only return the JSON, no other text.' }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    });

    // Parse Gemini response and map to TranscriptResult
    // Note: Gemini doesn't provide native timestamps — it returns them in prompted format
    // Timestamps will be approximate; Whisper is the accurate option
  }
}
```

### Audio Compression

```typescript
// packages/speech/src/compressor.ts

/**
 * Compress WAV to MP3 64kbps mono before upload.
 * 10MB/min WAV becomes ~0.5MB/min MP3 — 50 min fits in 25MB limit.
 *
 * Implementation options:
 * - Browser AudioContext + MediaRecorder (preferred, no native deps)
 * - Tauri-side: shell out to ffmpeg if available
 *
 * ponytail: browser AudioContext first, fallback to Tauri ffmpeg if needed
 */
export async function compressToMp3(wavPath: string): Promise<string> {
  // 1. Read WAV via Tauri fs plugin
  // 2. Decode in AudioContext
  // 3. Re-encode via MediaRecorder at 64kbps mono
  // 4. Write MP3 to temp dir, return path
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
2. Implement `packages/speech/src/compressor.ts`: WAV → MP3 64kbps mono via browser AudioContext + MediaRecorder
3. Implement `packages/speech/src/chunker.ts`:
   - `chunkOnSilence()`: RMS energy detection in 100ms windows, split at longest silence gaps
   - `transcribeWithChunking()`: orchestrates compress → chunk → transcribe → stitch
4. Implement `packages/speech/src/providers/whisper.ts`:
   - `singleTranscribe(audioPath, apiKey)` → parses verbose_json response
   - Multipart/form-data with `file`, `model`, `response_format`, `timestamp_granularities[]`
   - Error handling for API key, rate limits, format errors
5. Implement `packages/speech/src/providers/gemini.ts`:
   - `transcribe(audioPath, apiKey)` → inline base64 audio + transcription prompt
   - Parse JSON response, handle approximate timestamps
   - `extractJson()` to handle markdown wrapping (same pattern as Phase 5)
6. Create frontend action in `packages/core/src/commands/transcription.ts`:
   - Orchestrate: read audio path, read API key from DB, compress, chunk (if needed), call provider, write segments
7. Add progress reporting: emit progress events (`total_chunks`, `current_chunk`)
8. Add retry logic with exponential backoff wrapper
9. Export via `packages/speech/src/index.ts`

## Success Criteria

- [ ] Whisper-1 STT: single file (<25MB after compression) returns correct segments with timestamps
- [ ] Gemini STT: returns transcript with approximate timestamps
- [ ] WAV compressed to MP3 (64kbps mono) before upload
- [ ] Silence-based chunker splits at quiet gaps, not mid-sentence
- [ ] Chunked transcription returns correctly offset timestamps
- [ ] Both providers configurable via settings (user picks one)
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
