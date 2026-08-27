# Knowledge & Notes

## Purpose

This area covers Knowledge Overview, Topic Detail, Obsidian/Notes Hub and learning/capture experiences.

## Status

All current assets are approved V1 references. They guide structure and interaction while leaving final visual refinement for the later redesign phase.

## Assets in This Folder

- `Approved/PBOS-Knowledge-Overview-v1-REFERENCE.png` — knowledge overview reference.
- `Approved/PBOS-Knowledge-Topic-Detail-v1-REFERENCE.png` — topic detail reference.
- `Approved/PBOS-Obsidian-Notes-Hub-v1-REFERENCE.png` — Obsidian and notes integration hub reference.
- `Approved/PBOS-Knowledge-Learning-Capture-v1-REFERENCE.png` — knowledge learning and capture reference.

## Product / UX Intent

PBOS is the control and intelligence layer for knowledge: it organizes context, connections, learning state and next actions. Obsidian remains the long-form Markdown note store and editor.

## Implementation Guidance

Use references to create linked but distinct overview, topic, hub and capture components. Store canonical long-form note bodies in Obsidian; PBOS should retain references, metadata and intelligence rather than creating a duplicate authoritative body. Respect offline access and vault permissions.

## What Is Locked

- PBOS/Obsidian authority boundary.
- No duplicate authoritative long-form note bodies.
- Approved V1 references and global Design System tokens.

## What Is NOT Permanently Locked

Exact note previews, graph/list arrangements, capture layout, example content, icons and decorative treatment may evolve later.

## Source-of-Truth Rules

Main documentation owns knowledge architecture and Obsidian behavior; the Design System owns tokens; assets communicate visual/UX intent; implementation code realizes the integration. Screenshots cannot override requirements or data authority.

## Naming / Versioning

Keep existing names. Follow `Working → Review → Approved → Implementation`; move replaced approved assets to `Archive`. Prefer `PBOS-Knowledge-Notes-[Screen]-v#-REFERENCE.png` or `...-PRIMARY.png`.

## Notes for Future Design

Refine navigation between PBOS intelligence and Obsidian editing, with special attention to provenance, offline states and avoiding duplicated content.
