// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage";

function mount() {
  return render(
    <MemoryRouter initialEntries={["/no-such-page"]}>
      <NotFoundPage />
    </MemoryRouter>,
  );
}

describe("NotFoundPage — unknown-route catch-all", () => {
  it("states plainly that the page was not found", () => {
    mount();
    expect(screen.getByText("Page not found")).toBeInTheDocument();
  });

  it("offers a single route back to Today", () => {
    mount();
    const link = screen.getByRole("link", { name: /back to today/i });
    expect(link).toHaveAttribute("href", "/");
  });
});
