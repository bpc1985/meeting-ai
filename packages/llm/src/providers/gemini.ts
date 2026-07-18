import type { LLMProvider, MeetingSummary } from "../types";
import { MEETING_SUMMARY_PROMPT } from "../prompts/meeting-summary";
import { withRetry, HttpError } from "@meeting-ai/speech";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export class GeminiProvider implements LLMProvider {
  name = "gemini";

  async summarize(transcript: string, apiKey: string): Promise<MeetingSummary> {
    const prompt = MEETING_SUMMARY_PROMPT.replace("{transcript}", transcript);

    const response = await withRetry(() =>
      fetch(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      })
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message =
        response.status === 400
          ? `Invalid Gemini API key: ${err?.error?.message ?? "Unknown"}`
          : `Gemini API error ${response.status}: ${err?.error?.message ?? "Unknown"}`;
      throw new HttpError(message, response.status);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    const json = extractJson(text);

    return {
      overview: String(json.overview ?? ""),
      keyDecisions: Array.isArray(json.keyDecisions) ? json.keyDecisions as string[] : [],
      actionItems: Array.isArray(json.actionItems) ? json.actionItems as string[] : [],
      risks: (Array.isArray(json.risks) ? (json.risks as Array<Record<string, unknown>>) : []).map(
        (r: Record<string, unknown>) => ({
          description: String(r.description ?? ""),
          severity: typeof r.severity === "string" && ["high", "medium", "low"].includes(r.severity)
            ? (r.severity as "high" | "medium" | "low")
            : "medium" as const,
        })
      ),
    };
  }
}

function extractJson(text: string): Record<string, unknown> {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as Record<string, unknown>;
      } catch {
        // fallback: treat entire response as overview
      }
    }
    return { overview: text };
  }
}
