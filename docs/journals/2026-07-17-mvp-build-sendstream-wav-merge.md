# cpal::Stream not Send on macOS — SendStream wrapper and WAV merge for pause

**Date**: 2026-07-17 14:30
**Severity**: High
**Component**: Rust audio backend (cpal + hound)
**Status**: Resolved

## What Happened

Tauri v2 commands run on the async runtime / a different thread than where the
audio stream is created. `cpal::Stream` is **not `Send` on macOS** (the CoreAudio
callbacks capture non-Send types). Moving the stream into a Tauri state struct
or across an `await` boundary failed to compile: `future cannot be sent between threads safely`.

## The Brutal Truth

This one ate the better part of a phase. The error isn't obvious — it surfaces
as a generic `Send` bound failure on the command's future, not on the stream
type itself. You stare at the command signature wondering what you did wrong
when the real culprit is a `Vec<u8>` buffer living inside the callback closure
that the compiler refuses to prove is thread-safe.

## Technical Details

- Error: `the trait bound `cpal::Stream: Send` is not satisfied` / `future created by async block is not Send`
- Root: cpal's macOS `Stream` holds a `AudioUnit` handle that is not `Send`.
- Fix: wrapped the stream in a `SendStream` newtype with an `Arc<Mutex<Option<cpal::Stream>>>` and a `PhantomData` marker to assert `Send + Sync` manually, isolating the non-Send value behind a sync boundary.

## What We Tried

- Storing `cpal::Stream` directly in `tauri::State` → compile error.
- `Box::leak` to keep the stream alive without moving it → worked but leaked and was ugly. Rejected.
- `SendStream` wrapper with explicit `unsafe impl Send/Sync` + `Arc<Mutex<>>` → clean, compiles, no leak.

## Root Cause Analysis

We assumed a cross-platform audio API would give us a `Send` stream. cpal does
not guarantee that on macOS. The fix is to never move the stream across threads
and to hand-assert `Send` on a controlled wrapper.

## Lessons Learned

If you touch cpal on macOS and use Tauri, wrap the stream immediately. Don't
try to store it in app state raw. The `unsafe impl Send` is justified here
because we never actually share the non-Send internals across threads — only
the wrapper handle.

## Next Steps

None — resolved in Phase 3. Revisit if we add system audio capture later.
