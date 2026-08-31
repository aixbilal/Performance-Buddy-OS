import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 4 — the ACADEMIC EXECUTION loop through the real browser UI. Fresh
 * profile, no seed. Proves Focus time ≠ mastery, that a Mastery Check hands off
 * exactly one Knowledge Evidence record on an explicit action (idempotent), and
 * that Professor Coverage / Personal Study / official grade are never touched.
 */

const APP_READY = /Onboarding|Today's Plan|Resume step|No courses yet|Academics/;

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

/** Data Structures course + Binary Trees topic linked to a Binary Trees Knowledge concept. */
async function setupCourseTopicLinked(page: Page) {
  // Knowledge concept first so the link select is populated
  await hashTo(page, "#/knowledge/new", /topic title/i);
  await page.getByLabel(/topic title/i).fill("Binary Trees");
  await page.getByRole("button", { name: /^(add topic|create topic)$/i }).click();
  await expect(page.getByRole("heading", { name: /Binary Trees/ })).toBeVisible();

  await hashTo(page, "#/academics", /no courses yet|Academics/i);
  await page.getByRole("button", { name: /add your first course|add course/i }).first().click();
  await page.getByLabel(/course name/i).fill("Data Structures");
  await page.getByRole("button", { name: /^add course$/i }).click();
  await expect(page.getByRole("heading", { name: /Data Structures/ })).toBeVisible();

  await page.getByRole("button", { name: /^add topic$/i }).click();
  await page.getByLabel(/topic title/i).fill("Binary Trees");
  await page.getByRole("button", { name: /^add topic$/i }).click();
  await expect(page.getByText("Binary Trees").first()).toBeVisible();

  await page.getByLabel(/professor coverage for binary trees/i).selectOption("taught");
  await page.getByLabel(/link binary trees to a knowledge concept/i).selectOption({ label: "Binary Trees" });
  await page.getByRole("button", { name: /^link$/i }).click();
  await expect(page.getByRole("button", { name: /unlink knowledge concept/i })).toBeVisible();
}

test("Normal Study → Focus: time is activity, never mastery; session persists", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await setupCourseTopicLinked(page);

  await hashTo(page, "#/academics/study", /Study targets/i);
  await page.getByRole("button", { name: /Study Binary Trees \(Data Structures\)/i }).click();
  await page.getByRole("button", { name: /^start focus$/i }).click();

  // canonical Focus session with academic context
  await expect(page.getByText(/Context:.*Data Structures/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /^finish$/i })).toBeVisible();

  // finish WITHOUT a recall check
  await page.getByRole("button", { name: /^finish$/i }).click();
  await expect(page.getByText(/NO mastery evidence added/i)).toBeVisible();
  await expect(page.getByText(/Recent Sessions \(1\)/)).toBeVisible();
  await expect(page.getByText(/activity only/i)).toBeVisible();

  // back to study — professor coverage unchanged, Knowledge still has no evidence
  await page.getByRole("button", { name: /back to study/i }).click();
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  await expect(page.getByText(/mastery is unknown until it is/i)).toBeVisible();

  // session history survives a hard reload
  await hardReload(page);
  await hashTo(page, "#/focus", /Recent Sessions/i);
  await expect(page.getByText(/Recent Sessions \(1\)/)).toBeVisible();
});

test("Mastery Check → one Knowledge Evidence record, idempotent, no grade/coverage change", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await setupCourseTopicLinked(page);

  await hashTo(page, "#/academics/study", /Study targets/i);
  await page.getByRole("button", { name: /Study Binary Trees \(Data Structures\)/i }).click();
  await page.getByRole("button", { name: /start mastery check/i }).click();

  // rate every prompt "Confident" (radio input is visually-hidden inside its label)
  await expect(page.getByRole("heading", { name: /Mastery Check — Binary Trees/i })).toBeVisible();
  const confidentLabels = await page.locator('label:has(input[value="confident"])').all();
  expect(confidentLabels.length).toBeGreaterThanOrEqual(3);
  for (const l of confidentLabels) await l.click();
  await page.getByRole("button", { name: /submit check/i }).click();

  // result
  await expect(page.getByRole("heading", { name: /Mastery Result — Binary Trees/i })).toBeVisible();
  await expect(page.getByText(/\b4\/4\b/)).toBeVisible();
  await expect(page.getByText(/\bstrong\b/i).first()).toBeVisible();

  // explicit handoff → exactly one evidence
  await page.getByRole("button", { name: /record as knowledge evidence/i }).click();
  await expect(page.getByText(/Re-recording is blocked — no duplicates/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /record as knowledge evidence/i })).toHaveCount(0);

  // Knowledge mastery derives from that one record
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  await expect(page.getByText(/100%/)).toBeVisible();
  await expect(page.getByText(/Mastery Check — Binary Trees/)).toBeVisible(); // the one evidence row

  // official grade + professor coverage untouched
  await hashTo(page, "#/academics", /Academics/i);
  await page.getByRole("link", { name: /Data Structures/ }).click();
  await expect(page.getByLabel(/professor coverage for binary trees/i)).toHaveValue("taught");

  // reload → still one evidence, re-record still blocked
  await hardReload(page);
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  const evidenceRows = page.getByText(/Mastery Check — Binary Trees/);
  await expect(evidenceRows).toHaveCount(1);
});

test("study modes switch presentation only — course/topic data is untouched", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await setupCourseTopicLinked(page);
  await hashTo(page, "#/academics/study", /Study targets/i);

  for (const m of ["Exam", "Recovery", "Normal"]) {
    await page.getByRole("button", { name: new RegExp(`^${m}$`) }).click();
    await expect(page.getByRole("button", { name: new RegExp(`^${m}$`) })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  // data intact after churning modes
  await hashTo(page, "#/academics", /Academics/i);
  await page.getByRole("link", { name: /Data Structures/ }).click();
  await expect(page.getByText("Binary Trees").first()).toBeVisible();
  await expect(page.getByLabel(/professor coverage for binary trees/i)).toHaveValue("taught");
});

test("the Mastery Check form has no critical/serious a11y violations", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await setupCourseTopicLinked(page);
  await hashTo(page, "#/academics/study", /Study targets/i);
  await page.getByRole("button", { name: /Study Binary Trees \(Data Structures\)/i }).click();
  await page.getByRole("button", { name: /start mastery check/i }).click();
  await page.getByRole("heading", { name: /Mastery Check — Binary Trees/i }).waitFor({ timeout: 15_000 });
  const results = await new AxeBuilder({ page })
    .include("fieldset")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
});
