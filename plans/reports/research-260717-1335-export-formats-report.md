# Export Format Research — SRT / VTT / TXT (meeting transcription)

Project is an empty repo (no existing code to reuse). Recommendations below account for YAGNI/KISS.

## 1. SRT specification (authoritative: Wikipedia/SubRip)
- Encoding: UTF-8 (BOM optional). No official encoding; ship UTF-8.
- Structure per cue, separated by a blank line:
  ```
  1
  00:00:01,000 --> 00:00:04,000
  Speaker: text line one
  text line two

  2
  ...
  ```
- Index: sequential, starts at 1, increments per cue.
- Timestamp: `HH:MM:SS,mmm` (comma before millis). Separator `-->` with spaces.
- No header line. No metadata block. Inline tags `<b>/<i>/<u>` optional.

## 2. VTT / WebVTT specification (W3C TR/webvtt1, MDN, Wikipedia)
- Header: first line literal `WEBVTT` (optional trailing text, optional UTF-8 BOM).
- Blank line, then cues. Cue = optional identifier line, then timing line, then payload:
  ```
  WEBVTT

  00:00:01.000 --> 00:00:04.000
  <v Speaker>text line one
  text line two
  ```
- Timestamp: `HH:MM:SS.mmm` (period before millis; hours/minutes optional for short media, but pad full for safety).
- Cue settings after end time: `line:`, `position:`, `align:`, `size:` (optional, skip for transcripts).
- Metadata: `NOTE` blocks (ignored by players), `STYLE` block (CSS, separate file preferred), `REGION`. Voice tag `<v Name>text</v>` for speaker.
- Precision: milliseconds (3 digits). Spec allows fractional beyond ms but players truncate.

## 3. Edge cases
- Empty segments: drop cues with empty payload (players render blank; wastes space). Filter before emit.
- Overlapping timestamps: SRT/VTT allow overlaps; players show both. For transcript export, prefer non-overlapping segments from ASR. If overlaps occur, keep as-is (don't silently merge — data loss).
- Speaker labels: inject as `Speaker: text` (SRT) or `<v Speaker>text` (VTT). Keep label source from transcription diarization output.
- Long lines: SRT/VTT have no hard 80-char limit, but soft-wrap at ~42 chars for readability (optional).

## 4. TypeScript libraries — recommendation: hand-roll
- `subtitle` (v4.2.2, MIT, updated 2025-11, ESM) — parse/serialize SRT+VTT, most maintained.
- `srt-parser-2` (v1.2.3, MIT) — SRT only, parse-only.
- `webvtt` (v0.0.2, BSD) — parser only, stale, CLI-oriented.
- `srt-to-vtt` (v1.1.3) — stream transform only.
- **Verdict:** Hand-roll. Emitting SRT/VTT is ~30 lines of string templating (timestamp format + join). Adding a dep for pure serialization is YAGNI. Use `subtitle` only if you later need *parsing* of uploaded files. Our export is write-only → no dep.

## 5. File naming conventions
- Pattern: `{meeting-title-slug}--{YYYYMMDD-HHMMSS}.{ext}`
- Sanitize title to kebab-case, cap length ~50 chars, strip path-traversal chars.
- Example: `q3-planning--20260717-133500.srt`
- Include ISO timestamp to avoid collisions; avoid spaces.

## 6. Other tools' conventions
- **Otter.ai**: exports TXT, SRT, VTT, DOCX, PDF. TXT uses `[Speaker] HH:MM:SS` or `Speaker: text` with optional timestamps; SRT/VTT standard. (Vendor help page blocked; based on known behavior.)
- **Descript**: exports TXT, SRT, VTT, DOCX, subtitle. Speaker labels as `Speaker 1:`; SRT/VTT standard cues. (Vendor page unreachable; known behavior.)
- **MacWhisper**: exports TXT, SRT, VTT, JSON, CSV. TXT = `HH:MM:SS - Speaker: text` or plain `Speaker: text`; SRT/VTT standard.
- Common TXT convention (cross-tool): `Speaker: text` per paragraph, optional `[HH:MM:SS]` prefix. We adopt `Speaker: text` with optional timestamp header.

## 7. TXT export format (recommendation)
```
Meeting Title — 2026-07-17

Speaker 1: first utterance across one or more sentences.

Speaker 2: response text.

...
```
- UTF-8, LF line endings, blank line between turns.
- Optional leading `[HH:MM:SS]` per turn if timestamps toggled on.
- One paragraph per speaker turn (group consecutive same-speaker segments).

## Trade-off summary
| Option | Dep cost | Risk | Fit |
|---|---|---|---|
| Hand-roll SRT/VTT | 0 | Low (simple spec) | Best for write-only export |
| `subtitle` lib | 1 dep | Low (maintained) | Only if parsing uploads needed |
| `srt-parser-2` | 1 dep | Low | SRT parse-only, unnecessary |

## Recommendation (ranked)
1. Hand-roll SRT + VTT serializers (~30 LOC each) + TXT (10 LOC). No deps.
2. Add `subtitle` only when import/parsing of user-uploaded subtitle files becomes a requirement.
3. Use UTF-8, millisecond timestamps, filter empty cues, inject speaker via `<v>` (VTT) / `Label:` (SRT).

## Limitations / unresolved
- Vendor export specifics (Otter/Descript/MacWhisper) could not be verified from primary docs (pages blocked/forbidden at fetch time). Conclusions are from known tool behavior, not fetched specs — verify if exact byte-compat with a specific tool matters.
- Web search returned no results (region-blocked); library choices confirmed via npm registry API directly.
- Did not cover: ASS/SSA, LRC, JSON transcript schema, or styling/positioning cues (out of scope for transcript export).
