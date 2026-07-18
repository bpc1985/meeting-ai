# Vite rolldown + Tauri externalization broke the build

**Date**: 2026-07-17 15:10
**Severity**: Medium
**Component**: Build toolchain (Vite + Tauri v2)
**Status**: Resolved

## What Happened

The Vite plugin for Tauri externalizes Node builtins and Tauri's IPC bridge so
they aren't bundled into the frontend. With Vite's rolldown-based bundler
active, the externalization config silently stopped applying for some modules,
producing a bundle that tried to `require('@tauri-apps/api')` at runtime inside
the webview and threw `Module not found`.

## The Brutal Truth

Build toolchain rot is the most demoralizing failure category because it has
nothing to do with your actual product. We shipped 9 phases of real features
and then lost an hour to a bundler internals mismatch between a pre-release
Vite and Tauri's plugin expectations. The `.app` produced ran but the UI was a
white screen with a console full of unresolved imports.

## Technical Details

- Symptom: webview console `Failed to resolve import "@tauri-apps/api/core"`.
- Cause: rolldown rollup-compatible output didn't honor the `tauri/vite`
  `tauri:` external filter the same way esbuild did.
- Fix: pinned Vite to the version Tauri's plugin was tested against and added
  explicit `build.rollupOptions.external` entries for `@tauri-apps/api` and
  `@tauri-apps/plugin-*` as a belt-and-suspenders.

## What We Tried

- Bumping Tauri plugin → no change.
- Adding `ssr.external` → wrong axis, frontend is client build.
- Pinning Vite + explicit external list → resolved.

## Root Cause Analysis

We grabbed the newest Vite (rolldown-enabled) without checking Tauri's plugin
compatibility matrix. Pre-1.0 bundler internals + a plugin written for esbuild
expectations = externalization drift.

## Lessons Learned

For Tauri, do not chase bleeding-edge Vite. Match the Vite major to what the
Tauri `vite` plugin declares as supported. If externalization misbehaves,
hard-code the `external` list rather than trusting the plugin filter.

## Next Steps

None. Pinned in Phase 1 scaffolding; document in README if we revisit build.
