export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptResult {
  segments: TranscriptSegment[];
  language?: string;
  duration: number;
}

export interface SpeechProvider {
  name: string;
  transcribe(audioPath: string, apiKey: string, options?: Record<string, unknown>): Promise<TranscriptResult>;
}
