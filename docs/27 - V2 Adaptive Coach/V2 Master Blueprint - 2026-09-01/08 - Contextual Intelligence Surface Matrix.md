# 08 — Contextual Intelligence Surface Matrix (V2 final hardening, Priority 2)

Principle: **intelligence is distributed; authority stays in the canonical
domain engines.** A screen gets a contextual AI affordance ONLY where
deterministic state does not already answer the question. Everything below the
`ContextualInsight` line stays subordinate to execution/state — never a card,
never an "Ask AI" hero, never a chat box, never equal recommendation cards.

Legend: **D** deterministic answer already present · **C** contextual insight
added this run · **A** recommendation action (AI Coach / mutation registry) ·
**E** explanation action · **—** no AI surface needed.

## Primary V2 operational surfaces

| Screen | Deterministic? | AI enhance useful? | Rec. action? | Explain action? | This run |
| --- | --- | --- | --- | --- | --- |
| Today | D — NOW surface + "Adaptation needed" card lists reasons | limited | — (adaptation is deterministic) | yes | **C**: "Explore alternatives" → AI Coach on the Adaptation card (only when `mode === "adaptation-needed"`) |
| Planner | D — capacity/conflict/fragility; "Adapt this week" diff | when Could Not Fit | — | yes | **C**: `PlanningDiffReview` shows What/Why/Protected/Could-Not-Fit; "Consider alternatives in AI Coach" appears **only** when something Could Not Fit |
| Calendar | D — grid + per-occurrence resolve | no | — | — | **—** |
| Academics Overview | D — course cards | low | — | — | **—** (course attention is derived; no AI surface) |
| Course Detail | D — weighting + `AssessmentScopeEditor` | no | — | — | **—** |
| Normal Study | D — study-target reason chips (`studyEngine`) | for method change on repeated weakness | plan-this | why-this | **C**: `ContextualInsight` on the *selected* topic — `attentionEngine` reasons + `methodSuggestion` note + "Plan this" (→ Planner) + "Explore in AI Coach". Absent when no topic is selected. |
| Knowledge Overview | D — topic list + review queue | no | — | — | **—** |
| Knowledge Topic Detail | D — mastery %, evidence list, review-due badge | yes — Generate Recall | — | evidence-gap | **C**: `ContextualInsight` explains the evidence/review boundary when there is a gap, one piece of evidence, or review is due. **A** already present: `GenerateRecallButton` (permission + provider gated). |
| Routines Overview | D — consistency list | no | — | — | **—** |
| Routine Detail | D — consistency | yes — pattern | structural change | pattern explanation | **A/E already present**: `RoutinePatternPanel` (evidence-gated; Accept & apply → `adjust-routine-*` mutation) |
| AI Coach | — this IS the deep-reasoning surface | yes | yes | yes | unchanged — deep reasoning / cross-domain trade-offs |
| Weekly Review | D — deterministic facts card | yes — interpret | create-proposal | pattern explanation | **already present**: "Still open — decide or correct" prepopulation + "ask the coach to interpret" |

## Secondary / contextual surfaces

| Screen | This run |
| --- | --- |
| Focus | **—** deterministic timer + context; no AI surface |
| Analytics Overview / Patterns | **—** deterministic snapshots; AI interpretation lives in Weekly/Monthly Review |
| Language Overview | **—** deterministic path progress |
| Development / Fitness / Money Overview | **—** deterministic; Money stays `no-access` regardless |
| Settings → AI permissions | unchanged — the permission model itself |

## Guarantees for every contextual path

- **Permission**: the only remote path touched here is `GenerateRecallButton`,
  which already checks `aiAvailability === "ready"` AND
  `canReadDomain("Knowledge", permissions)`. `ContextualInsight` itself is
  100% deterministic — it renders reason strings, never calls a provider.
  Money is never widened; it stays `no-access` by default.
- **Provider unavailable**: `ContextualInsight` is unaffected (deterministic).
  `GenerateRecallButton` falls back to PBOS's standard prompts and says so.
  No page breaks.
- **No spam**: each screen gains at most one compact `ContextualInsight`
  strip, and it renders **nothing** when its headline is null (a quiet screen
  shows no AI surface at all).
- **Recommendation ≠ fact**: a contextual action that creates a durable
  recommendation does so through the shared mutation registry + the AI Coach
  decision trail — it is never blended into a deterministic fact display.
