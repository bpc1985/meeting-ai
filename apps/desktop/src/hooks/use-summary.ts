import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { GeminiProvider } from "@meeting-ai/llm";
import { WhisperProvider, GeminiSpeechProvider } from "@meeting-ai/speech";
import { useSettingsStore } from "../stores/settings-store";
import type { TranscriptSegment } from "@meeting-ai/core";

interface DbSummary {
  overview: string | null;
  key_decisions: string | null;
  action_items: string | null;
  risks: string | null;
  provider: string;
  model: string | null;
}

export function useSummary(meetingId: string | undefined) {
  const queryClient = useQueryClient();
  const settings = useSettingsStore();

  const query = useQuery<DbSummary | null>({
    queryKey: ["summary", meetingId],
    queryFn: () => invoke<DbSummary | null>("get_summary", { meetingId: meetingId! }),
    enabled: !!meetingId,
  });

  const generate = useMutation({
    mutationFn: async () => {
      if (!meetingId) throw new Error("No meeting");

      // 1. Get segments
      const segments = await invoke<TranscriptSegment[]>("get_segments", { meetingId });

      // 2. Build transcript
      const transcript = segments
        .map((s) => `${s.speaker_label}: ${s.text}`)
        .join("\n\n");

      // 3. Summarize via Gemini
      const apiKey = settings.geminiApiKey;
      if (!apiKey) throw new Error("No Gemini API key configured");

      const gemini = new GeminiProvider();
      const summary = await gemini.summarize(transcript, apiKey);

      // 4. Store in DB
      await invoke("create_summary", {
        meetingId,
        overview: summary.overview,
        keyDecisions: JSON.stringify(summary.keyDecisions),
        actionItems: JSON.stringify(summary.actionItems),
        risks: JSON.stringify(summary.risks.map((r) => JSON.stringify(r))),
      });

      // 5. Update status
      await invoke("update_meeting", { id: meetingId, status: "summarized" });

      return summary;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summary", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });

  return { ...query, generate };
}

export function useTranscription() {
  const settings = useSettingsStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (meetingId: string) => {
      // Get meeting to find audio path
      const meeting = await invoke<{ id: string; audio_path: string | null }>("get_meeting", {
        id: meetingId,
      });
      if (!meeting.audio_path) throw new Error("No audio file");

      // Get API key based on selected provider
      const provider =
        settings.speechProvider === "gemini"
          ? new GeminiSpeechProvider()
          : new WhisperProvider();
      const apiKey =
        settings.speechProvider === "gemini"
          ? settings.geminiApiKey
          : settings.openaiApiKey;

      if (!apiKey) throw new Error("No API key configured");

      // Transcribe
      const result = await provider.transcribe(meeting.audio_path, apiKey);

      // Save segments
      const segments = result.segments.map((s, i) => ({
        speaker_label: `Speaker ${(i % 2) + 1}`,
        text: s.text,
        start_secs: s.start,
        end_secs: s.end,
      }));

      await invoke("create_segments_batch", {
        meetingId,
        segments,
      });

      // Update status
      await invoke("update_meeting", { id: meetingId, status: "transcribed" });
    },
    onSuccess: (_data, meetingId) => {
      queryClient.invalidateQueries({ queryKey: ["segments", meetingId] });
      queryClient.invalidateQueries({ queryKey: ["meeting", meetingId] });
    },
  });
}
