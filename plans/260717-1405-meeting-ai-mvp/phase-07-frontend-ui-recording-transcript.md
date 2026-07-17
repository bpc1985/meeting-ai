---
phase: 7
title: "Frontend UI - Recording & Transcript"
status: pending
priority: P1
dependencies: [3, 4, 6]
---

# Phase 7: Frontend UI - Recording & Transcript

## Overview

Build the recording view (waveform, timer, controls) and transcript editor (editable segments with timestamps, two-panel layout with AI summary). Match wireframes exactly. Use design tokens for all styling.

## Requirements

- **Functional:** Start/stop/pause recording with visual feedback (pulsing dot, waveform, timer). View/edit transcript with timestamps and speaker labels. Split/merge/delete segments. View AI summary in tabbed panel. Trigger transcription and summary generation from UI.
- **Non-functional:** Waveform CSS-animated bars (no audio processing library). Double-click to edit segments. `prefers-reduced-motion` respected.

## Architecture

```
apps/desktop/src/
├── routes/
│   ├── recording.tsx           # /recording/:id — active recording
│   └── transcript-editor.tsx   # /meeting/:id — transcript + summary
├── components/
│   ├── recording/
│   │   ├── recording-view.tsx  # Full recording page layout
│   │   ├── recording-indicator.tsx  # Pulsing red dot + "Recording" label
│   │   ├── duration-timer.tsx  # 00:00:00 counter
│   │   ├── waveform.tsx        # CSS-animated bars
│   │   ├── mic-level.tsx       # Mic input level meter
│   │   └── recording-controls.tsx  # Stop/Pause/Mute buttons
│   ├── transcript/
│   │   ├── transcript-panel.tsx    # Left panel: segment list
│   │   ├── transcript-segment.tsx  # Single segment: timestamp + speaker + text
│   │   ├── segment-actions.tsx     # Edit/Split/Delete hover actions
│   │   └── speaker-pill.tsx        # Colored speaker label badge
│   └── summary/
│       ├── summary-panel.tsx       # Right panel: tabbed summary
│       ├── summary-tabs.tsx        # Overview | Decisions | Actions | Risks
│       ├── action-item.tsx         # Checkbox + text
│       └── risk-item.tsx           # Severity badge + text
├── hooks/
│   ├── use-recording.ts       # Recording state + commands
│   ├── use-segments.ts        # Segment CRUD
│   └── use-summary.ts         # Summary generation + retrieval
└── stores/
    └── editor-store.ts        # Current editor state (active segment, etc.)
```

### Recording View (`routes/recording.tsx`)

```tsx
// Match wireframe: full-page centered recording UI
export function RecordingView() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-10">
      {/* Waveform visualization */}
      <Waveform />

      {/* Duration timer — 72px monospace */}
      <DurationTimer />

      {/* Recording indicator — pulsing red dot */}
      <RecordingIndicator />

      {/* Mic level meter */}
      <MicLevel />

      {/* Controls: Stop / Pause */}
      <RecordingControls />

      {/* Recording info: provider, format, file size */}
      <RecordingInfo />
    </div>
  );
}
```

### Waveform (`components/recording/waveform.tsx`)

```tsx
// ponytail: CSS-only animated bars, no audio data needed
// 40 bars, randomized heights, staggered animation delays
export function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-24">
      {Array.from({ length: 40 }, (_, i) => (
        <div
          key={i}
          className="w-1 bg-accent/80 rounded-full"
          style={{
            animation: active ? `waveform ${0.4 + Math.random() * 0.4}s ease-in-out infinite` : 'none',
            animationDelay: `${i * 0.05}s`,
            height: active ? `${30 + Math.random() * 70}%` : '10%',
          }}
        />
      ))}
    </div>
  );
}
```

### Duration Timer (`components/recording/duration-timer.tsx`)

```tsx
export function DurationTimer({ seconds }: { seconds: number }) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  return (
    <div className="font-ui text-7xl text-primary tabular-nums tracking-tight">
      {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </div>
  );
}
```

### Transcript Editor (`routes/transcript-editor.tsx`)

```tsx
// Match wireframe: 2-panel layout
export function TranscriptEditor() {
  return (
    <div className="flex h-full">
      {/* Left Panel: Transcript Segments */}
      <div className="flex-1 overflow-y-auto p-6">
        <TranscriptPanel meetingId={meetingId} segments={segments} />
      </div>

      {/* Right Panel: AI Summary */}
      <div className="w-[360px] border-l border-border-default bg-bg-deep">
        <SummaryPanel meetingId={meetingId} />
      </div>
    </div>
  );
}
```

### Transcript Segment (`components/transcript/transcript-segment.tsx`)

```tsx
// Match wireframe: timestamp | speaker pill | editable text
export function TranscriptSegment({ segment, onEdit, onSplit, onDelete }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <div
      className="group flex gap-4 py-3 px-2 border-b border-border-default hover:bg-bg-hover/50"
      onDoubleClick={() => setEditing(true)}
    >
      {/* Timestamp */}
      <span className="text-xs text-tertiary font-ui tabular-nums w-20 pt-1 shrink-0">
        {formatTimestamp(segment.start_secs)}
      </span>

      {/* Speaker label + text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <SpeakerPill speaker={segment.speaker_label} index={segment.sequence} />
        </div>

        {editing ? (
          <textarea
            value={segment.text}
            onChange={e => onEdit(segment.id, e.target.value)}
            onBlur={() => setEditing(false)}
            className="w-full bg-transparent text-base text-primary font-transcript resize-none
                       border border-border-focus rounded p-1 focus:outline-none"
            autoFocus
            rows={2}
          />
        ) : (
          <p className="text-base text-primary font-transcript leading-relaxed">
            {segment.text}
          </p>
        )}
      </div>

      {/* Hover actions */}
      <SegmentActions
        visible={!editing}
        onEdit={() => setEditing(true)}
        onSplit={() => onSplit(segment.id)}
        onDelete={() => onDelete(segment.id)}
      />
    </div>
  );
}
```

### Speaker Pill (`components/transcript/speaker-pill.tsx`)

```tsx
const SPEAKER_COLORS = [
  'bg-speaker-1/20 text-speaker-1',
  'bg-speaker-2/20 text-speaker-2',
  'bg-speaker-3/20 text-speaker-3',
  'bg-speaker-4/20 text-speaker-4',
];

export function SpeakerPill({ speaker, index }: { speaker: string; index: number }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5
                     font-ui font-semibold text-xs ${SPEAKER_COLORS[index % 4]}`}>
      {speaker}
    </span>
  );
}
```

### Summary Panel (`components/summary/summary-panel.tsx`)

```tsx
// Match wireframe: tabbed panel with Overview | Decisions | Actions | Risks
export function SummaryPanel({ meetingId }: { meetingId: string }) {
  const [tab, setTab] = useState<'overview' | 'decisions' | 'actions' | 'risks'>('overview');
  const { data: summary, isLoading } = useSummary(meetingId);

  if (!summary && !isLoading) {
    return (
      <div className="p-6">
        <Button onClick={() => generateSummary(meetingId)}>
          Generate AI Summary
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <SummaryTabs active={tab} onChange={setTab} />
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'overview' && <p className="text-sm text-secondary">{summary.overview}</p>}
        {tab === 'decisions' && <DecisionList items={summary.keyDecisions} />}
        {tab === 'actions' && <ActionItemList items={summary.actionItems} />}
        {tab === 'risks' && <RiskList items={summary.risks} />}
      </div>
      <div className="p-4 border-t border-border-default">
        <Button variant="ghost" size="sm" onClick={() => regenerateSummary(meetingId)}>
          Regenerate
        </Button>
      </div>
    </div>
  );
}
```

### Recording Hook (`hooks/use-recording.ts`)

```typescript
export function useRecording() {
  const [state, setState] = useState<'idle' | 'recording' | 'paused'>('idle');
  const [duration, setDuration] = useState(0);
  const [meetingId, setMeetingId] = useState<string | null>(null);
  const intervalRef = useRef<number>();

  const start = async () => {
    // 1. Create meeting in DB
    const id = await invoke<string>('create_meeting', { title: `Meeting — ${new Date().toLocaleDateString()}` });
    setMeetingId(id);
    // 2. Start recording
    await startRecording();
    setState('recording');
    // 3. Start duration timer
    intervalRef.current = window.setInterval(() => setDuration(d => d + 1), 1000);
  };

  const pause = async () => {
    await pauseRecording();
    setState('paused');
    clearInterval(intervalRef.current);
  };

  const stop = async () => {
    await stopRecording();
    setState('idle');
    clearInterval(intervalRef.current);
    // Navigate to transcript editor
  };

  return { state, duration, meetingId, start, pause, stop, resume };
}
```

## Implementation Steps

1. Build recording view components: `Waveform`, `DurationTimer`, `RecordingIndicator`, `RecordingControls`
2. Build `useRecording` hook connecting to Rust commands
3. Build `RecordingView` route page
4. Wire "New Recording" button in meeting list to navigate to `/recording/new`
5. Build transcript components: `TranscriptSegment`, `SpeakerPill`, `SegmentActions`
6. Build `TranscriptPanel` with segment list + inline editing
7. Build summary components: `SummaryPanel`, `SummaryTabs`, `DecisionList`, `ActionItemList`, `RiskList`
8. Build `useSegments` and `useSummary` TanStack Query hooks
9. Build `TranscriptEditor` route page (2-panel)
10. Wire meeting card click → navigate to `/meeting/:id`
11. Wire "Transcribe" action in meeting context (calls Whisper via phase 4)
12. Wire "Generate Summary" button (calls Gemini via phase 5)
13. Add keyboard shortcut: `Escape` to exit editing mode

## Success Criteria

- [ ] Recording view matches wireframe: waveform animation, 72px timer, pulsing dot
- [ ] Start/pause/stop recording works end-to-end (Rust → UI state)
- [ ] Stopped recording navigates to transcript editor
- [ ] Transcript segments display with timestamps + colored speaker pills
- [ ] Double-click segment enables inline editing
- [ ] Split/merge/delete segment actions work
- [ ] Summary panel shows 4 tabs with correct content
- [ ] "Generate AI Summary" button triggers summarization and shows results
- [ ] `prefers-reduced-motion` disables waveform animation (bars freeze)

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Waveform CSS animation jank on window resize | Use fixed bar count (40), transform-based animation (GPU-accelerated) |
| Large transcript (200+ segments) rendering slow | Virtualize with `useVirtualizer` if >50 segments; add later |
| Summary regeneration races | Disable button during generation, use `useMutation` for single-flight |
