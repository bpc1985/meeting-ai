# Wrapper / Proxy Correctness Review — cfeabac..601b03d

Scope: AppState (Mutex<Connection> + Mutex<RecordingState>), SendStream (Option<cpal::Stream>),
SpeechProvider (whisper.ts vs gemini.ts), useSettingsStore/useLoadSettings, Zustand selectors.

## Findings

### 🔴 bugs

1. `apps/desktop/src-tauri/src/audio/recorder.rs:150-211` (resume_recording)
   The new WavWriter + stream are built but the writer `Arc<Mutex<Option<WavWriter>>>` is a
   LOCAL variable and never stored in `RecordingState`. Only `rec.stream.0` and
   `rec.chunk_paths`/`rec.active_path` are stored. On the next pause/stop, `drop(stream)`
   releases the cpal stream, but the WavWriter (kept alive only by the callback's Arc clone)
   is dropped without finalize/flush because its originating Arc went out of scope at fn
   return. Result: resumed chunk is clipped or header never written.

2. `apps/desktop/src-tauri/src/audio/recorder.rs:48-49,210` (SendStream unsafe Send)
   The ponytail comment claims "no concurrent stream access" because all recording access is
   serialized through RecordingState's Mutex. FALSE: the cpal input callback runs on cpal's
   own audio thread, NOT under the RecordingState Mutex. The Mutex only guards `rec`, not the
   stream's callback execution. When pause_recording / stop_recording does
   `rec.stream.0.take(); drop(stream)`, stream stop is async — the callback may still be
   executing on another thread when drop returns, writing through the (now sole-owning) Arc
   into a WavWriter that is being dropped. No happens-before guarantees. The unsafe Send is
   not actually safe under this lifecycle.

3. `apps/desktop/src-tauri/src/audio/recorder.rs:269-309` (merge_wav_files)
   Output is opened as `output_file`, ALL chunk audio data is written to it (lines 282-284),
   then `output_file` is dropped and a NEW `final_file` is opened (line 286) with the header,
   and all chunks are RE-READ and RE-WRITTEN (lines 291-298). The first full write pass to
   `output_file` is dead work — wasted 2x I/O on a real multi-chunk recording. Functionally
   correct only because final_file is fully rewritten; the first pass must be deleted.

4. `apps/desktop/src-tauri/src/audio/recorder.rs:243,267` (truncated-final-chunk passes merge)
   stop_recording drops the stream (possible race, see #2) then merges. merge_wav_files only
   validates `all_bytes.len() < 44` per chunk — a truncated final chunk (missing data tail
   from a stream-drop race) still passes the check and yields a corrupt merged WAV silently.

### 🟡 risks

5. `apps/desktop/src/stores/settings-store.ts:12` + `apps/desktop/src/hooks/use-settings.ts:8`
   `useLoadSettings` calls `useSettingsStore()` with NO selector → subscribes to the entire
   store. Any settings update re-renders the subscriber. Not fatal here but inefficient and
   fragile.

6. `apps/desktop/src/hooks/use-summary.ts:9` (useSummary)
   Same whole-store subscription (`const settings = useSettingsStore();`). Every unrelated
   settings state change re-renders the summary view/component tree. Use a selector or
   `useShallow`.

7. `apps/desktop/src-tauri/src/audio/recorder.rs:243` (stop after drop)
   The drop-stream-then-merge ordering has no synchronization that the cpal callback has fully
   stopped; combined with #2/#4 this is a data-integrity risk for the recorded audio.

### 🔵 nits

8. `packages/speech/src/types.ts:14` (SpeechProvider interface)
   Interface declares `name: string`. `whisper.ts` sets `name = "openai-whisper"`;
   `gemini.ts` (GeminiSpeechProvider) does NOT declare `name`. Method signatures
   (`transcribe(audioPath, apiKey, options?)`) match in both providers. If any code reads
   `provider.name` for telemetry/logging, Gemini returns undefined. Add `name` to
   GeminiSpeechProvider for symmetry.

9. `apps/desktop/src-tauri/src/db/mod.rs:15-18` (AppState locking)
   db and recording are SEPARATE Mutexes. No command locks both at once (recorders lock only
   recording; DB commands lock only db). No dual-lock deadlock found — this part is correct.

## Verification notes
- resume_recording DOES declare `file_path` (line 150). The real defect is the missing writer
  store, not a missing var.
- AppState: two independent Mutexes, no cross-lock → no deadlock. Confirmed by reading all
  command bodies.

## Unresolved questions
- Intent for pause/resume: is one WAV per chunk the desired output, or a single continuous
  file? The merge logic assumes chunk-per-pause; the writer-not-stored bug breaks that.

totals: 4🔴 3🟡 2🔵
