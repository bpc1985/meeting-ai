import type { TranscriptSegment } from "@meeting-ai/core";

/**
 * Format transcript segments as SRT subtitle file.
 */
export function formatAsSrt(segments: TranscriptSegment[]): string {
  if (segments.length === 0) return "";

  const lines = segments.map((seg, i) => {
    const index = i + 1;
    const start = secondsToSrtTime(seg.start_secs);
    const end = secondsToSrtTime(seg.end_secs);
    const text = `${seg.speaker_label}: ${seg.text}`;
    return `${index}\n${start} --> ${end}\n${text}`;
  });

  return lines.join("\n\n") + "\n";
}

function secondsToSrtTime(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const millis = Math.floor((totalSeconds % 1) * 1000);

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":") + "," + String(millis).padStart(3, "0");
}
