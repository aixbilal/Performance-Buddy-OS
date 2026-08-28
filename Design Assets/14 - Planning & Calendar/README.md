# Planning & Calendar — Design References

## Purpose
Day 13 defines the authoritative planning/scheduling layer that turns priorities and Actions into realistic time allocation while respecting capacity, fixed commitments, protected time, and conflicts.

## Approved assets
- `PBOS-Planner-Overview-v1-REFERENCE.png` — future workload, capacity, priorities, open windows, and unscheduled work.
- `PBOS-Calendar-Week-v1-REFERENCE.png` — authoritative visual weekly time map.
- `PBOS-Plan-Builder-v1-REFERENCE.png` — proposed schedule generation with hard constraints, preferences, validation, and user approval.
- `PBOS-Schedule-Conflict-Capacity-v1-REFERENCE.png` — diagnostic/resolution workspace for overlaps, overload, fragility, and cascading impact.

## Archive
- `Archive/PBOS-Plan-Builder-v1-ALT-REFERENCE.png` — an additional generated Plan Builder variant retained for historical comparison; the Approved version remains primary.

## Product / UX intent
- Action ≠ scheduled block ≠ actual completion.
- Planner ≠ Calendar ≠ Today.
- Deadline ≠ work session.
- Empty time ≠ productive capacity.
- Fixed/protected blocks differ from flexible blocks.
- Daily capacity differs from weekly capacity.
- Rescheduling cannot solve a fundamentally overloaded week.
- Generate ≠ Apply; deterministic validation runs before schedule mutations.
- Locked/manual decisions survive regeneration.

## Asset route after extraction
`C:\Performance Buddy OS\Design Assets\14 - Planning & Calendar\Approved\`

## Global implementation rules
- These PNGs are **V1 structural / functional visual references**, not permanent pixel-perfect final UI.
- Product behavior and architecture come from the main Performance Buddy OS documentation; these images communicate hierarchy, interaction intent, and approximate composition.
- The locked Design System remains authoritative for typography, color, spacing, radii, borders, shadows, and global tokens. Accidental colors in generated images must not become new global tokens.
- Keep business/domain logic separate from layout components so the later usage-driven UI redesign is recomposition/styling, not a rebuild.
- AI suggestions are advisory; deterministic rules and structured local data remain authoritative where applicable.

## Versioning
`Working → Review → Approved → Implementation`. When an Approved reference is superseded, move the old reference to `Archive` rather than deleting it.
