# Raccourier

## Design Context

Raccourier's strategic design brief lives in [PRODUCT.md](PRODUCT.md); the visual
system lives in [DESIGN.md](DESIGN.md). Read both before doing UI work. The
`/impeccable` skill uses them automatically.

**Register:** product (an always-on desktop notifier — design serves the task,
read at a glance from the corner of the desk).

Raccourier is the **source** of the shared brand family: its app icon and
`app/renderer/styles.css` are where the sibling **SeniorDev** workbench sampled
its palette (teal / amber / tan / charcoal / cream, authored in OKLCH). Keep the
two visually consistent; when the tokens here change, they are the source of truth.

**Design principles** (see PRODUCT.md for the full text):

1. **Legible in one glance** — severity, title, source, and time land in a second; the body is for the lean-in.
2. **Calm until it matters** — default to quiet; reserve the rust alert tint, the toast, and the phone push for what warrants interrupting.
3. **Warmth leads, but stays honest** — this is the raccoon's home turf; let copy and mascot carry personality, but an alert still reads as an alert.
4. **The courier gets out of the way** — deliver and recede; no chrome the task doesn't need, no focus it hasn't earned.
5. **Never lose a delivery, never clobber quietly** — 14-day history; read/unread, clear, and mark-all are honest and non-destructive.

Accessibility target: **WCAG 2.1 AA** + honor `prefers-reduced-motion`; never
convey severity by color alone (pair it with the dot, title weight, copy, and —
for alerts — border + shadow).
