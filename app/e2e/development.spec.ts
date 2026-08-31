import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 2B — the Development domain end to end through the real browser UI.
 * Fresh profile, no seed. Proves Project progress and Skill capability stay
 * distinct, and that linking a skill / recording unreviewed AI work does not
 * inflate independent capability.
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

test("create a project + skill, link them, add a milestone, record evidence, reload", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/development");

  await expect(page.getByText(/nothing here yet/i)).toBeVisible({ timeout: 15_000 });

  // create a project
  await page.getByRole("button", { name: /add your first project/i }).click();
  await page.getByLabel(/project name/i).fill("Performance Buddy OS");
  await page.getByRole("button", { name: /^add project$/i }).click();
  await expect(page.getByRole("heading", { name: /Performance Buddy OS/ })).toBeVisible();

  // edit the project
  await page.getByRole("button", { name: /edit project/i }).click();
  await page.getByLabel(/description/i).fill("Academic & Knowledge APIs");
  await page.getByRole("button", { name: /save project/i }).click();
  await expect(page.getByText("Academic & Knowledge APIs")).toBeVisible();

  // add a milestone → progress becomes a real ratio
  await page.getByLabel(/new milestone title/i).fill("Build dashboard");
  await page.getByRole("button", { name: /^add milestone$/i }).click();
  await expect(page.getByText("Build dashboard")).toBeVisible();
  await expect(page.getByText("0%")).toBeVisible();
  await page.getByRole("checkbox", { name: /mark build dashboard complete/i }).check();
  await expect(page.getByText("100%")).toBeVisible();

  // create a skill
  await page.evaluate(() => {
    window.location.hash = "#/development/skills/new";
  });
  await page.getByLabel(/skill name/i).fill("React");
  await page.getByRole("button", { name: /^add skill$/i }).click();
  await expect(page.getByRole("heading", { name: /^React$/ })).toBeVisible();
  await expect(page.getByText(/capability is unknown until it is/i)).toBeVisible();

  // link the skill to the project (from Project Detail)
  await page.evaluate(() => {
    window.location.hash = "#/development";
  });
  await page.getByRole("link", { name: /Performance Buddy OS/ }).click();
  await page.getByLabel(/link a skill to performance buddy os/i).selectOption({ label: "React" });
  await page.getByRole("button", { name: /^link$/i }).click();
  await expect(page.getByRole("button", { name: /^unlink$/i })).toBeVisible();

  // record independent evidence on the skill → Evidence 100%
  await page.getByRole("link", { name: /^React$/ }).click();
  await page.getByRole("button", { name: /add evidence/i }).click();
  await page.getByLabel(/evidence description/i).fill("Built the dashboard layout myself");
  await page.getByRole("button", { name: /^add evidence$/i }).click();
  await expect(page.getByText("100%")).toBeVisible();

  // add unreviewed AI-assisted evidence → 50% + exclusion warning
  await page.getByRole("button", { name: /add evidence/i }).click();
  await page.getByLabel(/evidence description/i).fill("AI wrote the data hook, not reviewed");
  await page.getByLabel(/evidence provenance/i).selectOption("ai-assisted");
  await page.getByRole("button", { name: /^add evidence$/i }).click();
  await expect(page.getByText("50%")).toBeVisible();
  await expect(page.getByText(/excluded from the Evidence score/i)).toBeVisible();

  // full fresh load → everything persists, and progress ≠ capability
  await gotoRoute(page, "#/development");
  await page.getByRole("link", { name: /Performance Buddy OS/ }).click();
  await expect(page.getByText("100%")).toBeVisible(); // project progress (1/1 milestone)
  await page.getByRole("link", { name: /^React$/ }).click();
  await expect(page.getByText("50%")).toBeVisible(); // skill evidence, unchanged
});

test("no critical/serious a11y violations on the Development forms", async ({ page }) => {
  await freshProfile(page);
  await gotoRoute(page, "#/development/projects/new");
  await expect(page.getByLabel(/project name/i)).toBeVisible({ timeout: 15_000 });
  const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
