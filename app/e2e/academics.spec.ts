import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 2A — the Academic domain driven end to end through the real browser UI.
 * Fresh profile, no seed data, no fixtures. Proves Professor Coverage, Personal
 * Study and Mastery stay independent and that mastery is never auto-granted.
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

test("create a course, add a topic, edit coverage independently, add assessment + marks, reload", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/academics");

  // 1-2: honest empty state
  await expect(page.getByText(/no courses yet/i)).toBeVisible({ timeout: 15_000 });

  // 3-4: add a course
  await page.getByRole("button", { name: /add your first course/i }).click();
  await page.getByLabel(/course name/i).fill("Data Structures");
  await page.getByLabel(/course code/i).fill("CSE 201");
  await page.getByRole("button", { name: /^add course$/i }).click();

  // 5: land on Course Detail
  await expect(page.getByRole("heading", { name: /Data Structures/ })).toBeVisible();

  // 6: edit the course
  await page.getByRole("button", { name: /edit course/i }).click();
  await page.getByLabel(/instructor/i).fill("Prof. Sharma");
  await page.getByRole("button", { name: /save course/i }).click();
  await expect(page.getByText(/Prof\. Sharma/)).toBeVisible();

  // 7: add an Academic Topic
  await page.getByRole("button", { name: /^add topic$/i }).click();
  await page.getByLabel(/topic title/i).fill("Binary Trees");
  await page.getByRole("button", { name: /^add topic$/i }).click();
  await expect(page.getByText("Binary Trees")).toBeVisible();

  // 8-9: set Professor Coverage → Personal Study is untouched
  const coverage = page.getByLabel(/professor coverage for binary trees/i);
  const study = page.getByLabel(/personal study percent for binary trees/i);
  await coverage.selectOption("taught");
  await expect(coverage).toHaveValue("taught");
  await expect(study).toHaveValue("0");

  // 10-11: set Personal Study → coverage untouched, mastery NOT granted
  await study.fill("70");
  await study.blur();
  await expect(coverage).toHaveValue("taught");
  await expect(page.getByText("Not linked")).toBeVisible();

  // 12: add an assessment
  await page.getByRole("button", { name: /^add assessment$/i }).click();
  await page.getByLabel(/assessment title/i).fill("Quiz 1");
  await page.getByLabel(/total marks/i).fill("20");
  await page.getByLabel(/weight %/i).fill("100");
  await page.getByRole("button", { name: /^add assessment$/i }).click();
  await expect(page.getByText("Quiz 1", { exact: true })).toBeVisible();

  // 13-14: enter marks → deterministic weighted score (18/20 * 100% = 90.0%)
  const marks = page.getByLabel(/obtained marks for quiz 1/i);
  await marks.fill("18");
  await marks.blur();
  await expect(page.getByText(/90\.0%/)).toBeVisible();

  // 15-16: full fresh load (proves persistence), state remains
  await gotoRoute(page, "#/academics");
  await page.getByRole("link", { name: /Data Structures/ }).click();
  await expect(page.getByText("Binary Trees")).toBeVisible();
  await expect(page.getByLabel(/professor coverage for binary trees/i)).toHaveValue("taught");
  await expect(page.getByLabel(/personal study percent for binary trees/i)).toHaveValue("70");
  await expect(page.getByText(/90\.0%/)).toBeVisible();
});

test("no critical/serious a11y violations on the Academics forms", async ({ page }) => {
  await freshProfile(page);
  await gotoRoute(page, "#/academics/new");
  await expect(page.getByLabel(/course name/i)).toBeVisible({ timeout: 15_000 });
  // Scope to the form — the AppShell chrome carries the known global
  // token-contrast audit item, which is out of scope for Batch 2A.
  const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
