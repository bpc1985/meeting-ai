import { useParams } from "react-router-dom";
import { useRecording } from "../hooks/use-recording";
import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

// Generate stable bar configs once — avoids Math.random() on every re-render
const WAVE_BARS = Array.from({ length: 40 }, (_, i) => ({
  key: i,
  duration: 0.4 + Math.random() * 0.4,
  delay: i * 0.05,
  height: 30 + Math.random() * 70,
}));

export function RecordingPage() {
  const { id } = useParams<{ id: string }>();
  const { state, duration, start, pause, resume, stop } = useRecording();
  const [ready, setReady] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);

  // Listen for recording errors emitted from Rust
  useEffect(() => {
    const unlisten = listen<string>("recording-error", (event) => {
      setMicError(event.payload);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleStart = async () => {
    if (!id) return;
    setReady(false);
    setMicError(null);
    try {
      await start(id);
    } catch {
      setReady(true);
      setMicError("Could not access microphone");
    }
  };

  const h = Math.floor(duration / 3600);
  const m = Math.floor((duration % 3600) / 60);
  const s = Math.floor(duration % 60);
  const timer = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-8">
      {/* Error banner */}
      {micError && (
        <div className="flex items-center gap-3 bg-error-muted border border-error/20 text-error rounded-lg px-4 py-3 text-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <span>{micError}</span>
          <button onClick={() => setMicError(null)} className="ml-auto text-error/60 hover:text-error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Waveform */}
      <div className="flex items-center justify-center gap-1 h-24">
        {WAVE_BARS.map((bar) => (
          <div key={bar.key} className="w-1 bg-accent/80 rounded-full"
            style={{
              animation: state === "recording" ? `waveform ${bar.duration}s ease-in-out infinite` : "none",
              animationDelay: `${bar.delay}s`,
              height: state === "recording" ? `${bar.height}%` : "10%",
            }} />
        ))}
      </div>

      {/* Timer */}
      <div className="font-ui text-7xl text-text-primary tabular-nums tracking-tight">{timer}</div>

      {/* Recording indicator */}
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full bg-recording"
          style={{ animation: state === "recording" ? "pulse-record 1.5s ease-in-out infinite" : "none" }} />
        <span className="text-xs text-recording font-semibold uppercase tracking-wider">
          {state === "recording" ? "Recording" : state === "paused" ? "Paused" : "Ready"}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {ready && state === "idle" && (
          <button onClick={handleStart} className="flex items-center gap-2 px-6 py-3 bg-accent text-bg-deep rounded-lg font-semibold text-sm hover:bg-accent-hover transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg>
            Start Recording
          </button>
        )}
        {state === "recording" && (
          <button onClick={pause} className="flex items-center gap-2 px-6 py-3 bg-warning-muted text-warning rounded-lg font-semibold text-sm hover:bg-warning/20 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
            Pause
          </button>
        )}
        {state === "paused" && (
          <button onClick={resume} className="flex items-center gap-2 px-6 py-3 bg-accent-muted text-accent rounded-lg font-semibold text-sm hover:bg-accent/20 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
            Resume
          </button>
        )}
        {(state === "recording" || state === "paused") && (
          <button onClick={() => id && stop(id)} className="flex items-center gap-2 px-6 py-3 bg-error-muted text-error rounded-lg font-semibold text-sm hover:bg-error/20 transition-all">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
            Stop
          </button>
        )}
      </div>

      {/* Info */}
      <div className="text-xs text-text-tertiary">Provider: {state === "idle" ? "—" : "Microphone"} · Format: WAV 16-bit mono</div>
    </div>
  );
}
