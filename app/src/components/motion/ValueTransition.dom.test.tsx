// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValueTransition } from "./ValueTransition";
import { PrimaryActionSurface } from "../PrimaryActionSurface";

afterEach(() => {
  delete document.documentElement.dataset.reducedMotion;
});

describe("ValueTransition — restrained value ticker (§25.C)", () => {
  it("renders the formatted value on first mount without animating", () => {
    render(<ValueTransition value={7} format={(n) => `${Math.round(n)} / 10`} />);
    expect(screen.getByText("7 / 10")).toBeInTheDocument();
  });

  it("collapses to an instant set when reduced motion is requested", async () => {
    document.documentElement.dataset.reducedMotion = "true";
    const { rerender } = render(<ValueTransition value={0} format={(n) => `${Math.round(n)}%`} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    rerender(<ValueTransition value={90} format={(n) => `${Math.round(n)}%`} />);
    // no tween frames — the final value is shown synchronously
    expect(screen.getByText("90%")).toBeInTheDocument();
  });
});

describe("PrimaryActionSurface — the single next-action surface (§18)", () => {
  it("renders its eyebrow + children and is an accessible region", () => {
    render(
      <PrimaryActionSurface eyebrow="Next">
        <p>Review AVL deletion cases</p>
      </PrimaryActionSurface>,
    );
    expect(screen.getByRole("region", { name: /current focus/i })).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
    expect(screen.getByText("Review AVL deletion cases")).toBeInTheDocument();
  });
});
