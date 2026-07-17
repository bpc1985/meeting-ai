import { create } from "zustand";
import type { SpeechProviderType, LLMProviderType } from "@meeting-ai/core";

interface SettingsStore {
  speechProvider: SpeechProviderType;
  llmProvider: LLMProviderType;
  openaiApiKey: string;
  geminiApiKey: string;
  setSpeechProvider: (p: SpeechProviderType) => void;
  setLLMProvider: (p: LLMProviderType) => void;
  setApiKey: (provider: string, key: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  speechProvider: "openai-whisper",
  llmProvider: "gemini",
  openaiApiKey: "",
  geminiApiKey: "",
  setSpeechProvider: (p) => set({ speechProvider: p }),
  setLLMProvider: (p) => set({ llmProvider: p }),
  setApiKey: (provider, key) => {
    if (provider === "openai") set({ openaiApiKey: key });
    if (provider === "gemini") set({ geminiApiKey: key });
  },
}));
