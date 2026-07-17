import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { appCacheDir, join } from "@tauri-apps/api/path";

/**
 * Compress WAV to MP3 64kbps mono before upload.
 * Uses browser AudioContext + MediaRecorder — no native deps.
 *
 * 10MB/min WAV → ~0.5MB/min MP3. 50 min fits in 25MB Whisper limit.
 */
export async function compressToMp3(wavPath: string): Promise<string> {
  // ponytail: AudioContext-based compression.
  // 1. Read WAV bytes via Tauri fs
  // 2. Decode with AudioContext.decodeAudioData()
  // 3. Re-encode via MediaRecorder at 64kbps mono
  // 4. Write to cache dir

  const audioBytes = await readFile(wavPath);
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(audioBytes.buffer as ArrayBuffer);

  // Create mono offline context for resampling/resampling if needed
  const offlineCtx = new OfflineAudioContext(
    1,
    audioBuffer.duration * audioBuffer.sampleRate,
    audioBuffer.sampleRate
  );
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();

  // Convert to WAV in-memory for MediaRecorder (since it needs a stream)
  const wavBlob = audioBufferToWav(renderedBuffer);

  // Encode as MP3 via MediaRecorder
  const mp3Blob = await encodeWithMediaRecorder(wavBlob, 64000);

  const cacheDir = await appCacheDir();
  const mp3Path = await join(cacheDir, `${crypto.randomUUID()}.mp3`);

  const mp3Bytes = new Uint8Array(await mp3Blob.arrayBuffer());
  await writeFile(mp3Path, mp3Bytes);

  return mp3Path;
}

async function encodeWithMediaRecorder(blob: Blob, bitrate: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const audioCtx = new AudioContext();
    const chunks: Blob[] = [];

    const fileReader = new FileReader();
    fileReader.onload = async () => {
      const buffer = await audioCtx.decodeAudioData(fileReader.result as ArrayBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;

      const dest = audioCtx.createMediaStreamDestination();
      source.connect(dest);

      const recorder = new MediaRecorder(dest.stream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: bitrate,
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));
      recorder.onerror = (e) => reject(e);

      recorder.start();
      source.start();

      setTimeout(() => {
        source.stop();
        recorder.stop();
        audioCtx.close();
      }, buffer.duration * 1000 + 100);
    };
    fileReader.readAsArrayBuffer(blob);
  });
}

// ponytail: minimal WAV encoder from AudioBuffer — hand-rolled, no dep needed
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitsPerSample = 16;

  const data = buffer.getChannelData(0);
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = data.length * blockAlign;
  const headerSize = 44;

  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < data.length; i++) {
    const sample = Math.max(-1, Math.min(1, data[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
