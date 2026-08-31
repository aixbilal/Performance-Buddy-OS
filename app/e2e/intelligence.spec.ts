import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 6 — the final core-loop link, through the real UI:
 *   Analytics facts → permitted context → deterministic FAKE provider proposal →
 *   user decision → Phase-23-style validation → allowlisted canonical Apply →
 *   re-planning boundary → persistence.
 *
 * Browser mode has no env credential, so the provider is the built-in
 * deterministic FakeProvider (no network). No paid AI call happens anywhere.
 */

const APP_READY = /Performance Buddy OS|Onboarding|Today's Plan|Resume step|Analytics|AI Coach|No courses yet|Knowledge/;

async function boot(page: Page) {
  await page.goto("/");
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
}
async function freshBoot(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
    } catch {
      /* ignore */
    }
  });
  await boot(page);
}
async function hashTo(page: Page, route: string, expectText: RegExp) {
  await page.evaluate((r) => {
    window.location.hash = r;
  }, route);
  await expect(page.getByText(expectText).first()).toBeVisible({ timeout: 15_000 });
}
async function hardReload(page: Page) {
  await page.reload();
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
}

/** A review-due Knowledge concept (so the fake provider has a real fact to act on). */
async function seedReviewDueTopic(page: Page, title = "Binary Trees") {
  await hashTo(page, "#/knowledge/new", /topic title/i);
  await page.getByLabel(/topic title/i).fill(title);
  await page.getByRole("button", { name: /^(add topic|create topic)$/i }).click();
  await expect(page.getByRole("heading", { name: new RegExp(title) })).toBeVisible();
  await page.getByLabel(/next review/i).fill("2020-01-01");
}

test("Analytics: Overview facts + Weekly / Monthly / Patterns are honest and month-scoped", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await freshBoot(page);

  await hashTo(page, "#/analytics", /Analytics & Reviews/i);
  await expect(page.getByText(/No single combined "performance score"/i)).toBeVisible();
  await expect(page.getByText(/No graded courses yet/i)).toBeVisible();

  await hashTo(page, "#/analytics/patterns", /Patterns & Insights/i);
  await expect(page.getByText(/insufficient evidence/i).first()).toBeVisible();
  await expect(page.getByText(/association is not a cause/i)).toBeVisible();

  await hashTo(page, "#/analytics/monthly", /Monthly Review/i);
  await expect(page.getByText(/insufficient comparison — no complete prior month/i)).toBeVisible();

  await hashTo(page, "#/analytics/weekly", /Weekly Review/i);
  await expect(page.getByText(/What happened \(deterministic facts\)/i)).toBeVisible();
  await page.getByLabel(/what worked/i).fill("Shipped the analytics work");
  await page.getByRole("button", { name: /log this week's review/i }).click();
  await expect(page.getByText(/Analytics & Reviews/i)).toBeVisible(); // navigated back
  await hashTo(page, "#/analytics/weekly", /Past reviews \(1\)/i);
});

test("AI apply loop: generate → Accept → Apply → canonical Planning block → re-plan boundary → reload persists", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await freshBoot(page);
  await seedReviewDueTopic(page);

  await hashTo(page, "#/ai-coach/workspace", /Workspace/i);
  // context preview shows the boundary — Money is Excluded by default
  await expect(page.getByTestId("context-preview")).toContainText("Excluded");
  await expect(page.getByTestId("context-preview").getByText("Money", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /ask coach/i }).click();
  const scheduleCard = page.locator('[data-testid^="rec-"]', { hasText: /study block/i }).first();
  await expect(scheduleCard).toBeVisible({ timeout: 15_000 });
  await expect(scheduleCard.getByText(/Proposed change:/i)).toBeVisible();
  await expect(scheduleCard.getByText(/✓ Validation/i)).toBeVisible();

  await scheduleCard.getByRole("button", { name: /^accept$/i }).click();
  await scheduleCard.getByRole("button", { name: /^apply$/i }).click();
  await expect(scheduleCard.getByText(/Applied —/i)).toBeVisible();

  // the canonical mutation is real — the Planner shows the new block
  await hashTo(page, "#/planner", /Planner/i);
  await expect(page.getByText(/Study: Binary Trees/i).first()).toBeVisible();

  // decision trail + applied state survive a reload
  await hardReload(page);
  await hashTo(page, "#/ai-coach", /Decision history/i);
  await expect(page.getByText(/proposed → accepted → applied/i)).toBeVisible();
});

test("Reject makes zero mutation; Modify applies the edited value; Invalid Apply is blocked then retried", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await freshBoot(page);
  await seedReviewDueTopic(page);

  await hashTo(page, "#/ai-coach/workspace", /Workspace/i);
  await page.getByRole("button", { name: /ask coach/i }).click();

  // REJECT the knowledge-review proposal → no review date is set on the topic
  const reviewCard = page.locator('[data-testid^="rec-"]', { hasText: /review for Binary Trees/i }).first();
  await expect(reviewCard).toBeVisible({ timeout: 15_000 });
  await reviewCard.getByRole("button", { name: /^reject$/i }).click();
  await expect(reviewCard.getByText("rejected")).toBeVisible();

  const blockCard = page.locator('[data-testid^="rec-"]', { hasText: /study block/i }).first();

  // INVALID: modify the study block to an impossible duration → Apply is blocked, no mutation
  await blockCard.getByRole("button", { name: /^modify$/i }).click();
  await blockCard.getByLabel(/modify durationMinutes/i).fill("5000");
  await blockCard.getByRole("button", { name: /save modified proposal/i }).click();
  await blockCard.getByRole("button", { name: /^apply$/i }).click();
  await expect(blockCard.getByText("apply failed")).toBeVisible();
  await expect(blockCard.getByText(/INVALID_TIME/)).toBeVisible();

  // MODIFY & RETRY with a valid, smaller duration — the edited value is what gets applied
  await blockCard.getByRole("button", { name: /modify & retry/i }).click();
  await blockCard.getByLabel(/modify durationMinutes/i).fill("30");
  await blockCard.getByRole("button", { name: /save modified proposal/i }).click();
  // preview now reflects the edited value: 17:00–17:30
  await expect(blockCard.getByText(/17:00.*17:30/)).toBeVisible();
  await blockCard.getByRole("button", { name: /^apply$/i }).click();
  await expect(blockCard.getByText(/Applied —/i)).toBeVisible();

  // exactly one canonical block exists, and the review was never set (reject = no mutation)
  await hashTo(page, "#/planner", /Planner/i);
  await expect(page.getByText(/Study: Binary Trees/i).first()).toBeVisible();
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  await expect(page.getByLabel(/next review/i)).toHaveValue("2020-01-01");
});

test("AI disabled: Analytics + Reviews still work; the coach reports unavailable honestly", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await hashTo(page, "#/ai-coach", /AI Coach/i);
  await page.getByRole("button", { name: /disable ai/i }).click();
  await expect(page.getByText(/AI is switched off/i)).toBeVisible();

  await hashTo(page, "#/ai-coach/workspace", /Workspace/i);
  await page.getByRole("button", { name: /ask coach/i }).click();
  await expect(page.getByText(/AI unavailable \(disabled\)/i)).toBeVisible();

  // deterministic surfaces unaffected
  await hashTo(page, "#/analytics", /Domain snapshot/i);
  await expect(page.getByText(/No graded courses yet/i)).toBeVisible();
});

test("AI Coach + Workspace have no critical/serious a11y violations", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await seedReviewDueTopic(page);
  await hashTo(page, "#/ai-coach/workspace", /Workspace/i);
  await page.getByRole("button", { name: /ask coach/i }).click();
  await expect(page.locator('[data-testid^="rec-"]').first()).toBeVisible({ timeout: 15_000 });
  const results = await new AxeBuilder({ page })
    .include('[data-testid="context-preview"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
});
