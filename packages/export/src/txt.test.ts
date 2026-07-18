import { describe, it, expect } from "vitest";
import { formatAsTxt } from "./txt";
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

describe("formatAsTxt", () => {
  it("formats multiple segments with header", () => {
    const result = formatAsTxt([
      makeSeg({ speaker_label: "Alice", text: "Hi there" }),
      makeSeg({ id: "2", speaker_label: "Bob", text: "Hello!", start_secs: 5, end_secs: 10, sequence: 1 }),
    ], "Test Meeting");
    expect(result).toContain("Test Meeting");
    expect(result).toContain("======");
    expect(result).toContain("Alice:\nHi there");
    expect(result).toContain("Bob:\nHello!");
  });

  it("returns header with no-transcript message for empty segments", () => {
    const result = formatAsTxt([], "Empty");
    expect(result).toContain("Empty");
    expect(result).toContain("(No transcript)");
  });

  it("formats single segment correctly", () => {
    const result = formatAsTxt([makeSeg({ speaker_label: "Solo", text: "One" })], "Solo Meeting");
    expect(result).toContain("Solo:\nOne");
    expect(result).not.toContain("\n\n\n"); // no double joins for single
  });

  it("handles special characters in title", () => {
    const result = formatAsTxt([makeSeg()], "M#eeting: @2024 & Co.");
    expect(result).toContain("M#eeting: @2024 & Co.");
  });

  it("preserves Unicode in transcript text", () => {
    const result = formatAsTxt([
      makeSeg({ text: "こんにちは — c'est fini ✓" }),
    ], "Unicode");
    expect(result).toContain("こんにちは — c'est fini ✓");
  });
});
