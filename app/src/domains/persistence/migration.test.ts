import { describe, it, expect } from "vitest";
import {
  planLocalStorageMigration,
  readLegacyLocalStorage,
  LS_MIGRATED_MARKER,
} from "./migration";
import type { KvEntry } from "./backend";

const legacy: KvEntry[] = [
  { key: "pbos:performance-goals", value: '[{"id":"g1"}]' },
  { key: "pbos:routine-logs", value: '{"2026-08-29":{}}' },
  { key: "pbos:broken", value: "{not json" },
  { key: "unrelated-key", value: "ignored" },
  { key: LS_MIGRATED_MARKER, value: "2026-08-30T00:00:00Z" },
];

describe("planLocalStorageMigration", () => {
  it("selects only valid pbos:* JSON blobs as eligible", () => {
    const plan = planLocalStorageMigration(legacy, false);
    expect(plan.eligible.map((e) => e.key)).toEqual([
      "pbos:performance-goals",
      "pbos:routine-logs",
    ]);
  });

  it("reports unparseable legacy values as invalid — never drops them silently", () => {
    const plan = planLocalStorageMigration(legacy, false);
    expect(plan.invalid).toEqual([
      { key: "pbos:broken", reason: "value is not valid JSON" },
    ]);
  });

  it("ignores non-pbos keys and the migration marker itself", () => {
    const plan = planLocalStorageMigration(legacy, false);
    const keys = [...plan.eligible, ...plan.invalid.map((i) => ({ key: i.key }))].map(
      (e) => e.key,
    );
    expect(keys).not.toContain("unrelated-key");
    expect(keys).not.toContain(LS_MIGRATED_MARKER);
  });

  it("is a no-op once SQLite has already recorded the import (idempotent)", () => {
    const plan = planLocalStorageMigration(legacy, true);
    expect(plan).toEqual({ eligible: [], invalid: [], empty: true });
  });

  it("reports empty when there is genuinely nothing to migrate", () => {
    expect(planLocalStorageMigration([], false).empty).toBe(true);
  });
});

describe("readLegacyLocalStorage", () => {
  it("pulls every pbos:* pair out of a Storage-like object", () => {
    const map = new Map<string, string>([
      ["pbos:a", "1"],
      ["pbos:b", "2"],
      ["other", "x"],
      [LS_MIGRATED_MARKER, "z"],
    ]);
    const keys = [...map.keys()];
    const storage = {
      length: map.size,
      key: (i: number) => keys[i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
    };
    expect(readLegacyLocalStorage(storage).map((e) => e.key)).toEqual([
      "pbos:a",
      "pbos:b",
    ]);
  });
});
