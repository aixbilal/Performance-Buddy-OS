# Today

## Purpose

Today is the PBOS daily command centre: what happened today, current performance, what remains, what should happen next and contextual AI guidance.

## Status

Approved V1 primary direction. It should remain the Today reference until explicitly replaced. A later manual UI redesign may refine presentation without changing documented behavior.

## Assets in This Folder

- `Approved/Today-v1-PRIMARY.png` — approved primary reference for Today’s information hierarchy, composition and visual direction.

## Product / UX Intent

Help the user understand the day quickly and act on the next useful step. Information should support collapsible `Primary`, `Secondary` and `On-Demand` layers so detail is available without making the daily view noisy.

## Implementation Guidance

Implement the hierarchy as modular, collapsible sections backed by authoritative planning and tracking data. AI guidance is contextual and explainable: AI suggests, deterministic rules validate, and the human decides. Keep layout components independent from scheduling logic so later redesign is safe.

## What Is Locked

- The approved Today reference is the current V1 direction.
- The daily-command-centre purpose and layered information model should be preserved.
- Design System tokens override colors or styling inferred from the screenshot.

## What Is NOT Permanently Locked

Exact cards, spacing, data examples, wording, decorative elements and pixel-level layout can evolve. Generated content is illustrative, not authoritative user data or business logic.

## Source-of-Truth Rules

Main documentation defines Today behavior, priorities and planning logic. The Design System defines global visual tokens. This asset provides visual/UX reference. Code is the implementation. A screenshot never overrides explicit requirements.

## Naming / Versioning

Keep the existing name unchanged. New work follows `Working → Review → Approved → Implementation`; replaced approvals move to `Archive`. Prefer `PBOS-Today-[Screen]-v#-REFERENCE.png` or `...-PRIMARY.png` for future versions.

## Notes for Future Design

During final redesign, test information density, collapse behavior, contextual guidance and calm scanning across realistic high- and low-activity days.
