---
phase: 1
title: Project Scaffolding
status: completed
priority: P1
dependencies: []
---

# Phase 1: Project Scaffolding

## Overview

Scaffold the Tauri v2 + React 19 monorepo with Vite, TypeScript, TailwindCSS 4, shadcn/ui, and all package boundaries. Get `cargo tauri dev` running with a blank window.

## Requirements

- **Functional:** Tauri v2 app compiles and opens desktop window with React frontend
- **Non-functional:** Monorepo structure with shared packages, TypeScript strict mode, Vite HMR, Tailwind v4 with design tokens

## Architecture

```
meeting-ai/
├── apps/desktop/           # Tauri + React entry point
│   ├── src/                # React app (Vite)
│   ├── src-tauri/          # Rust backend
│   │   ├── src/
│   │   │   ├── main.rs     # Tauri entry
│   │   │   └── lib.rs      # Plugin registration
│   │   ├── Cargo.toml      # Rust deps: tauri, serde, etc.
│   │   └── tauri.conf.json # Window config, permissions
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
├── packages/
│   ├── core/               # Shared types, utilities
│   ├── ui/                 # shadcn/ui components, design tokens
│   ├── speech/             # Provider interfaces + Whisper impl
│   ├── llm/                # Provider interfaces + Gemini impl
│   └── export/             # SRT, TXT formatters
├── docs/
└── plans/
```

## Implementation Steps

1. **Create Tauri v2 project** via `npm create tauri-app@latest` with React/TypeScript template, target `apps/desktop`
2. **Configure `src-tauri/Cargo.toml`**: add `tauri = "2"`, `serde = { version = "1", features = ["derive"] }`, `serde_json = "1"`, `tauri-plugin-shell = "2"`, `tauri-plugin-dialog = "2"`, `tauri-plugin-fs = "2"`
3. **Configure `src-tauri/tauri.conf.json`**:
   - Window: 1280x800 default, min 960x640, title "Meeting AI"
   - macOS: `NSMicrophoneUsageDescription` in bundle config
   - Identifier: `com.meeting-ai.app`
   - Security: allowlist for `dialog`, `fs`, `shell` plugins
4. **Set up Vite + React + TypeScript** in `apps/desktop/`:
   - `vite.config.ts` with Tauri plugin, path aliases to packages
   - `tsconfig.json` strict mode, path aliases to `@meeting-ai/*`
5. **Install frontend dependencies**: `react@19`, `react-dom@19`, `@tanstack/react-query`, `zustand`, `tailwindcss@4`, `@tailwindcss/vite`, `lucide-react`, `react-router-dom`
6. **Configure TailwindCSS 4** with design tokens from `docs/design-guidelines.md`:
   - Theme extension: colors (deep navy palette, semantic tokens), fonts (Lexend, Atkinson Hyperlegible), border radius
   - Dark mode only (default)
7. **Set up shadcn/ui** with `components.json` config, configure for Tailwind v4
8. **Create package stubs**:
   - `packages/core/`: `package.json`, `src/index.ts`, `src/types.ts`
   - `packages/ui/`: `package.json`, `src/index.ts`
   - `packages/speech/`: `package.json`, `src/index.ts`
   - `packages/llm/`: `package.json`, `src/index.ts`
   - `packages/export/`: `package.json`, `src/index.ts`
9. **Configure monorepo**: root `package.json` with workspaces, turborepo or npm workspaces
10. **Verify**: `cargo tauri dev` opens desktop window with Vite React app

## Success Criteria

- [ ] `cargo tauri dev` launches desktop window (macOS) without errors
- [ ] React app renders with Vite HMR working
- [ ] TailwindCSS 4 compiles with design tokens applied
- [ ] `lucide-react` icons render correctly
- [ ] TypeScript strict mode compiles clean (`npx tsc --noEmit`)
- [ ] All 5 packages importable via `@meeting-ai/core`, `@meeting-ai/ui`, etc.
- [ ] Window title "Meeting AI", dark background

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Tauri v2 breaking changes vs v1 | Use v2 docs exclusively; `tauri = "2"` in Cargo.toml |
| TailwindCSS 4 API differences from v3 | Use `@tailwindcss/vite` plugin; CSS-first config instead of `tailwind.config.ts` |
| shadcn/ui Tailwind v4 compat | Check shadcn docs for v4 init command; may need manual adaptation |
| macOS TCC microphone permission | Add `NSMicrophoneUsageDescription` early to avoid silent failures |
