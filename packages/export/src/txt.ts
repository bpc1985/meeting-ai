import type { TranscriptSegment } from "@meeting-ai/core";

/**
 * Format transcript segments as speaker-labeled plain text.
 */
export function formatAsTxt(segments: TranscriptSegment[], meetingTitle: string): string {
  const header = `${meetingTitle}\n${"=".repeat(meetingTitle.length)}\n\n`;

  if (segments.length === 0) {
    return header + "(No transcript)";
  }

  const body = segments.map((s) => `${s.speaker_label}:\n${s.text}`).join("\n\n");

  return header + body + "\n";
}
