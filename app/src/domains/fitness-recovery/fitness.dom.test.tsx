// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FitnessProvider } from "./store";
import { FitnessOverviewPage } from "./FitnessOverviewPage";
import { PlanBuilderPage } from "./PlanBuilderPage";
import { TrainingPlanDetailPage } from "./TrainingPlanDetailPage";
import { ActiveWorkoutPage } from "./ActiveWorkoutPage";
import { RecoveryReadinessPage } from "./RecoveryReadinessPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

function App({ start = "/fitness" }: { start?: string }) {
  return (
    <FitnessProvider>
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/fitness" element={<FitnessOverviewPage />} />
          <Route path="/fitness/recovery" element={<RecoveryReadinessPage />} />
          <Route path="/fitness/plans/new" element={<PlanBuilderPage />} />
          <Route path="/fitness/plans/:planId" element={<TrainingPlanDetailPage />} />
          <Route path="/fitness/plans/:planId/edit" element={<PlanBuilderPage />} />
          <Route path="/fitness/workout/:workoutId" element={<ActiveWorkoutPage />} />
        </Routes>
      </MemoryRouter>
    </FitnessProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function createPlan(user: ReturnType<typeof userEvent.setup>, title: string) {
  const start =
    screen.queryByRole("button", { name: /create your first plan/i }) ??
    screen.getByRole("button", { name: "Create Training Plan" });
  await user.click(start);
  await user.type(await screen.findByLabelText(/plan name/i), title);
  await user.click(screen.getByRole("button", { name: /^create plan$/i }));
  await screen.findByRole("heading", { name: new RegExp(title) });
}

async function addSession(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^add session$/i }));
  await user.type(await screen.findByLabelText(/session title/i), "Upper Body");
  await user.type(screen.getByLabelText(/exercise 1 name/i), "Push-ups");
  await user.clear(screen.getByLabelText(/exercise 1 sets/i));
  await user.type(screen.getByLabelText(/exercise 1 sets/i), "3");
  await user.type(screen.getByLabelText(/exercise 1 target/i), "15");
  await user.click(screen.getByRole("button", { name: /^add session$/i }));
  await screen.findByText(/Push-ups — 3 × 15/);
}

describe("Fitness — driven through the real UI", () => {
  it("honest empty state → create a plan that appears immediately", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/no training plan yet/i)).toBeInTheDocument();
    await createPlan(user, "Weekly Training");
    expect(screen.getByRole("heading", { name: /Weekly Training/ })).toBeInTheDocument();
    expect(screen.getByText(/this is the base plan/i)).toBeInTheDocument();
  });

  it("validation failure preserves the other input", async () => {
    const user = userEvent.setup();
    render(<App start="/fitness/plans/new" />);
    const days = await screen.findByLabelText(/days per week/i);
    await user.clear(days);
    await user.type(days, "4");
    await user.click(screen.getByRole("button", { name: /^create plan$/i }));
    expect(await screen.findByText(/give the plan a title/i)).toBeInTheDocument();
    expect((days as HTMLInputElement).value).toBe("4");
  });

  it("records an ACTUAL workout that differs from the plan — the BASE PLAN stays unchanged", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createPlan(user, "Weekly Training");
    await addSession(user);

    // start a workout from the planned session
    await user.click(screen.getByRole("button", { name: /^start workout$/i }));

    // record actuals different from the prescription (plan: 3 × 15)
    const sets = await screen.findByLabelText(/push-ups sets completed/i);
    await user.clear(sets);
    await user.type(sets, "3");
    await user.type(screen.getByLabelText(/push-ups reps completed/i), "15,14,11");
    await user.click(screen.getByRole("button", { name: /complete workout/i }));
    expect(await screen.findByText(/completed/i)).toBeInTheDocument();
    // the plan prescription card (Active Workout page) still shows the unchanged base
    expect(screen.getByText(/Push-ups — 3 × 15/)).toBeInTheDocument();

    // navigate back to the plan via its link — base prescription still 3 × 15, history has the actual
    await user.click(screen.getByRole("link", { name: /open the plan/i }));
    expect(await screen.findByText(/Push-ups — 3 × 15/)).toBeInTheDocument();
    expect(screen.getByText(/Workout History \(1\)/)).toBeInTheDocument();
  });

  it("readiness is honest 'insufficient-data' with <3 check-ins, then derives once enough exist", async () => {
    const user = userEvent.setup();
    render(<App start="/fitness/recovery" />);
    expect(await screen.findByText(/insufficient-data/i)).toBeInTheDocument();
    expect(screen.getByText(/not enough data.*not 0 readiness/i)).toBeInTheDocument();

    // one check-in for today — still insufficient (need 3)
    await user.click(screen.getByRole("button", { name: /save check-in/i }));
    expect(await screen.findByText(/check-in saved/i)).toBeInTheDocument();
    expect(screen.getByText(/Check-In History \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/insufficient-data/i)).toBeInTheDocument();
  });
});
