// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanningDiffReview } from "./PlanningDiffReview";
import { buildPlanningDiff, placeCandidates, type PlanningCandidate } from "./adaptiveEngine";

function candidate(over: Partial<PlanningCandidate> = {}): PlanningCandidate {
  return {
    id: "c1",
    sourceDomain: "Academics",
    sourceEntityType: "topic",
    sourceEntityId: "t1",
    actionId: null,
    title: "Study graphs",
    context: "",
    estMinutes: 60,
    requiredBefore: null,
    earliestDate: null,
    preferredTimeWindow: null,
    minimumBlockMinutes: null,
    splittable: false,
    reasonCodes: ["NEAREST_SCOPED_ASSESSMENT"],
    priority: 0,
    ...over,
  };
}

describe("PlanningDiffReview", () => {
  it("shows What changes / Why / Protected / Could Not Fit and only enables Apply with real changes", async () => {
    const user = userEvent.setup();
    const plan = placeCandidates({
      candidates: [candidate(), candidate({ id: "c2", title: "Impossible", estMinutes: 60 })],
      horizonStartIso: "2026-09-07",
      horizonEndIso: "2026-09-13",
      datedBlocks: [],
      dailyCapacityMinutes: 60, // only room for one 60-min block per day but week cap small
      weeklyCapacityMinutes: 60,
      scope: "week",
    });
    const diff = buildPlanningDiff(plan, [], ["locked-1"]);
    const onApply = vi.fn();
    render(<PlanningDiffReview diff={diff} onApply={onApply} onDiscard={() => {}} />);

    expect(screen.getByText(/What changes/i)).toBeInTheDocument();
    expect(screen.getByText(/Why/)).toBeInTheDocument();
    expect(screen.getByText(/Protected \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Could not fit/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /apply changes/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("disables Apply when the diff has no real changes", () => {
    const diff = buildPlanningDiff({ placements: [], nudges: [], couldNotFit: [] }, [], ["k1"]);
    render(<PlanningDiffReview diff={diff} onApply={() => {}} onDiscard={() => {}} />);
    expect(screen.getByRole("button", { name: /apply changes/i })).toBeDisabled();
    expect(screen.getByText(/current plan already holds/i)).toBeInTheDocument();
  });
});
