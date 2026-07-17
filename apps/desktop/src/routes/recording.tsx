import { useParams } from "react-router-dom";
import { useRecording } from "../hooks/use-recording";
import { useEffect } from "react";

export function RecordingPage() {
  const { id } = useParams<{ id: string }>();
  const { state, duration, start, pause, resume, stop } = useRecording();

  useEffect(() => {
    if (id && state === "idle") {
      start(id);
    }
  }, [id]);

  const h = Math.floor(duration / 3600);
  const m = Math.floor((duration % 3600) / 60);
  const s = Math.floor(duration % 60);
  const timer = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center justify-center h-full gap-10 px-8">
      {/* Waveform */}
      <div className="flex items-center justify-center gap-1 h-24">
        {Array.from({ length: 40 }, (_, i) => (
          <div key={i} className="w-1 bg-accent/80 rounded-full"
            style={{
              animation: state === "recording" ? `waveform ${0.4 + Math.random() * 0.4}s ease-in-out infinite` : "none",
              animationDelay: `${i * 0.05}s`,
              height: state === "recording" ? `${30 + Math.random() * 70}%` : "10%",
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
