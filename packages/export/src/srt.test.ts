import { describe, it, expect } from "vitest";
import { formatAsSrt } from "./srt";
import type { TranscriptSegment } from "@meeting-ai/core";

function makeSeg(overrides: Partial<TranscriptSegment> = {}): TranscriptSegment {
  return {
    id: "1",
    meeting_id: "m1",
    speaker_label: "Speaker 1",
    text: "Hello world",
    start_secs: 0,
    end_secs: 5,
    sequence: 0,
    ...overrides,
  };
}

describe("formatAsSrt", () => {
  it("formats multiple segments as sequentially numbered SRT blocks", () => {
    const result = formatAsSrt([
      makeSeg({ speaker_label: "Alice", text: "Hi", start_secs: 0, end_secs: 3 }),
      makeSeg({ id: "2", speaker_label: "Bob", text: "Hello", start_secs: 3, end_secs: 6, sequence: 1 }),
    ]);
    expect(result).toContain("1\n00:00:00,000 --> 00:00:03,000\nAlice: Hi");
    expect(result).toContain("2\n00:00:03,000 --> 00:00:06,000\nBob: Hello");
  });

  it("returns empty string for empty segments", () => {
    expect(formatAsSrt([])).toBe("");
  });

  it("formats timestamps with hours, minutes, seconds, milliseconds", () => {
    const result = formatAsSrt([
      makeSeg({ start_secs: 3661.5, end_secs: 7322.999 }),
    ]);
    // 7322.999 → millis = Math.floor(0.999 * 1000) — floating point may give 998 or 999
    expect(result).toMatch(/01:01:01,500 --> 02:02:02,99\d/);
  });

  it("includes speaker label in subtitle text", () => {
    const result = formatAsSrt([
      makeSeg({ speaker_label: "Host", text: "Welcome", end_secs: 2 }),
    ]);
    expect(result).toContain("Host: Welcome");
  });

  it("formats single segment as single SRT block", () => {
    const result = formatAsSrt([makeSeg({ text: "Solo" })]);
    const lines = result.trim().split("\n");
    expect(lines[0]).toBe("1");
    expect(lines[1]).toContain("-->");
    expect(lines[2]).toBe("Speaker 1: Solo");
  });

  it("formats zero timestamps correctly", () => {
    const result = formatAsSrt([
      makeSeg({ start_secs: 0, end_secs: 0 }),
    ]);
    expect(result).toContain("00:00:00,000 --> 00:00:00,000");
  });

  it("formats timestamps at 1-hour boundary correctly", () => {
    const result = formatAsSrt([
      makeSeg({ start_secs: 3600, end_secs: 7200 }),
    ]);
    expect(result).toContain("01:00:00,000 --> 02:00:00,000");
  });

  it("adds trailing newline", () => {
    const result = formatAsSrt([makeSeg({ text: "End" })]);
    expect(result).toMatch(/\n$/);
  });
});
