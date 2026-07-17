export const MEETING_SUMMARY_PROMPT = `You are a professional meeting assistant. Analyze the following meeting transcript and return a structured JSON summary. Be concise and actionable.

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
}`;
