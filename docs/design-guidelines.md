# Meeting AI — Design Guidelines

## Design Philosophy

**Professional. Trustworthy. Privacy-first. Modern but restrained.**

Meeting AI handles sensitive conversation data locally. Design must communicate security, reliability, and professionalism without feeling cold or dated.

| Pillar | Expression |
|---|---|
| **Privacy-first** | No unnecessary network indicators, local-first cues, reassuring lock/badge motifs |
| **Professional** | Clean layouts, generous whitespace, no frivolous decoration |
| **Trustworthy** | Clear visual hierarchy, predictable interactions, transparent system status |
| **Modern** | Smooth micro-interactions, purposeful use of depth, refined dark palette |
| **Restrained** | Minimal animation, no motion sickness, nothing flashy or distracting |

---

## Color System

### Base Palette (Dark Mode Default)

```
--bg-deep:       #090D1A    App shell background
--bg-base:       #0F1525    Main content background
--bg-elevated:   #161E33    Cards, panels, modals
--bg-hover:      #1C2540    Hover state on surfaces
--bg-pressed:    #243050    Pressed/active state

--text-primary:  #EDF0F5    Primary text, headings
--text-secondary:#8B92A5    Secondary text, labels, metadata
--text-tertiary: #5B6378    Disabled text, placeholders
--text-inverse:  #090D1A    Text on accent/success backgrounds

--border-default: rgba(139, 146, 165, 0.12)
--border-emphasis: rgba(139, 146, 165, 0.24)
--border-focus:   rgba(34, 211, 238, 0.40)
```

### Light Mode (Future)

Same token names, inverted luminance — deferred until post-MVP.

### Semantic Tokens

```
--accent:        #22D3EE    Primary action, links, recording indicator
--accent-hover:  #3DD9F1
--accent-muted:  rgba(34, 211, 238, 0.10)

--success:       #22C55E    Exported, completed, connected
--success-muted: rgba(34, 197, 94, 0.10)
--warning:       #F59E0B    Processing, needs attention
--warning-muted: rgba(245, 158, 11, 0.10)
--error:         #EF4444    Failed, disconnected, delete
--error-muted:   rgba(239, 68, 68, 0.10)
--info:          #60A5FA    Informational, hints
--info-muted:    rgba(96, 165, 250, 0.10)

--recording:     #EF4444    Recording pulse, active mic
--speaker-1:     #22D3EE    Speaker label color 1
--speaker-2:     #A78BFA    Speaker label color 2
--speaker-3:     #34D399    Speaker label color 3
--speaker-4:     #FBBF24    Speaker label color 4
```

### Contrast Ratios

All text/background combinations meet WCAG 2.1 AA minimum:
- Text primary on bg-base: **13.2:1** (AAA)
- Text secondary on bg-base: **6.1:1** (AA)
- Accent text on bg-base: **4.7:1** (AA)
- Text primary on accent: checked per context, inverse used where needed

---

## Typography

### Font Selection

**2 fonts only. Neither is Inter nor Poppins.**

| Role | Font | Why |
|---|---|---|
| **UI** | **Lexend** (weights: 400, 500, 600, 700) | Designed for readability. Wider character spacing reduces crowding. Excellent Vietnamese support. |
| **Transcript** | **Atkinson Hyperlegible** (weights: 400, 700) | Purpose-built by Braille Institute for maximum legibility. Distinguished letterforms (I/l/1, O/0). Ideal for long-reading transcription text. Vietnamese support via extended Latin glyphs. |

```css
/* Google Fonts Import */
@import url('https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Lexend:wght@400;500;600;700&display=swap');
```

```js
// Tailwind Config
fontFamily: {
  ui: ['Lexend', 'sans-serif'],
  transcript: ['Atkinson Hyperlegible', 'sans-serif'],
}
```

### Type Scale

| Token | Size | Line Height | Weight | Usage |
|---|---|---|---|---|
| `text-xs` | 0.75rem (12px) | 1rem (16px) | 400 | Timestamps, metadata, captions |
| `text-sm` | 0.875rem (14px) | 1.25rem (20px) | 400 | Secondary text, labels, sidebar nav |
| `text-base` | 1rem (16px) | 1.5rem (24px) | 400 | Transcript body, inputs, card text |
| `text-lg` | 1.125rem (18px) | 1.75rem (28px) | 500 | Card headings, section titles |
| `text-xl` | 1.25rem (20px) | 1.75rem (28px) | 600 | Panel titles, modal headings |
| `text-2xl` | 1.5rem (24px) | 2rem (32px) | 700 | Page headings |
| `text-3xl` | 1.875rem (30px) | 2.25rem (36px) | 700 | App title, hero (rarely used) |

### Font Usage Rules

- **Transcript body** always uses `font-transcript` (Atkinson Hyperlegible), `text-base`, `text-primary`
- **Timestamps** use `font-ui` (Lexend), `text-xs`, `text-tertiary`, tabular-nums
- **Speaker labels** use `font-ui`, `text-sm`, `font-semibold`
- **All UI elements** (buttons, inputs, nav, headings) use `font-ui`

---

## Spacing Scale

Based on 4px grid. All values in rem.

```
--space-0:   0
--space-1:   0.25rem  (4px)
--space-2:   0.5rem   (8px)
--space-3:   0.75rem  (12px)
--space-4:   1rem     (16px)
--space-5:   1.25rem  (20px)
--space-6:   1.5rem   (24px)
--space-8:   2rem     (32px)
--space-10:  2.5rem   (40px)
--space-12:  3rem     (48px)
--space-16:  4rem     (64px)
```

### Layout Spacing

| Context | Token | Value |
|---|---|---|
| Sidebar width | --sidebar-w | 16rem (256px) |
| Content padding | px-8 | 2rem (32px) |
| Card padding | p-5 | 1.25rem (20px) |
| List item gap | gap-3 | 0.75rem (12px) |
| Section gap | gap-6 | 1.5rem (24px) |
| Panel min-height | --panel-min-h | 100vh (full height) |

---

## Border Radius

```
--radius-sm:   0.375rem  (6px)    Small elements: badges, tags, small buttons
--radius-md:   0.5rem    (8px)    Standard: buttons, inputs, dropdowns
--radius-lg:   0.75rem   (12px)   Cards, panels, modals
--radius-xl:   1rem      (16px)   Large cards, main panels
--radius-full: 9999px             Pills, recording indicator, speaker avatars
```

---

## Shadows (Dark Mode)

```css
--shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.3);
--shadow-md:   0 4px 6px rgba(0, 0, 0, 0.4);
--shadow-lg:   0 10px 15px rgba(0, 0, 0, 0.5);
--shadow-glow: 0 0 20px rgba(34, 211, 238, 0.15);  /* Accent glow, sparingly */

--shadow-recording: 0 0 30px rgba(239, 68, 68, 0.3);  /* Recording pulse glow */
```

Shadows in dark mode are more subtle than light mode — depth comes from light surfaces, not dark shadows.

---

## Component Patterns

### Buttons

**Primary** — Solid accent background, used for main actions (Record, Save, Export)
- bg-accent, text-inverse, px-4 py-2.5, rounded-md, font-ui font-semibold text-sm
- Hover: bg-accent-hover
- Active: scale-[0.98]
- Disabled: opacity-50 cursor-not-allowed

**Secondary** — Outlined, used for secondary actions (Cancel, Skip)
- border border-border-emphasis, bg-transparent, text-primary
- Hover: bg-bg-hover

**Ghost** — Text only, used for tertiary actions, sidebar nav
- text-secondary, hover:text-primary, hover:bg-bg-hover, rounded-md

**Danger** — Red accent for destructive actions
- bg-error/10, text-error, border border-error/20
- Hover: bg-error/20

### Inputs

- bg-bg-base, border border-border-default, rounded-md, px-3 py-2
- Focus: border-border-focus, ring-2 ring-accent/10
- Placeholder: text-tertiary
- Masked input (API keys): monospace mask with toggle show/hide

### Cards (Meeting Cards)

- bg-bg-elevated, rounded-lg, p-5
- Border: 1px border-border-default
- Hover: border-border-emphasis, shadow-md
- Contains: title, date, duration, preview text (2-line truncation), speaker count badge

### Recording Indicator

- Circle: w-3 h-3 rounded-full bg-recording
- Animation: pulse (opacity 1→0.4→1, 1.5s ease-in-out infinite)
- Label next to circle: text-xs text-recording font-semibold uppercase tracking-wider

### Waveform Visualization

- CSS-based animated bars (20-40 bars)
- Each bar: rounded-full, bg-accent/80, animate in height
- Heights randomized but smoothed via CSS animation-delay
- During pause: bars freeze
- During recording: active animation with variating heights

### Speaker Labels

- Pill shape: rounded-full, px-2.5 py-0.5, font-ui font-semibold text-xs
- Distinct colors per speaker (see semantic tokens)
- Used inline before transcript segments

### Transcript Segment

- Hover-reveal edit actions (pen, split, delete icons)
- Editable on double-click or via hover action button
- Timestamp left-aligned, speaker label, then transcript text
- Segments separated by 2px border-bottom border-border-default

### Tabs (Summary Panel)

- Horizontal tab bar, bottom-border highlight on active tab
- Active: text-primary, border-b-2 border-accent
- Inactive: text-tertiary, hover:text-secondary

---

## Animation Philosophy

**Subtle. Purposeful. No motion sickness.**

| Animation | Duration | Easing | Usage |
|---|---|---|---|
| Fade in | 150ms | ease-out | Elements appearing, page transitions |
| Scale press | 100ms | ease-out | Button click feedback (0.98 scale) |
| Slide | 200ms | ease-out | Panel expand/collapse, sidebar toggle |
| Recording pulse | 1.5s | ease-in-out | Recording indicator, mic level |
| Waveform bars | 0.4-0.8s | ease-in-out | Random heights, staggered |
| Hover transitions | 150ms | ease-out | Border color, bg color, shadow |

**Respect `prefers-reduced-motion`**: disable all non-essential animations. Recording pulse and waveform freeze but remain visible.

**No parallax, no scroll-jacking, no auto-playing video/audio.**

---

## Iconography

Use **Lucide** icon set (via `lucide-react`). Consistent 24px grid, 1.5px stroke width.

Key icons:
- Mic, MicOff — recording states
- Play, Pause, Stop — playback control
- FileText — transcripts
- Download — export
- Settings — settings
- Search — search
- ChevronLeft, ChevronRight — navigation
- Edit3, Scissors, Trash2 — transcript editing
- Check, X — confirm/cancel
- Shield, Lock — privacy indicators

---

## Layout System

### App Shell (All Views)

```
+------------------+----------------------------------------+
|                  |                                        |
|    Sidebar       |         Main Content Area              |
|    (256px)       |                                        |
|                  |                                        |
|  - App Logo      |                                        |
|  - Nav Items     |                                        |
|  - User/Privacy  |                                        |
|    Badge         |                                        |
|                  |                                        |
+------------------+----------------------------------------+
```

### Sidebar

- Fixed left, full height, bg-bg-deep (slightly darker than content)
- Width: 256px (16rem)
- Top: App logo/brand
- Middle: Navigation items with icons
- Bottom: Privacy badge + version
- Active nav item: bg-accent-muted, text-accent, border-l-2 border-accent

### Two-Panel (Transcript Editor)

```
+------------------+-------------------+---------------------+
|    Sidebar       |   Transcript      |   AI Summary        |
|    (256px)       |   (flex-1)        |   (360px)           |
|                  |                   |                     |
|                  | [00:00:12]        | [Tabs: Overview |   |
|                  | Speaker 1:        |  Decisions | Actions]|
|                  | Lorem ipsum...    |                     |
|                  |                   | Summary content...  |
|                  | [00:00:45]        |                     |
|                  | Speaker 2:        |                     |
|                  | Dolor sit amet... |                     |
+------------------+-------------------+---------------------+
```

### Dark Mode Default

The app launches in dark mode. No light mode toggle needed for MVP. All designs assume dark mode.

---

## Accessibility

- All interactive elements: min 44x44px touch target (even on desktop — larger targets = faster pointing)
- Focus ring: 2px ring-accent with 2px offset on all focusable elements
- Tab order: logical left-to-right, top-to-bottom
- ARIA labels on icon-only buttons
- Transcript is fully keyboard-navigable (arrow keys between segments)
- Color is never the sole indicator of state (icons + text + color)
- `prefers-reduced-motion` respected globally

---

## File Naming & Asset Conventions

- Wireframes: `./docs/wireframes/{view-name}.html`
- Design tokens: referenced in this file and consumed via Tailwind config
- Component variants: documented per component above
- All wireframes use Tailwind CSS CDN for styling (not production build, for design review only)
