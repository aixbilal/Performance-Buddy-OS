import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 2B — the Fitness & Recovery domain end to end through the real browser
 * UI. Fresh profile, no seed. Proves the BASE PLAN is never rewritten by an
 * ACTUAL workout, and that readiness is an honest insufficient-data state until
 * enough check-ins exist.
 */

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

test("create a plan + session, log an actual workout that differs, base plan unchanged, reload", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/fitness");

  await expect(page.getByText(/no training plan yet/i)).toBeVisible({ timeout: 15_000 });

  // 1. create the BASE PLAN
  await page.getByRole("button", { name: /create your first plan/i }).click();
  await page.getByLabel(/plan name/i).fill("Weekly Training");
  await page.getByRole("button", { name: /^create plan$/i }).click();
  await expect(page.getByRole("heading", { name: /Weekly Training/ })).toBeVisible();

  // 2. edit the plan
  await page.getByRole("button", { name: /edit plan/i }).click();
  await page.getByLabel(/total weeks/i).fill("12");
  await page.getByRole("button", { name: /save plan/i }).click();
  await expect(page.getByText(/of 12 ·/)).toBeVisible();

  // 3. add a planned session (the prescription: Push-ups 3 × 15)
  await page.getByRole("button", { name: /^add session$/i }).click();
  await page.getByLabel(/session title/i).fill("Upper Body");
  await page.getByLabel(/exercise 1 name/i).fill("Push-ups");
  await page.getByLabel(/exercise 1 sets/i).fill("3");
  await page.getByLabel(/exercise 1 target/i).fill("15");
  await page.getByRole("button", { name: /^add session$/i }).click();
  await expect(page.getByText("Push-ups — 3 × 15")).toBeVisible();

  // 4-5. start a workout and record ACTUALS different from the prescription
  await page.getByRole("button", { name: /^start workout$/i }).click();
  await page.getByLabel(/push-ups sets completed/i).fill("3");
  await page.getByLabel(/push-ups reps completed/i).fill("15,14,11");
  await page.getByRole("button", { name: /complete workout/i }).click();
  await expect(page.getByText("completed", { exact: true })).toBeVisible();
  // the plan prescription card still shows the unchanged base
  await expect(page.getByText("Push-ups — 3 × 15")).toBeVisible();

  // 6-8. back to the plan: base prescription unchanged, actual is in history
  await page.getByRole("link", { name: /open the plan/i }).click();
  await expect(page.getByText("Push-ups — 3 × 15")).toBeVisible();
  await expect(page.getByText(/Workout History \(1\)/)).toBeVisible();

  // 9-11. full fresh load → plan + session + workout all persist
  await gotoRoute(page, "#/fitness");
  await page.getByRole("link", { name: /^Open$/ }).click();
  await expect(page.getByText("Push-ups — 3 × 15")).toBeVisible();
  await expect(page.getByText(/Workout History \(1\)/)).toBeVisible();
});

test("recovery readiness is an honest insufficient-data state, not a fabricated 0", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/fitness/recovery");

  await expect(page.getByText(/insufficient-data/i).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/not enough data.*not 0 readiness/i)).toBeVisible();

  await page.getByLabel(/sleep hours/i).fill("7.8");
  await page.getByLabel("Energy", { exact: true }).selectOption("high");
  await page.getByRole("button", { name: /save check-in/i }).click();
  await expect(page.getByText(/check-in saved/i)).toBeVisible();
  // still insufficient — the minimum is 3
  await expect(page.getByText(/insufficient-data/i).first()).toBeVisible();
  await expect(page.getByText(/Check-In History \(1\)/)).toBeVisible();

  // reload → the check-in persists
  await gotoRoute(page, "#/fitness/recovery");
  await expect(page.getByText(/Check-In History \(1\)/)).toBeVisible();
});

test("no critical/serious a11y violations on the Fitness forms", async ({ page }) => {
  await freshProfile(page);
  await gotoRoute(page, "#/fitness/plans/new");
  await expect(page.getByLabel(/plan name/i)).toBeVisible({ timeout: 15_000 });
  const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
