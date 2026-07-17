import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSettingsStore } from "../stores/settings-store";
import { useSaveSetting, useLoadSettings } from "../hooks/use-settings";

export function SettingsPage() {
  const { speechProvider, openaiApiKey, geminiApiKey, setSpeechProvider, setApiKey } = useSettingsStore();
  const saveSetting = useSaveSetting();
  useLoadSettings();
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showGemini, setShowGemini] = useState(false);

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Settings</h1>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Speech-to-Text Provider</h2>
        <div className="space-y-3">
          <ProviderCard name="OpenAI Whisper" description="Accurate transcription with timestamps" price="$0.006/min"
            selected={speechProvider === "openai-whisper"} onSelect={() => { setSpeechProvider("openai-whisper"); saveSetting.mutate({ key: "speech_provider", value: "openai-whisper" }); }} />
          <ProviderCard name="Gemini 2.5 Flash" description="Transcription via Gemini (timestamps approximate)" price="~$0.002/min"
            selected={speechProvider === "gemini"} onSelect={() => { setSpeechProvider("gemini"); saveSetting.mutate({ key: "speech_provider", value: "gemini" }); }} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">API Keys</h2>
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-primary mb-2">OpenAI API Key</label>
          <div className="relative">
            <input type={showOpenAi ? "text" : "password"} value={openaiApiKey}
              onChange={(e) => { setApiKey("openai", e.target.value); saveSetting.mutate({ key: "openai_api_key", value: e.target.value }); }}
              placeholder="sk-..." className="w-full bg-bg-elevated border border-border-default rounded-md px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus outline-none" />
            <button onClick={() => setShowOpenAi(!showOpenAi)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              {showOpenAi ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-primary mb-2">Gemini API Key</label>
          <div className="relative">
            <input type={showGemini ? "text" : "password"} value={geminiApiKey}
              onChange={(e) => { setApiKey("gemini", e.target.value); saveSetting.mutate({ key: "gemini_api_key", value: e.target.value }); }}
              placeholder="AIza..." className="w-full bg-bg-elevated border border-border-default rounded-md px-3 py-2 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus outline-none" />
            <button onClick={() => setShowGemini(!showGemini)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary">
              {showGemini ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-4">Data & Privacy</h2>
        <div className="bg-bg-elevated rounded-lg p-5 border border-border-default">
          <p className="text-sm text-text-secondary">All audio and transcripts stored locally. Data only sent to providers you configure above.</p>
        </div>
      </section>
    </div>
  );
}

function ProviderCard({ name, description, price, selected, onSelect }: {
  name: string; description: string; price: string; selected: boolean; onSelect: () => void;
}) {
  return (
    <div onClick={onSelect} className={`p-4 rounded-lg border cursor-pointer transition-all ${selected ? "border-accent bg-accent-muted" : "border-border-default bg-bg-elevated hover:border-border-emphasis"}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-text-primary">{name}</p>
          <p className="text-xs text-text-secondary mt-1">{description}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-tertiary">{price}</span>
          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selected ? "border-accent" : "border-border-emphasis"}`}>
            {selected && <div className="w-2 h-2 rounded-full bg-accent" />}
          </div>
        </div>
      </div>
    </div>
  );
}
