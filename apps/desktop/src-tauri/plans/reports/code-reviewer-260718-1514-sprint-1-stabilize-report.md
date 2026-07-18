# Code Review: Sprint 1 -- Stabilize

**Date**: 2026-07-18
**Branch**: main
**Commit**: a2adb77
**Files**: 27 changed, +675/-215

## Verification Gates

| Gate | Result |
|------|--------|
| cargo build | PASS (1 pre-existing warning: unused `Migrations` import) |
| cargo test | PASS (4/4) |
| npm run build | PASS |
| npm run test | PASS (4/4, chunker.test.ts) |
| npm run lint | PASS (2 pre-existing warnings) |

## Acceptance Criteria: 12/12 VERIFIED

All 12 acceptance criteria are met. Evidence in the diff.

---

## Findings

### CRITICAL: Gemini provider sends WebM audio with mimeType "audio/mp3"

**Files**: `packages/speech/src/providers/gemini.ts:31`, `packages/speech/src/compressor.ts:27`, `packages/speech/src/chunker.ts:165-171`

**The bug**: Three facts in conflict:

1. `compressToMp3()` produces **WebM Opus** files (`.webm`) — line 27: `mimeType: "audio/webm;codecs=opus"`, line 45: `${crypto.randomUUID()}.webm`
2. `findSilenceBoundaries` path (file >24MB): `writeChunkToTemp` calls `audioBufferToWav` which produces **raw PCM WAV** — chunker.ts line 165-171, file extension `.wav`
3. `GeminiSpeechProvider.transcribe()` hardcodes `mimeType: "audio/mp3"` — gemini.ts line 31

So the provider always tells Gemini "this is audio/mp3" but sends:
- **Non-chunked path**: WebM Opus bytes — not MP3, not a listed Gemini audio format
- **Chunked path**: WAV bytes — actually supported by Gemini, but declared as MP3

Per Gemini docs (ai.google.dev), supported inline audio formats: `audio/wav`, `audio/mp3`, `audio/aiff`, `audio/aac`, `audio/ogg`, `audio/flac`. **WebM is NOT listed.** Whether the API validates the mimeType header strictly or auto-detects is unknown, but the mismatch on the non-chunked path (WebM declared as MP3) is a failure mode waiting to happen.

**Impact**: Non-chunked transcriptions via Gemini may fail with a validation error. Chunked path would work if mimeType were "audio/wav" instead of "audio/mp3", but a "WAV declared as MP3" mismatch may also trigger a 400.

**Fix** (minimal):
```typescript
// packages/speech/src/providers/gemini.ts, replace line 31
const extension = audioPath.split(".").pop()?.toLowerCase();
const mimeType = extension === "webm" ? "audio/webm"
  : extension === "wav" ? "audio/wav"
  : "audio/mpeg";
```

And fix the compressor name/pipeline: either rename `compressToMp3` → `compressAudio` (and reconcile the extension) or have the compressor produce an actual supported format.

**Severity**: Correctness — transcription failures in production.

---

### HIGH: ErrorBoundary has no `componentDidCatch` — errors silently lost

**File**: `apps/desktop/src/components/error-boundary.tsx`

Only `getDerivedStateFromError` is implemented. No `componentDidCatch` to log the error. Production crashes will show "Something went wrong" with zero diagnostic information (no stack, no error message, no console output).

Add:
```typescript
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  console.error("ErrorBoundary:", error, errorInfo);
}
```

**Severity**: Quality — defeats the diagnostic purpose of error boundaries.

---

### HIGH: `useEffect` missing `store` dependency

**File**: `apps/desktop/src/hooks/use-settings.ts:42-61`

The effect calls `store.setSpeechProvider()`, `store.setLLMProvider()`, `store.setApiKey()` but omits `store` from deps. Flagged by oxlint: `react-hooks(exhaustive-deps)`. Zustand refs are stable so this works currently, but it's technically incorrect and would break if the pattern ever changes. Include `store` in deps.

**Severity**: Quality — latent bug, cleanly caught by the linter.

---

### MEDIUM: `merge_wav_files` leaves truncated file on partial failure

**File**: `apps/desktop/src-tauri/src/audio/recorder.rs:303-316`

After `File::create(output)` truncates the file (line 303), the header writes (line 304), then chunks are re-read and appended (lines 307-316). If re-read/write fails (e.g. chunk file deleted between the two passes), the error propagates, but the output path now contains a truncated WAV with valid header — could be mistaken for a valid file later. Low-likelihood. Mitigation: delete output on error.

**Severity**: Quality — stale partial file, edge case.

---

### MEDIUM: Settings save on blur has no error feedback

**File**: `apps/desktop/src/routes/settings.tsx:34,46`

`saveSetting.mutate(...)` is fire-and-forget in the `onBlur` handler. If keychain storage fails (security prompt denial, macOS sandbox issue), the user gets no visual indication their API key wasn't saved. The mutation result is discarded.

**Severity**: UX — silent data loss on save failure.

---

### LOW: Unused import `useMemo` in `recording.tsx:3`

Pre-existing, flagged by oxlint.

---

## Edge Cases Checked

- **Compressor simplification**: Old compressor did redundant `OfflineAudioContext` pass at same sample rate — removing it is correct. No data loss.
- **Keychain `-U` flag**: `security add-generic-password -U` handles update. The delete+retry on failure is redundant but harmless.
- **CSP Tauri IPC**: `connect-src` includes both `ipc:` and `http://ipc.localhost` — covers both Tauri v2 custom protocol and fallback.
- **WAV header finalization on pause**: `WavWriter::drop` writes final header data — correct.
- **Search FTS escape**: `search_meetings` correctly guards empty/whitespace-only queries and FTS special chars.

## Recommendations

1. Fix Gemini mimeType mismatch — auto-detect from extension
2. Add `componentDidCatch` logging to ErrorBoundary
3. Include `store` in `useEffect` deps
4. Delete partial output file on `merge_wav_files` error
5. Surface save errors in Settings UI

## Unresolved

- Does Gemini API strictly validate `mimeType` in `inlineData` or auto-detect? Docs don't say. Regardless, the mismatch between declared and actual format is a correctness bug.
