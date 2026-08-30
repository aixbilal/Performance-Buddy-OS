import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 1 — the Goal → System → Action spine driven end to end through the real
 * browser UI. Nothing here touches seed data or fixtures.
 */

/** Get past the startup splash/onboarding gate, then hash-route to `route`. */
async function gotoRoute(page: Page, route: string) {
  await page.goto("/");
  await page.waitForFunction(
    () => /Performance Buddy OS|Onboarding|Today/.test(document.body.innerText),
    { timeout: 25_000 },
  );
  await page.evaluate((r) => {
    window.location.hash = r;
  }, route);
}

/** Start from a genuinely clean profile (once, not on every reload). */
async function freshProfile(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
}

test("create a goal, link a system, add and progress an action, verify relationship + reload", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/goals");

  await expect(page.getByText(/no goals yet/i)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: /create goal/i }).click();

  await page.getByLabel(/goal name/i).fill("Complete DSA revision");
  await page.getByLabel("Baseline").fill("0");
  await page.getByLabel("Target").fill("10");
  await page.getByLabel("Unit").fill("topics");
  await page.getByRole("button", { name: /^create goal$/i }).click();

  await expect(page.getByRole("heading", { name: "Complete DSA revision" })).toBeVisible();
  await expect(page.getByText("0 / 10 topics")).toBeVisible();

  await page.getByRole("button", { name: /manage systems/i }).click();
  await page.getByRole("button", { name: /create a system for this goal/i }).click();
  await page.getByLabel(/system name/i).fill("Weekly DSA Study");
  await page.getByRole("button", { name: /^create system$/i }).click();

  await expect(page.getByRole("heading", { name: /Weekly DSA Study/ })).toBeVisible();
  await expect(page.getByText(/not enough activity yet/i)).toBeVisible(); // Unknown ≠ Zero

  await page.getByRole("button", { name: /add action/i }).click();
  await page.getByLabel(/^action$/i).fill("Revise Binary Trees");
  await page.getByRole("button", { name: /^add action$/i }).click();
  await expect(page.getByText("Revise Binary Trees", { exact: true })).toBeVisible();

  await page.getByLabel(/status for revise binary trees/i).selectOption("done");
  await expect(page.getByText("100%")).toBeVisible();

  await page.evaluate(() => (window.location.hash = "#/goals"));
  await page.getByRole("link", { name: /Complete DSA revision/i }).click();
  await expect(page.getByRole("link", { name: /Weekly DSA Study/i })).toBeVisible();

  // hard reload — the LocalRepo dev backend persisted everything
  await page.reload();
  await page.waitForFunction(
    () => /Performance Buddy OS|Onboarding|Today/.test(document.body.innerText),
    { timeout: 25_000 },
  );
  await page.evaluate(() => (window.location.hash = "#/goals"));
  await page.getByRole("link", { name: /Complete DSA revision/i }).click();
  await expect(page.getByRole("link", { name: /Weekly DSA Study/i })).toBeVisible();
});

test("the Goal Builder form has no critical/serious a11y violations", async ({ page }) => {
  await freshProfile(page);
  await gotoRoute(page, "#/goals/new");
  await page.getByLabel(/goal name/i).waitFor({ timeout: 15_000 });
  // Scope to the form Batch 1 owns. Page-level descriptive-prose contrast is a
  // pre-existing app-wide token issue (audit P1-13) owned by Batch 9.
  const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
});
