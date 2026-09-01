/**
 * Development/test-only resilience-simulation hooks.
 *
 * These let the app's REAL degradation handling be exercised live:
 *   - `simulateStorageFailure` — makes `mirrorWrite` (see `cache.ts`) genuinely
 *     reject, so the legacy `usePersistedState` path shows "Save Failed" +
 *     preserves the draft.
 *   - `simulateRepoFailure` — makes the per-domain `LocalRepo` write paths that
 *     opt in (via `assertRepoWritable()`) genuinely throw, so a Batch 2+
 *     relational store surfaces `saveState = "failed"` and keeps the optimistic
 *     in-memory value (the draft).
 *   - `delayNextLoads` — makes a store's initial load await a real delay, so the
 *     LOADING state (Loading ≠ Empty) is observable in a browser test.
 *
 * NONE of these are product features. They are NOT rendered anywhere in the
 * normal UI. They are reachable only:
 *   - directly from tests, and
 *   - in a Vite dev / e2e build via `window.__PBOS_DEV__.*` (see
 *     `installDevControls()` — wired from `main.tsx` ONLY when
 *     `import.meta.env.MODE === 'development'`, i.e. never in `npm run build`).
 */
let simulateFailure = false;
let simulateRepoFailure = false;
let simulateObsidianScanError = false;
let pendingLoadDelayMs = 0;

export function setSimulateStorageFailure(value: boolean) {
  simulateFailure = value;
}

export function isSimulatingFailure() {
  return simulateFailure;
}

export function setSimulateRepoFailure(value: boolean) {
  simulateRepoFailure = value;
}

export function isSimulatingRepoFailure() {
  return simulateRepoFailure;
}

/**
 * A per-domain `LocalRepo` calls this at the top of its write methods so a
 * dev/test failure toggle can exercise the store's real save-failure path.
 */
export function assertRepoWritable() {
  if (simulateRepoFailure) {
    throw new Error("Simulated persistence failure (dev/test control enabled)");
  }
}

export function setSimulateObsidianScanError(value: boolean) {
  simulateObsidianScanError = value;
}

/**
 * The browser Obsidian adapter calls this at the top of `scan()` so a
 * dev/test toggle can exercise the Notes Hub's real error state — proving a
 * filesystem/scan failure stays local to the Notes Hub and never touches
 * Knowledge Topics / Evidence / mastery.
 */
export function assertObsidianScanOk() {
  if (simulateObsidianScanError) {
    throw new Error("Simulated vault scan failure (dev/test control enabled)");
  }
}

/** Arm a one-shot load delay; the next store load that opts in consumes it. */
export function setNextLoadDelay(ms: number) {
  pendingLoadDelayMs = Math.max(0, ms);
}

/**
 * A store's load effect calls this once; if a delay was armed it returns a
 * promise that resolves after it (and disarms), otherwise it resolves
 * immediately. Real awaited time — no fake progress bar.
 */
let activeLoadDelay: Promise<void> | null = null;

export function consumeLoadDelay(): Promise<void> {
  // React 18 StrictMode double-invokes effects in dev: return the SAME
  // in-flight promise so both invocations wait the full delay (otherwise the
  // first, cancelled run would consume the one-shot token and the real run
  // would see nothing).
  if (activeLoadDelay) return activeLoadDelay;

  let ms = pendingLoadDelayMs;
  pendingLoadDelayMs = 0;
  // Dev/e2e bridge: a Playwright test can seed the delay in sessionStorage so
  // it survives the reload that actually re-mounts the stores. Only honoured
  // in a dev/e2e build.
  if (ms === 0 && import.meta.env?.MODE === "development") {
    try {
      const seeded = Number(window.sessionStorage.getItem("__pbos_load_delay__"));
      if (Number.isFinite(seeded) && seeded > 0) {
        ms = seeded;
        window.sessionStorage.removeItem("__pbos_load_delay__");
      }
    } catch {
      /* sessionStorage unavailable — ignore */
    }
  }
  if (ms <= 0) return Promise.resolve();

  activeLoadDelay = new Promise<void>((r) =>
    setTimeout(() => {
      activeLoadDelay = null;
      r();
    }, ms),
  );
  return activeLoadDelay;
}

type PbosDevWindow = Window & {
  __PBOS_DEV__?: {
    simulateStorageFailure: (on?: boolean) => boolean;
    isSimulatingStorageFailure: () => boolean;
    simulateRepoFailure: (on?: boolean) => boolean;
    isSimulatingRepoFailure: () => boolean;
    simulateObsidianScanError: (on?: boolean) => boolean;
    delayNextLoads: (ms?: number) => number;
  };
};

/** Called once from `main.tsx` only when `import.meta.env.MODE === 'development'`. */
export function installDevControls() {
  const w = window as PbosDevWindow;
  w.__PBOS_DEV__ = {
    simulateStorageFailure: (on = true) => {
      setSimulateStorageFailure(on);
      // eslint-disable-next-line no-console
      console.info(`[PBOS dev] storage-failure simulation ${on ? "ENABLED" : "disabled"}`);
      return on;
    },
    isSimulatingStorageFailure: isSimulatingFailure,
    simulateRepoFailure: (on = true) => {
      setSimulateRepoFailure(on);
      // eslint-disable-next-line no-console
      console.info(`[PBOS dev] repo-failure simulation ${on ? "ENABLED" : "disabled"}`);
      return on;
    },
    isSimulatingRepoFailure,
    simulateObsidianScanError: (on = true) => {
      setSimulateObsidianScanError(on);
      // eslint-disable-next-line no-console
      console.info(`[PBOS dev] obsidian scan-error simulation ${on ? "ENABLED" : "disabled"}`);
      return on;
    },
    delayNextLoads: (ms = 1500) => {
      setNextLoadDelay(ms);
      // eslint-disable-next-line no-console
      console.info(`[PBOS dev] next store load delayed by ${ms}ms`);
      return ms;
    },
  };
}
