import { describe, it, expect } from "vitest";
import { resolveResilienceState, deriveAIAvailability, saveStateLabel } from "./engine";
import type { ResilienceInputs } from "./types";

const base: ResilienceInputs = {
  isLoading: false,
  hasError: false,
  isConfigured: true,
  hasData: false,
  filtersActive: false,
  emptyIsPositive: false,
};

describe("resolveResilienceState — exact priority order from the approved reference", () => {
  it("loading takes priority over everything else, even a real error", () => {
    expect(resolveResilienceState({ ...base, isLoading: true, hasError: true })).toBe("loading");
  });

  it("error takes priority over unconfigured/empty", () => {
    expect(resolveResilienceState({ ...base, hasError: true, isConfigured: false })).toBe("error");
  });

  it("unconfigured (setup-required) takes priority over empty/filtered checks", () => {
    expect(resolveResilienceState({ ...base, isConfigured: false, filtersActive: true })).toBe("setup-required");
  });

  it("has-data wins once configured, even if filters happen to be active", () => {
    expect(resolveResilienceState({ ...base, hasData: true, filtersActive: true })).toBe("has-data");
  });

  it("filtered-empty when configured, no data, but filters are active", () => {
    expect(resolveResilienceState({ ...base, filtersActive: true })).toBe("filtered-empty");
  });

  it("true-empty as the final fallback when nothing else applies", () => {
    expect(resolveResilienceState(base)).toBe("true-empty");
  });

  it("positive-empty instead of true-empty when the domain marks zero as a good outcome", () => {
    expect(resolveResilienceState({ ...base, emptyIsPositive: true })).toBe("positive-empty");
  });
});

describe("deriveAIAvailability — Disabled ≠ Not Configured ≠ Unavailable (§29-31)", () => {
  it("is disabled when the user turned AI off, regardless of provider state", () => {
    expect(deriveAIAvailability({ userEnabled: false, providerConfigured: true, lastRequestFailed: true })).toBe("disabled");
  });
  it("is not-configured when enabled but no provider is set up yet", () => {
    expect(deriveAIAvailability({ userEnabled: true, providerConfigured: false, lastRequestFailed: false })).toBe("not-configured");
  });
  it("is unavailable when configured but the last request genuinely failed", () => {
    expect(deriveAIAvailability({ userEnabled: true, providerConfigured: true, lastRequestFailed: true })).toBe("unavailable");
  });
  it("is ready when enabled, configured, and no failure recorded", () => {
    expect(deriveAIAvailability({ userEnabled: true, providerConfigured: true, lastRequestFailed: false })).toBe("ready");
  });
});

describe("saveStateLabel — never claims Saved before persistence succeeds (§50)", () => {
  it("labels each state truthfully", () => {
    expect(saveStateLabel("saving")).toBe("Saving…");
    expect(saveStateLabel("saved")).toBe("Saved");
    expect(saveStateLabel("failed")).toBe("Save Failed");
    expect(saveStateLabel("idle")).toBe("");
  });
});
