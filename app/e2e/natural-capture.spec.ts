import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * V2 Phase D — Natural Capture through the real browser UI.
 *
 * Proves end to end:
 *   - one mixed-domain capture → a multi-proposal bundle in the drawer,
 *   - each proposal shows its origin ("You said" vs "PBOS interpreted"),
 *   - a selective Accept & apply routes through the shared mutation engine and
 *     writes a canonical change (subjective Today capacity here — no entity
 *     needed on a fresh profile),
 *   - the raw capture + its proposals survive a hard reload,
 *   - unclassifiable text keeps the raw capture and proposes nothing,
 *   - the drawer has no critical/serious a11y violations.
 */

const APP_READY = /Onboarding|Today|Your day is open|Goals|Nothing scheduled|Knowledge/;

async function boot(page: Page) {
  await page.goto("/");
  await page.evaluate(() => {
    try {
      window.localStorage.clear();
      window.sessionStorage.clear();
    } catch {
      /* ignore */
    }
    const now = new Date().toISOString();
    window.localStorage.setItem(
      "pbos:onboarding-state-v1",
      JSON.stringify({
        status: "completed",
        currentStep: "review",
        firstBootExperienceSeen: true,
        flowVersion: 1,
        personalSetup: {},
        systemChoices: { obsidian: "not-set", ai: "not-set" },
        startedAt: now,
        completedAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    );
  });
  await page.reload();
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
}

async function openDrawer(page: Page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("pbos:open-natural-capture")));
  await expect(page.getByRole("dialog", { name: "Natural Capture" })).toBeVisible();
}

test("mixed capture → proposal bundle → selective apply → survives reload", async ({ page }) => {
  await boot(page);
  await openDrawer(page);

  await page
    .getByLabel("What happened?")
    .fill("Feeling wiped out after a rough night. Spent 1200 on groceries.");
  await page.getByRole("button", { name: "Structure this" }).click();

  const dialog = page.getByRole("dialog", { name: "Natural Capture" });
  // Two proposals: a Today-capacity interpretation + a Money expense fact.
  await expect(dialog.getByText(/proposal/i).first()).toBeVisible();
  await expect(dialog.getByText("PBOS interpreted").first()).toBeVisible();
  await expect(dialog.getByText("You said").first()).toBeVisible();
  await expect(dialog.getByText(/Today capacity: low/i)).toBeVisible();

  // Apply just the capacity proposal.
  const capacityRow = dialog
    .locator("div")
    .filter({ hasText: "Today capacity: low" })
    .last();
  await capacityRow.getByRole("button", { name: /Accept & apply/i }).click();
  await expect(dialog.getByText("Applied").first()).toBeVisible();

  // It wrote the canonical subjective-capacity slice.
  const stored = await page.evaluate(() =>
    window.localStorage.getItem("pbos:today-operating-state-v2"),
  );
  expect(stored).toContain('"capacityLevel":"low"');

  // Raw capture + proposals persist across a hard reload.
  await page.reload();
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
  const proposals = await page.evaluate(() =>
    window.localStorage.getItem("pbos:capture-proposals-v2"),
  );
  expect(proposals).toContain("set-today-capacity");
  expect(proposals).toContain("create-expense");
});

test("unclassifiable text keeps the raw capture and proposes nothing", async ({ page }) => {
  await boot(page);
  await openDrawer(page);
  await page.getByLabel("What happened?").fill("the sky was an unusual shade of teal this evening");
  await page.getByRole("button", { name: "Structure this" }).click();

  const dialog = page.getByRole("dialog", { name: "Natural Capture" });
  await expect(dialog.getByText(/Nothing structured to propose/i)).toBeVisible();

  const inbox = await page.evaluate(() => window.localStorage.getItem("pbos:capture-inbox-v2"));
  expect(inbox).toContain("unusual shade of teal");
});

test("the Natural Capture drawer has no critical/serious a11y violations", async ({ page }) => {
  await boot(page);
  await openDrawer(page);
  await page.getByLabel("What happened?").fill("did 25 min of German");
  await page.getByRole("button", { name: "Structure this" }).click();
  await expect(page.getByRole("dialog", { name: "Natural Capture" }).getByText(/proposal/i).first()).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(serious).toEqual([]);
});
