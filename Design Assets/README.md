# Performance Buddy OS Design Assets

`Design Assets` contains visual artifacts for Performance Buddy OS. It is not a home for implementation code or primary product documentation.

## Sources of truth

- The main documentation tree remains the written source of truth for product behavior, architecture, features, and requirements.
- `Design Assets` is the visual source of truth for approved UI appearance.

## Structure

- `00 - Foundation` stores the global design system, visual identity, reference material, and superseded foundation work.
- `Working` contains concepts currently being explored.
- `Approved` contains the currently accepted visual reference for implementation.
- `Archive` preserves superseded or rejected versions for history. Coding agents must not use archived designs unless explicitly instructed.
- `99 - Shared Assets` contains reusable visual assets shared across screens, including icons, logos, backgrounds, and other common assets.

## Workflow

`Working → Review → Approved → Implementation`

When an approved design is replaced:

`Old Approved → Archive`

Never overwrite historical approved assets without first preserving the previous version in `Archive`.

## Naming convention

Use predictable, descriptive, versioned filenames, for example:

- `App-Shell-v1.png`
- `App-Shell-v2.png`
- `Today-v1.png`
- `Today-Empty-State-v1.png`

Avoid random generated filenames.

## Future expansion

Do not create folders for every future Performance Buddy OS domain in advance. This asset tree is intentionally extensible. When design work begins for a new UI area, create its numbered folder at that time using the same `Approved / Working / Archive` pattern.

Potential future areas may include Focus, Goals, Academics, Knowledge, Development, Fitness, Routine, Language, Money, Analytics, AI/Coach, and Settings. These are examples only, not folders that must exist now.

The folder structure itself is not permanently frozen. It may evolve when genuine design requirements appear, provided changes remain documented and existing approved assets are not lost.
