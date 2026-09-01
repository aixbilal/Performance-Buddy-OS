import { test, expect, type Page } from "@playwright/test";

/**
 * V2 Phase F — recurring-occurrence control through the real browser UI.
 *
 * Proves blueprint §16.9 flow 4: skipping / deferring one occurrence of a
 * recurring block records an exception and does NOT alter the weekly template,
 * and it survives a hard reload.
 */

const APP_READY = /Onboarding|Today's Plan|Resume step|Goals|Systems|Nothing scheduled|Work needing placement/;

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

test("skip one occurrence of a weekly block — template survives, exception persists", async ({ page }) => {
  await boot(page);
  await hashTo(page, "#/planner", /Planner|capacity|block/i);

  // Create a weekly (unpinned) block on Tuesday.
  await page.getByLabel("Block title").fill("German practice");
  // "Pin to a specific date" stays unchecked → recurs weekly.
  await page.getByLabel("Weekday").selectOption({ label: "Tue" });
  await page.getByLabel("Start time").fill("09:00");
  await page.getByLabel("End time").fill("09:30");
  await page.getByRole("button", { name: /add block|schedule block|create/i }).first().click();

  await hashTo(page, "#/calendar", /Calendar|week/i);

  // Select the block in its Tuesday cell.
  await page.getByRole("button", { name: /German practice/i }).first().click();
  await expect(page.getByText(/This week's occurrence/i)).toBeVisible();
  await page.getByRole("button", { name: "Skip this one" }).click();
  await expect(page.getByText(/currently skipped/i)).toBeVisible();

  // Persisted as an exception, not a template mutation.
  const exceptions = await page.evaluate(() =>
    window.localStorage.getItem("pbos:planning-occurrence-exceptions-v2"),
  );
  expect(exceptions).toContain('"state":"skipped"');
  // The weekly template is still there and still recurring (its cell tag).
  await expect(page.getByText("· weekly").first()).toBeVisible();

  // Survives a hard reload.
  await page.reload();
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
  await hashTo(page, "#/calendar", /Calendar|week/i);
  await page.getByRole("button", { name: /German practice/i }).first().click();
  await expect(page.getByText(/currently skipped/i)).toBeVisible();
});
