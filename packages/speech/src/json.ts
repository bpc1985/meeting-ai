/**
 * Extract a JSON object from text, handling markdown code fences.
 * Shared by LLM and speech Gemini providers.
 * Returns fallback on parse failure (empty object by default).
 */
export function extractJson<T = Record<string, unknown>>(
  text: string,
  fallback?: () => T,
): T {
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        // fall through to fallback
      }
    }
    return fallback ? fallback() : ({} as T);
  }
}
