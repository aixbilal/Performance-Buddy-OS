# Performance Buddy OS — Claude Code Working Agreement

Performance Buddy OS (PBOS) is a **Tauri 2 desktop app** with a **React 19 + React
Router 7 + Vite 8 + Tailwind 4 + TypeScript** frontend in `app/`, and a Rust
backend in `app/src-tauri/`. Unit tests run on **Vitest**.

For any UI/frontend work, read and follow **`/DESIGN.md`** before implementation.
DESIGN.md is the canonical PBOS visual authority (it consolidates
`docs/07 - Visual & Design System`, the locked Visual Identity, and
`app/src/tokens/`). External UI sources are inspiration only and must never
override PBOS design rules or tokens.

---

## AUTONOMOUS TASK COMPLETION

An assigned task is **not complete until its acceptance criteria are verified**.

- The default loop is: **inspect → implement → test → diagnose → fix → retest.**
- Do **not** stop after the first failed command, install error, PATH problem,
  timeout, version conflict, or platform quirk. Investigate the cause.
- When a safe approach fails, find and try a supported alternative before
  reporting a blocker.
- Do **not** repeatedly ask the user to run checks you can run yourself.
- Preserve working systems. Make the **smallest safe change** that satisfies the
  task; do not refactor or redesign around it.
- Do **not** hide failures. If tests fail, say so with the output. If a step was
  skipped, say that.
- Report **BLOCKED** only when the blocker genuinely requires user action
  (credentials, account/browser auth, admin/UAC, paid service, an irreversible
  or product/architecture decision).
- Never bypass security controls, credential handling, destructive-action
  safeguards, or repository protections to make something pass.
- Before declaring **DONE**, run the relevant tests/checks and summarize the
  evidence.

---

## Verification commands (run from `app/`)

| Purpose | Command |
| --- | --- |
| Unit / component tests | `npm test` (Vitest) |
| Lint | `npm run lint` (oxlint) |
| Type-check + production build | `npm run build` (`tsc -b && vite build`) |
| Browser E2E (Playwright Test) | `npm run test:e2e` |
| Native desktop E2E (WebdriverIO) | `npm run test:e2e:tauri` — infrastructure smoke; see `app/wdio.conf.ts` header |

---

## Testing toolchain

- **Vitest** — pre-existing. Pure-logic engine tests run in the default `node`
  environment. React component tests opt into jsdom **per file** with a docblock:
  `// @vitest-environment jsdom`. Global setup: `app/vitest.setup.ts` (registers
  `@testing-library/jest-dom` matchers + RTL cleanup).
- **React Testing Library** — `@testing-library/react` / `dom` / `jest-dom` /
  `user-event`. Example: `app/src/components/Badge.dom.test.tsx`.
- **Tauri IPC mocks** — `@tauri-apps/api/mocks` wrapped by `app/src/test/tauri.ts`
  (`mockTauriCommands`, `clearMocks`). Example:
  `app/src/test/tauri-mocks.dom.test.ts`.
- **Playwright Test** (NOT Playwright MCP) — `app/playwright.config.ts`, specs in
  `app/e2e/`. Uses the **system-installed Chrome** (`channel: "chrome"`); no
  bundled-browser download. Accessibility assertions via `@axe-core/playwright`.
- **WebdriverIO + `@wdio/tauri-service`** — `app/wdio.conf.ts`, specs in
  `app/wdio/specs/`. `npm run test:e2e:tauri` passes: service diagnostics 6/6,
  `tauri-driver` + `msedgedriver` launch, and a live WebView2 WebDriver session
  is created against `src-tauri/target/debug/app.exe`. Driving the PBOS
  renderer's own DOM needs `tauri-plugin-wdio` wired into `src-tauri` (a
  product-source change, intentionally not done) — until then the session
  attaches to a blank document. `driverProvider` is `external`. Windows Tauri
  prereqs (Rust MSVC stable, VC build tools, WebView2, `tauri-driver`,
  `msedgedriver`) are all installed.

## Development tools

- **Context7 / find-docs** — use the `find-docs` skill (or `npx ctx7@latest`) for
  current library/API docs. See `.claude/rules/context7.md`.
- **Agent Browser** (`agent-browser`) — the **primary** interactive browser for
  visual inspection / exploratory QA. Installed globally (`agent-browser@0.35.x`);
  uses system Chrome automatically (no Chrome-for-Testing download). Skill stub at
  `.claude/skills/agent-browser/`; run `agent-browser skills get core` for the
  workflow guide. Do **not** substitute Playwright MCP for this.
- **Claude skills** (project scope, in `.claude/skills/`): `find-docs` and
  `agent-browser` are committed. `vercel-react-best-practices`,
  `web-design-guidelines`, and `impeccable` are pinned in `skills-lock.json`
  and **git-ignored** — restore them after cloning with
  `npx skills experimental_install`. Discover more with `skills find <query>`
  (the `skills` CLI is installed globally); add project-scoped with
  `skills add <owner/repo> --skill <name> --copy`.
- **Impeccable** (`pbakaus/impeccable`) — a UI **refinement / audit vocabulary**
  only. PBOS already has a **locked Design System and Visual Identity**; use
  Impeccable's verbs — primarily `critique`, `layout`, `quieter`, `distill`,
  `polish`, `harden`, `optimize` — to review and tighten existing PBOS surfaces
  within those tokens. Do **not** run `impeccable init` and do **not** let it
  redefine the PBOS visual identity, add new design languages, or introduce
  bold/loud aesthetics.

## UI component sourcing (order of preference)

Existing PBOS component → 21st.dev → Magic UI → Vengeance UI → UILora → DevUI.

External UI is **on-demand only** and must **never redefine PBOS design**. When a
component is eventually pulled in: search existing PBOS components first, extract
only the behavior, re-map to PBOS design tokens, strip unnecessary visual effects
and dependencies, preserve accessibility, and add a test. No generic shadcn /
cyberpunk / RGB-gaming / other-library visual identity.

- **Motion for React** (`motion`, import from `motion/react`) — the PBOS runtime
  animation library. Installed as an app dependency.
- 21st.dev / Magic UI / Vengeance UI / UILora / DevUI — **not installed**; pull
  from them per-component only when PBOS lacks a suitable one, following the rule
  above. UILora MCP stays disabled.
