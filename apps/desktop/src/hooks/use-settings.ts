import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../stores/settings-store";
import { useEffect } from "react";

const KEYCHAIN_SERVICE = "MeetingAI";
const API_KEY_NAMES = ["openai_api_key", "gemini_api_key"];

export function useLoadSettings() {
  const store = useSettingsStore();

  const { data } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ["settings"],
    queryFn: async () => {
      const keys = ["speech_provider", "llm_provider", "openai_api_key", "gemini_api_key"];
      const results: Array<{ key: string; value: string }> = [];

      for (const key of keys) {
        const val = await invoke<string | null>("get_setting", { key });

        if (val !== null) {
          // If the stored value is a keychain marker, fetch real key from keychain
          if (val.startsWith("keychain:")) {
            const realKey = await invoke<string | null>("get_key_from_keychain", {
              service: KEYCHAIN_SERVICE,
              account: key,
            });
            if (realKey !== null) {
              results.push({ key, value: realKey });
            }
            // If keychain lookup fails, don't add the key — treat as not configured
          } else {
            // Backward compat: plaintext key stored directly in DB
            results.push({ key, value: val });
          }
        }
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
      if (API_KEY_NAMES.includes(key) && value) {
        // Store real key in keychain, only a marker in DB
        await invoke("store_key_in_keychain", {
          service: KEYCHAIN_SERVICE,
          account: key,
          key: value,
        });
        await invoke("set_setting", { key, value: `keychain:${key}` });
      } else {
        // Non-key settings go directly to DB
        await invoke("set_setting", { key, value });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
