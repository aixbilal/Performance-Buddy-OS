# Performance Buddy OS — V1 Release Candidate

Installable Windows desktop Release Candidate. This document covers only the
packaging of the already-approved V1; the product, UI, and domain architecture
are frozen and unchanged.

| | |
| --- | --- |
| **Product** | Performance Buddy OS |
| **Version** | `1.0.0-rc.1` |
| **Bundle identifier** | `com.aixbilal.performancebuddyos` (was `com.tauri.dev`) |
| **Platform** | Windows 10 / 11, x64 |
| **Installer** | NSIS (`*-setup.exe`), per-user |
| **Signing** | Unsigned — internal Release Candidate |
| **Schema** | v10 (unchanged) |

## Version source

`src-tauri/tauri.conf.json` `version` is authoritative — Tauri reads it for the
installer and the executable's version resource. `app/package.json` and
`src-tauri/Cargo.toml` are aligned to the same value to avoid drift; neither is
consumed by the bundler when `tauri.conf.json` carries a `version`.

`1.0.0-rc.1` is accepted as-is by the NSIS bundler and appears verbatim in the
installer filename, the executable's `ProductVersion` / `FileVersion`, and the
Windows "Apps & features" entry. No numeric-only fallback was needed.

## Build

Run from `app/`:

```
npm run tauri:build
```

(`tauri:build` = `tauri build`; the pre-existing `tauri:build:debug` is kept.)
This runs `beforeBuildCommand` (`npm run build` → `tsc -b && vite build`), then
the Rust release compile, then NSIS bundling.

### Artifacts (build outputs — not committed)

| | |
| --- | --- |
| Installer | `app/src-tauri/target/release/bundle/nsis/Performance Buddy OS_1.0.0-rc.1_x64-setup.exe` |
| Installer size | ~5.65 MB (5,926,424 bytes) |
| Bundled executable | `app/src-tauri/target/release/app.exe` |
| Executable size | ~15.0 MB (15,732,736 bytes) |

## Installer configuration

| Field | Value | Notes |
| --- | --- | --- |
| `bundle.targets` | `["nsis"]` | One canonical Windows target. MSI not required for this RC. |
| `bundle.windows.nsis.installMode` | `currentUser` | Per-user install to `%LOCALAPPDATA%\Performance Buddy OS\`; no administrator / UAC prompt; uninstall entry under `HKCU`. |
| `bundle.windows.webviewInstallMode` | `downloadBootstrapper` | Tauri default. Small installer; downloads the Evergreen WebView2 runtime only if the machine lacks it (present by default on current Windows 10/11). No large offline runtime embedded. |
| Icons | `src-tauri/icons/*` | Re-generated from the approved PBOS brand master (`Design Assets/00 - Foundation/Brand Identity/03 - App Icon/PBOS-App-Icon-Master-1024.png`) via `tauri icon`. Geometry unchanged — approved artwork only, rasterised to platform sizes. |
| Window title | `Performance Buddy OS` | Also set as the HTML `<title>`. |

## Content Security Policy

Set in `tauri.conf.json` → `app.security.csp`. Tauri injects it as a
`Content-Security-Policy` response header on release asset responses only; the
Vite dev server (`npm run dev`, `tauri dev`, Playwright) is unaffected, so no
separate `dev_csp` is needed. `dangerousDisableAssetCspModification` is left at
its default (`false`) so Tauri can add the IPC nonce.

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self';
font-src 'self';
media-src 'self';
connect-src 'self' ipc: http://ipc.localhost;
object-src 'none';
base-uri 'self';
frame-ancestors 'none';
form-action 'self'
```

| Directive | Rationale |
| --- | --- |
| `default-src 'self'` | Deny by default; same-origin only. |
| `script-src 'self'` | Only the bundled app JS. No `unsafe-eval` (verified absent from `dist`), no remote/CDN scripts. |
| `style-src 'self' 'unsafe-inline'` | Static Tailwind CSS is same-origin; `'unsafe-inline'` is required for runtime inline styles from Motion animations and React `style` props. Style injection only — cannot execute code. |
| `img-src 'self'` | All images ship in the bundle (`/splash`, `/src/assets`, `/icons.svg`, favicon). No `data:`/`blob:` image URIs are emitted. |
| `font-src 'self'` | Four self-hosted `.woff2` files under `/fonts`. No Google Fonts / remote fonts. |
| `media-src 'self'` | The onboarding splash `<video>` (`/splash/PBOS-First-Boot.webm`). |
| `connect-src 'self' ipc: http://ipc.localhost` | Tauri IPC transport. No remote origins: this RC ships without `VITE_PBOS_AI_API_KEY`, so `makeAIProvider` returns a null provider and the renderer makes **zero** outbound network requests. |
| `object-src 'none'` · `base-uri 'self'` · `frame-ancestors 'none'` · `form-action 'self'` | Standard hardening. |

**AI network path:** the OpenAI-compatible provider (`remoteProvider.ts`) does
`fetch()` from the renderer, but only when a build-time API key is present.
The RC has no key, so the path is inert. Enabling real remote AI in a future
build is an operator action that must also widen `connect-src` to the exact
chosen endpoint.

### CSP validation

Installed the RC and launched it: the app renders fully (dark theme, sidebar,
custom display + body fonts, inline SVG icons, Tailwind styling), IPC + SQLite
work (fresh DB created and migrated on first run), navigation works, no blank
screen or unstyled flash. Deep console-error inspection is part of the manual
smoke below (native WebView2 automation is an external blocker — see Known
limitations).

## Data path & identifier safety

The SQLite database is opened at Tauri's `app_data_dir()`:

```
%APPDATA%\com.aixbilal.performancebuddyos\pbos.sqlite3   (+ -wal, -shm)
```

WebView2 per-profile data (localStorage, cache):

```
%LOCALAPPDATA%\com.aixbilal.performancebuddyos\EBWebView\
```

Both paths derive from the bundle identifier. Changing the identifier from the
scaffold `com.tauri.dev` moves these paths.

**Impact:** PBOS has never been released publicly. The only data under the old
`com.tauri.dev` path is local developer/scaffold state from `tauri dev` runs.
Changing the identifier does **not** put any real user data at risk — it
establishes the canonical V1 storage namespace. No migration or compatibility
shim is added (none is warranted). The old `com.tauri.dev` directory is left
untouched; it can be deleted manually by the developer at any time.

Verified during the install smoke: launching the installed app created the new
`com.aixbilal.performancebuddyos` directory and DB, and left the pre-existing
`com.tauri.dev` dev database intact.

## Install / native smoke (automated)

Performed with the generated RC, silent per-user install, synthetic profile:

| Check | Result |
| --- | --- |
| `…setup.exe /S` silent install | exit 0, no elevation |
| Install location | `%LOCALAPPDATA%\Performance Buddy OS\` (`app.exe` + `uninstall.exe`) |
| Uninstall registration | `HKCU\…\Uninstall` → "Performance Buddy OS", `1.0.0-rc.1`, publisher `aixbilal` |
| Start Menu shortcut | created (`Performance Buddy OS.lnk`) |
| First launch | window opens, title "Performance Buddy OS", single process, no crash after 20 s |
| Render | full UI, fonts + icons + styling correct, no CSP blank |
| SQLite creation | fresh `pbos.sqlite3` created + migrated under the production identifier |
| Old dev data | `com.tauri.dev` DB untouched |
| Close + relaunch | reopens cleanly, no crash |
| `uninstall.exe /S` | exit 0; install dir, HKCU entry, and shortcut removed; user data dir intentionally retained |

## Manual smoke (required — ~5–10 min)

Automated native interaction is blocked by an external toolchain issue
(`@wdio/tauri-service` vs current WebView2), so a short manual pass is needed on
the installed RC:

1. Launch **Performance Buddy OS** from the Start Menu.
2. Confirm the splash appears.
3. Confirm onboarding (clean profile) or normal startup loads — no crash, no
   blank screen.
4. Navigate **Today → Academics → Focus → Settings**.
5. Create one temporary synthetic **Action**.
6. Start and stop one short **Focus** session.
7. Fully close PBOS.
8. Relaunch.
9. Confirm the synthetic Action / state persisted.
10. Confirm no obvious CSP / render / font / icon problem (open DevTools console
    if available; there should be no CSP violation entries).
11. Remove the temporary synthetic item if desired.

## Verification (this RC)

| Suite | Result |
| --- | --- |
| Vitest | 672 / 672 (`670` baseline + 2 for the new Not-Found route) |
| Playwright | 63 / 63 |
| Cargo (`--lib`) | 101 / 101 |
| Lint (oxlint) | pass (0 errors; 50 pre-existing warnings) |
| Web build (`tsc -b && vite build`) | pass |
| Cargo release build | pass |
| Tauri production build (NSIS) | pass |
| Accessibility | 0 critical / 0 serious (unchanged) |
| Secret scan (diff, config, `dist`) | clean |

## Optional P2 — unknown route

Implemented. Truly unknown hash routes now resolve to a PBOS-styled
"Page not found" screen inside the app shell, with a single link back to Today
(`src/shell/NotFoundPage.tsx`, splat route in `src/shell/router.tsx`, test
`NotFoundPage.dom.test.tsx`). No architecture change, no new dependency.

## Known limitations (approved V1 — not release defects)

- No OS-level notification scheduler; one dark theme.
- Quick Note does not silently write to Obsidian; the Obsidian long-form vault
  is an external read/metadata boundary.
- No RAG / vector / semantic search; Past Papers / adaptive testing deferred.
- No mobile companion; no cloud sync / multi-device.
- No collapsed 72 px sidebar icon rail; context rail on `/focus` only.
- Real remote-AI provider smoke is a manual / operator step (the suite uses the
  deterministic FakeProvider and makes no paid call).
- Native desktop E2E (WebdriverIO) is blocked by an external toolchain
  incompatibility (`@wdio/tauri-service` vs WebView2 151+); browser E2E, RTL,
  Rust, and this install smoke cover the same ground.

## Code signing — operator / future action

This RC is **unsigned**. Consequences:

- Windows SmartScreen / "Unknown publisher" warnings on download and first run.
- Not suitable for public distribution as-is.

Before a public V1.0: acquire a legitimate code-signing certificate (OV or EV),
configure Tauri signing (`bundle.windows.certThumbprint` / `signCommand`), and
re-bundle. Microsoft Store distribution would additionally require Store
packaging and signing. No self-signed or fake certificate is used or implied.

## Not in this release

Tauri updater, update signatures/endpoints, telemetry/analytics SDKs,
Microsoft Store / MSIX packaging, certificate purchasing, dependency upgrades.
