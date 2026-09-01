// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadingState, ErrorState, PartialDataNotice, StaleNotice, SaveErrorBanner } from "./StateViews";

describe("StateViews — Day-17 resilience surfaces", () => {
  it("LoadingState announces politely and is not an alert (Loading ≠ Error)", () => {
    render(<LoadingState label="Loading today…" />);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent("Loading today…");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("ErrorState is an alert, answers 'is my data safe', and only shows Retry when given onRetry", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<ErrorState title="Today couldn't load" detail="sqlite locked" />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Today couldn't load");
    expect(alert).toHaveTextContent("sqlite locked");
    expect(alert).toHaveTextContent(/your saved data is safe/i);
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();

    rerender(<ErrorState title="Today couldn't load" onRetry={onRetry} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("PartialDataNotice is a polite status, not an error (Partial ≠ Failed)", () => {
    render(<PartialDataNotice>No complete prior month yet — comparison unavailable.</PartialDataNotice>);
    const el = screen.getByRole("status");
    expect(el).toHaveTextContent(/comparison unavailable/i);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("StaleNotice shows a keyboard-reachable Refresh when given onRefresh (Stale ≠ Current)", async () => {
    const onRefresh = vi.fn();
    render(<StaleNotice onRefresh={onRefresh}>Index last built 2 days ago.</StaleNotice>);
    const btn = screen.getByRole("button", { name: /refresh/i });
    btn.focus();
    expect(btn).toHaveFocus();
    await userEvent.setup().keyboard("{Enter}");
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("SaveErrorBanner states the draft is kept and offers exactly one Retry", async () => {
    const onRetry = vi.fn();
    render(<SaveErrorBanner error="disk full" onRetry={onRetry} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/your input is still here/i);
    await userEvent.setup().click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
