# 09 — Visual & Accessibility QA Record (V2 final hardening, Priority 4)

Method: `npm run dev` + `agent-browser` (system Chrome, CDP) at the primary
1440×900 viewport, plus the automated `e2e/visual-system.spec.ts`
no-horizontal-overflow sweep at 1024 / 1280 / 1440 / 1600 / 1920 px and the
per-domain axe (`@axe-core/playwright`) assertions, all green. `DESIGN.md` is the
visual constitution; the intent was to *harden*, not redesign.

## Static token audit (all NEW V2 surfaces)

`grep` for raw hex, `rgb()/rgba()`, arbitrary Tailwind values (`bg-[…]` /
`text-[…]` / `border-[…]`), non-`motion-safe` animations, and
`purple/violet/cyan/neon/fuchsia/indigo` classes across:

`NaturalCaptureDrawer`, `CaptureProposalItem`, `AssessmentScopeEditor`,
`PlanningDiffReview`, `GenerateRecallButton`, `RoutinePatternPanel`,
`ContextualInsight`, the Today adaptation card, the Planner "Adapt this week"
section, the Weekly Review "Still open" card.

**Result: 0 violations.** Every colour is a design token; no arbitrary values;
no gaming / cyberpunk / RGB / AI-purple / orb / glass; the only animation in
the new code is `Button`'s inherited `motion-safe:animate-spin` loader.

## Screens inspected (1440×900)

| Screen | Finding |
| --- | --- |
| Today | One obvious primary "Your day is open" / NOW surface. The new Capacity `Low/Normal/High` segmented control + "Capture what happened" sit calmly on a secondary row under the header — not competing with the primary surface. The "Adaptation needed" card renders only on material divergence (verified via dom tests). Matte graphite ground, restrained steel-blue accent. No regression to equal stat cards — the three tertiary metrics stay a compact strip. |
| Planner | The new "Adapt this week (concrete dates)" card uses the exact card + header-action pattern of the V1 "Work needing placement" card directly above it; calm copy; the V1 weekly-grid "Generate proposal" flow is untouched beside it. |
| Planning Diff Review | Sections read What changes → Why → Protected → Could Not Fit → Apply/Discard. Apply is disabled with no real changes. "Consider alternatives in AI Coach" shows only under Could Not Fit. |
| Natural Capture drawer | Right-side sheet, `role="dialog"` + `aria-modal` + `aria-label`, dim `bg-black/60` overlay (the established CommandPalette pattern), close ✕ with `aria-label`, `sr-only` label on the textarea, visible focus ring, Escape + overlay-click close, autofocus on open. No chatbot bubbles, no orb, no neon. Idle state is deliberately spacious; it fills once proposals render. |
| Capture Inbox | V2 proposal bundles render with the shared `CaptureProposalItem`; V1 confirm/reclassify retained for rows without proposals. |
| Weekly Review | "Still open — decide or correct" card sits in the correct order: deterministic facts → open decisions → your notes → optional AI interpretation. Honest empty state when nothing is pending. |
| Course Detail | Collapsed `AssessmentScopeEditor` per assessment — a quiet "Scope: N topics · edit" toggle, `aria-expanded`, same-course checklist only. |
| Knowledge Topic Detail | `GenerateRecallButton` with the optional single-note radio picker (hidden when AI is not allowed); a `ContextualInsight` explains the evidence/review boundary when there is a gap. |
| Routine Detail | `RoutinePatternPanel` — evidence-gated; below-threshold shows an honest "not enough comparable history" line, not a fabricated recommendation. |
| AI Coach | Unchanged layout; apply path unified underneath. |

## Accessibility

- The `agent-browser` interactive a11y snapshot of Today shows correct heading
  levels (h1/h2/h3), labelled controls, `aria-pressed` on the capacity buttons,
  and the "Current focus" region label.
- `ContextualInsight` disclosure and `AssessmentScopeEditor` carry
  `aria-expanded` / `aria-controls`.
- Status is never colour-only — every `Badge` in the new surfaces carries a
  text label; the confidence chip reads "Clear / Needs review / Needs a choice".
- The `e2e/natural-capture.spec.ts` axe assertion on the open drawer passes
  (no critical/serious violations); the `a11y-sweep` and per-domain axe specs
  remain green.

## Fixes made

None — nothing material was found. The `datedBlocks` `useMemo` on the Planner
was replaced with an on-demand helper during Priority 1, which also removed a
React-Compiler `preserve-manual-memoization` warning (net −1).

## Remaining visual debt

- The Natural Capture drawer does not trap focus (Tab can leave it). This
  matches the existing `CommandPalette` overlay, so it is a codebase-wide
  pattern choice, not a V2 regression. Adding a focus trap to both overlays is
  a small, separate follow-up.
- No dedicated dark/light *toggle* test of the new surfaces beyond the app's
  single locked theme — the app ships one matte theme, so this is not
  applicable.
