import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 7 — the entry / configuration lifecycle through the real UI.
 *
 * Browser mode uses the localStorage fallback for onboarding + settings (no
 * Tauri). The splash + routing gate is real: a fresh profile plays the
 * first-boot splash then lands on Welcome; a completed profile lands on Today.
 */

const ONBOARDING_READY = /Performance Buddy OS · Setup|Start setup|Step 1 of 4/;
const TODAY_READY = /Today's Plan|Your day is open|NOW|NEXT|LATER/;

async function freshStart(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto("/");
}

async function waitForOnboarding(page: Page) {
  await page.waitForFunction(
    (re) => new RegExp(re).test(document.body.innerText),
    ONBOARDING_READY.source,
    { timeout: 30_000 },
  );
}
async function waitForToday(page: Page) {
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), TODAY_READY.source, {
    timeout: 30_000,
  });
}
async function hashTo(page: Page, route: string, expectText: RegExp) {
  await page.evaluate((r) => {
    window.location.hash = r;
  }, route);
  await expect(page.getByText(expectText).first()).toBeVisible({ timeout: 15_000 });
}

test("first run: Splash → Welcome → Personal Setup → Connect Systems → Review → Launch → Today (survives reload)", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await freshStart(page);
  await waitForOnboarding(page);

  // Welcome
  await expect(page.getByRole("heading", { name: /^Welcome$/ })).toBeVisible();
  await page.getByRole("button", { name: /start setup/i }).click();

  // Personal Setup — write a real baseline
  await expect(page.getByRole("heading", { name: /Personal setup/i })).toBeVisible();
  await page.getByLabel(/name \(optional\)/i).fill("Bilal");
  await page.getByLabel(/protected sleep/i).fill("7");
  await page.getByLabel(/weekday academic capacity/i).fill("150");
  await page.getByLabel(/starting operating mode/i).selectOption("midterm");
  await page.getByRole("button", { name: /^academics$/i }).click(); // a priority
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Connect Systems — real statuses, optional ones can be skipped
  await expect(page.getByRole("heading", { name: /Connect your systems/i })).toBeVisible();
  await expect(page.getByText("Obsidian")).toBeVisible();
  await expect(page.getByText(/Not set up|Optional — not connected/).first()).toBeVisible();
  await page.getByRole("button", { name: /skip obsidian for now/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();

  // Review shows the ACTUAL choices
  await expect(page.getByRole("heading", { name: /Review & launch/i })).toBeVisible();
  await expect(page.getByText("Bilal")).toBeVisible();
  await expect(page.getByText("midterm")).toBeVisible();
  await expect(page.getByText("150 min")).toBeVisible();
  await expect(page.getByText(/Ready to launch/i)).toBeVisible();

  await page.getByRole("button", { name: /launch pbos/i }).click();
  await waitForToday(page);

  // the canonical Settings got the entered baseline
  await hashTo(page, "#/settings", /Effective configuration/i);
  await expect(page.getByText(/midterm mode/i).first()).toBeVisible();
  await expect(page.getByLabel(/weekday academic capacity — BASE/i)).toHaveValue("150");

  // hard reload → straight to Today, onboarding never reappears
  await page.reload();
  await waitForToday(page);
  await expect(page.getByText(/Start setup|Step 1 of 4/)).toHaveCount(0);
});

test("resume: interrupt mid-setup, reload, and continue from the saved step with input intact", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await freshStart(page);
  await waitForOnboarding(page);

  await page.getByRole("button", { name: /start setup/i }).click();
  await page.getByLabel(/name \(optional\)/i).fill("Resume Test");
  await page.getByLabel(/weekday academic capacity/i).fill("175");
  await page.getByRole("button", { name: /^continue$/i }).click();
  await expect(page.getByRole("heading", { name: /Connect your systems/i })).toBeVisible();

  // hard reload mid-flow
  await page.reload();
  await page.waitForFunction(
    () => /Connect your systems|Setup is in progress/.test(document.body.innerText),
    undefined,
    { timeout: 30_000 },
  );
  await expect(page.getByRole("heading", { name: /Connect your systems/i })).toBeVisible();
  await expect(page.getByText(/Setup is in progress/i)).toBeVisible();

  // the earlier input survived
  await page.getByRole("button", { name: /^back$/i }).click();
  await expect(page.getByLabel(/name \(optional\)/i)).toHaveValue("Resume Test");
  await expect(page.getByLabel(/weekday academic capacity/i)).toHaveValue("175");

  // finish
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /launch pbos/i }).click();
  await waitForToday(page);
});

test("Settings effective config: mode + temporary override precedence, clear restores, base never mutated, persists", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await freshStart(page);
  await waitForOnboarding(page);
  // fast-path through onboarding
  await page.getByRole("button", { name: /start setup/i }).click();
  await page.getByLabel(/weekday academic capacity/i).fill("90");
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /launch pbos/i }).click();
  await waitForToday(page);

  await hashTo(page, "#/settings", /Effective configuration/i);
  const eff = page.getByTestId("effective-config");
  await expect(eff).toContainText("Effective 90m");

  await page.getByRole("button", { name: /^midterm$/i }).click();
  await expect(eff).toContainText("Effective 135m");

  await page.getByRole("button", { name: /Add \+15 min temporary override/i }).click();
  await expect(eff).toContainText("Effective 150m");

  await page.getByRole("button", { name: /Clear all temporary overrides/i }).click();
  await expect(eff).toContainText("Effective 135m"); // mode override reappears

  await page.getByRole("button", { name: /^recovery$/i }).click();
  await expect(eff).toContainText("Effective 60m");
  // base is unchanged by any mode switch
  await expect(page.getByLabel(/weekday academic capacity — BASE/i)).toHaveValue("90");

  // reload → the mode choice persists
  await page.reload();
  await waitForToday(page);
  await hashTo(page, "#/settings", /Effective configuration/i);
  await expect(page.getByTestId("effective-config")).toContainText("Effective 60m");
});

test("reset onboarding from Settings re-runs first-run WITHOUT deleting domain data", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await freshStart(page);
  await waitForOnboarding(page);
  await page.getByRole("button", { name: /start setup/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /launch pbos/i }).click();
  await waitForToday(page);

  // create some real domain data
  await hashTo(page, "#/knowledge/new", /topic title/i);
  await page.getByLabel(/topic title/i).fill("Binary Trees");
  await page.getByRole("button", { name: /^(add topic|create topic)$/i }).click();
  await expect(page.getByRole("heading", { name: /Binary Trees/ })).toBeVisible();

  // reset onboarding
  await hashTo(page, "#/settings", /Re-run onboarding/i);
  await page.getByRole("button", { name: /reset onboarding…/i }).click();
  await page.getByRole("button", { name: /yes, reset onboarding only/i }).click();
  await expect(page.getByText(/Onboarding reset/i)).toBeVisible();

  // reload → first-run again, but the Knowledge topic is still there
  await page.reload();
  await waitForOnboarding(page);
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await expect(page.getByText("Binary Trees").first()).toBeVisible();
});

test("Onboarding wizard has no critical/serious a11y violations", async ({ page }) => {
  test.setTimeout(120_000);
  await freshStart(page);
  await waitForOnboarding(page);
  await page.getByRole("button", { name: /start setup/i }).click();
  await expect(page.getByRole("heading", { name: /Personal setup/i })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
});
