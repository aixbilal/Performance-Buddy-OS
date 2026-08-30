/**
 * Development/test-only storage-failure simulation.
 *
 * When enabled, `mirrorWrite` (see `cache.ts`) genuinely rejects, so the app's
 * real save-failure handling — "Save Failed" indicator, draft preserved — can
 * be exercised live. This is NOT a product feature.
 *
 * It is deliberately NOT rendered anywhere in the normal PBOS UI. It is
 * reachable only:
 *   - directly from tests (`setSimulateStorageFailure(true)`), and
 *   - in a Vite dev/e2e build, via `window.__PBOS_DEV__.simulateStorageFailure(...)`
 *     (see `installDevControls()` — wired from `main.tsx` only when
 *     `import.meta.env.MODE === 'development'`, i.e. never in `npm run build`).
 */
let simulateFailure = false;

export function setSimulateStorageFailure(value: boolean) {
  simulateFailure = value;
}

export function isSimulatingFailure() {
  return simulateFailure;
}

type PbosDevWindow = Window & {
  __PBOS_DEV__?: {
    simulateStorageFailure: (on?: boolean) => boolean;
    isSimulatingStorageFailure: () => boolean;
  };
};

/** Called once from `main.tsx` only when `import.meta.env.MODE === 'development'`. */
export function installDevControls() {
  const w = window as PbosDevWindow;
  w.__PBOS_DEV__ = {
    simulateStorageFailure: (on = true) => {
      setSimulateStorageFailure(on);
      // eslint-disable-next-line no-console
      console.info(
        `[PBOS dev] storage-failure simulation ${on ? "ENABLED" : "disabled"}`,
      );
      return on;
    },
    isSimulatingStorageFailure: isSimulatingFailure,
  };
}
