// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { SettingsProvider, useSettings } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let s: ReturnType<typeof useSettings>;
function Probe() {
  s = useSettings();
  return <div data-testid="ready">{String(s.loaded)}</div>;
}
function mountHarness() {
  render(
    <SettingsProvider>
      <Probe />
    </SettingsProvider>,
  );
}
beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
async function mount() {
  mountHarness();
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

const future = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
};

describe("Settings store — canonical persistence + effective config precedence", () => {
  it("base config change persists across a remount", async () => {
    await mount();
    await act(async () => s.setBaseConfig({ weekdayAcademicCapacityMinutes: 120 }));
    expect(s.baseConfig.weekdayAcademicCapacityMinutes).toBe(120);
    cleanup();
    await mount();
    expect(s.baseConfig.weekdayAcademicCapacityMinutes).toBe(120);
  });

  it("mode override + temporary override compose; temporary > mode > base", async () => {
    await mount();
    await act(async () => s.setBaseConfig({ weekdayAcademicCapacityMinutes: 90 }));
    await act(async () => s.setMode("midterm"));
    expect(s.effectiveWeekdayCapacity).toBe(135);
    await act(async () =>
      s.addTemporaryOverride({ label: "This week", weekdayAcademicDeltaMinutes: 15, expiresAt: future() }),
    );
    expect(s.effectiveWeekdayCapacity).toBe(150);
  });

  it("clearing the temporary override restores the mode/base value; mode + base untouched", async () => {
    await mount();
    await act(async () => s.setBaseConfig({ weekdayAcademicCapacityMinutes: 90 }));
    await act(async () => s.setMode("midterm"));
    await act(async () =>
      s.addTemporaryOverride({ label: "x", weekdayAcademicDeltaMinutes: 15, expiresAt: future() }),
    );
    const id = s.temporaryOverrides[0].id;
    await act(async () => s.clearTemporaryOverride(id));
    expect(s.effectiveWeekdayCapacity).toBe(135); // mode+base
    expect(s.mode).toBe("midterm");
    expect(s.baseConfig.weekdayAcademicCapacityMinutes).toBe(90);
  });

  it("switching mode never mutates the base config", async () => {
    await mount();
    await act(async () => s.setBaseConfig({ weekdayAcademicCapacityMinutes: 100 }));
    await act(async () => s.setMode("final"));
    await act(async () => s.setMode("recovery"));
    await act(async () => s.setMode("normal"));
    expect(s.baseConfig.weekdayAcademicCapacityMinutes).toBe(100);
    expect(s.effectiveWeekdayCapacity).toBe(100); // normal mode = no delta
  });

  it("a save failure keeps the in-memory value (input is not lost)", async () => {
    await mount();
    // sabotage the repo's save
    const repoSave = vi
      .spyOn(Object.getPrototypeOf(window.localStorage), "setItem")
      .mockImplementationOnce(() => {
        throw new Error("disk full");
      });
    await act(async () => s.setMode("final"));
    expect(s.mode).toBe("final"); // still applied locally
    await waitFor(() => expect(s.saveState).toBe("failed"));
    repoSave.mockRestore();
  });

  it("restore interface defaults resets notifications + appearance only, not mode/base", async () => {
    await mount();
    await act(async () => s.setBaseConfig({ weekdayAcademicCapacityMinutes: 111 }));
    await act(async () => s.setMode("midterm"));
    await act(async () => s.setReducedMotion(true));
    await act(async () => s.toggleCategory("academics"));
    await act(async () => s.restoreInterfaceDefaults());
    expect(s.appearance.reducedMotion).toBe(false);
    expect(s.notifications.categories.academics).toBe(true);
    expect(s.mode).toBe("midterm"); // domain data untouched
    expect(s.baseConfig.weekdayAcademicCapacityMinutes).toBe(111);
    expect(s.lastResetResult?.neverAffects).toContain("aiPermissions");
  });
});
