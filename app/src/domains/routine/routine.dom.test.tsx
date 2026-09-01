// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PerformanceProvider } from "../performance/store";
import { RevisionProvider } from "../revision/store";
import { AcademicProvider } from "../academic/store";
import { KnowledgeProvider } from "../knowledge/store";
import { LanguageProvider } from "../language/store";
import { MoneyProvider } from "../money/store";
import { PlanningProvider } from "../planning/store";
import { RoutineProvider } from "./store";
import { RoutinesOverviewPage } from "./RoutinesOverviewPage";
import { RoutineBuilderPage } from "./RoutineBuilderPage";
import { RoutineDetailPage } from "./RoutineDetailPage";
import { DailyCheckInPage } from "./DailyCheckInPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

function seedSystem() {
  window.localStorage.setItem(
    "pbos:performance-v2",
    JSON.stringify({
      goals: [],
      systems: [
        {
          id: "sys-1",
          title: "Weekly DSA Study",
          description: "",
          domain: "development",
          cadence: "Weekly",
          tags: [],
          starred: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      actions: [],
      links: [],
    }),
  );
  window.localStorage.setItem("pbos:performance-v2-imported", "1");
}

function App({ start = "/routine" }: { start?: string }) {
  return (
    <RevisionProvider>
      <PerformanceProvider>
        <AcademicProvider>
          <KnowledgeProvider>
            <LanguageProvider>
              <MoneyProvider>
                <PlanningProvider>
                  <RoutineProvider>
                    <MemoryRouter initialEntries={[start]}>
                      <Routes>
                        <Route path="/routine" element={<RoutinesOverviewPage />} />
                        <Route path="/routine/new" element={<RoutineBuilderPage />} />
                        <Route path="/routine/check-in" element={<DailyCheckInPage />} />
                        <Route path="/routine/:routineId" element={<RoutineDetailPage />} />
                        <Route path="/routine/:routineId/edit" element={<RoutineBuilderPage />} />
                      </Routes>
                    </MemoryRouter>
                  </RoutineProvider>
                </PlanningProvider>
              </MoneyProvider>
            </LanguageProvider>
          </KnowledgeProvider>
        </AcademicProvider>
      </PerformanceProvider>
    </RevisionProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function createRoutine(user: ReturnType<typeof userEvent.setup>, title: string) {
  await screen.findAllByRole("button", { name: /create your first routine|^new routine$/i }); // wait past LOADING
  const start =
    screen.queryByRole("button", { name: /create your first routine/i }) ??
    screen.getByRole("button", { name: /^new routine$/i });
  await user.click(start);
  await user.type(await screen.findByLabelText(/routine name/i), title);
  await user.click(screen.getByRole("button", { name: /^create routine$/i }));
  await screen.findByRole("heading", { name: new RegExp(title) });
}

describe("Routines — driven through the real UI", () => {
  it("honest empty state → create a routine that appears immediately", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/no routines yet/i)).toBeInTheDocument();
    await createRoutine(user, "Morning Mobility");
    expect(screen.getByRole("heading", { name: /Morning Mobility/ })).toBeInTheDocument();
    // brand-new routine: honest "no history" state, NOT 0%
    expect(screen.getByText(/no history yet/i)).toBeInTheDocument();
  });

  it("validation failure preserves the other input", async () => {
    const user = userEvent.setup();
    render(<App start="/routine/new" />);
    const category = await screen.findByLabelText(/category/i);
    await user.type(category, "Prayer");
    await user.click(screen.getByRole("button", { name: /^create routine$/i }));
    expect(await screen.findByText(/give the routine a name/i)).toBeInTheDocument();
    expect((category as HTMLInputElement).value).toBe("Prayer");
  });

  it("weekly-days cadence requires at least one day", async () => {
    const user = userEvent.setup();
    render(<App start="/routine/new" />);
    await user.type(await screen.findByLabelText(/routine name/i), "German Practice");
    await user.selectOptions(screen.getByLabelText(/^cadence$/i), "weekly-days");
    await user.click(screen.getByRole("button", { name: /^create routine$/i }));
    expect(await screen.findByText(/pick at least one day/i)).toBeInTheDocument();
    // now pick Wednesday and succeed
    await user.click(screen.getByRole("button", { name: /^Wed$/ }));
    await user.click(screen.getByRole("button", { name: /^create routine$/i }));
    expect(await screen.findByRole("heading", { name: /German Practice/ })).toBeInTheDocument();
    expect(screen.getAllByText(/Wed/).length).toBeGreaterThan(0);
  });

  it("check-in today records history, and re-picking updates the SAME canonical log", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createRoutine(user, "Hydration");

    // Detail page shows the check-in control (daily → scheduled today)
    await user.click(screen.getByRole("button", { name: /mark hydration partial/i }));
    expect(await screen.findByText(/History \(1\)/)).toBeInTheDocument();

    // change today's result — still ONE row in history
    await user.click(screen.getByRole("button", { name: /mark hydration done/i }));
    expect(await screen.findByText(/History \(1\)/)).toBeInTheDocument();
    const historyCard = screen.getByText(/History \(1\)/).closest("div")!.parentElement!;
    expect(within(historyCard).getAllByRole("row").length).toBe(2); // header + 1
  });

  it("links a Routine to a canonical System without duplicating it; unlink works", async () => {
    seedSystem();
    const user = userEvent.setup();
    render(<App />);
    await createRoutine(user, "DSA Warmup");

    await user.selectOptions(
      await screen.findByLabelText(/link a system to dsa warmup/i),
      "sys-1",
    );
    expect(await screen.findByRole("link", { name: /Weekly DSA Study/ })).toBeInTheDocument();
    expect(screen.getByText(/a reference only/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^unlink$/i }));
    expect(await screen.findByLabelText(/link a system to dsa warmup/i)).toBeInTheDocument();
  });

  it("Daily Check-In uses the full-width row layout and keeps one-click check-in (§22–§24)", async () => {
    const user = userEvent.setup();
    const first = render(<App />);
    await createRoutine(user, "Hydration");
    first.unmount();

    render(<App start="/routine/check-in" />);
    // full-width row: routine link + its one-click state control, plus a
    // progress summary — no streak / XP / rings anywhere
    expect(await screen.findByRole("link", { name: /Hydration/ })).toBeInTheDocument();
    expect(screen.getByText(/recorded today/i)).toBeInTheDocument();
    const group = screen.getByRole("group", { name: /check-in for hydration/i });
    expect(group).toBeInTheDocument();
    expect(screen.queryByText(/streak|XP|badge/i)).not.toBeInTheDocument();

    await user.click(within(group).getByRole("button", { name: /mark hydration done/i }));
    expect(await screen.findByText(/recorded Done/i)).toBeInTheDocument();
  });

  it("pause hides a routine from Daily Check-In but keeps it (and its history)", async () => {
    const user = userEvent.setup();
    render(<App />);
    await createRoutine(user, "Evening Stretch");
    await user.click(screen.getByRole("button", { name: /mark evening stretch done/i }));

    await user.click(screen.getByRole("button", { name: /^pause$/i }));
    render(<App start="/routine/check-in" />);
    expect(await screen.findByText(/nothing scheduled for today/i)).toBeInTheDocument();
  });
});
