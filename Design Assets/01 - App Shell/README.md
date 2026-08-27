# App Shell

## Purpose

This area represents the global desktop shell: navigation/sidebar, global bar, workspace frame, page framing, AI or command access, profile/system areas and shell interaction states.

## Status

Approved V1 visual reference. The primary image is the strongest current shell reference; final visual refinement is still planned after functional desktop implementation.

## Assets in This Folder

- `Approved/App-Shell-v1-PRIMARY.png` — strongest current reference for the shell’s structure and visual direction.
- `Approved/App-Shell-v1-Content-Reference.png` — supporting reference showing content within the shell; placeholder content is not permanent business logic.

## Product / UX Intent

Provide a calm, stable desktop frame that makes navigation, current context, system state and AI access easy to understand without overwhelming the workspace.

## Implementation Guidance

Build the shell as reusable layout and navigation components with clear slots for domain pages. Treat hierarchy, framing and interaction intent as guidance; derive routes, labels, permissions and behavior from product documentation. Do not encode placeholder screenshot data as product rules.

## What Is Locked

- `App-Shell-v1-PRIMARY.png` is the strongest current shell visual reference.
- Global Design System tokens and the premium matte-black, graphite, gunmetal and muted silver-blue direction remain authoritative.
- The desktop-first shell must support accessible navigation and clear system state.

## What Is NOT Permanently Locked

Pixel positions, placeholder copy/data, decorative details, exact icon treatment and final responsive refinements may change during redesign.

## Source-of-Truth Rules

Main documentation owns behavior and architecture; the Design System owns global tokens; these images communicate visual/UX intent; source code implements them. Generated screenshots cannot override requirements. Unexpected purple, gold, orange, bright green or bright red must not become new global tokens.

## Naming / Versioning

Preserve current filenames. New designs follow `Working → Review → Approved → Implementation`; replaced approved versions move to `Archive`. Prefer `PBOS-App-Shell-[Screen]-v#-REFERENCE.png` or `...-PRIMARY.png` for future standardized names.

## Notes for Future Design

Refine density, navigation states, command access and large-monitor behavior during the final UI redesign without coupling domain logic to the shell presentation.
