import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settings-store";
import { useEffect } from "react";

export function useLoadSettings() {
  const store = useSettingsStore();

  const { data } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ["settings"],
    queryFn: async () => {
      // ponytail: get all known setting keys at once
      const keys = ["speech_provider", "llm_provider", "openai_api_key", "gemini_api_key"];
      const results: Array<{ key: string; value: string }> = [];
      for (const key of keys) {
        const val = await invoke<string | null>("get_setting", { key });
        if (val !== null) results.push({ key, value: val });
      }
      return results;
    },
  });

  useEffect(() => {
    if (data) {
      for (const { key, value } of data) {
        switch (key) {
          case "speech_provider":
            store.setSpeechProvider(value as "openai-whisper" | "gemini");
            break;
          case "llm_provider":
            store.setLLMProvider(value as "gemini");
            break;
          case "openai_api_key":
            store.setApiKey("openai", value);
            break;
          case "gemini_api_key":
            store.setApiKey("gemini", value);
            break;
        }
      }
    }
  }, [data]);

  return { loaded: !!data };
}

export function useSaveSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      await invoke("set_setting", { key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
