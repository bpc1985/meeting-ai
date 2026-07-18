import type { SpeechProvider, TranscriptResult } from "../types";
import { withRetry } from "../retry";

export class WhisperProvider implements SpeechProvider {
  name = "openai-whisper";

  async transcribe(
    audioPath: string,
    apiKey: string,
    _options?: Record<string, unknown>
  ): Promise<TranscriptResult> {
    // ponytail: read file via Tauri fs plugin, send via fetch FormData
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const audioBytes = await readFile(audioPath);

    const extension = audioPath.split(".").pop() ?? "webm";
    const mimeType = extension === "webm" ? "audio/webm" : extension === "mp3" ? "audio/mpeg" : "audio/wav";
    const blob = new Blob([audioBytes as unknown as BlobPart], { type: mimeType });
    const form = new FormData();
    form.append("file", blob, `audio.${extension}`);
    form.append("model", "whisper-1");
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "segment");

    const response = await withRetry(() =>
      fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      })
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const message =
        response.status === 401
          ? "Invalid OpenAI API key"
          : `Whisper API error ${response.status}: ${err?.error?.message ?? "Unknown"}`;
      throw new (await import("../retry")).HttpError(message, response.status);
    }

    const data = await response.json();

    return {
      segments: (data.segments ?? []).map(
        (s: { start: number; end: number; text: string }) => ({
          start: s.start,
          end: s.end,
          text: s.text.trim(),
        })
      ),
      language: data.language,
      duration: data.duration ?? 0,
    };
  }
}
