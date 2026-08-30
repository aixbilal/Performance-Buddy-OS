// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Badge } from "./Badge";

// Smoke test proving the React Testing Library + jsdom + jest-dom toolchain
// is wired up. Not a behavioural spec for Badge.
describe("Badge (RTL toolchain smoke test)", () => {
  it("renders its children into the DOM", () => {
    render(<Badge tone="success">On track</Badge>);
    expect(screen.getByText("On track")).toBeInTheDocument();
  });

  it("applies the tone class", () => {
    render(<Badge tone="danger">Behind</Badge>);
    expect(screen.getByText("Behind").className).toContain("status-danger");
  });
});
