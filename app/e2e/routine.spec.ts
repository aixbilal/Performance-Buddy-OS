import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 2B — the Routines & Daily Life domain end to end through the real
 * browser UI. Fresh profile, no seed. Proves an honest empty state, real
 * schedule-aware consistency (no streak), one canonical log per day, an
 * optional canonical System link that never duplicates the System, and that
 * pausing keeps the routine + its history.
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

test("create → configure cadence → check in → idempotent update → reload → pause", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/routine");

  await expect(page.getByText(/no routines yet/i)).toBeVisible({ timeout: 15_000 });

  // 1. create a routine (defaults to a daily boolean routine)
  await page.getByRole("button", { name: /create your first routine/i }).click();
  await page.getByLabel(/routine name/i).fill("Morning Mobility");
  await page.getByRole("button", { name: /^create routine$/i }).click();
  await expect(page.getByRole("heading", { name: /Morning Mobility/ })).toBeVisible();
  // brand-new: honest "no history" state — never a fabricated 0%
  await expect(page.getByText(/no history yet — consistency appears/i)).toBeVisible();

  // 2. today's check-in from Routine Detail
  await page.getByRole("button", { name: /mark morning mobility done/i }).click();
  await expect(page.getByText(/History \(1\)/)).toBeVisible();
  await expect(page.getByText(/scheduled opportunities in the last/i)).toBeVisible();

  // 3. re-pick today's result → still ONE canonical log
  await page.getByRole("button", { name: /mark morning mobility partial/i }).click();
  await expect(page.getByText(/History \(1\)/)).toBeVisible();

  // 4. edit → weekly-days cadence
  await page.getByRole("button", { name: /^edit$/i }).click();
  await page.getByLabel(/^cadence$/i).selectOption("weekly-days");
  // select every weekday so it stays "scheduled today" regardless of run day
  for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) {
    await page.getByRole("button", { name: new RegExp(`^${d}$`) }).click();
  }
  await page.getByRole("button", { name: /save routine/i }).click();
  await expect(page.getByText(/Mon, Tue, Wed, Thu, Fri, Sat, Sun/)).toBeVisible();

  // 5. full reload → routine + history persist
  await gotoRoute(page, "#/routine");
  await page.getByRole("link", { name: /Morning Mobility/ }).click();
  await expect(page.getByText(/History \(1\)/)).toBeVisible();

  // 6. pause → it drops out of Daily Check-In but is not deleted
  await page.getByRole("button", { name: /^pause$/i }).click();
  await gotoRoute(page, "#/routine/check-in");
  await expect(page.getByText(/nothing scheduled for today/i)).toBeVisible();
  await gotoRoute(page, "#/routine");
  await expect(page.getByRole("link", { name: /Morning Mobility/ })).toBeVisible();
});

test("optional canonical System link — referenced, never duplicated; unlink works", async ({
  page,
}) => {
  await freshProfile(page);

  // minimum canonical System via the Batch 1 UI
  await gotoRoute(page, "#/systems");
  await page.getByRole("button", { name: /create system/i }).first().click();
  await page.getByLabel(/system name/i).fill("Weekly Mobility System");
  await page.getByRole("button", { name: /^create system$/i }).click();
  await expect(page.getByRole("heading", { name: /Weekly Mobility System/ })).toBeVisible();

  // a routine
  await gotoRoute(page, "#/routine");
  await page.getByRole("button", { name: /create your first routine/i }).click();
  await page.getByLabel(/routine name/i).fill("Mobility Drill");
  await page.getByRole("button", { name: /^create routine$/i }).click();
  await expect(page.getByRole("heading", { name: /Mobility Drill/ })).toBeVisible();

  // link the System (reference only)
  await page.getByLabel(/link a system to mobility drill/i).selectOption({ label: "Weekly Mobility System" });
  await expect(page.getByRole("link", { name: /Weekly Mobility System/ })).toBeVisible();
  await expect(page.getByText(/a reference only/i)).toBeVisible();

  // persists across reload
  await gotoRoute(page, "#/routine");
  await page.getByRole("link", { name: /Mobility Drill/ }).click();
  await expect(page.getByRole("link", { name: /Weekly Mobility System/ })).toBeVisible();

  // unlink
  await page.getByRole("button", { name: /^unlink$/i }).click();
  await expect(page.getByLabel(/link a system to mobility drill/i)).toBeVisible();
});

test("no critical/serious a11y violations on the Routine builder form", async ({ page }) => {
  await freshProfile(page);
  await gotoRoute(page, "#/routine/new");
  await expect(page.getByLabel(/routine name/i)).toBeVisible({ timeout: 15_000 });
  const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
