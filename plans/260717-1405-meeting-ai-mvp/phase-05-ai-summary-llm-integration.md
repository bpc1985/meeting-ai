---
phase: 5
title: AI Summary & LLM Integration
status: completed
priority: P1
dependencies:
  - 4
---

# Phase 5: AI Summary & LLM Integration

## Overview

Implement Gemini 2.5 Flash integration for AI meeting summaries. Send full transcript text with structured prompt. Parse response into sections: overview, key decisions, action items, risks. Store summary in SQLite. Support regeneration.

## Requirements

- **Functional:** Generate structured meeting summary from transcript via Gemini API. Parse into 4 sections. Store in DB. Allow regeneration.
- **Non-functional:** Configurable API key per user. Streaming response display optional. Prompt engineered for consistent JSON output.

## Architecture

```
packages/llm/
├── src/
│   ├── index.ts
│   ├── types.ts              # LLMProvider interface
│   ├── providers/
│   │   └── gemini.ts         # Gemini 2.5 Flash implementation
│   └── prompts/
│       └── meeting-summary.ts # Structured summary prompt
```

### Provider Interface

```typescript
// packages/llm/src/types.ts
export interface SummarySection {
  title: string;
  content: string;
}

export interface MeetingSummary {
  overview: string;
  keyDecisions: string[];
  actionItems: string[];
  risks: Array<{ description: string; severity: 'high' | 'medium' | 'low' }>;
}

export interface LLMProvider {
  name: string;
  summarize(transcript: string, apiKey: string, options?: Record<string, unknown>): Promise<MeetingSummary>;
}
```

### Summary Prompt

```typescript
// packages/llm/src/prompts/meeting-summary.ts
export const MEETING_SUMMARY_PROMPT = `
You are a professional meeting assistant. Analyze the following meeting transcript and return a structured JSON summary. Be concise and actionable.

Transcript:
---
{transcript}
---

Return ONLY a JSON object (no markdown, no extra text) with this exact structure:
{
  "overview": "2-3 sentence summary of the meeting's purpose and outcomes",
  "keyDecisions": ["Decision 1", "Decision 2"],
  "actionItems": ["Action item with owner if mentioned", "Action item"],
  "risks": [
    { "description": "Risk description", "severity": "high|medium|low" }
  ]
}
`;
```

### Gemini Implementation

```typescript
// packages/llm/src/providers/gemini.ts
import type { LLMProvider, MeetingSummary } from '../types';
import { MEETING_SUMMARY_PROMPT } from '../prompts/meeting-summary';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export class GeminiProvider implements LLMProvider {
  name = 'gemini';

  async summarize(transcript: string, apiKey: string): Promise<MeetingSummary> {
    const prompt = MEETING_SUMMARY_PROMPT.replace('{transcript}', transcript);

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,      // Lower temp = more consistent JSON
          maxOutputTokens: 2048,
        },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${response.status} — ${err?.error?.message ?? 'Unknown'}`);
    }

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;

    // Parse JSON from response (handle occasional markdown wrapper)
    const json = extractJson(text);
    return {
      overview: json.overview,
      keyDecisions: json.keyDecisions || [],
      actionItems: json.actionItems || [],
      risks: json.risks || [],
    };
  }
}

// ponytail: simple JSON extraction — strip ```json wrappers if Gemini adds them
function extractJson(text: string): any {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(cleaned);
}
```

### Frontend Action Integration

```typescript
// packages/core/src/commands/summary.ts
export async function generateSummary(
  meetingId: string,
  apiKey: string
): Promise<MeetingSummary> {
  // 1. Fetch all segments for meeting via Tauri command
  const segments = await invoke<Segment[]>('get_segments', { meetingId });

  // 2. Build transcript text: "Speaker: text" per segment
  const transcript = segments
    .map(s => `${s.speaker_label}: ${s.text}`)
    .join('\n\n');

  // 3. Call Gemini provider
  const gemini = new GeminiProvider();
  const summary = await gemini.summarize(transcript, apiKey);

  // 4. Store in DB via Tauri command
  await invoke('create_summary', {
    meetingId,
    overview: summary.overview,
    keyDecisions: JSON.stringify(summary.keyDecisions),
    actionItems: JSON.stringify(summary.actionItems),
    risks: JSON.stringify(summary.risks),
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  });

  // 5. Update meeting status
  await invoke('update_meeting', { id: meetingId, status: 'summarized' });

  return summary;
}
```

## Implementation Steps

1. Create `packages/llm/src/types.ts` with provider interface
2. Create `packages/llm/src/prompts/meeting-summary.ts` with structured prompt
3. Implement `packages/llm/src/providers/gemini.ts`:
   - `summarize(transcript, apiKey)` → MeetingSummary
   - `extractJson()` to handle Gemini's occasional markdown wrapping
   - Error handling for invalid API key, rate limits, malformed JSON
4. Create `packages/core/src/commands/summary.ts`:
   - Orchestrate: read segments, build transcript, call Gemini, store result
   - Retry on 429/5xx
5. Add Tauri Rust command for `create_summary` if not yet implemented in phase 2
6. Export via `packages/llm/src/index.ts`

## Success Criteria

- [ ] Gemini API returns valid JSON meeting summary
- [ ] Summary parsed correctly into 4 sections (overview, decisions, actions, risks)
- [ ] Summary stored in SQLite and retrievable
- [ ] Meeting status updates to 'summarized'
- [ ] Invalid API key returns clear error message
- [ ] Regeneration replaces previous summary (not duplicate)
- [ ] Long transcripts (20,000+ chars) don't exceed Gemini context (9.5h audio equivalent = very safe for text)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Gemini returns invalid JSON | `extractJson()` strips markdown wrappers; fallback: treat entire response as overview |
| Transcript exceeds Gemini context | 9.5h audio ≈ 80K words — unlikely for meetings. If needed, chunk and stitch |
| Summary not actionable enough | Prompt is engineered for structure; user can regenerate if unsatisfied |
| Non-English transcripts | Prompt is English; Gemini handles multi-language but response will be English. Accept for MVP |
