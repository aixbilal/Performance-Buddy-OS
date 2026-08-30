// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

const isTauriMock = vi.fn(() => false);
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
  invoke: vi.fn(),
}));

import {
  initPersistence,
  getPersistenceStatus,
  __resetPersistenceBootstrapForTests,
} from "./bootstrap";
import { cacheAdapter, __resetCacheForTests } from "./cache";

beforeEach(() => {
  __resetPersistenceBootstrapForTests();
  __resetCacheForTests();
  window.localStorage.clear();
  isTauriMock.mockReturnValue(false);
});

describe("initPersistence — browser dev (localStorage backend)", () => {
  it("loads existing pbos:* state into the synchronous cache and reports truthfully", async () => {
    window.localStorage.setItem("pbos:money-transactions", '[{"id":"tx1"}]');

    const status = await initPersistence();

    expect(status.phase).toBe("loaded");
    expect(status.backend).toBe("localStorage");
    expect(status.degradedFrom).toBeNull();
    expect(status.keyCount).toBe(1);
    // Cache is warm and synchronous.
    expect(cacheAdapter.getItem("pbos:money-transactions")).toBe('[{"id":"tx1"}]');
  });

  it("is idempotent — repeated calls return the same settled status", async () => {
    const a = await initPersistence();
    const b = await initPersistence();
    expect(a).toBe(b);
    expect(getPersistenceStatus().phase).toBe("loaded");
  });
});

describe("initPersistence — degradation is represented, never silent", () => {
  it("falls back from a failing sqlite backend to localStorage and says so", async () => {
    isTauriMock.mockReturnValue(true); // selects sqlite
    // invoke() (mocked) returns undefined -> SqliteBackend.status()/loadAll() throw.
    window.localStorage.setItem("pbos:routine-logs", "{}");

    const status = await initPersistence();

    expect(status.backend).toBe("localStorage");
    expect(status.degradedFrom).toBe("sqlite");
    expect(status.error).toMatch(/SQLite unavailable/i);
    expect(status.phase).toBe("loaded");
    expect(cacheAdapter.getItem("pbos:routine-logs")).toBe("{}");
  });
});
