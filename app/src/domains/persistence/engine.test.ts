import { describe, it, expect } from "vitest";
import { attemptSave, attemptLoad } from "./engine";
import type { StorageAdapter } from "./types";

function workingAdapter(): StorageAdapter {
  const store = new Map<string, string>();
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  };
}

function quotaExceededAdapter(): StorageAdapter {
  return {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError: storage is full");
    },
  };
}

describe("attemptSave — real success and real failure paths", () => {
  it("succeeds with a working storage adapter", () => {
    const result = attemptSave(workingAdapter(), "goals", { id: "g1" });
    expect(result.success).toBe(true);
    expect(result.error).toBeNull();
  });

  it("fails honestly when storage throws (e.g. quota exceeded), never fabricating success", () => {
    const result = attemptSave(quotaExceededAdapter(), "goals", { id: "g1" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("QuotaExceededError");
  });

  it("does not throw even for a value that cannot be serialized — reports failure instead", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const result = attemptSave(workingAdapter(), "bad", circular);
    expect(result.success).toBe(false);
  });
});

describe("attemptLoad — Unknown key ≠ Corrupted data (§47/§48)", () => {
  it("returns the fallback with NO error when the key genuinely never existed", () => {
    const result = attemptLoad(workingAdapter(), "missing-key", { default: true });
    expect(result.value).toEqual({ default: true });
    expect(result.error).toBeNull();
    expect(result.wasEmpty).toBe(true);
  });

  it("returns the fallback WITH an error when stored data is corrupted, not silently treated as empty", () => {
    const adapter = workingAdapter();
    adapter.setItem("broken", "{not valid json");
    const result = attemptLoad(adapter, "broken", { default: true });
    expect(result.value).toEqual({ default: true });
    expect(result.error).not.toBeNull();
    expect(result.wasEmpty).toBe(false); // it existed — it was corrupted, a real distinction
  });

  it("round-trips a real save/load correctly", () => {
    const adapter = workingAdapter();
    attemptSave(adapter, "goals", { id: "g1", title: "Real Data" });
    const result = attemptLoad(adapter, "goals", null);
    expect(result.value).toEqual({ id: "g1", title: "Real Data" });
    expect(result.error).toBeNull();
  });
});
