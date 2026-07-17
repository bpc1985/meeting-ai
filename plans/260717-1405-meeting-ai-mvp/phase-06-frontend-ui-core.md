---
phase: 6
title: Frontend UI - Core
status: completed
priority: P1
dependencies:
  - 1
---

# Phase 6: Frontend UI - Core

## Overview

Build the core UI shell: app layout with sidebar, meeting list view with search, settings page with API key management. Follow design guidelines and wireframes exactly. Use shadcn/ui components, Zustand for state, TanStack Query for data fetching.

## Requirements

- **Functional:** Sidebar navigation, meeting list grouped by date, search, settings page with provider selection and API key input
- **Non-functional:** Dark mode default, Lexend + Atkinson Hyperlegible fonts, WCAG AA contrast, responsive min 960x640

## Architecture

```
apps/desktop/src/
├── main.tsx                    # React entry
├── App.tsx                     # Router + layout shell
├── globals.css                 # TailwindCSS + design tokens
├── routes/
│   ├── meeting-list.tsx        # / — main view
│   └── settings.tsx            # /settings
├── components/
│   ├── layout/
│   │   ├── app-shell.tsx       # Sidebar + content area
│   │   └── sidebar.tsx         # Nav, logo, privacy badge
│   ├── meetings/
│   │   ├── meeting-card.tsx    # Card with title, date, duration, badge
│   │   └── meeting-group.tsx   # Date-grouped list section
│   ├── search/
│   │   └── search-bar.tsx      # FTS5 search input
│   └── settings/
│       ├── provider-selector.tsx   # Radio cards for providers
│       ├── api-key-input.tsx       # Masked input with toggle
│       └── privacy-section.tsx     # Storage info
├── stores/
│   ├── meeting-store.ts        # Zustand: selected meeting, UI state
│   └── settings-store.ts       # Zustand: current settings
└── hooks/
    ├── use-meetings.ts         # TanStack Query: list/search meetings
    └── use-settings.ts         # TanStack Query: get/set settings
```

### Key Components

#### App Shell (`components/layout/app-shell.tsx`)

```tsx
// Match wireframe: sidebar (256px) + main content area
export function AppShell() {
  return (
    <div className="flex h-screen bg-bg-deep">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-bg-base">
        <Outlet />
      </main>
    </div>
  );
}
```

#### Sidebar (`components/layout/sidebar.tsx`)

```tsx
// ponytail: static navigation, no nested menus for MVP
export function Sidebar() {
  return (
    <aside className="w-64 h-screen flex flex-col bg-bg-deep border-r border-border-default">
      {/* Logo + App Name */}
      <div className="p-5">
        <img src={logoUrl} alt="Meeting AI" className="h-8" />
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 space-y-1">
        <NavItem to="/" icon={FileText}>Meetings</NavItem>
        <NavItem to="/settings" icon={Settings}>Settings</NavItem>
      </nav>

      {/* Privacy Badge */}
      <div className="p-5 border-t border-border-default">
        <PrivacyBadge />
      </div>
    </aside>
  );
}
```

#### Meeting Card (`components/meetings/meeting-card.tsx`)

```tsx
// Match wireframe: title, date, duration, 2-line preview, status badge
export function MeetingCard({ meeting }: { meeting: Meeting }) {
  return (
    <div className="bg-bg-elevated rounded-lg p-5 border border-border-default hover:border-border-emphasis cursor-pointer">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-medium text-primary">{meeting.title}</h3>
          <p className="text-sm text-secondary mt-1">
            {formatDate(meeting.created_at)} · {formatDuration(meeting.duration_secs)}
          </p>
        </div>
        <StatusBadge status={meeting.status} />
      </div>
    </div>
  );
}
```

#### Settings — Provider Selector

```tsx
// Match wireframe: radio cards with provider info
export function ProviderSelector() {
  return (
    <div className="space-y-3">
      <ProviderCard
        name="OpenAI Whisper"
        description="Best for accurate transcription with timestamps"
        price="$0.006/min"
        selected={speechProvider === 'openai-whisper'}
        onSelect={() => setSpeechProvider('openai-whisper')}
      />
      <ProviderCard
        name="Gemini 2.5 Flash"
        description="Audio transcription via Gemini (timestamps approximate)"
        price="~$0.002/min"
        selected={speechProvider === 'gemini'}
        onSelect={() => setSpeechProvider('gemini')}
      />
    </div>
  );
}
```

#### API Key Input (`components/settings/api-key-input.tsx`)

```tsx
export function ApiKeyInput({ provider, value, onChange }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={`Enter your ${provider} API key`}
        className="w-full bg-bg-base border border-border-default rounded-md px-3 py-2 pr-10
                   text-primary placeholder:text-tertiary focus:border-border-focus focus:ring-2 focus:ring-accent/10"
      />
      <button
        onClick={() => setVisible(!visible)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary hover:text-primary"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
```

### State Management

```typescript
// stores/meeting-store.ts
export const useMeetingStore = create<MeetingStore>((set) => ({
  selectedMeetingId: null,
  searchQuery: '',
  setSelectedMeeting: (id) => set({ selectedMeetingId: id }),
  setSearchQuery: (q) => set({ searchQuery: q }),
}));

// stores/settings-store.ts
export const useSettingsStore = create<SettingsStore>((set) => ({
  speechProvider: 'openai-whisper',
  llmProvider: 'gemini',
  openaiApiKey: '',
  geminiApiKey: '',
  setSpeechProvider: (p) => set({ speechProvider: p }),
  setLLMProvider: (p) => set({ llmProvider: p }),
  setApiKey: (provider, key) => set({ [`${provider}ApiKey`]: key }),
}));
```

### Data Fetching (TanStack Query)

```typescript
// hooks/use-meetings.ts
export function useMeetings(searchQuery?: string) {
  return useQuery({
    queryKey: ['meetings', searchQuery],
    queryFn: () => searchQuery
      ? invoke<Meeting[]>('search_meetings', { query: searchQuery })
      : invoke<Meeting[]>('list_meetings'),
  });
}
```

## Implementation Steps

1. Set up React Router with routes: `/` → MeetingList, `/settings` → Settings
2. Implement `AppShell` + `Sidebar` components (match wireframe exactly)
3. Build `MeetingCard` and `MeetingGroup` components with date grouping
4. Build `SearchBar` component with FTS5 search hook
5. Build meeting list page (`routes/meeting-list.tsx`)
6. Build settings page:
   - Provider radio cards for STT + LLM
   - API key inputs with show/hide toggle
   - Privacy section with storage info
7. Set up Zustand stores for UI state
8. Set up TanStack Query hooks for meeting data
9. Add Google Fonts (Lexend + Atkinson Hyperlegible) via `@import` in `globals.css`
10. Apply design tokens (colors, spacing, typography) from `design-guidelines.md`

## Success Criteria

- [ ] App shell renders with sidebar + main content area
- [ ] Navigation between Meetings and Settings views works
- [ ] Meeting list shows cards grouped by date (Today/Yesterday/This Week/Last Week)
- [ ] Search filters meetings (when DB has data)
- [ ] Settings page saves API keys to SQLite
- [ ] Settings page shows provider radio cards (visual match to wireframe)
- [ ] Dark theme applied throughout, colors match design tokens
- [ ] Lexend (UI) and Atkinson Hyperlegible (transcript) fonts load
- [ ] "New Recording" button visible in meeting list header
- [ ] Privacy badge in sidebar footer

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| shadcn/ui + Tailwind v4 theming mismatch | Use CSS-variable-based theme; wrap in ThemeProvider if needed |
| TanStack Query v5 API changes | Pin to latest v5 docs; queryOptions pattern |
| Empty state (no meetings) | Render empty state with "Record your first meeting" CTA |
