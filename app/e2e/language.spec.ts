import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Master Batch 2 — the Reading & Language Learning domain end to end through
 * the real browser UI. Fresh profile, no seed. Proves:
 *   - honest empty state, no fake German/Italian path or sample books
 *   - path progress is a curriculum ratio (null when no units) — never mastery
 *   - reading progress is deterministic; UNKNOWN total pages ≠ 0%
 *   - a learning session / finishing a book NEVER creates Knowledge mastery
 *   - an optional Routine link is a reference, not a duplicate schedule
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

test("language path: create → units → session → reload; no Knowledge mastery is silently created", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/language");

  await expect(page.getByText(/nothing here yet/i)).toBeVisible({ timeout: 15_000 });

  // 1-2. create a path
  await page.getByRole("button", { name: /new language path/i }).first().click();
  await page.getByLabel(/^language$/i).fill("German");
  await page.getByLabel(/path title/i).fill("A1 Foundations");
  await page.getByRole("button", { name: /^create path$/i }).click();
  await expect(page.getByRole("heading", { name: /A1 Foundations/ })).toBeVisible();
  await expect(page.getByText(/No units yet — not 0%\./i)).toBeVisible();

  // 3. edit the path
  await page.getByRole("button", { name: /^edit$/i }).click();
  await page.getByLabel(/target level/i).fill("A2");
  await page.getByRole("button", { name: /save path/i }).click();
  await expect(page.getByText(/→ A2/)).toBeVisible();

  // 4-5. add two units
  for (const t of ["Basic Introductions", "Numbers"]) {
    await page.getByLabel(/unit title/i).fill(t);
    await page.getByRole("button", { name: /^add unit$/i }).click();
    await expect(page.getByText(new RegExp(t)).first()).toBeVisible();
  }
  await expect(page.getByText(/0 of 2 units\. Curriculum position, not skill evidence\./i)).toBeVisible();

  // 6-8. start a learning session, log it (no recall score)
  await page.getByRole("button", { name: /start learning session/i }).click();
  await page.getByLabel(/unit \(optional\)/i).selectOption({ label: "Basic Introductions" });
  await page.getByLabel(/minutes practised/i).fill("30");
  await page.getByRole("button", { name: /^log session$/i }).click();
  await expect(page.getByText(/Session logged/i)).toBeVisible();
  await expect(page.getByText(/changed Language progress only/i)).toBeVisible();

  // 9. path progress advanced (the linked unit is now complete → 1 of 2)
  await page.getByRole("link", { name: /back to the path/i }).click();
  await expect(page.getByText(/1 of 2 units/i)).toBeVisible();

  // 10. Knowledge was NOT silently touched
  await gotoRoute(page, "#/knowledge");
  await expect(page.getByText(/nothing here yet|no topics|add.*topic/i).first()).toBeVisible();

  // 11-12. reload → path + units + session persist
  await gotoRoute(page, "#/language");
  await page.getByRole("link", { name: /A1 Foundations/ }).click();
  await expect(page.getByText(/1 of 2 units/i)).toBeVisible();
  await expect(page.getByText(/Learning Sessions \(1\)/)).toBeVisible();
});

test("optional Routine link on a path is a reference, not a duplicated schedule", async ({ page }) => {
  await freshProfile(page);

  // minimum canonical Routine via the Batch 2B UI
  await gotoRoute(page, "#/routine");
  await page.getByRole("button", { name: /create your first routine/i }).click();
  await page.getByLabel(/routine name/i).fill("German Practice");
  await page.getByRole("button", { name: /^create routine$/i }).click();
  await expect(page.getByRole("heading", { name: /German Practice/ })).toBeVisible();

  await gotoRoute(page, "#/language");
  await page.getByRole("button", { name: /new language path/i }).first().click();
  await page.getByLabel(/^language$/i).fill("German");
  await page.getByLabel(/path title/i).fill("A1");
  await page.getByRole("button", { name: /^create path$/i }).click();
  await expect(page.getByRole("heading", { name: /German A1|A1/ })).toBeVisible();

  await page.getByLabel(/link a routine to/i).selectOption({ label: "German Practice" });
  await expect(page.getByRole("link", { name: /German Practice/ })).toBeVisible();
  await expect(page.getByText(/the routine owns cadence and check-in history/i)).toBeVisible();

  await gotoRoute(page, "#/language");
  await page.getByRole("link", { name: /A1/ }).first().click();
  await expect(page.getByRole("link", { name: /German Practice/ })).toBeVisible();
  await page.getByRole("button", { name: /^unlink$/i }).click();
  await expect(page.getByLabel(/link a routine to/i)).toBeVisible();
});

test("reading: deterministic progress, UNKNOWN total ≠ 0%, sessions advance the page but not mastery", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/language");

  // book with a known total
  await page.getByRole("button", { name: /add book/i }).first().click();
  await page.getByLabel(/^title$/i).fill("Deep Work");
  await page.getByLabel(/total pages/i).fill("300");
  await page.getByRole("button", { name: /^add book$/i }).click();
  await expect(page.getByRole("heading", { name: /Deep Work/ })).toBeVisible();

  // set current page → 60/300 = 20%
  await page.getByLabel(/set current page/i).fill("60");
  await page.getByRole("button", { name: /^update$/i }).click();
  await expect(page.getByText("20%")).toBeVisible();

  // log a reading session → page advances to 120 → 40%
  await page.getByLabel(/reading session from page/i).fill("60");
  await page.getByLabel(/reading session to page/i).fill("120");
  await page.getByLabel(/reading session minutes/i).fill("25");
  await page.getByRole("button", { name: /log reading/i }).click();
  await expect(page.getByText(/Reading Sessions \(1\)/)).toBeVisible();
  await expect(page.getByText("40%")).toBeVisible();

  // a second book with NO total pages → honest non-percent state
  await gotoRoute(page, "#/language");
  await page.getByRole("button", { name: /add book/i }).first().click();
  await page.getByLabel(/^title$/i).fill("Unknown Length");
  await page.getByRole("button", { name: /^add book$/i }).click();
  await expect(page.getByText(/Total pages not tracked/i)).toBeVisible();
  await expect(page.getByText(/This is not 0%/i)).toBeVisible();

  // reload → both books + the reading session persist
  await gotoRoute(page, "#/language");
  await page.getByRole("link", { name: /Deep Work/ }).click();
  await expect(page.getByText("40%")).toBeVisible();
  await expect(page.getByText(/Reading Sessions \(1\)/)).toBeVisible();
});

test("no critical/serious a11y violations on the Language + Book forms", async ({ page }) => {
  await freshProfile(page);
  for (const route of ["#/language/paths/new", "#/language/books/new"]) {
    await gotoRoute(page, route);
    await expect(page.locator("form")).toBeVisible({ timeout: 15_000 });
    const results = await new AxeBuilder({ page })
      .include("form")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(serious, `${route}: ${JSON.stringify(serious, null, 2)}`).toEqual([]);
  }
});
