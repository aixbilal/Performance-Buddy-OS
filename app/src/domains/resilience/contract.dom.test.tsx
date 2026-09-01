// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

import { PerformanceProvider } from "../performance/store";
import { GoalsOverviewPage } from "../performance/GoalsOverviewPage";
import { GoalBuilderPage } from "../performance/GoalBuilderPage";
import { GoalDetailPage } from "../performance/GoalDetailPage";
import {
  setNextLoadDelay,
  setSimulateRepoFailure,
} from "../persistence/testControls";

function App({ start = "/goals" }: { start?: string }) {
  return (
    <PerformanceProvider>
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/goals" element={<GoalsOverviewPage />} />
          <Route path="/goals/new" element={<GoalBuilderPage />} />
          <Route path="/goals/:goalId" element={<GoalDetailPage />} />
          <Route path="/goals/:goalId/edit" element={<GoalBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </PerformanceProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  window.localStorage.clear();
  setSimulateRepoFailure(false);
  setNextLoadDelay(0);
});

describe("Day-17 resilience contract — LOADING ≠ EMPTY", () => {
  it("shows a loading status first, and the honest empty state only AFTER the store has loaded", async () => {
    setNextLoadDelay(60); // dev/test-only injected delay
    render(<App />);

    // While the store resolves: a polite loading status, NOT "no goals yet".
    expect(screen.getByRole("status")).toHaveTextContent(/loading your goals/i);
    expect(screen.queryByText(/no goals yet/i)).not.toBeInTheDocument();

    // After it settles: the real empty state, no lingering spinner.
    expect(await screen.findByText(/no goals yet/i)).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("Day-17 resilience contract — FAILED SAVE ≠ LOST DRAFT (relational store)", () => {
  it("a persistence failure surfaces 'Save Failed' but keeps the optimistic value; a retry then persists", async () => {
    const user = userEvent.setup();
    render(<App start="/goals/new" />);

    // Fill + submit the Goal Builder with repo writes forced to fail.
    setSimulateRepoFailure(true);
    await user.type(await screen.findByLabelText(/goal name/i), "Ship V1");
    await user.click(screen.getByRole("button", { name: /^create goal$/i }));

    // The goal is still shown (optimistic in-memory state kept), and the
    // failure is surfaced honestly — the draft was NOT discarded.
    expect(await screen.findByRole("heading", { name: "Ship V1" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/save failed/i)).toBeInTheDocument());

    // Recover: allow writes, make another change → it now persists.
    setSimulateRepoFailure(false);
    await user.click(await screen.findByRole("button", { name: /edit goal/i }));
    const name = await screen.findByLabelText(/goal name/i);
    await user.clear(name);
    await user.type(name, "Ship V1 for real");
    await user.click(screen.getByRole("button", { name: /save goal/i }));

    expect(await screen.findByRole("heading", { name: "Ship V1 for real" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/^saved$/i)).toBeInTheDocument());

    // And it is durable: a fresh provider instance reloads it from storage.
    render(<App />);
    expect(await screen.findAllByText(/ship v1 for real/i)).not.toHaveLength(0);
  });
});
