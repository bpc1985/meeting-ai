/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";

if (!globalThis.crypto?.randomUUID) {
  vi.stubGlobal("crypto", { ...globalThis.crypto, randomUUID: () => "00000000-0000-0000-0000-000000000000" });
}
import { transcribeWithChunking } from "./chunker";
import type { SpeechProvider, TranscriptResult } from "./types";

// ── Helpers ──────────────────────────────────────────────

function makeSilentWavBuffer(durationSecs: number, sampleRate = 44100): ArrayBuffer {
  const numSamples = sampleRate * durationSecs;
  const dataSize = numSamples * 2; // 16-bit = 2 bytes per sample
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeStr(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(view, 8, "WAVE");
  writeStr(view, 12, "fmt ");
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // format = PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(view, 36, "data");
  view.setUint32(40, dataSize, true);

  return buffer;
}

function writeStr(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function mockProvider(
  segments: Array<{ start: number; end: number; text: string }> = [{ start: 0, end: 5, text: "Hello" }]
): SpeechProvider {
  return {
    name: "mock",
    async transcribe(): Promise<TranscriptResult> {
      return { segments, duration: segments[segments.length - 1]?.end ?? 0 };
    },
  };
}

// ── Mock Tauri FS plugin ─────────────────────────────────

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(async () => {
    const buffer = makeSilentWavBuffer(5); // 5-second silent WAV
    return new Uint8Array(buffer);
  }),
  writeFile: vi.fn(async () => {}),
  mkdir: vi.fn(async () => {}),
  stat: vi.fn(async () => ({ size: 10 * 1024 })),
}));

vi.mock("@tauri-apps/api/path", () => ({
  appCacheDir: vi.fn(async () => "/tmp/meeting-ai-test"),
  join: vi.fn(async (...parts: string[]) => parts.join("/")),
}));

// ── Mock MediaRecorder / AudioContext ─────────────────────

// Fake AudioContext for node env — minimal impl for compressAudio + AudioContext
class FakeAudioContext {
  sampleRate = 44100;
  createBufferSource() {
    let buf: AudioBuffer | null = null;
    const src = {
      get buffer() { return buf; },
      set buffer(b: AudioBuffer) { buf = b; },
      connect() {},
      start() {},
      stop() {},
    };
    return src;
  }
  createMediaStreamDestination() {
    return { stream: new EventTarget() as MediaStream };
  }
  decodeAudioData(_buf: ArrayBuffer) {
    return Promise.resolve({
      duration: 0.1,
      sampleRate: 44100,
      length: Math.floor(44100 * 0.1),
      numberOfChannels: 1,
      getChannelData() { return new Float32Array(Math.floor(44100 * 0.1)); },
    } as unknown as AudioBuffer);
  }
  close() {}
}

class FakeMediaRecorder {
  ondataavailable?: (e: Event & { data?: Blob }) => void;
  onstop?: () => void;
  onerror?: (e: Event) => void;
  state = "inactive";
  constructor(_stream: MediaStream, _options?: Record<string, unknown>) {}
  start() {
    this.state = "recording";
    setTimeout(() => {
      if (this.ondataavailable) {
        // Create a proper Blob-like data event
        this.ondataavailable({ data: new Blob(["fake-audio-data"]) } as Event & { data: Blob });
      }
    }, 10);
  }
  stop() {
    this.state = "inactive";
    setTimeout(() => this.onstop?.(), 20);
  }
}

beforeAll(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
});

afterAll(() => {
  vi.restoreAllMocks();
});

// ── Tests ────────────────────────────────────────────────

describe("transcribeWithChunking pipeline", () => {
  it("returns transcript for short audio (fast path)", async () => {
    const provider = mockProvider();
    const result = await transcribeWithChunking("/fake/audio.wav", provider, "fake-key");

    expect(result.segments).toHaveLength(1);
    expect(result.segments[0].text).toBe("Hello");
  });

  it("accepts progress callback (not invoked on fast path)", async () => {
    // Progress only fires on chunked path (>25MB). Fast path calls provider directly.
    const provider = mockProvider();
    // Should not throw
    await transcribeWithChunking("/fake/audio.wav", provider, "fake-key", () => {});
  });

  it("returns total duration from last segment", async () => {
    const provider = mockProvider([
      { start: 0, end: 3, text: "A" },
      { start: 3, end: 10, text: "B" },
    ]);
    const result = await transcribeWithChunking("/fake/audio.wav", provider, "fake-key");
    expect(result.duration).toBe(10);
  });
});

describe("transcription error handling", () => {
  it("propagates provider errors", async () => {
    const failingProvider: SpeechProvider = {
      name: "fail",
      async transcribe(): Promise<TranscriptResult> {
        throw new Error("API down");
      },
    };

    await expect(
      transcribeWithChunking("/fake/audio.wav", failingProvider, "key")
    ).rejects.toThrow("API down");
  });

  it("handles auth failure gracefully", async () => {
    const authProvider: SpeechProvider = {
      name: "unauth",
      async transcribe(): Promise<TranscriptResult> {
        const { HttpError } = await import("./retry");
        throw new HttpError("Invalid API key", 401);
      },
    };

    await expect(
      transcribeWithChunking("/fake/audio.wav", authProvider, "bad-key")
    ).rejects.toThrow("Invalid API key");
  });

  it("handles empty segments response", async () => {
    const emptyProvider = mockProvider([]);
    const result = await transcribeWithChunking("/fake/audio.wav", emptyProvider, "key");
    expect(result.segments).toHaveLength(0);
    expect(result.duration).toBe(0);
  });
});
