import type { SpeechProvider, TranscriptResult, TranscriptSegment } from "./types";
import { compressAudio } from "./compressor";
import { readFile } from "@tauri-apps/plugin-fs";

const MAX_CHUNK_BYTES = 24 * 1024 * 1024; // 24MB, leave headroom under 25MB

/**
 * Transcribe audio with automatic chunking for files >25MB after compression.
 * Chunks on silence boundaries for clean splits.
 */
export async function transcribeWithChunking(
  audioPath: string,
  provider: SpeechProvider,
  apiKey: string,
  onProgress?: (current: number, total: number) => void
): Promise<TranscriptResult> {
  // Step 1: compress to MP3
  const { path: compressedPath, size: compressedSize } = await compressAudio(audioPath);

  if (compressedSize <= MAX_CHUNK_BYTES) {
    onProgress?.(1, 1);
    return provider.transcribe(compressedPath, apiKey);
  }

  // Step 2: decode MP3 for silence analysis
  const audioBytes = await readFile(compressedPath);
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(audioBytes.buffer as ArrayBuffer);

  // Step 3: find silence boundaries
  const splitPoints = findSilenceBoundaries(audioBuffer, MAX_CHUNK_BYTES, compressedSize);
  await audioCtx.close();

  // Step 4: extract chunks and transcribe
  const allSegments: TranscriptSegment[] = [];

  for (let i = 0; i < splitPoints.length; i++) {
    const startSamples = splitPoints[i];
    const endSamples =
      i + 1 < splitPoints.length
        ? splitPoints[i + 1]
        : audioBuffer.length;

    onProgress?.(i + 1, splitPoints.length);

    const chunk = extractChunk(audioBuffer, startSamples, endSamples);
    const chunkPath = await writeChunkToTemp(chunk);

    const result = await provider.transcribe(chunkPath, apiKey);

    // Offset timestamps by chunk start time
    const offsetSecs = startSamples / audioBuffer.sampleRate;
    for (const seg of result.segments) {
      allSegments.push({
        start: seg.start + offsetSecs,
        end: seg.end + offsetSecs,
        text: seg.text,
      });
    }
  }

  const totalDuration = audioBuffer.length / audioBuffer.sampleRate;
  return { segments: allSegments, duration: totalDuration };
}

/**
 * Find split points at silence gaps.
 * ponytail: RMS in 100ms windows, split at longest silence region
 * that keeps each chunk under the byte budget.
 */
export function findSilenceBoundaries(
  buffer: AudioBuffer,
  maxBytes: number,
  totalBytes: number
): number[] {
  const windowSize = Math.floor(buffer.sampleRate * 0.1); // 100ms
  const threshold = 0.01;
  const minSilenceWindows = 5; // 500ms minimum silence

  const data = buffer.getChannelData(0);
  const numWindows = Math.floor(data.length / windowSize);

  // Compute RMS per window
  const rmsWindow: number[] = [];
  for (let i = 0; i < numWindows; i++) {
    const start = i * windowSize;
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      sum += data[start + j] ** 2;
    }
    rmsWindow.push(Math.sqrt(sum / windowSize));
  }

  // Find silence regions (consecutive windows below threshold)
  const silenceRegions: Array<{ startWindow: number; endWindow: number; length: number }> = [];
  let silenceStart = -1;
  for (let i = 0; i < rmsWindow.length; i++) {
    if (rmsWindow[i] < threshold) {
      if (silenceStart === -1) silenceStart = i;
    } else {
      if (silenceStart !== -1 && i - silenceStart >= minSilenceWindows) {
        silenceRegions.push({
          startWindow: silenceStart,
          endWindow: i,
          length: i - silenceStart,
        });
      }
      silenceStart = -1;
    }
  }

  if (silenceRegions.length === 0) {
    // No silence found — split on fixed time intervals
    const chunkDurationSecs = (maxBytes / totalBytes) * buffer.duration;
    const chunkSamples = Math.floor(chunkDurationSecs * buffer.sampleRate);
    const points: number[] = [];
    for (let s = chunkSamples; s < buffer.length; s += chunkSamples) {
      points.push(s);
    }
    return [0, ...points];
  }

  // Pick split points: evenly distributed silence regions
  const targetChunks = Math.ceil(totalBytes / maxBytes);
  const points: number[] = [0];

  if (silenceRegions.length >= targetChunks - 1) {
    const step = Math.floor(silenceRegions.length / (targetChunks - 1));
    for (let i = 0; i < targetChunks - 1; i++) {
      const region = silenceRegions[Math.min(i * step, silenceRegions.length - 1)];
      points.push(Math.floor((region.startWindow + region.endWindow) / 2) * windowSize);
    }
  } else {
    for (const region of silenceRegions) {
      points.push(Math.floor((region.startWindow + region.endWindow) / 2) * windowSize);
    }
  }

  return points;
}

function extractChunk(buffer: AudioBuffer, startSample: number, endSample: number): AudioBuffer {
  const length = endSample - startSample;
  const chunk = new AudioBuffer({
    length,
    numberOfChannels: 1,
    sampleRate: buffer.sampleRate,
  });

  const src = buffer.getChannelData(0);
  const dest = chunk.getChannelData(0);
  for (let i = 0; i < length; i++) {
    dest[i] = src[startSample + i] ?? 0;
  }

  return chunk;
}

import { join } from "@tauri-apps/api/path";
import { appCacheDir } from "@tauri-apps/api/path";

async function writeChunkToTemp(chunk: AudioBuffer): Promise<string> {
  // Reuse audioBufferToWav from compressor (ponytail: shared util later if needed)
  const wavData = audioBufferToWav(chunk);
  const cacheDir = await appCacheDir();
  const chunkPath = await join(cacheDir, `${crypto.randomUUID()}.wav`);
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  const bytes = new Uint8Array(await wavData.arrayBuffer());
  await writeFile(chunkPath, bytes);
  return chunkPath;
}

// Duplicated from compressor.ts — ponytail: shared audio-utils later
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const sampleRate = buffer.sampleRate;
  const bitsPerSample = 16;
  const data = buffer.getChannelData(0);
  const blockAlign = 2;
  const byteRate = sampleRate * blockAlign;
  const dataSize = data.length * blockAlign;

  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeStringWav(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStringWav(view, 8, "WAVE");
  writeStringWav(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStringWav(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeStringWav(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
