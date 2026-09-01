# Performance Buddy OS Design System

Canonical visual constitution for **all** PBOS frontend work. Every future
Claude/Codex UI task starts here — not from a screenshot guess, not from a
library default, not from generic AI-dashboard instinct.

**Authority order.** This file consolidates and points at the locked sources; on
any conflict, the source wins and this file is corrected:

1. `docs/07 - Visual & Design System/` — approved design system (07.01–07.18).
2. `Design Assets/00 - Foundation/Visual Identity/VISUAL-IDENTITY-v1.md` — locked identity.
3. `app/src/tokens/tokens.css` + `app/src/tokens/fonts.css` — the running tokens (source of truth for values).
4. `Design Assets/.../Approved/` reference screenshots.

External UI sites and generated concepts are **inspiration only**. They never
override accessibility, domain ownership, interaction rules, tokens, or identity.

This is not a redesign and not a V2 document. It records what is already
approved so it stops being re-derived.

---

## 1. Product Character

PBOS should feel:

- calm
- precise
- private
- intelligent
- disciplined
- engineered
- premium
- performance-oriented

**Visual balance:**

- **70%** premium productivity software
- **20%** precision instrument
- **10%** restrained cinematic sci-fi

Foundation is matte black / graphite / gunmetal. Metallic edges, precise seams,
and recessed construction are allowed but subtle. Illumination is cool
white / muted blue-grey. **Glow communicates state** (focus, activity, progress),
never decoration. Panels read as purposeful instruments, not generic SaaS cards.

Explicitly **NOT**:

- gaming / esports UI
- cyberpunk / neon
- RGB
- neon dashboard
- AI showcase website
- glass everywhere
- futuristic spaceship / cockpit interface
- generic admin template

---

## 2. Core Surface Principle

> **SIMPLIFY THE SURFACE. PRESERVE THE CAPABILITY.**

Prefer **Primary → Secondary → Tertiary** hierarchy over equal-card grids.

Reach for these **before** adding another card:

- typography weight/size
- whitespace and rhythm
- grouping and alignment
- dividers
- progressive disclosure

Quality test (07.02): remove decorative styling and confirm the structure still
works; disable colour and motion and confirm states still read; resize/zoom and
confirm reflow; swap in long / empty / error data and confirm resilience.

---

## 3. Canonical Colours

The running values live in `app/src/tokens/tokens.css` under `@theme`. Consume
the **semantic** names as Tailwind v4 utilities (`bg-canvas`, `text-text-primary`,
`border-border-subtle`, `bg-status-success`, …). Never hard-code a hex in a
component.

### Foundation (locked)

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg-base` | `#0A0C0F` | application canvas |
| `--color-bg-surface` | `#111419` | primary workspace / sections |
| `--color-bg-surface-raised` | `#171B21` | menus, cards needing separation, side context |
| `--color-bg-surface-soft` | `#1D2229` | overlay / command / popover layer |
| `--color-line-subtle` | `#252B33` | low-emphasis separator / component boundary |
| `--color-line-strong` | `#343C46` | selected / nested-region boundary |
| `--color-line-divider` | `#20252C` | divider between groups |
| `--color-ink-primary` | `#F2F4F7` | primary text |
| `--color-ink-secondary` | `#A9B0B9` | secondary text |
| `--color-ink-muted` | `#7C8490` | metadata / captions (nudged from `#6F7883` to clear AA on both surfaces) |
| `--color-ink-disabled` | `#4A515A` | disabled (legible but clearly inactive) |
| `--color-ink-on-accent` | `#0A0C0F` | text/icon on an accent fill |
| `--color-accent-primary` | `#8FA8C1` | restrained accent — primary action, focus ring |
| `--color-accent-hover` | `#A7BCD0` | accent hover |
| `--color-accent-soft` | `#24303C` | accent-tinted surface (selected, AI surface) |
| `--color-accent-glow` | `#6F8DAA` | selection edge / state glow only |
| `--color-success` | `#6FA58A` | confirmed success |
| `--color-warning` | `#C6A76A` | attention |
| `--color-danger` | `#C97878` | danger / error only |
| `--color-info` | `#7D9DBD` | neutral information |

### Semantic aliases (what components use)

- **canvas/surface:** `canvas`, `surface`, `surface-raised`, `surface-inset` (= surface), `surface-overlay` (= soft), `surface-selected` (= accent-soft)
- **text:** `text-primary`, `text-secondary`, `text-muted`, `text-disabled`, `text-inverse` / `text-on-accent`
- **border:** `border-subtle`, `border-strong`, `border-divider`, `border-focus` (= accent-primary), `border-selected` (= accent-glow)
- **action:** `action-primary`, `action-primary-hover`, `action-secondary` (= surface-soft), `action-destructive` (= danger)
- **status:** `status-success`, `status-warning`, `status-danger`, `status-info`
- **AI:** `ai-accent` (= accent-primary), `ai-surface` (= accent-soft) — proposal identity, must **not** imply authority

### Rules

- One dark theme in V1. Token architecture must not make a future light theme
  impossible, but no light palette is built.
- No wildcard vivid blue/cyan. The accent is a **desaturated steel blue-grey**;
  keep it rare.
- Red is danger/error only — never "low productivity". Green is confirmed
  success — never a moral score.
- Status is never colour alone: pair with label + icon + wording + structure.
- Domain accents (if ever used) stay subordinate to semantic status.
- No raw product colour bypasses a token.

---

## 4. Typography

Three self-hosted variable families (subsetted `woff2`, `font-display: swap`, no
runtime network fetch). Defined in `app/src/tokens/fonts.css`.

| Family | Token | Use |
| --- | --- | --- |
| **Space Grotesk** | `--font-display` | display, headings, card titles |
| **Inter** | `--font-sans` | UI, body, navigation, forms, tables, AI text (the default) |
| **JetBrains Mono** | `--font-mono` | Focus timer, precise technical readouts, IDs, formulas |

No fourth font without explicit approval.

### Type scale (`tokens.css`)

| Token | Size / line-height | Role |
| --- | --- | --- |
| `text-xs` | 12 / 16 | UI label, caption |
| `text-sm` | 13 / 18 | small / dense |
| `text-base` | 14 / 22 | body default |
| `text-lg` | 16 / 24 | body large, card title, subheading |
| `text-xl` | 18 / 26 | H3 / section heading |
| `text-2xl` | 22 / 30 | H2 |
| `text-3xl` | 28 / 36 | H1 / page title |
| `text-4xl` | 32 / 40 | hero (rare product / empty-state moments only) |

Rules: limited scale, clear weight/size hierarchy, comfortable body line length,
all-caps only for short labels, tabular numerals for marks/money/timers/tables,
truncation never hides critical data (provide accessible full text). Hierarchy
must survive zoom, long content, dense tables, and fallback fonts.

---

## 5. Layout & Hierarchy

- **One obvious primary focus per screen.** Page purpose → current/primary state
  → primary action → essential content → supporting context → metadata.
  (Safety / permission / data-loss consequences may override this order.)
- **Desktop-first.** Left sidebar is primary navigation; topbar stays restrained.
- **Context rail only when genuinely useful** — currently `/focus` only. A route
  opts in via `handle.contextRail`.
- Do not fill empty space merely because it exists. Do not float a tiny centred
  card in a giant empty workspace — use the space for evidence, relationships,
  comparison, or a calm empty state.
- Domain pages may use different composition while sharing tokens + components.
- Spacing scale (4px base): `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64`. No
  arbitrary spacing values. Whitespace expresses grouping before borders/cards.
- Widths: bounded reading/form widths; align related labels/values and repeated
  rows; keep alignment stable when badges or optional actions appear.

### Shell metrics (`tokens.css`)

| Token | Value |
| --- | --- |
| `--shell-sidebar-expanded` | 248px |
| `--shell-sidebar-collapsed` | 72px (deferred — see §8) |
| `--shell-topbar` | 64px |
| `--shell-context-rail` | 300px |

### Radii (`tokens.css`)

`sm 6` · `md 8` · `lg 12` · `xl 16` · `2xl 20` · `full`. Pills (`full`) are for
chips / status / filter controls where the shape communicates containment —
not general cards.

---

## 6. Today

Today must answer, in this priority:

1. **What matters now?**
2. **What should I do next?**
3. **What remains today?**
4. **Is anything important changing?**

Rules:

- Current / next execution is **primary** — the plan rows (NOW / NEXT / EARLIER)
  with a per-row Start Focus are the centre of the screen.
- Metrics are **tertiary** — a demoted strip, not a hero row of equal stat cards.
- AI is **advisory** — a labelled proposal (Approve / Modify / Not now),
  visually subordinate to user execution.
- **Do not regress Today into a dashboard of equal stat cards.**

---

## 7. Focus

Focus is a canonical PBOS visual reference. It is a low-distraction environment,
**not** a decorative full-screen timer.

Visual hierarchy:

1. Current task / session title + evidence target.
2. Timer / elapsed state (JetBrains Mono) with pause / finish / interruption.
3. Minimal source / context needed for the work.
4. Optional notes and session evidence capture.
5. Quiet access to plan and exit.

Treatment: simplified canvas, reduced navigation prominence, controlled reading
width, restrained accent, contextual rail, minimal controls, calm empty space.
It must remain useful **without artwork and without AI**. AI-off practice is
indicated plainly, never framed as punishment. States (planned/unplanned,
active, paused, interrupted, completing, saved, failed-to-save) stay clear.
Ends with an honest completion / evidence workflow.

---

## 8. Navigation / Shell

Current approved direction (`app/src/shell/`):

- **Icons + labels.** One canonical PBOS-owned line-icon family
  (`components/Icon.tsx`, `IconName`). The visible label carries meaning; the
  icon is decorative (`aria-hidden`).
- **Restrained selected state:** `accent-soft` fill + brighter icon +
  `aria-current="page"` + a **single thin accent edge indicator that glides**
  between destinations (CSS transform; collapses to an instant move under
  reduced motion). The active state never depends on the indicator alone.
- Quiet hover; do not make hover a near-selected state.
- **Small PBOS identity presence** (compact brand lockup). No giant logo, no
  decorative metallic panels, no 3D brandmark in the shell chrome.
- Sidebar placement is **stable** and does not move between screens.
- Nav groups (single source of truth = `app/src/shell/navigation.ts`):
  **Today** (Today, Focus, Goals, Planner, Calendar) ·
  **Life** (Academics, Development, Fitness, Routine, Language, Money) ·
  **Intelligence** (Knowledge, Analytics, AI Coach) ·
  **System** (Settings).
- Collapsed 72px icon rail is **optional / later** — it needs width-toggle
  state, persistence, and topbar coordination; do not build it as a side effect.
- **TopBar stays restrained:** page title + search/⌘K + a small save-status
  line + the AI affordance. Nothing decorative.
- `RouteErrorBoundary` wraps each routed page; a page crash never takes down the
  sidebar / topbar.

---

## 9. Cards & Containers

**DO NOT put everything in cards.**

Avoid:

- card inside card (nested depth is limited)
- equal 3-up card grids by default
- large bordered boxes around trivial information
- dashboard-template composition

Use a card / raised surface only for:

- meaningful containment
- an interaction boundary
- elevated / layered state
- important contextual grouping

Reach for whitespace + hierarchy + dividers first (07.07). Dark surfaces separate
by subtle tonal step + border, not heavy shadow. Existing primitives:
`Card`, `StatCard`, `PrimaryActionSurface`, `EmptyState`, `RecommendationCard`,
`EvidenceList`, `Badge`, `Button`, `FormFields`, `StateViews` (in
`app/src/components/`).

---

## 10. Motion

Motion communicates **state, selection, change, focus** — nothing else.

- Typical duration **120–220ms**. Tokens: `--motion-duration-feedback 120ms`,
  `--motion-duration-transition 200ms`, `--motion-duration-slow 320ms`.
  Easing: `--motion-easing-standard cubic-bezier(0.2, 0, 0.2, 1)`.
- Motion begins from a user/system cause and ends in the **true persisted
  state**. A persistence failure must never animate a successful completion.
- Small distances. No simultaneous unrelated animations.

Avoid:

- decorative loops
- bounce / large spring overshoot
- particles
- glow animation everywhere
- animation on every mount
- continuous ambient animation

**Reduced motion** is a complete mode (instant changes / fades, no spatial
movement). Honoured via `prefers-reduced-motion` **and** the in-app
`appearance.reducedMotion` toggle (global rule in `index.css`;
`components/motion/useReducedMotionPref.ts`). No workflow, hierarchy, chart
meaning, or confirmation may depend on animation.

Runtime library: **Motion for React** (`import { ... } from "motion/react"`).

---

## 11. AI Surfaces

AI should feel: **advisory · contextual · reversible · permission-aware**.

- AI content is **labelled** and visually **separated** from confirmed records
  (`ai-accent` / `ai-surface`, distinct from confirmed state).
- A proposed change **never looks already committed** (human authority).
- AI proposal is distinct but **subordinate to user execution**.

AI must **NOT** become:

- the entire navigation
- the primary visual element on every page
- a chat bubble permanently dominating the workspace

Personas (Head Coach / Culture & Knowledge Guide / Growth & Communication Guide)
have stable identity tokens independent of provider/model; failover never
recolours or renames them. Hidden specialists appear as labelled source chips /
consultation records, not foreground characters.

---

## 12. Domain Identity

**No separate colour theme per domain.** Allow subtle *compositional* personality
only:

| Domain | Compositional emphasis |
| --- | --- |
| Academics | mastery / assessment / next-study intelligence |
| Development | projects / skills / evidence |
| Fitness | prescription / session / recovery |
| Knowledge | topic / evidence / source relationships |
| Language | path / lesson / review |
| Money | actual / planned / savings |

All domains remain unmistakably PBOS. Domain components may specialize semantics
but must **not** fork base accessibility or tokens (07.15).

---

## 13. Accessibility

Non-negotiable (07.02 / 07.08 / 07.17; V1 shipped 0 critical / 0 serious):

- **Visible focus** over every surface — never removed for aesthetics; distinct
  from selection; survives high-contrast / system modes.
- Full **keyboard navigation** and correct focus order; sidebar, forms, and the
  command palette are keyboard-reachable.
- Semantic controls (real buttons/links/inputs, not clickable divs).
- **AA contrast** for text and essential controls (≥ 4.5:1); `ink-muted` is
  already tuned for this — do not reintroduce `#6F7883` for body text.
- Reduced-motion complete mode.
- **No colour-only status** — always label / icon / pattern as well.
- Accessible names for icon-only controls; decorative icons hidden from AT.
- Adequate target sizes; truncation provides accessible full text.

Verification: `app/e2e/a11y-sweep.spec.ts` + per-form scoped axe
(`@axe-core/playwright`). **Target: 0 critical / 0 serious.**

---

## 14. Component Inspiration Policy

External UI sources are **component / interaction mines**, never a design system.

Order: **existing PBOS component** (`app/src/components/`) → then, only if PBOS
lacks a suitable one, inspiration from: 21st.dev · Magic UI · Vengeance UI ·
UILora · DevUI · Unlumen · Eldora UI. None are installed; none define PBOS.

Rules:

1. Never adopt an external library as PBOS's design system.
2. Never copy foreign colours / branding / visual identity.
3. Extract only the useful **interaction / composition** concept.
4. Rewrite / adapt into a PBOS-owned component.
5. Map everything to PBOS tokens.
6. Preserve accessibility and reduced motion.
7. Use only when solving a **verified product problem**.
8. Add a test for the adapted component.

Typical usefulness:

- **Unlumen** → navigation interaction
- **Vengeance UI** → selective AI surface / active-state ideas
- **Magic UI** → restrained number / state transitions
- **Eldora UI** → small event-driven microinteractions
- **UILora / DevUI** → fallback inspiration only

No generic shadcn / cyberpunk / RGB-gaming / other-library identity survives the
adaptation.

---

## 15. Approved Design Toolchain

| Stage | Tool | Use |
| --- | --- | --- |
| **Design authority** | `DESIGN.md` + `docs/07` + approved reference screenshots | the rules; consult first |
| **Reference translation** | Image-to-Code | only when a screenshot / mockup / approved reference is worth adapting — never to invent PBOS branding. *(not currently installed — see §16)* |
| **Implementation** | Claude Code / Codex | build against the tokens + components |
| **Selective refinement** | Impeccable | one specific surface at a time — `critique` / `layout` / `quieter` / `distill` / `polish` / `harden` / `optimize`. Never blanket-apply; never let it redefine identity or run `impeccable init` |
| **Engineering quality** | Vercel React Best Practices | during / after implementation |
| **UI quality audit** | Web Design Guidelines | after implementation / refinement |
| **Browser interaction** | Agent Browser | when real interactive browser work is needed (primary interactive browser) |
| **PBOS verification** | Playwright (`npm run test:e2e`) | regression, deterministic fixed-viewport screenshots, 1024–1920 checks |
| **Independent review** | generated screenshots → user uploads to ChatGPT → external PASS / FIX | final visual gate |

---

## 16. Explicitly Excluded Tools (for now)

Do **not** add for current PBOS frontend work:

- Firecrawl
- Crawl4AI
- Jina Reader
- Mobbin MCP
- full Taste skill collection

They do not currently solve a strong enough PBOS problem to justify the
tool/context complexity. Not a judgement on the tools. Re-evaluate only if a
future task specifically requires large-scale crawling / research.

**Current availability** (verified this task):

| Tool | Status |
| --- | --- |
| DESIGN.md | present (this file) |
| Impeccable | available (`.claude/skills/impeccable/`, pinned) |
| Vercel React Best Practices | available (pinned) |
| Web Design Guidelines | available (pinned) |
| Agent Browser | available (`.claude/skills/agent-browser/`, global CLI) |
| Playwright | available (`app/playwright.config.ts`, `npm run test:e2e`) |
| **Image-to-Code** | **not currently available** — add only when a task genuinely needs reference→code translation |

---

## 17. Image-to-Code Rules

When Image-to-Code is used:

```
reference
  → extract structure
  → identify useful interaction / layout
  → discard foreign brand
  → apply PBOS DESIGN.md (tokens, type, spacing, a11y)
  → build a reusable PBOS component
  → screenshot
  → independent review
```

Do **not** clone a screenshot pixel-for-pixel when it conflicts with PBOS
structure, tokens, or accessibility. Reference similarity is not acceptance.

---

## 18. Generic AI-UI Warning Signs

If a screen shows these, reconsider composition:

- hero + three statistic cards + grid on every page
- endless identical rounded rectangles
- every metric given equal weight
- random gradients
- unnecessary glass
- blue / cyan everything
- sparkle icons everywhere
- oversized headings
- meaningless decorative charts
- excessive pills
- every domain structurally identical

> If the screen could belong to any SaaS product after removing its title,
> the composition is wrong.

---

## 19. Pre-Implementation Checklist

Before building any frontend surface:

1. What is the single most important user decision / action here?
2. What is secondary?
3. What information can be hidden until needed?
4. Does this actually require a card?
5. Does an existing PBOS component already solve it?
6. Is external inspiration genuinely necessary?
7. Does this preserve PBOS identity (§1, §18)?
8. Is it still usable at 1024px?
9. Does it respect reduced motion?
10. How will it be visually verified?

---

## 20. Definition of Done for UI Work

```
implementation
  → tests (Vitest + RTL; Playwright where it is a workflow)
  → Web Design Guidelines audit
  → Vercel React Best Practices pass
  → targeted accessibility (keyboard / focus / contrast / reduced motion / axe)
  → Playwright deterministic screenshot
  → independent visual review (external PASS)
```

A surface is done only when it is understandable, buildable, testable,
consistent, recoverable, accessible, and honest about authority — not merely
attractive.
