import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { appCacheDir, join } from "@tauri-apps/api/path";

/**
 * Compress WAV to compressed audio (WebM Opus 64kbps mono) before upload.
 * Uses browser AudioContext + MediaRecorder — no native deps.
 *
 * 10MB/min WAV → ~0.5MB/min compressed. 50 min fits in 25MB Whisper limit.
 *
 * ponytail: MediaRecorder produces WebM/Opus, not MP3.
 * Whisper and Gemini both accept WebM natively, so this works for both providers.
 */
export async function compressAudio(wavPath: string): Promise<string> {
  const audioBytes = await readFile(wavPath);
  const audioCtx = new AudioContext();
  const audioBuffer = await audioCtx.decodeAudioData(audioBytes.buffer as ArrayBuffer);

  // Feed decoded buffer directly into MediaRecorder via MediaStreamDestination.
  // ponytail: skip OfflineAudioContext pass — no resampling needed.
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  const dest = audioCtx.createMediaStreamDestination();
  source.connect(dest);

  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(dest.stream, {
    mimeType: "audio/webm;codecs=opus",
    audioBitsPerSecond: 64000,
  });

  const webmBlob = await new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => resolve(new Blob(chunks, { type: "audio/webm" }));
    recorder.onerror = (e) => reject(e);
    recorder.start();
    source.start();
    setTimeout(() => {
      source.stop();
      recorder.stop();
      audioCtx.close();
    }, audioBuffer.duration * 1000 + 100);
  });

  const cacheDir = await appCacheDir();
  const outPath = await join(cacheDir, `${crypto.randomUUID()}.webm`);

  const outBytes = new Uint8Array(await webmBlob.arrayBuffer());
  await writeFile(outPath, outBytes);

  return outPath;
}
