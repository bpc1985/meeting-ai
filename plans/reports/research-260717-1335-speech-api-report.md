# Speech-to-Text API Research: Gemini vs OpenAI Whisper

*Date: 2026-07-17 | For: meeting-ai desktop app*

## 1. Gemini (2.5 Flash / Pro)

**Speech-to-text capability:** Gemini is a multimodal model that accepts audio as input and can transcribe, translate, and summarize. It is *not* a dedicated STT engine — you prompt it ("Transcribe this", "Transcribe with speaker labels"). 2.5 Flash and Pro both support audio.

**Sending audio:**
- **Inline base64:** `inline_data` in the request part, max ~20MB total request.
- **Files API upload:** for larger files. `files.upload()` returns a `uri` (e.g. `files/abc-123`) used in the content part. Per-file max **2GB**, 20GB/project. Required when request >100MB (docs say >100MB; inline cap is ~20MB — use Files API for anything substantial).
- Endpoint: `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=API_KEY`
- Auth: API key as query param or `Authorization: Bearer` header. SDK: `google-generativeai` (Python) / `@google/generative-ai` (JS).

**Formats / limits:**
- Formats: WAV, MP3, AIFF, AAC, OGG, FLAC.
- Context: up to **9.5 hours of audio per prompt**; audio billed at ~32 tokens/sec (~1,920 tokens/min).
- Languages: multilingual; no fixed list — prompt in target language. Quality varies by language.

**Timestamps:** No native word-level or segment JSON. You prompt for them: "Give timestamps in MM:SS". Output is free-form text, not structured segments. For reliable segment/word timing, Whisper is stronger.

**Pricing (audio input):** 2.5 Flash ≈ **$1.00 / 1M audio tokens** (≈ $1.00 per ~520 min at 32 tok/s — effectively very cheap, ~$0.002/min). Pro has no separately published audio rate on the pricing page (billed as Pro token rates). TTS is separate ($10/$20 per 1M audio tokens) and irrelevant to transcription.

## 2. OpenAI Whisper API (whisper-1)

**Capabilities:** Dedicated STT. Transcription (same language) and translation (→ English). Generally higher transcription accuracy than prompting Gemini for raw transcript; weaker at summarization.

**Formats / limits:**
- Formats: mp3, mp4, mpeg, mpga, m4a, wav, webm.
- **File size max 25MB** per request. Long audio MUST be chunked client-side.
- Endpoint: `POST https://api.openai.com/v1/audio/transcriptions`
- Auth: `Authorization: Bearer API_KEY`, `multipart/form-data` with `file`, `model=whisper-1`, `response_format`.

**Timestamps:** `response_format=verbose_json` returns `segments[]` each with `start`, `end`, `text`, `tokens`, `temperature`. `response_format=srt` / `vtt` gives subtitle files directly. Word-level timestamps available via `timestamp_granularities[]=word` (add `word` to get `words[]` per segment) — *confirm in code; API-ref fetch was blocked, but param is documented across OpenAI guides.*

**SRT/VTT:** Native — just set `response_format` to `srt` or `vtt`. No post-processing needed.

**Pricing:** whisper-1 ≈ **$0.006 / minute** of audio (official rate). ~25-min file per 25MB upload at typical bitrates.

## 3. Best Practices (both)

**Chunking long audio:**
- Whisper: hard 25MB cap → split on silence boundaries (pydub `detect_silence`), keep ~10-min chunks, re-stitch with offset adjustment. M4A/MP3 at 64–128kbps keeps files small.
- Gemini: rarely needed (9.5h/prompt) — use Files API for large files, then prompt per-section if context is huge.

**Error handling / retries:**
- Both: 429 (rate limit) and 5xx → exponential backoff (base 1s, factor 2, cap ~30s, 3–5 attempts). Use `Retry-After` header.
- Whisper 400 = bad format/size → fix before retry (don't blind-retry).
- Gemini Files API: poll `state` until `ACTIVE` before using `uri` (upload is async).
- Network/timeout: wrap in try/except, surface user-visible errors; never silently drop a chunk.

**Architectural fit for meeting-ai:**
- Need structured timestamps / SRT / VTT → **Whisper** (native, cheap, accurate transcript).
- Need translation, summarization, or speaker-aware notes in one pass → **Gemini** (prompt-driven).
- Recommended: Whisper for the transcript backbone + timestamps; optionally Gemini for summary/action-items on the transcript. Avoid dual STT.

## Trade-off Matrix

| Dimension | Gemini 2.5 Flash | Whisper-1 |
|---|---|---|
| Raw transcript accuracy | Good | Better (dedicated) |
| Structured timestamps | No (prompt only) | Yes (segments + words) |
| SRT/VTT native | No | Yes |
| Max file size | 2GB (Files API) | 25MB (chunk) |
| Cost / min | ~$0.002 | $0.006 |
| Summarization/translate | Strong | Weak |
| Setup complexity | Low (1 call) | Med (chunking) |

## Recommendation

Use **Whisper-1** as the STT core: native timestamps, SRT/VTT, predictable $0.006/min, accurate. Add a silence-based chunker for >25MB. Layer **Gemini 2.5 Flash** only for downstream summary / action-items on the transcript — not for transcription itself. This keeps the transcript structured and avoids Gemini's free-form timestamp weakness.

## Unresolved Questions
- Confirm `timestamp_granularities[]=word` availability against current API (ref fetch blocked).
- Confirm Gemini Pro audio billing rate (not on pricing page).
- Decide speaker diarization need: neither offers native diarization; would need a separate lib (pyannote) or Gemini prompting (unreliable).
