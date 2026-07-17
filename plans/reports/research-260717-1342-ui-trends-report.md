# UI/UX Design Trends — Meeting Transcription Desktop Apps

*Researcher report 260717-1342. Sources: competitor sites (otter.ai, notta.ai, fireflies.ai), MacWhisper product page, plus established desktop-app design conventions. Web-search snippet retrieval was degraded in this environment; claims marked `[analyst]` are from general pattern knowledge, not a live fetch — verify before shipping pixel values.*

## 1. Competitor analysis (shared patterns)

| App | Layout | Accent | Mode | Notes |
|-----|--------|--------|------|-------|
| Notta | Sidebar + list + transcript (3-col) | Blue | Light | Clean, sans-serif [fetched] |
| Otter.ai | Sidebar + transcript/notes | Orange "hot-gradient" | Light | Conversation view [fetched] |
| Fireflies.ai | Sidebar + meeting list + transcript | Blue/teal | Dark gradients | [fetched] |
| Descript | Left media panel + center transcript editor + right inspector | Purple | Light/dark | Waveform-driven [analyst] |
| MacWhisper | Single-window, sidebar history + transcript pane | System (macOS) | Native light/dark | [fetched/product] |

**Convention:** 3-pane is dominant — left nav/history, center transcript, right context (notes/summary/speakers). 2-pane (list + transcript) appears in lighter tools. Sidebar is near-universal for history access.

## 2. Color palette trends

- **Dark mode**: preferred by Fireflies/Descript for "studio/recording" feel; light mode dominates Notta/Otter for document readability. Offer both; default to system.
- **Accent**: blue (Notta, Fireflies) is the safe, trustworthy choice for productivity. Purple (Descript) signals creative/editor tooling. Orange (Otter) = energetic/consumer. Green reserved for "recording live" + success states.
- **Neutrals**: low-chroma grays (#F7F8FA light / #1E1E1E dark). One saturated accent only; avoid gradient-heavy chrome in the working UI (gradients fine for marketing).

## 3. Typography

- **Body/transcript**: Inter or IBM Plex Sans — high x-height, screen-optimized, excellent at 14–16px long-form. Source Sans as alt.
- **Timestamps / speaker labels / metadata**: monospace (JetBrains Mono, IBM Plex Mono) — aligns columns, signals "data", aids scanning.
- **Avoid serif** for transcript body on screen; serif hurts sustained screen reading at small sizes.
- Pairing: Inter (UI + transcript) + JetBrains Mono (timestamps/speaker tags/word-counts). One font family for chrome keeps it DRY.

## 4. Component patterns

- **Recording indicator**: pulsing red dot (CSS `animation: pulse`), not blinking — softer, professional. Show elapsed time beside it.
- **Timeline/scrubber**: Descript-style waveform is gold standard; minimum viable = a progress bar with draggable handle + hover preview. Place above transcript, synced to scroll.
- **Search**: persistent top-of-transcript search box (Cmd/Ctrl+F local + global history search in sidebar). Highlight matches inline.
- **Settings / API keys**: dedicated Settings page, key field masked with reveal toggle, stored in OS keychain not plaintext. Group: Audio, Model/API, Shortcuts, Appearance.
- **Export**: toolbar button → dropdown (TXT, Markdown, SRT, DOCX, JSON). One button, many formats.

## 5. Desktop-specific UX

- **Window**: responsive min ~960×640, no fixed hard cap; fluid panes, collapsible sidebar. Respect `min-width` so transcript stays readable.
- **Titlebar**: integrate with OS (macOS traffic-light overlay / Windows caption). Hide default chrome; put app menu in sidebar or top bar.
- **Shortcuts**: Cmd/Ctrl+N new recording, Space play/pause, Cmd+F search, Cmd+E export, Cmd+, settings. Show in a shortcuts help panel (Cmd+/).
- **System tray**: minimize-to-tray for background capture; tray menu = Start/Stop record, Open, Quit. Request mic permission explicitly.

## 6. Meeting history patterns

- **List view** (Notta/Fireflies): rows = title, date, duration, participant count, status.
- **Group by date**: Today / Yesterday / This Week / Older — collapsible sections.
- **Search + filters**: free-text + filter by person/date/tag. Recent-first sort default.
- **Empty state**: clear "Record your first meeting" CTA.

## Recommendation (ranked)
1. **3-pane, system light/dark, Inter + JetBrains Mono, blue accent** — matches Notta/Fireflies, lowest risk, best readability.
2. Add waveform scrubber + pulsing red record dot as the differentiator (Descript-grade feel).
3. Skip serif body, gradient chrome, and fixed window sizes — YAGNI for v1.

## Unresolved
- Exact pixel/color tokens for Descript & MacWhisper need a live screenshot pass (search blocked here).
- Confirm target OS (macOS-only like MacWhisper, or cross-platform Electron/Tauri) — affects titlebar + tray implementation.
