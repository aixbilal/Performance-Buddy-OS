# Foundation

## Purpose

This folder holds the global visual foundation for Performance Buddy OS (PBOS). Downstream screen references should express this identity while remaining subordinate to the main product documentation.

## Status

Foundation reference. The identity document is the only asset currently present. It guides V1 implementation, while a dedicated final UI redesign and refinement phase is still expected after the functional desktop application is complete.

## Assets in This Folder

- `Visual Identity/VISUAL-IDENTITY-v1.md` — current visual-identity reference for the product’s premium, private, engineered, calm direction.

## Product / UX Intent

PBOS should feel matte black, graphite and gunmetal, with muted blue-grey or silver-blue accents, restrained sci-fi depth, limited glow and limited glass. Avoid RGB-gaming styling, cyberpunk neon, excessive semantic color, generic SaaS card grids, excessive glassmorphism and fake technical complexity.

## Implementation Guidance

Use the foundation to shape reusable components and surfaces, not to hard-code individual screenshots. Keep business logic separate from visual components so the planned redesign can change presentation without rewriting behavior.

## What Is Locked

- Main documentation remains authoritative for behavior, requirements, architecture and logic.
- The locked PBOS Design System remains authoritative for typography, colors, spacing, dimensions, radii, borders, shadows, glow and other global tokens.
- The restrained visual direction above should be preserved.

## What Is NOT Permanently Locked

Exact compositions, illustrations, decorative details, component styling and pixel-level treatment may evolve during final redesign. Strong accidental colors in generated screens do not create global tokens.

## Source-of-Truth Rules

Authority is: main documentation for product behavior; locked Design System for global visual tokens; Design Assets for visual and UX intent; application code for implementation. Generated images never override explicit requirements or deterministic rules.

## Naming / Versioning

Keep current names unchanged. New work moves `Working → Review → Approved → Implementation`. When replacing an approved asset, move the historical version to `Archive`; never destroy it. Prefer `PBOS-[Area]-[Screen]-v#-REFERENCE.png` or `PBOS-[Area]-[Screen]-v#-PRIMARY.png` for future images.

## Notes for Future Design

Expand foundation references only through approved Design System work. Validate accessibility, restraint and cross-area consistency during the final UI refinement phase.
