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

    const blob = new Blob([audioBytes as unknown as BlobPart], { type: "audio/mpeg" });
    const form = new FormData();
    form.append("file", blob, "audio.mp3");
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
      if (response.status === 401) throw new Error("Invalid OpenAI API key");
      throw new Error(
        `Whisper API error ${response.status}: ${err?.error?.message ?? "Unknown"}`
      );
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
