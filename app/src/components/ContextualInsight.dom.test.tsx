// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextualInsight } from "./ContextualInsight";

describe("ContextualInsight", () => {
  it("renders nothing when there is no headline (no AI surface on a quiet screen)", () => {
    const { container } = render(<ContextualInsight headline={null} reasons={["x"]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the headline inline and the full reasons only under 'Why this?'", async () => {
    const user = userEvent.setup();
    render(
      <ContextualInsight
        headline="Study AVL trees — before 2026-10-01"
        reasons={["Explicitly in the nearest assessment's scope", "Knowledge evidence weak"]}
      />,
    );
    expect(screen.getByText(/Study AVL trees/)).toBeInTheDocument();
    expect(screen.queryByText(/nearest assessment's scope/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /why this/i }));
    expect(screen.getByText(/nearest assessment's scope/)).toBeInTheDocument();
  });

  it("renders subordinate actions and a muted note", async () => {
    const user = userEvent.setup();
    const onPlan = vi.fn();
    render(
      <ContextualInsight
        headline="Why this"
        note="AI was unavailable — deterministic reasons only."
        actions={[{ label: "Plan this", onClick: onPlan, variant: "secondary" }]}
      />,
    );
    expect(screen.getByText(/AI was unavailable/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Plan this" }));
    expect(onPlan).toHaveBeenCalledTimes(1);
  });
});
