# Bundled fonts

Self-hosted, subsetted (latin / latin-ext) **variable** woff2 files for the
canonical PBOS typography — no runtime network fetch, no font-package dependency.

| File | Family | Source | Licence |
|---|---|---|---|
| `inter-latin.woff2`, `inter-latin-ext.woff2` | Inter Variable | rsms/inter | SIL OFL 1.1 |
| `space-grotesk-latin.woff2` | Space Grotesk Variable | floriankarsten/space-grotesk | SIL OFL 1.1 |
| `jetbrains-mono-latin.woff2` | JetBrains Mono Variable | JetBrains/JetBrainsMono | SIL OFL 1.1 |

All three are SIL Open Font License 1.1 — redistribution inside an application
bundle is permitted. Full licence text: <https://openfontlicense.org>.

Faces are declared in `src/tokens/fonts.css` (`font-display: swap`, weight-axis
range, unicode-range per subset) and mapped to `--font-sans` / `--font-display`
/ `--font-mono` in `src/tokens/tokens.css`.
