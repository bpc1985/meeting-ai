import { useState, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";

interface StopResult {
  file_path: string;
  duration_secs: number;
}

export function useRecording() {
  const [state, setState] = useState<"idle" | "recording" | "paused">("idle");
  const [duration, setDuration] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const navigate = useNavigate();

  const start = useCallback(async (_meetingId: string) => {
    await invoke<string>("start_recording");
    setState("recording");
    setDuration(0);

    intervalRef.current = window.setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const pause = useCallback(async () => {
    await invoke("pause_recording");
    setState("paused");
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
  }, []);

  const resume = useCallback(async () => {
    await invoke("resume_recording");
    setState("recording");
    intervalRef.current = window.setInterval(() => {
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const stop = useCallback(
    async (meetingId: string) => {
      const result = await invoke<StopResult>("stop_recording");
      setState("idle");
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

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
