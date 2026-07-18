# Code Standards

Implementation standards for Meeting AI. Covers structure, testing, security, and contribution conventions.

## Repository Layout

```
meeting-ai/
├── apps/desktop/        # Tauri desktop app (React + Vite frontend, Rust backend in src-tauri)
│   ├── src/             # React frontend (hooks, routes, components)
│   ├── src-tauri/        # Rust backend (audio, db, speech integration)
│   └── package.json      # Frontend scripts + vitest devDependency
├── packages/speech/     # Shared transcription/chunking library (TS)
└── docs/                # Design guidelines, wireframes, journals
```

## Testing

### Frontend / shared TS (`packages/speech`, `apps/desktop`)

- Framework: **vitest** (devDependency in `apps/desktop/package.json`).
- Run all TS tests:
  ```bash
  cd apps/desktop && npm test          # runs `vitest run`
  ```
- New unit tests live next to source as `*.test.ts` (e.g. `packages/speech/src/chunker.test.ts` covers `findSilenceBoundaries`).
- Do not add a new test framework; vitest covers both `packages/speech` and `apps/desktop`.

### Rust backend (`apps/desktop/src-tauri`)

- Standard `cargo test` with `#[cfg(test)] mod tests` inline modules.
- Run backend tests:
  ```bash
  cd apps/desktop/src-tauri && cargo test
  ```
- Example: `src/audio/recorder.rs` has 4 tests for `merge_wav_files` (single chunk, multi-chunk concat, empty input error, invalid WAV error).

### Conventions

- Tests are co-located with the code they exercise (inline Rust modules; `*.test.ts` for TS).
- Prefer real fixtures over mocks for audio/WAV logic.

## Security

### API Key Storage — macOS Keychain

API keys (e.g. Gemini) are **not** stored in plaintext settings. They are written to the macOS keychain via the `security` CLI:

- `store_key_in_keychain(service, account, key)` — `security add-generic-password -s <service> -a <account> -w <key> -U` (the `-U` flag updates existing entries; on conflict it deletes + retries).
- `get_key_from_keychain(service, account)` — `security find-generic-password -s <service> -a <account> -w`; returns `None` if the entry is absent.

Both are exposed as Tauri commands (`#[tauri::command]`) in `src-tauri/src/db/settings.rs` and registered in `lib.rs`. macOS only — there is no fallback for other platforms.

### Gemini Authentication

Gemini speech requests authenticate via the `x-goog-api-key` header (see `packages/speech/src/providers/gemini.ts`), not a query param. The key is pulled from the keychain.

### Content Security Policy

CSP is enforced via `tauri.conf.json` (`app.security.csp`):

```
default-src 'self';
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
connect-src 'self' ipc: http://ipc.localhost https://api.openai.com https://generativelanguage.googleapis.com
```

Allowed external hosts: OpenAI (Whisper) and Google Generative Language (Gemini). `connect-src` must be updated if a new API host is added.

## Error Handling

- Rust commands return `Result<T, String>`; surface errors to the frontend as string messages.
- Derive `serde::Serialize` on any struct returned to the frontend (e.g. `SearchResult` in `src/db/models.rs`, `StopResult` in `recorder.rs`).
- Frontend catches command failures with an `ErrorBoundary` (`apps/desktop/src/components/error-boundary.tsx` wrapping the app in `App.tsx`).

## Serialization Rule

Any struct passed across the Tauri IPC boundary (command return types, DB models) must derive `serde::Serialize` (and `Deserialize` for command arguments). Missing derives cause silent serialization failures.

## Contribution Conventions

- Keep commits focused; conventional commit format; no AI references in messages.
- Do not commit secrets, `.env`, or keychain material.
- Reuse existing helpers/utilities before adding new ones (YAGNI/KISS/DRY).
