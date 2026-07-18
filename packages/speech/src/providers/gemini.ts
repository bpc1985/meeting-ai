import type { SpeechProvider, TranscriptResult } from "../types";
import { withRetry } from "../retry";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export class GeminiSpeechProvider implements SpeechProvider {
  name = "gemini";

  async transcribe(
    audioPath: string,
    apiKey: string,
    _options?: Record<string, unknown>
  ): Promise<TranscriptResult> {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const audioBytes = await readFile(audioPath);

    // ponytail: browser doesn't have Buffer, use btoa with Uint8Array
    const base64 = arrayBufferToBase64(audioBytes.buffer as ArrayBuffer);

    // Detect MIME type from file extension — compressor produces .webm, chunker produces .wav
    const extension = audioPath.split(".").pop()?.toLowerCase();
    const mimeType = extension === "webm" ? "audio/webm"
      : extension === "wav" ? "audio/wav"
      : extension === "m4a" ? "audio/mp4"
      : extension === "ogg" ? "audio/ogg"
      : "audio/mpeg";

    const response = await withRetry(() =>
      fetch(GEMINI_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64,
                  },
                },
                {
                  text: 'Transcribe this audio. Return a JSON array of segments with this exact structure: {"segments": [{"start": number_seconds, "end": number_seconds, "text": "transcript here"}]}. Return ONLY valid JSON, no markdown wrappers, no other text.',
                },
              ],
            },
          ],
          generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
        }),
      })
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message =
        response.status === 400
          ? `Invalid Gemini API key: ${err?.error?.message ?? "Unknown"}`
          : `Gemini API error ${response.status}: ${err?.error?.message ?? "Unknown"}`;
      throw new (await import("../retry")).HttpError(message, response.status);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const json = extractJson(text);

    const segments = (json.segments ?? []).map(
      (s: { start: number; end: number; text: string }) => ({
        start: s.start,
        end: s.end,
        text: s.text?.trim() ?? "",
      })
    );

    const duration = segments.length > 0 ? segments[segments.length - 1].end : 0;

    return { segments, duration };
  }
}

// ponytail: extract JSON even if Gemini wraps it in ```json fences
function extractJson(text: string): { segments: Array<{ start: number; end: number; text: string }> } {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // fallback: try to find JSON object in the text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    return { segments: [] };
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 8192;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}
