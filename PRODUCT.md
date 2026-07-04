# Product

## Register

product

## Users

The same people SeniorDev is built for — working software engineers who run
local CLI agents (Claude Code, Codex, Cowork) all day and live between an issue
tracker, a terminal, and a PR. They are fluent, fast, and keyboard-first; they
expect a tool to keep up rather than explain itself. Their context with
Raccourier is almost always *peripheral*: something is running elsewhere (a
YOLO agent, a mail-triage pass, a long build) and Raccourier is the corner of
the desk they glance at when it drops something off. They are rarely staring at
it — they are working, and it earns a look only when a delivery lands. So the
interface has to be legible at a glance, scannable in a second, and honest about
what matters (an alert vs. an FYI) without demanding focus it hasn't earned.

## Product Purpose

Raccourier is a lightweight, always-on desktop notifier: the place a local
Claude agent drops your alerts on your desk. It is not a workbench — it holds no
tickets, runs no agents, opens no PRs. It does one thing well: receive a message
an agent pushed (via the `raccourier` MCP tool), raise a native Windows toast,
and keep it in a persistent pop-up window with a 14-day markdown history. A tray
app owns all state and a secret-guarded loopback listener; a thin MCP server
health-checks and forwards. Messages carry a severity (info / success / warning
/ alert), an optional source label, and an origin so a merged feed can show
which machine or agent sent what. An optional Pushover relay carries the same
alert to a phone.

It exists so an engineer can leave work running and trust that anything worth
knowing will be waiting — clearly marked, still there tomorrow, and quiet until
it matters. Success is when the window sits ignored in a corner for hours, then
a toast lands, and a one-second glance tells the whole story: what, how urgent,
from where. Raccourier is the courier, not the cargo: it delivers and gets out
of the way.

## Brand Personality

**Warm, quietly capable, honest.** Raccourier shares SeniorDev's low-ceremony,
show-the-work confidence, but this is the raccoon's home turf — the mascot's
warmth is allowed to lead here in a way it never does on the workbench's task
surface. The little hard-hat courier who "drops your alerts on your desk" sets
the tone: friendly, unpretentious, glad to help, never cutesy or cloying. Voice
is plain and human — "No deliveries yet," "Raccourier will drop your alerts
right here" — short, kind, and free of marketing gloss or dashboard jargon. It
is calm by default and only raises its voice (the rust alert tint, the toast)
when something genuinely needs you. The charm is in restraint: warmth carried by
copy, the mascot, and a single soft glow, not smeared across every pixel.

## Anti-references

- **Generic SaaS notification center.** No bell-icon dropdowns of identical gray
  rows, no card-grid inbox, no hero-metric tiles or gradient accents. This is a
  courier's desk, not an analytics panel.
- **Nagware / attention-grabbing.** No badges that guilt-trip, no bouncing
  icons, no red-dot anxiety engine, nothing that manufactures urgency it doesn't
  have. Calm until it matters is the whole point.
- **Consumer-cute / toy-like.** The raccoon leads here, but it is still warmth
  with a job, not a sticker pack. No rounded-everything, no confetti, no emoji
  soup, nothing that undercuts trust in a tool you leave running unattended.
- **Flashy / over-animated.** No choreographed load sequences, decorative
  motion, or glassmorphism-for-its-own-sake. Motion conveys arrival and state (a
  message sliding in, a read fade) and nothing else. The one backdrop-blur is a
  functional sticky header, earned — not a glass theme.

## Design Principles

1. **Legible in one glance.** The window is read peripherally, in a second, from
   the corner of the eye. Severity, title, source, and time must land instantly;
   the body is there when you lean in, never required to get the gist.
2. **Calm until it matters.** Default to quiet. Reserve intensity — the rust
   tint, the toast, the phone push — for what genuinely warrants interrupting.
   An interface that shouts about everything says nothing.
3. **Warmth leads, but stays honest.** This is the mascot's home; let the
   raccoon and the copy carry real personality. But warmth never dresses up a
   problem — an alert still reads as an alert, and the tone stays truthful.
4. **The courier gets out of the way.** Raccourier delivers and recedes. It
   holds no work hostage, steals no focus, and adds no chrome the task doesn't
   need. Earned familiarity over novelty; standard affordances a developer
   trusts on sight.
5. **Never lose a delivery, never clobber quietly.** History persists for 14
   days; read/unread, clear, and mark-all are honest and non-destructive by
   default. State the agent pushed is state the user can still find.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**. Body text meets 4.5:1 against its surface — the warm
dark-charcoal planes must be checked at every severity tint, including muted ink
(`ink-muted`) on tinted message surfaces before using it for body-length text;
large/bold text meets 3:1. Severity is **never conveyed by color alone**: it is
paired with the dot, the title weight, the copy, and (for alerts) a distinct
border and shadow, so a colorblind or grayscale reader still ranks urgency.
Every interactive element (mark-read, clear, mark-all, links) has a visible
focus outline and is keyboard-operable — the audience lives on the keyboard.
Honor `prefers-reduced-motion` on every animation (entrance, read fade, smooth
scroll already do) with an instant fallback. Toasts and the history window must
stay legible at the small window sizes this tool actually runs in.
