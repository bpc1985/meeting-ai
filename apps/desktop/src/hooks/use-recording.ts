import { useState, useRef, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

interface StopResult {
  file_path: string;
  duration_secs: number;
}

// ponytail: shared interval management — clear on state change or unmount
function useInterval(callback: () => void, active: boolean) {
  const savedCallback = useRef(callback);
  savedCallback.current = callback;

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => savedCallback.current(), 1000);
    return () => clearInterval(id);
  }, [active]);
}

export function useRecording() {
  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [duration, setDuration] = useState(0);
  const navigate = useNavigate();

  useInterval(
    () => setDuration((d) => d + 1),
    state === "recording"
  );

  const start = useCallback(async (_meetingId: string) => {
    await invoke<string>("start_recording");
    setState("recording");
    setDuration(0);
  }, []);

  const pause = useCallback(async () => {
    await invoke("pause_recording");
    setState("paused");
  }, []);

  const resume = useCallback(async () => {
    await invoke("resume_recording");
    setState("recording");
  }, []);

  const stop = useCallback(
    async (meetingId: string) => {
      const result = await invoke<StopResult>("stop_recording");
      setState("idle");

      // Update meeting with audio path + duration
      await invoke("update_meeting", {
        id: meetingId,
        audioPath: result.file_path,
        durationSecs: result.duration_secs,
      });

      navigate(`/meeting/${meetingId}`);
    },
    [navigate]
  );

  return { state, duration, start, pause, resume, stop };
}
