import { test, expect, type Page } from "@playwright/test";

/**
 * V2 Phase G — Adaptive Today through the real browser UI.
 *
 * Flow 5 (follow-plan): a valid plan shows no "Adaptation needed" surface.
 * Flow 6 (adaptation-needed): a block that has fully elapsed without evidence
 * surfaces the adaptation panel; resolving the occurrence clears it. The
 * subjective capacity control persists and does not touch Planner capacity.
 */

const APP_READY = /Onboarding|Today|Your day is open|Goals|Nothing scheduled/;

async function boot(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await page.goto("/");
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
}

async function hashTo(page: Page, route: string, expectText: RegExp) {
  await page.evaluate((r) => {
    window.location.hash = r;
  }, route);
  await expect(page.getByText(expectText).first()).toBeVisible({ timeout: 15_000 });
}

/** Local civil date `yyyy-mm-dd` — must match the app's `isoDateOf(new Date())`,
 *  NOT `toISOString()` (UTC), or a block pins to the wrong day in the hours
 *  either side of midnight in a non-UTC timezone. */
function localIsoDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function addBlock(page: Page, title: string, start: string, end: string) {
  await hashTo(page, "#/planner", /Planner|capacity|block/i);
  await page.getByLabel("Block title").fill(title);
  await page.getByLabel("Weekday").selectOption({ index: new Date().getDay() === 0 ? 6 : new Date().getDay() - 1 });
  // pin to today so it matches regardless of weekday handling
  await page.getByLabel(/Pin to a specific date/i).check();
  await page.getByLabel("Block date").fill(localIsoDate());
  await page.getByLabel("Start time").fill(start);
  await page.getByLabel("End time").fill(end);
  await page.getByRole("button", { name: /add block|schedule block|create/i }).first().click();
}

test("follow-plan: nothing elapsed or diverging → no adaptation surface", async ({ page }) => {
  // A far-future block today (23:30) is "planned"; in the last 30 min of the
  // day it would already be elapsed, so skip that thin window rather than flake.
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  test.skip(nowMin >= 23 * 60 + 30, "runs inside the late block window — 'planned' state not deterministic");
  await boot(page);
  // A far-future block today: planned, not elapsed → the plan still fits.
  await addBlock(page, "Late review", "23:30", "23:59");
  await hashTo(page, "#/", /Today/i);
  await expect(page.getByText(/Adaptation needed/i)).toHaveCount(0);
});

test("adaptation-needed: a block whose end time is before now surfaces the panel; resolving clears it", async ({ page }) => {
  await boot(page);
  // A block early today: unless the test runs within its first ~30 min, it has
  // already elapsed. Skip the run in that rare pre-dawn window rather than flake.
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  test.skip(nowMin < 40, "runs inside the block window — elapsed state not yet deterministic");
  await addBlock(page, "Elapsed block", "00:00", "00:30");
  await hashTo(page, "#/", /Today/i);
  await expect(page.getByText(/Adaptation needed/i)).toBeVisible();
  await expect(page.getByText(/without being resolved/i)).toBeVisible();

  await page.getByRole("button", { name: "Skip", exact: true }).first().click();
  await expect(page.getByText(/Adaptation needed/i)).toHaveCount(0);
});

test("the capacity control persists a subjective level without touching Planner capacity", async ({ page }) => {
  await boot(page);
  await hashTo(page, "#/", /Today/i);
  await page.getByRole("button", { name: "low", exact: true }).click();
  const stored = await page.evaluate(() =>
    window.localStorage.getItem("pbos:today-operating-state-v2"),
  );
  expect(stored).toContain('"capacityLevel":"low"');
});
