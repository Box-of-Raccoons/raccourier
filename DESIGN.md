---
name: Raccourier
description: Warm dark-charcoal desktop notifier — a courier's desk where a local Claude agent drops your alerts, legible at a glance and calm until it matters.
colors:
  bg: "oklch(0.21 0.012 165)"
  surface: "oklch(0.255 0.014 165)"
  surface-2: "oklch(0.305 0.016 165)"
  ink-well: "oklch(0.16 0.01 165)"
  hairline: "oklch(1 0 0 / 0.08)"
  hairline-strong: "oklch(1 0 0 / 0.14)"
  ink: "oklch(0.95 0.008 95)"
  ink-soft: "oklch(0.82 0.012 120)"
  ink-muted: "oklch(0.70 0.014 140)"
  teal: "oklch(0.78 0.085 168)"
  green: "oklch(0.79 0.11 155)"
  amber: "oklch(0.80 0.115 68)"
  tan: "oklch(0.77 0.045 78)"
  rust: "oklch(0.68 0.15 38)"
typography:
  wordmark:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.005em"
  body:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: "normal"
  meta:
    fontFamily: "Segoe UI Variable Text, Segoe UI, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "0.02em"
  mono:
    fontFamily: "Cascadia Code, Consolas, ui-monospace, monospace"
    fontSize: "0.88em"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
components:
  message:
    backgroundColor: "color-mix(in oklch, {colors.surface} 91%, {colors.teal} 9%)"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  message-read:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "5px 13px"
  button-ghost-hover:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
  source-badge:
    backgroundColor: "oklch(0.77 0.045 78 / 0.12)"
    textColor: "color-mix(in oklch, {colors.tan} 82%, white)"
    rounded: "{rounded.pill}"
    padding: "1px 8px"
  code-inline:
    backgroundColor: "{colors.ink-well}"
    textColor: "color-mix(in oklch, {colors.amber} 70%, {colors.ink})"
    rounded: "5px"
    padding: "1px 5px"
---

# Design System: Raccourier

## 1. Overview

**Creative North Star: "The Courier's Desk"**

Raccourier is the corner of the desk a local Claude agent drops your alerts on.
A single always-on window over a warm dark-charcoal canvas: a quiet stack of
message cards, newest on top, each one legible in a one-second glance. The room
is dim so a delivery reads bright. A faint teal glow bleeds from the top edge —
the echo of the toast it arrived as — and every message wears exactly as much
color as its urgency earns: a hair of teal for info, green for success, amber
for attention, and a genuine rust flare for an alert. Color is severity here,
never decoration.

This is the same brand family as **SeniorDev** — in fact Raccourier's icon and
CSS are the *source* the workbench sampled its palette from (teal `#6cb49c`,
amber `#e49c54`, tan `#b49c84`, charcoal `#545454`, cream `#fcfcfc`, all
re-authored in OKLCH). But where the workbench keeps the raccoon offstage,
Raccourier is the mascot's home turf: the empty state, the wordmark, and the
overall warmth are allowed to lead. The system reads as **warm, quietly capable,
and honest** — a friendly courier, not a notification-center nag. It rejects the
SaaS inbox (no gray-row dropdowns, card grids, or hero-metric tiles), the
nagware (no anxiety badges or bouncing icons), the toy (warmth with a job, not a
sticker pack), and the flashy (motion conveys arrival and state, nothing else).

Depth is built from **tone before shadow**: three flat charcoal planes
(`bg` → `surface` → `surface-2`) stack by lightness, hairline borders draw the
seams, and a soft shadow lifts only what has genuinely arrived or been raised.

**Key Characteristics:**
- Dark warm-charcoal canvas, warm off-white ink, one soft teal glow.
- OKLCH throughout — the palette is authored and reasoned in OKLCH, not hex.
- Severity IS color: info/teal, success/green, warning/amber, alert/rust — earned per message, never decorative.
- Flat tonal layering (`bg`/`surface`/`surface-2`) plus hairlines; shadow reserved for arrival and lift.
- One consumer sans (Segoe UI Variable) for everything the human reads; Cascadia/Consolas mono only inside message code.
- Calm at rest; intensity (the rust flare, the entrance motion) reserved for what matters.

## 2. Colors

A dark warm-charcoal foundation carrying a compact semantic set that maps
one-to-one onto message severity. The palette is the canonical "raccourier"
source scheme — sampled from the app icon and authored in OKLCH — that SeniorDev
later inherited.

### Severity (the load-bearing color)
- **Info Teal** (`oklch(0.78 0.085 168)`): The default. An unread info message
  tints its surface ~9% teal; the severity dot and the top glow are teal. Also
  the interactive accent — links, focus outlines, the wordmark's leading `R`.
- **Success Green** (`oklch(0.79 0.11 155)`): A completed, good-news delivery —
  its dot, its ~9% surface tint. Never decorative.
- **Attention Amber** (`oklch(0.80 0.115 68)`): Warning / needs-a-look. Also the
  one warm highlight inside message code (`code` text mixes amber into ink).
- **Alarm Rust** (`oklch(0.68 0.15 38)`): The only genuinely high-chroma color,
  and it earns that from scarcity. An `alert` message gets a rust-mixed border
  plus a rust glow shadow — the one message that is *allowed* to shout. Also the
  destructive-hover color on the `Clear` button.

### Neutral
- **Room Charcoal — bg** (`oklch(0.21 0.012 165)`): The deepest plane. Window
  background; the sticky header sits over it at 82% alpha with a blur.
- **Card Charcoal — surface** (`oklch(0.255 0.014 165)`): The message-card base
  (before the severity tint) and the resting plane for a read message.
- **Raised Charcoal — surface-2** (`oklch(0.305 0.016 165)`): Ghost-button hover,
  scrollbar thumb, table headers — the highest resting plane.
- **Ink Well** (`oklch(0.16 0.01 165)`): Deeper than `bg`; the recessed base for
  code blocks and inline code, so machine text reads as inset.
- **Bright Ink** (`oklch(0.95 0.008 95)`): Titles and primary text; warm off-white.
- **Soft Ink** (`oklch(0.82 0.012 120)`): Message body prose, inactive labels.
- **Muted Ink** (`oklch(0.70 0.014 140)`): Timestamps, captions, list markers,
  the empty-state caption. Verify it clears 4.5:1 on its plane before using it
  for body-length text.
- **Hairline** (`oklch(1 0 0 / 0.08)`) / **Hairline Strong** (`oklch(1 0 0 / 0.14)`):
  White-alpha borders and seams that read consistently across all charcoal planes.

### Named Rules
**The Severity-Is-Color Rule.** Teal, green, amber, and rust appear only as
message severity (and their fixed interactive roles — teal for links/focus, rust
for destructive-hover). They are never brand flavor or decoration. Severity is
never conveyed by color alone — it is always paired with the dot, the title
weight, the copy, and (for alerts) the border and shadow.

**The Earned-Intensity Rule.** Chroma tracks urgency. Info sits at a whisper
(~9% surface tint); an alert is the one message permitted a colored border and a
glow. If two messages compete for "loudest" and neither is an alert, something
is over-tinted.

## 3. Typography

**One Font:** Segoe UI Variable Text (with Segoe UI, system-ui, sans-serif)
**Machine voice:** Cascadia Code / Consolas (monospace), inside message code only

**Character:** A single consumer sans carries the whole window — wordmark,
titles, body, meta. No display face: this is a peripheral notifier read at a
glance, and a fluid heading would only look wrong in a small always-on window.
Mono appears strictly inside rendered markdown (`code`, `pre`) — the voice of
whatever the agent pasted, set into the recessed ink-well plane.

### Hierarchy
- **Wordmark** (700, 15px, `-0.01em`): "Raccourier" in the header, the leading
  `R` in teal. The only 700 weight in the UI.
- **Title** (600, 14px, `-0.005em`): A message's title. Truncates with ellipsis
  on one line — the glanceable anchor of each card. Dims to 500 / soft-ink when read.
- **Body** (400, 13px, 1.6): Rendered markdown message prose, in soft ink. This
  is the only long-form text; keep it comfortable, not dense.
- **Meta** (600, 11px, `0.02em`): Timestamps (tabular-nums) and the source badge
  — small, quiet, out of the way until wanted.
- **Mono** (Cascadia/Consolas, `0.88em`): Inline and block code inside a message.

### Named Rules
**The Fixed-Scale Rule.** Type sizes are fixed px/em, never `clamp()`. A notifier
window is viewed at a consistent size and DPI; fluid type that shrinks in a small
window is a regression, not a feature.

**The One-Family Rule.** Segoe UI Variable for everything the human reads;
Cascadia/Consolas only for code the agent emitted. No third face, no display font.

## 4. Elevation

Depth is **tone first, shadow second**. Three flat charcoal planes stack by
lightness — `bg` (0.21) → `surface` (0.255) → `surface-2` (0.305) — and hairline
white-alpha borders draw the seams. The window is flat and calm at rest. Shadow
is then reserved for two jobs: a whisper of lift on a resting message card, and a
genuine flare on an alert or a freshly arrived delivery.

### Shadow Vocabulary
- **Card Lift** (`box-shadow: 0 1px 2px oklch(0 0 0 / 0.25)`): The faint
  dimensionality on an unread message card — just enough to read as "sitting on
  the desk." Removed entirely when the message is read (it flattens into `surface`).
- **Alert Flare** (`0 0 0 1px oklch(0.68 0.15 38 / 0.15), 0 2px 10px oklch(0.68 0.15 38 / 0.14)`):
  An `alert` message only — a rust ring plus a soft rust glow that lifts the one
  message that genuinely needs you off the calm stack.
- **Top Glow** (`radial-gradient(... oklch(0.78 0.085 168 / 0.10) ...)`): Not a
  shadow but the room's light — a fixed 160px teal wash bleeding from the top
  edge, echoing the toast the message arrived as. Purely atmospheric, behind everything.

### Named Rules
**The Tone-First Rule.** Reach for a lighter plane (or the severity tint) before a
shadow. Shadow is for arrival and lift, not for separating stacked cards — the gap
and the hairline do that.

## 5. Components

Components feel **calm and tactile**: hairline-defined, softly rounded, warm on
hover, with color spent only where severity or interaction earns it.
`--radius-md` (12px) is the message-card corner; `--radius-sm` (8px) is the
smaller step (code blocks, the brand mark); `999px` pills are for controls and
badges. Transitions run on `--ease-out` (`cubic-bezier(0.16, 1, 0.3, 1)`).

### The Message Card (the signature)
- **Unread (default):** `surface` mixed ~9% toward its severity, hairline border,
  `12px` radius, Card Lift shadow. Layout: a severity **dot**, the truncated
  **title**, a spacer, then the **time**; an optional **source badge** below; then
  the rendered markdown **body**. Reads top-to-bottom, urgent-to-detail. Hovering
  an unread card deepens its tint to ~15% and strengthens the border — it reads as
  clickable because clicking marks it read.
- **Alert variant:** adds the rust-mixed border and Alert Flare. The one card
  allowed to break the calm.
- **Read (handled):** collapses to flat `surface`, drops the severity tint and
  shadow, fades to `opacity: 0.6`, the title softens to 500/soft-ink, and the dot
  hollows to a muted ring. Read is visibly *done* — quieter, but never gone.
- **Cards are the content, not a grid.** This is a chronological stack, not a
  repeating icon+heading+text tile wall.

### Buttons (ghost only)
- **Style:** Transparent fill, `1px solid hairline-strong`, pill radius,
  `5px 13px`, soft-ink 600 12px. `Mark all read` and `Clear` in the header.
- **Hover:** text lifts to `ink`, fill to `surface-2`, border fades out. `Clear`
  hovers toward rust (destructive intent shown, not hidden).
- **Active/Focus:** `translateY(0.5px)` press; `outline: 2px solid teal`,
  `outline-offset: 2px`. Disabled drops to `opacity: 0.38`.

### Source & Origin Badge
A pill in low-chroma **tan** (`tan @ 12%` fill, `tan @ 20%` border, tan-toward-white
text) marking where a message came from — the `source`/`origin` on the payload,
which lets a merged multi-machine feed show provenance. Deliberately quiet: it's
context, not a headline.

### Markdown Body
Full rendered markdown (sanitized) in soft ink: headings step down in `em`, links
are teal with a subtle underline, `code` is amber-on-ink-well, `pre` is a bordered
ink-well block, blockquotes use a hairline rule, tables get `surface-2` headers.
The one place a message's own structure shows through — kept legible, never loud.

### Empty State
Centered teal envelope/parcel glyph in a soft-tinted rounded tile, over "No
deliveries yet" and "Raccourier will drop your alerts right here." This is a
sanctioned warmth moment — the mascot's voice leading, calm and friendly.

### Header
A sticky, `bg`-at-82%-alpha bar with a `blur(12px)` backdrop and a hairline
bottom edge — the one functional use of backdrop-filter, so the stack scrolls
cleanly under the brand. Holds the brand mark + wordmark and the two ghost actions.

## 6. Do's and Don'ts

### Do:
- **Do** author every color in OKLCH; the frontmatter values are the source of truth.
- **Do** map color to severity and nothing else (The Severity-Is-Color Rule);
  reserve rust and the Alert Flare for genuine alerts.
- **Do** convey depth with the tonal planes and hairlines first; reach for a
  shadow only for card lift, the alert flare, or arrival.
- **Do** keep the window legible at a glance — dot, title, source, time land
  first; body is for the lean-in.
- **Do** give every interactive element (mark-read, `Clear`, `Mark all read`,
  links) a visible `outline` focus state — the audience is keyboard-first.
- **Do** pair severity with the dot, title weight, copy, and (for alerts) border
  + shadow; never rely on color alone.
- **Do** honor `prefers-reduced-motion` (entrance, read fade, smooth scroll
  already fall back) with an instant alternative.
- **Do** verify `ink-muted` body/caption text clears 4.5:1 on its plane, including
  over a severity-tinted card.

### Don't:
- **Don't** build a SaaS notification center: no gray-row dropdowns, card grids,
  or hero-metric tiles.
- **Don't** manufacture urgency — no anxiety badges, bouncing icons, or red dots
  that guilt-trip. Calm until it matters.
- **Don't** over-mascot or turn warmth into a sticker pack; the raccoon leads in
  moments (empty state, wordmark), not smeared across every message.
- **Don't** add flashy or decorative motion or glassmorphism; the one blur is the
  functional sticky header. Motion conveys arrival/state or it doesn't ship.
- **Don't** use `background-clip: text` gradient text, or a colored
  `border-left`/`border-right` > 1px as a stripe accent (shared absolute bans).
- **Don't** use `clamp()` / fluid type or a display font anywhere.
- **Don't** let a read message stay loud — read is visibly done (dim, flat, hollow dot).
