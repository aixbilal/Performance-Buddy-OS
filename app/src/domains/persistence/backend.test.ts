// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// isTauri() must be stubbable per-test.
const isTauriMock = vi.fn(() => false);
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => isTauriMock(),
  invoke: vi.fn(),
}));

import {
  selectBackendName,
  makeBackend,
  LocalStorageBackend,
  MemoryBackend,
} from "./backend";

describe("selectBackendName", () => {
  beforeEach(() => {
    isTauriMock.mockReturnValue(false);
    window.localStorage.clear();
  });

  it("chooses sqlite when running under Tauri", () => {
    isTauriMock.mockReturnValue(true);
    expect(selectBackendName()).toBe("sqlite");
  });

  it("chooses localStorage in a browser without Tauri", () => {
    expect(selectBackendName()).toBe("localStorage");
  });
});

describe("LocalStorageBackend", () => {
  beforeEach(() => window.localStorage.clear());

  it("round-trips only pbos:* keys", async () => {
    const b = new LocalStorageBackend();
    window.localStorage.setItem("pbos:x", "1");
    window.localStorage.setItem("noise", "2");
    await b.set("pbos:y", "3");
    const all = await b.loadAll();
    expect(all.map((e) => e.key).sort()).toEqual(["pbos:x", "pbos:y"]);
  });

  it("delete removes a key", async () => {
    const b = new LocalStorageBackend();
    await b.set("pbos:z", "1");
    await b.delete("pbos:z");
    expect(await b.loadAll()).toEqual([]);
  });
});

describe("MemoryBackend", () => {
  it("is explicitly non-durable and still round-trips within a session", async () => {
    const b = new MemoryBackend();
    expect(b.durable).toBe(false);
    await b.set("pbos:m", "1");
    expect(await b.loadAll()).toEqual([{ key: "pbos:m", value: "1" }]);
  });
});

describe("makeBackend", () => {
  it("builds the named backend", () => {
    expect(makeBackend("localStorage")).toBeInstanceOf(LocalStorageBackend);
    expect(makeBackend("memory")).toBeInstanceOf(MemoryBackend);
    expect(makeBackend("sqlite").name).toBe("sqlite");
  });
});
