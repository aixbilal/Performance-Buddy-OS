// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PerformanceProvider } from "./store";
import { GoalsOverviewPage } from "./GoalsOverviewPage";
import { GoalDetailPage } from "./GoalDetailPage";
import { GoalBuilderPage } from "./GoalBuilderPage";
import { SystemsOverviewPage } from "./SystemsOverviewPage";
import { SystemDetailPage } from "./SystemDetailPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

function App({ start = "/goals" }: { start?: string }) {
  return (
    <PerformanceProvider>
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/goals" element={<GoalsOverviewPage />} />
          <Route path="/goals/new" element={<GoalBuilderPage />} />
          <Route path="/goals/:goalId" element={<GoalDetailPage />} />
          <Route path="/goals/:goalId/edit" element={<GoalBuilderPage />} />
          <Route path="/systems" element={<SystemsOverviewPage />} />
          <Route path="/systems/:systemId" element={<SystemDetailPage />} />
        </Routes>
      </MemoryRouter>
    </PerformanceProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function createGoal(user: ReturnType<typeof userEvent.setup>, title: string) {
  await user.click(await screen.findByRole("button", { name: /create goal/i }));
  await user.type(await screen.findByLabelText(/goal name/i), title);
  await user.click(screen.getByRole("button", { name: /^create goal$/i }));
  await screen.findByRole("heading", { name: title });
}

describe("Goal → System → Action, driven through the real UI", () => {
  it("creates a goal from the honest empty state and lands on its detail page", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/no goals yet/i)).toBeInTheDocument();

    await createGoal(user, "Complete DSA revision");

    expect(screen.getByRole("heading", { name: "Complete DSA revision" })).toBeInTheDocument();
    expect(screen.getByText(/no measurable target/i)).toBeInTheDocument(); // Unknown ≠ Zero
  });

  it("validation failure keeps the user's other input", async () => {
    const user = userEvent.setup();
    render(<App start="/goals/new" />);
    const detail = await screen.findByLabelText(/why this matters/i);
    await user.type(detail, "keep me");
    await user.click(screen.getByRole("button", { name: /^create goal$/i }));

    expect(await screen.findByText(/clear title/i)).toBeInTheDocument();
    expect((detail as HTMLTextAreaElement).value).toBe("keep me");
  });

  it("edits a goal and the change is visible immediately", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, "Draft title");

    await user.click(screen.getByRole("button", { name: /edit goal/i }));
    const name = await screen.findByLabelText(/goal name/i);
    await user.clear(name);
    await user.type(name, "Final title");
    await user.click(screen.getByRole("button", { name: /save goal/i }));

    expect(await screen.findByRole("heading", { name: "Final title" })).toBeInTheDocument();
  });

  it("creates a system, links it to a goal, then adds + edits + progresses an action", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createGoal(user, "Complete DSA revision");

    // link flow: Goal Detail → Manage Systems → create a system for this goal
    await user.click(screen.getByRole("button", { name: /manage systems/i }));
    await user.click(await screen.findByRole("button", { name: /create a system for this goal/i }));
    await user.type(await screen.findByLabelText(/system name/i), "Weekly DSA Study");
    await user.click(screen.getByRole("button", { name: /^create system$/i }));

    // now on System Detail
    expect(await screen.findByRole("heading", { name: /Weekly DSA Study/ })).toBeInTheDocument();
    expect(screen.getByText(/not enough activity yet/i)).toBeInTheDocument(); // insufficient-data, not 0%

    // add an action
    await user.click(screen.getByRole("button", { name: /add action/i }));
    await user.type(await screen.findByLabelText(/^action$/i), "Revise Binary Trees");
    await user.click(screen.getByRole("button", { name: /^add action$/i }));
    expect(await screen.findByText("Revise Binary Trees")).toBeInTheDocument();

    // progress its status via the explicit select (not a hidden click-cycle)
    const statusSelect = screen.getByLabelText(/status for revise binary trees/i);
    await user.selectOptions(statusSelect, "done");
    await waitFor(() => expect((statusSelect as HTMLSelectElement).value).toBe("done"));
    // health is now measurable (1/1 done) — no longer "insufficient data"
    expect(await screen.findByText("100%")).toBeInTheDocument();
    expect(screen.getByText(/from 1 action/i)).toBeInTheDocument();

    // edit the action title
    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const editTitle = await screen.findByDisplayValue("Revise Binary Trees");
    await user.clear(editTitle);
    await user.type(editTitle, "Revise AVL Trees");
    await user.click(screen.getByRole("button", { name: /save action/i }));
    expect(await screen.findByText("Revise AVL Trees")).toBeInTheDocument();

    // back on the goal, the system relationship is visible
    render(<App start="/goals" />); // fresh mount reads the same LocalRepo store
    await user.click(await screen.findByRole("link", { name: /Complete DSA revision/i }));
    expect(await screen.findByRole("link", { name: /Weekly DSA Study/i })).toBeInTheDocument();
  });

  it("an AI proposal never creates a goal on its own — Accept only prefills the builder", async () => {
    const user = userEvent.setup();
    render(<App start="/goals/new?tab=ai" />);

    await user.click(await screen.findByRole("button", { name: /^accept$/i }));
    // now in the manual builder, prefilled, still requires an explicit Create
    const name = await screen.findByLabelText(/goal name/i);
    expect((name as HTMLInputElement).value).toMatch(/cars/i);
    expect(screen.getByText(/does not create anything until you press create goal|prefilled from a proposal/i)).toBeInTheDocument();
  });

  it("Reject creates nothing", async () => {
    const user = userEvent.setup();
    render(<App start="/goals/new?tab=ai" />);
    await user.click(await screen.findByRole("button", { name: /^reject$/i }));
    expect(await screen.findByText(/nothing was created/i)).toBeInTheDocument();
  });
});
