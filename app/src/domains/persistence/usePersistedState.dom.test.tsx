// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePersistedState } from "./usePersistedState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { primeCache, __resetCacheForTests } from "./cache";
import { setSimulateStorageFailure } from "./testControls";
import type { PersistenceBackend } from "./backend";

/**
 * UI test foundation example — a React *interaction* test (distinct from the
 * pure-engine tests). Renders a real component that uses `usePersistedState`,
 * drives it with `userEvent`, and asserts the resulting rendered state.
 */
function fakeBackend(behaviour: "ok" | "fail"): PersistenceBackend {
  const writes: { key: string; value: string }[] = [];
  return {
    name: "memory",
    durable: false,
    async loadAll() {
      return [];
    },
    async set(key, value) {
      if (behaviour === "fail") throw new Error("backend write rejected");
      writes.push({ key, value });
    },
    async delete() {},
    async status() {
      return {
        schemaVersion: 0,
        kvCount: writes.length,
        localstorageMigrated: false,
        localstorageMigration: null,
      };
    },
    async migrateFromLocalStorage() {
      return { ran: false, imported: 0, skippedExisting: 0, skippedInvalid: [], schemaVersion: 0 };
    },
  };
}

function Counter() {
  const [n, setN, saveState] = usePersistedState<number>("test-counter", 0);
  return (
    <div>
      <output data-testid="n">{n}</output>
      <SaveIndicator state={saveState} />
      <button onClick={() => setN(n + 1)}>increment</button>
    </div>
  );
}

afterEach(() => {
  setSimulateStorageFailure(false);
  __resetCacheForTests();
});

describe("usePersistedState — interaction", () => {
  beforeEach(() => __resetCacheForTests());

  it("commits the value immediately and reports a real 'saved' after the durable write resolves", async () => {
    primeCache([], fakeBackend("ok"));
    render(<Counter />);
    expect(screen.getByTestId("n")).toHaveTextContent("0");

    await userEvent.click(screen.getByRole("button", { name: "increment" }));

    expect(screen.getByTestId("n")).toHaveTextContent("1"); // draft committed synchronously
    expect(await screen.findByText(/saved/i)).toBeInTheDocument();
  });

  it("shows 'Save Failed' when the durable write rejects — and never reverts the value", async () => {
    primeCache([], fakeBackend("fail"));
    render(<Counter />);

    await userEvent.click(screen.getByRole("button", { name: "increment" }));

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();
    expect(screen.getByTestId("n")).toHaveTextContent("1"); // §36 — draft preserved
  });

  it("honours the dev/test storage-failure simulation control", async () => {
    primeCache([], fakeBackend("ok"));
    setSimulateStorageFailure(true);
    render(<Counter />);

    await userEvent.click(screen.getByRole("button", { name: "increment" }));

    expect(await screen.findByText(/save failed/i)).toBeInTheDocument();
  });
});
