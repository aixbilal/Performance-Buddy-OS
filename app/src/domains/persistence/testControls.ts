import type { StorageAdapter } from "./types";

/**
 * A real, honest test affordance — same pattern as Onboarding's "Simulate
 * Relaunch." When toggled on, storage genuinely throws on write, so the
 * app's failure handling can be verified live, not just in unit tests.
 * This is NOT a product feature — it should never ship enabled.
 */
let simulateFailure = false;

export function setSimulateStorageFailure(value: boolean) {
  simulateFailure = value;
}

export function getStorageAdapter(): StorageAdapter {
  if (simulateFailure) {
    return {
      getItem: () => null,
      setItem: () => {
        throw new Error("Simulated storage failure (test control enabled)");
      },
    };
  }
  return window.localStorage;
}

export function isSimulatingFailure() {
  return simulateFailure;
}
