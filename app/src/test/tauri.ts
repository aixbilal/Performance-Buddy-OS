/**
 * Tauri v2 frontend test helpers.
 *
 * PBOS is a Tauri app; frontend code that calls `invoke(...)` / Tauri plugin
 * APIs must be testable without a running Rust backend. This wraps
 * `@tauri-apps/api/mocks` so tests can register command handlers from a map.
 *
 * Usage (in a jsdom test file):
 *
 *   // @vitest-environment jsdom
 *   import { afterEach } from "vitest";
 *   import { invoke } from "@tauri-apps/api/core";
 *   import { mockTauriCommands, clearMocks } from "../test/tauri";
 *
 *   afterEach(() => clearMocks());
 *
 *   it("loads goals from the backend", async () => {
 *     mockTauriCommands({ list_goals: () => [{ id: "g1", title: "Ship v1" }] });
 *     await expect(invoke("list_goals")).resolves.toHaveLength(1);
 *   });
 */
import {
  mockIPC,
  mockWindows,
  clearMocks,
  mockConvertFileSrc,
} from "@tauri-apps/api/mocks";

export { mockWindows, clearMocks, mockConvertFileSrc };

export type TauriCommandHandler = (
  payload: Record<string, unknown>,
) => unknown | Promise<unknown>;

export type TauriCommandMap = Record<string, TauriCommandHandler>;

/**
 * Intercept `invoke(cmd, payload)` calls, dispatching to the matching handler.
 * Unregistered commands reject so tests fail loudly on unexpected IPC traffic.
 */
export function mockTauriCommands(
  commands: TauriCommandMap,
  options?: { shouldMockEvents?: boolean },
): void {
  mockIPC((cmd, payload) => {
    const handler = commands[cmd];
    if (!handler) {
      return Promise.reject(
        new Error(`mockTauriCommands: no handler registered for "${cmd}"`),
      );
    }
    return handler((payload ?? {}) as Record<string, unknown>);
  }, options);
}
