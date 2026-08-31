import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 2A — the Knowledge domain + the Academic↔Knowledge link, end to end
 * through the real browser UI. Fresh profile, no seed. Proves mastery is
 * evidence-derived and that the Academic side reads it without a second copy.
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

test("create a Knowledge topic, add a source, record evidence, update review, reload", async ({
  page,
}) => {
  await freshProfile(page);
  await gotoRoute(page, "#/knowledge");

  await expect(page.getByText(/no topics yet/i)).toBeVisible({ timeout: 15_000 });

  await page.getByRole("button", { name: /add your first topic/i }).click();
  await page.getByLabel(/topic title/i).fill("Binary Trees");
  await page.getByLabel(/context/i).fill("Data Structures");
  await page.getByRole("button", { name: /^add topic$/i }).click();

  await expect(page.getByRole("heading", { name: /Binary Trees/ })).toBeVisible();
  await expect(page.getByText(/mastery is unknown until it is/i)).toBeVisible();

  // add a source — mastery must NOT move
  await page.getByRole("button", { name: /^add source$/i }).click();
  await page.getByLabel(/source title/i).fill("DSA Lecture 08");
  await page.getByLabel(/reference/i).fill("Slides/DSA-08.pdf");
  await page.getByRole("button", { name: /^add source$/i }).click();
  await expect(page.getByText("DSA Lecture 08")).toBeVisible();
  await expect(page.getByText(/mastery is unknown until it is/i)).toBeVisible();

  // record evidence — now mastery is a real derived number (9/10 = 90%)
  await page.getByRole("button", { name: /record evidence/i }).click();
  await page.getByLabel(/what was it/i).fill("Inorder traversal drill");
  await page.getByLabel(/^score$/i).fill("9");
  await page.getByRole("button", { name: /^record evidence$/i }).click();
  await expect(page.getByText("90%")).toBeVisible();

  // update review metadata (past date → Review Due), independent of mastery
  await page.getByLabel(/next review/i).fill("2020-01-01");
  await page.getByLabel(/next review/i).blur();
  await expect(page.getByText("Review Due", { exact: true })).toBeVisible();

  // full fresh load → everything persists
  await gotoRoute(page, "#/knowledge");
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  await expect(page.getByText("90%")).toBeVisible();
  await expect(page.getByText("DSA Lecture 08")).toBeVisible();
});

test("Academic Binary Trees links to the Knowledge Binary Trees concept and reads its mastery", async ({
  page,
}) => {
  await freshProfile(page);

  // create the Knowledge concept + one piece of evidence
  await gotoRoute(page, "#/knowledge/new");
  await page.getByLabel(/topic title/i).fill("Binary Trees");
  await page.getByRole("button", { name: /^add topic$/i }).click();
  await page.getByRole("button", { name: /record evidence/i }).click();
  await page.getByLabel(/what was it/i).fill("Quiz");
  await page.getByLabel(/^score$/i).fill("8");
  await page.getByRole("button", { name: /^record evidence$/i }).click();
  await expect(page.getByText("80%")).toBeVisible();

  // create the course + academic topic, then link
  await page.evaluate(() => {
    window.location.hash = "#/academics/new";
  });
  await page.getByLabel(/course name/i).fill("Data Structures");
  await page.getByRole("button", { name: /^add course$/i }).click();
  await page.getByRole("button", { name: /^add topic$/i }).click();
  await page.getByLabel(/topic title/i).fill("Binary Trees");
  await page.getByRole("button", { name: /^add topic$/i }).click();

  await page.getByLabel(/link binary trees to a knowledge concept/i).selectOption({ label: "Binary Trees" });
  await page.getByRole("button", { name: /^link$/i }).click();

  // the Academic UI now shows the mastery READ from Knowledge (80%), not a stored field
  await expect(page.getByRole("button", { name: /unlink knowledge concept/i })).toBeVisible();
  await expect(page.getByText("80%")).toBeVisible();
});

test("Notes Hub is honest — no vault connected, no fake files, offers to connect", async ({ page }) => {
  await freshProfile(page);
  await gotoRoute(page, "#/knowledge/notes");
  await expect(page.getByText(/no vault connected/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByLabel(/vault folder path/i)).toBeVisible();
  await expect(page.getByText(/indexed notes \(/i)).toHaveCount(0);
});

test("no critical/serious a11y violations on the Knowledge Topic form", async ({ page }) => {
  await freshProfile(page);
  await gotoRoute(page, "#/knowledge/new");
  await expect(page.getByLabel(/topic title/i)).toBeVisible({ timeout: 15_000 });
  const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
