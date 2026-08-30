import type { Options } from "@wdio/types";
import { createTauriCapabilities } from "@wdio/tauri-service";

/**
 * WebdriverIO + @wdio/tauri-service — native desktop E2E for the packaged
 * Performance Buddy OS Tauri app.
 *
 * STATUS: operational. `npm run test:e2e:tauri` passes — service diagnostics
 * report 6/6, tauri-driver + msedgedriver launch, and a live WebView2
 * WebDriver session is created against `src-tauri/target/debug/app.exe`.
 *
 * Prerequisites (all satisfied on this machine):
 *   - Rust stable `x86_64-pc-windows-msvc` (rustup/rustc/cargo on PATH)
 *   - MSVC C++ build tools (Visual Studio 2026 / VC Tools) for linking
 *   - Microsoft Edge WebView2 runtime
 *   - `tauri-driver` — `cargo install tauri-driver --locked`
 *   - `msedgedriver.exe` matching the WebView2 runtime, on PATH
 *     (~/.local/bin). NOTE: @wdio/tauri-service@1.3.0 mis-parses the newer
 *     "Microsoft Edge WebDriver <v>" version string, so `autoDownloadEdgeDriver`
 *     is left `true` and it fetches its own matching copy.
 *   - App binary: `cargo build` in `src-tauri/` (a `tauri build --debug` bundle
 *     step fails only on the default `com.tauri.dev` identifier, which is a
 *     product-config choice and unrelated to E2E).
 *
 * SCOPE LIMIT: driving the PBOS renderer's DOM / `browser.tauri.execute()`
 * needs `tauri-plugin-wdio` wired into `src-tauri` (plugin + `withGlobalTauri`
 * + `wdio:default` capability). That is a PBOS product-source change and is
 * NOT done here, so the session currently attaches to a blank WebView2
 * document. `driverProvider: 'external'` keeps the Rust source untouched;
 * switch to `'embedded'` when/if that plugin is added.
 *
 * Run:  npm run test:e2e:tauri   (or: npx wdio run wdio.conf.ts)
 */
const TAURI_APP_BINARY =
  process.platform === "win32"
    ? "./src-tauri/target/debug/app.exe"
    : "./src-tauri/target/debug/app";

export const config: Options.Testrunner = {
  runner: "local",
  specs: ["./wdio/specs/**/*.e2e.ts"],
  maxInstances: 1,

  capabilities: [
    createTauriCapabilities(TAURI_APP_BINARY, {
      driverProvider: "external",
      autoInstallTauriDriver: true,
    }),
  ],

  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath: TAURI_APP_BINARY,
        driverProvider: "external",
        autoInstallTauriDriver: true,
        // Let the service fetch the msedgedriver that matches the WebView2
        // runtime. A matching msedgedriver is also kept on PATH at
        // ~/.local/bin (see header) as a manual fallback.
        autoDownloadEdgeDriver: true,
        captureBackendLogs: true,
        captureFrontendLogs: true,
      },
    ],
  ],

  logLevel: "info",
  bail: 0,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 90_000,
  connectionRetryCount: 3,

  framework: "mocha",
  reporters: ["spec"],
  mochaOpts: {
    ui: "bdd",
    timeout: 60_000,
  },
};
