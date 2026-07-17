export interface RiskItem {
  description: string;
  severity: "high" | "medium" | "low";
}

export interface MeetingSummary {
  overview: string;
  keyDecisions: string[];
  actionItems: string[];
  risks: RiskItem[];
}

export interface LLMProvider {
  name: string;
  summarize(transcript: string, apiKey: string, options?: Record<string, unknown>): Promise<MeetingSummary>;
}
