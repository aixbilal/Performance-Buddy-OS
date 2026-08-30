// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { mockTauriCommands, clearMocks } from "./tauri";

// Smoke test proving the Tauri v2 IPC mocking toolchain works end to end.
describe("Tauri IPC mock toolchain", () => {
  afterEach(() => clearMocks());

  it("intercepts invoke() and returns the mocked value", async () => {
    mockTauriCommands({
      add: (payload) => (payload.a as number) + (payload.b as number),
    });
    await expect(invoke("add", { a: 12, b: 15 })).resolves.toBe(27);
  });

  it("rejects invoke() for unregistered commands", async () => {
    mockTauriCommands({});
    await expect(invoke("not_registered")).rejects.toThrow(/no handler registered/);
  });
});
