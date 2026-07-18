# Code Standards

Implementation standards for Meeting AI. Covers structure, testing, security, and contribution conventions.

## Repository Layout

```
meeting-ai/
├── apps/desktop/          # Tauri desktop app (React + Vite frontend, Rust backend in src-tauri)
│   ├── src/               # React frontend (hooks, routes, components, stores, lib)
│   ├── src-tauri/          # Rust backend (audio, db) — 13 source files
│   └── package.json        # scripts + vitest devDependency
├── packages/               # Shared TypeScript packages (resolved via tsconfig paths)
│   ├── core/src/           # Shared types (Meeting, TranscriptSegment) + GEMINI_MODEL constant
│   ├── speech/src/         # STT providers, chunker, compressor, retry, extractJson
│   ├── llm/src/            # LLM summarization (Gemini provider + prompt template)
│   └── export/src/         # TXT + SRT formatters
├── docs/                   # Design guidelines, wireframes, code standards, PDR, journals
└── plans/                  # Implementation plans + reports
```

## Testing

### Frontend + shared TS

- Framework: **vitest** (`apps/desktop/package.json` devDependency).
- Run: `cd apps/desktop && npm test`
- Test files live next to source as `*.test.ts` (e.g. `packages/speech/src/chunker.test.ts`).
- 4 tests for `findSilenceBoundaries` (no-silence, with-silence, tiny audio, undersized budget).
- Do not add a new test framework.

### Rust backend

- Standard `cargo test` with `#[cfg(test)] mod tests` inline modules.
- Run: `cd apps/desktop/src-tauri && cargo test`
- 4 tests for `merge_wav_files` (single chunk, multi-chunk concat, empty input error, invalid WAV error).
- Tests use `hound` (already a dependency) + `std::env::temp_dir()` for temp files.

### Conventions

- Tests co-located with code (inline Rust modules; `*.test.ts` for TS).
- Prefer real fixtures over mocks for audio/WAV logic.

## Security

### API Key Storage — macOS Keychain

API keys stored in macOS keychain via `security` CLI, not plaintext in SQLite:

- `store_key_in_keychain(service, account, key)` — `security add-generic-password -s <service> -a <account> -w <key> -U`
- `get_key_from_keychain(service, account)` — `security find-generic-password -s <service> -a <account> -w`

Both are Tauri commands in `src-tauri/src/db/settings.rs`, registered in `lib.rs`. DB stores only `keychain:` marker (e.g. `keychain:openai_api_key`). Backward compat: plaintext values without `keychain:` prefix still load normally.

### Gemini Authentication

All Gemini requests authenticate via `x-goog-api-key` header (not URL query param). Applies to both speech (`packages/speech/src/providers/gemini.ts`) and LLM (`packages/llm/src/providers/gemini.ts`). MIME type auto-detected from file extension (webm→audio/webm, wav→audio/wav).

### Content Security Policy

CSP enforced via `tauri.conf.json` (`app.security.csp`):

```
default-src 'self';
style-src 'self' 'unsafe-inline';
font-src 'self';
connect-src 'self' ipc: http://ipc.localhost https://api.openai.com https://generativelanguage.googleapis.com
```

Fonts are local (no CDN). `connect-src` must be updated if a new API host is added.

## Error Handling

- Rust commands return `Result<T, String>`; surface errors as string messages.
- cpal stream errors emit Tauri `recording-error` events → frontend shows dismissable red banner.
- LLM summarization uses `withRetry` (exponential backoff: 429, 5xx, TypeError).
- `ErrorBoundary` component wraps the app in `App.tsx`, logs errors via `componentDidCatch`.
- Derive `serde::Serialize` on any struct returned to the frontend.

## Shared Utilities

Before adding new code, check existing shared utilities:

| Utility | Location | Used by |
|---------|----------|---------|
| `extractJson<T>` | `packages/speech/src/json.ts` | LLM Gemini provider, speech Gemini provider |
| `withRetry` + `HttpError` | `packages/speech/src/retry.ts` | All API calls (speech + LLM) |
| `GEMINI_MODEL` | `packages/core/src/constants.ts` | Both Gemini providers (single source for model name) |
| `fmtDuration` + `fmtTimestamp` | `apps/desktop/src/lib/format.ts` | meeting-list, meeting-detail routes |
| `now_iso()` | `src-tauri/src/db/mod.rs` (pub(crate)) | meetings.rs, summaries.rs |
| `useKeyboardShortcuts` | `apps/desktop/src/hooks/use-keyboard-shortcuts.ts` | Route-level keyboard shortcut registration |

## DB Patterns

- **Batch INSERT**: `create_segments_batch` wraps all inserts in `BEGIN`/`COMMIT` transaction with explicit `ROLLBACK` on error.
- **Batch UPDATE**: `update_segment` builds dynamic SQL with `Box<dyn ToSql>` values — single UPDATE regardless of how many fields change.
- **Pagination**: `list_meetings` accepts `offset`/`limit` params with `LIMIT ? OFFSET ?` SQL.
- **Upsert**: `set_setting` uses `ON CONFLICT(key) DO UPDATE SET value = excluded.value`.
- **FTS5**: `search_meetings` uses `segments_fts MATCH` with prefix matching and `snippet()` for highlighted results.

## Frontend Patterns

- **State management**: Zustand for client state (meetingStore, settingsStore), TanStack Query for server state (staleTime: 30s, retry: 1).
- **Settings load**: API keys fetched from keychain, non-key settings from DB. Backward compat for plaintext values.
- **Settings save**: API keys → keychain + DB marker on blur (not on every keystroke).
- **Audio playback**: Read file via Tauri FS plugin, create blob URL, play via `<audio>` element.
- **Export**: Native macOS save dialog via `@tauri-apps/plugin-dialog` (not hidden DOM link).
- **Keyboard shortcuts**: Suppressed when user is typing in input/textarea (`useKeyboardShortcuts` hook).
- **Undo for edits**: `Escape` key in `EditableText` textarea reverts to original value.
- **Fonts**: Local TTF files in `assets/fonts/` (Lexend + Atkinson Hyperlegible), `@font-face` in `globals.css`.

## Contribution Conventions

- Conventional commits, no AI references in messages.
- No secrets, `.env`, or keychain material in commits.
- Kebab-case for JS/TS files, snake_case for Rust files.
- `// ponytail:` comments mark deliberate simplifications with upgrade paths.
- Reuse existing helpers before adding new ones.
