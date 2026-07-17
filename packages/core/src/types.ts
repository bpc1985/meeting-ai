export interface Meeting {
  id: string;
  title: string;
  audio_path: string | null;
  duration_secs: number | null;
  created_at: string;
  updated_at: string;
  status: "draft" | "transcribed" | "summarized";
}

export interface TranscriptSegment {
  id: string;
  meeting_id: string;
  speaker_label: string;
  text: string;
  start_secs: number;
  end_secs: number;
  sequence: number;
}

export interface MeetingSummary {
  id: string;
  meeting_id: string;
  overview: string | null;
  key_decisions: string | null;
  action_items: string | null;
  risks: string | null;
  provider: string;
  model: string | null;
  created_at: string;
}

export type SpeechProviderType = "openai-whisper" | "gemini";
export type LLMProviderType = "gemini";
export type MeetingStatus = "draft" | "transcribed" | "summarized";
