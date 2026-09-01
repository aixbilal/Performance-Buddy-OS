// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { NAVIGATION } from "./navigation";

function mount(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Sidebar />
    </MemoryRouter>,
  );
}

const ALL_ITEMS = NAVIGATION.flatMap((g) => g.items);

describe("Sidebar — V1 Visual Correction: canonical icon language + deliberate active state", () => {
  it("renders every destination with its label unchanged and a canonical line icon", () => {
    mount();
    const nav = screen.getByRole("navigation");
    for (const item of ALL_ITEMS) {
      const link = within(nav).getByRole("link", { name: new RegExp(`^${item.label}$`) });
      // one consistent icon family: an <svg data-icon> drawn inline, not an emoji
      const icon = link.querySelector("svg[data-icon]");
      expect(icon, `${item.label} has a canonical icon`).not.toBeNull();
      expect(icon).toHaveAttribute("data-icon", item.icon);
      expect(icon).toHaveAttribute("aria-hidden", "true");
    }
  });

  it("keeps navigation working — the group structure and paths are untouched", () => {
    mount();
    const nav = screen.getByRole("navigation");
    for (const item of ALL_ITEMS) {
      const link = within(nav).getByRole("link", { name: new RegExp(`^${item.label}$`) });
      expect(link).toHaveAttribute("href", item.path);
    }
    for (const group of NAVIGATION) {
      expect(within(nav).getByText(group.label, { selector: "div" })).toBeInTheDocument();
    }
  });

  it("marks the active destination with aria-current (not colour alone) and keeps it keyboard-focusable", () => {
    mount("/routine");
    const active = screen.getByRole("link", { name: /^Routine$/ });
    expect(active).toHaveAttribute("aria-current", "page");

    // every destination is a real focusable link
    const today = screen.getByRole("link", { name: /^Today$/ });
    today.focus();
    expect(today).toHaveFocus();
    expect(screen.getByRole("link", { name: /^Today$/ })).not.toHaveAttribute("aria-current", "page");
  });

  it("the active-indicator element is decorative and does not gate the active state", () => {
    const { container } = mount("/");
    // indicator is aria-hidden; the active state stands on aria-current + fill
    const indicator = container.querySelector('nav > span[aria-hidden="true"]');
    expect(indicator).not.toBeNull();
    expect(screen.getByRole("link", { name: /^Today$/ })).toHaveAttribute("aria-current", "page");
  });
});
