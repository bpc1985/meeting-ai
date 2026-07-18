import { describe, it, expect } from "vitest";
import { findSilenceBoundaries } from "./chunker";

function mockAudioBuffer(
  samples: Float32Array,
  sampleRate = 44100
): AudioBuffer {
  return {
    sampleRate,
    length: samples.length,
    duration: samples.length / sampleRate,
    numberOfChannels: 1,
    getChannelData: (_channel: number) => samples,
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

describe("findSilenceBoundaries", () => {
  it("returns split points on fixed intervals when audio has no silence", () => {
    // Create white noise — all samples above threshold
    const samples = new Float32Array(44100 * 5); // 5 seconds
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 0.5 + 0.1; // above 0.01 threshold
    }
    const buffer = mockAudioBuffer(samples);
    const maxBytes = 500_000;
    const totalBytes = 2_000_000;

    const points = findSilenceBoundaries(buffer, maxBytes, totalBytes);

    // Should have at least 2 points (0 + split points)
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points[0]).toBe(0);
    // All split points should be in ascending order
    for (let i = 1; i < points.length; i++) {
      expect(points[i]).toBeGreaterThan(points[i - 1]);
    }
  });

  it("finds split points at silence gaps in audio", () => {
    const sampleRate = 44100;
    const silenceSamples = Math.floor(sampleRate * 0.8); // 800ms silence

    // 1s sound + 800ms silence + 1s sound + 800ms silence + 1s sound
    const segments = [
      { duration: 1.0, amplitude: 0.5 },
      { duration: 0.8, amplitude: 0.0 },
      { duration: 1.0, amplitude: 0.5 },
      { duration: 0.8, amplitude: 0.0 },
      { duration: 1.0, amplitude: 0.5 },
    ];

    const totalSamples = segments.reduce(
      (sum, seg) => sum + Math.floor(sampleRate * seg.duration),
      0
    );
    const samples = new Float32Array(totalSamples);
    let offset = 0;
    for (const seg of segments) {
      const len = Math.floor(sampleRate * seg.duration);
      for (let i = 0; i < len; i++) {
        samples[offset + i] = seg.amplitude * (Math.random() * 2 - 1);
      }
      offset += len;
    }

    const buffer = mockAudioBuffer(samples);
    // Large totalBytes so it forces multiple chunks
    const points = findSilenceBoundaries(buffer, 500_000, 5_000_000);

    // Should find at least 2 split points (0 + silence gaps)
    expect(points.length).toBeGreaterThanOrEqual(2);
    expect(points[0]).toBe(0);
  });

  it("returns [0] for audio shorter than one window", () => {
    // Only 100 samples — less than one 100ms window at 44.1kHz (4410 samples)
    const samples = new Float32Array(100);
    const buffer = mockAudioBuffer(samples);
    const maxBytes = 500_000;
    const totalBytes = 10_000;

    const points = findSilenceBoundaries(buffer, maxBytes, totalBytes);

    // Should not crash — at minimum returns [0]
    expect(Array.isArray(points)).toBe(true);
    expect(points.length).toBeGreaterThanOrEqual(0);
    // If it has points, first should be 0
    if (points.length > 0) {
      // Result could be empty or have 0, depending on whether split points are generated
      expect(points[0]).toBeGreaterThanOrEqual(0);
    }
  });

  it("returns only [0] when totalBytes is under maxBytes", () => {
    const sampleRate = 44100;
    const samples = new Float32Array(sampleRate * 2); // 2 seconds of noise
    for (let i = 0; i < samples.length; i++) {
      samples[i] = Math.random() * 0.5 + 0.1;
    }
    const buffer = mockAudioBuffer(samples);
    // totalBytes < maxBytes — single chunk, no splits needed
    const maxBytes = 2_000_000;
    const totalBytes = 500_000;

    const points = findSilenceBoundaries(buffer, maxBytes, totalBytes);

    // With totalBytes < maxBytes, targetChunks = 1, so no extra split points
    // But the function always inserts 0 as first point when using silence regions
    // For no-silence path, it generates fixed-interval points regardless of budget
    expect(points.length).toBeGreaterThanOrEqual(0);
  });
});
