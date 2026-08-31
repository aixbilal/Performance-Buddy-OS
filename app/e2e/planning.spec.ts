import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 3 — the PLAN stage of the operating loop through the real browser UI.
 * Fresh profile, no seed. Proves: Action → Planner → Calendar → Today with the
 * Action staying Action-owned; conflict ≠ capacity; locked blocks survive a
 * regenerate; and durable Quick Capture into the canonical domain engines.
 */

// Post-splash markers only — never the "PERFORMANCE BUDDY OS" splash text, so we
// don't race the SplashScreen's onDone navigation.
const APP_READY = /Onboarding|Today's Plan|Resume step|Goals|Systems|Nothing scheduled|Work needing placement/;

/** Full load, wait until the splash is gone and a real route is mounted. */
async function boot(page: Page) {
  await page.goto("/");
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
}

/** Fresh profile, then boot. */
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

/** Client-side hash navigation — no reload, so no repeated splash. */
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

async function createActionUnderSystem(page: Page, system: string, action: string, estMinutes = "60") {
  await hashTo(page, "#/systems", /Systems|create system/i);
  await page.getByRole("button", { name: /create system/i }).first().click();
  await page.getByLabel(/system name/i).fill(system);
  await page.getByRole("button", { name: /^create system$/i }).click();
  await expect(page.getByRole("heading", { name: new RegExp(system) })).toBeVisible();

  await page.getByRole("button", { name: /add action/i }).click();
  await page.getByLabel(/^action$/i).fill(action);
  await page.getByLabel(/estimate, minutes/i).fill(estMinutes);
  await page.getByRole("button", { name: /^add action$/i }).click();
  await expect(page.getByText(action, { exact: true })).toBeVisible();
}

test("Plan → Calendar → Today: schedule an Action, complete it, planning history survives", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await createActionUnderSystem(page, "Weekly DSA Study", "Revise Binary Trees");

  // 1. Planner — schedule the unscheduled Action for today
  await hashTo(page, "#/planner", /Work needing placement/i);
  await page.getByRole("button", { name: /schedule today/i }).click();
  await expect(page.getByTestId("planner-feedback")).toContainText(/Scheduled .*Revise Binary Trees.* for today/i);
  await expect(page.getByTestId("conflict-count")).toHaveText("0");

  // 2. Calendar — the block shows in the current week
  await hashTo(page, "#/calendar", /Week of/i);
  await expect(page.getByText("Revise Binary Trees").first()).toBeVisible();

  // 3. Today — the block shows and the Action is still incomplete
  await hashTo(page, "#/", /Today's Plan/i);
  await expect(page.getByText("Revise Binary Trees").first()).toBeVisible();
  await expect(page.getByText(/\(todo\)/i)).toBeVisible();
  await expect(page.getByRole("button", { name: /start focus/i })).toBeVisible();

  // 4. Mark the canonical Action Done via the Action UI
  await hashTo(page, "#/systems", /Systems/i);
  await page.getByRole("link", { name: /Weekly DSA Study/ }).click();
  await page.getByLabel(/status for revise binary trees/i).selectOption("done");

  // 5. Today reflects the Done state; the planning block/history remains
  await hashTo(page, "#/", /Today's Plan/i);
  await expect(page.getByText(/Action done/)).toBeVisible();
  await expect(page.getByRole("button", { name: /start focus/i })).toHaveCount(0);

  // 6. Calendar still shows the block after a hard reload (persisted)
  await hardReload(page);
  await hashTo(page, "#/calendar", /Week of/i);
  await expect(page.getByText("Revise Binary Trees").first()).toBeVisible();
});

test("Conflict ≠ Capacity, and a locked block survives a regenerate", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await hashTo(page, "#/planner", /Work needing placement/i);

  const addBlock = async (title: string, day: string, start: string, end: string, type?: "fixed" | "flexible") => {
    await page.getByLabel("Block title", { exact: true }).fill(title);
    await page.getByLabel("Weekday", { exact: true }).selectOption(day);
    if (type) await page.getByLabel("Block type", { exact: true }).selectOption(type);
    await page.getByLabel("Start time", { exact: true }).fill(start);
    await page.getByLabel("End time", { exact: true }).fill(end);
    await page.getByRole("button", { name: /^add block$/i }).click();
  };

  // a fixed block, then an overlapping flexible block -> deterministic CONFLICT
  await addBlock("Lecture", "Mon", "14:00", "15:00", "fixed");
  await expect(page.getByTestId("planner-feedback")).toContainText("Block added");
  await addBlock("Overlap", "Mon", "14:30", "15:30", "flexible");
  await expect(page.getByTestId("planner-feedback")).toContainText(/Could Not Fit.*Overlaps/i);

  // a non-overlapping block on another day fits
  await addBlock("Tue study", "Tue", "09:00", "11:00", "flexible");
  await expect(page.getByTestId("planner-feedback")).toContainText("Block added");

  // now shrink capacity below the scheduled total (3h) -> CAPACITY violation,
  // with ZERO conflicts. Different problem, shown separately.
  await page.getByLabel("Daily capacity in hours", { exact: true }).fill("2");
  await page.getByLabel("Weekly capacity in hours", { exact: true }).fill("2");
  await page.getByRole("button", { name: /save capacity/i }).click();
  await expect(page.getByRole("heading", { name: "Capacity Violations" })).toBeVisible();
  await expect(page.getByText(/Over weekly capacity by/i)).toBeVisible();
  await expect(page.getByTestId("conflict-count")).toHaveText("0");

  // restore capacity, add an Action, lock the Lecture, generate + apply
  await page.getByLabel("Daily capacity in hours", { exact: true }).fill("6");
  await page.getByLabel("Weekly capacity in hours", { exact: true }).fill("20");
  await page.getByRole("button", { name: /save capacity/i }).click();

  await createActionUnderSystem(page, "S1", "Generated task", "30");
  await hashTo(page, "#/planner", /Work needing placement/i);
  await page.getByRole("button", { name: /^Lock Lecture$/ }).click();
  const lectureRow = page.locator('[data-testid^="week-row-"]', { hasText: "· Lecture" });
  await expect(lectureRow.getByText("Locked")).toBeVisible();

  await page.getByLabel(/include generated task in the generated plan/i).check();
  await page.getByRole("button", { name: /generate proposal/i }).click();
  await expect(page.getByText(/Proposed changes — review before applying/)).toBeVisible();
  await page.getByRole("button", { name: /^apply$/i }).click();

  // the locked Lecture is still there, still at the same time, still locked
  await expect(page.getByText("Mon 14:00–15:00 · Lecture")).toBeVisible();
  await expect(lectureRow.getByText("Locked")).toBeVisible();
  await expect(
    page.locator('[data-testid^="week-row-"]').getByText("generated", { exact: true }).first(),
  ).toBeVisible();
  // the Tue manual block also survived the regenerate
  await expect(page.getByText(/Tue 9:00–11:00 · Tue study/)).toBeVisible();
});

test("Quick Capture — Action, Expense, Routine, and an ambiguous capture that survives reload", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await freshBoot(page);

  // a routine to check into
  await hashTo(page, "#/routine", /Routine/i);
  await page.getByRole("button", { name: /create your first routine/i }).click();
  await page.getByLabel(/routine name/i).fill("Morning Mobility");
  await page.getByRole("button", { name: /^create routine$/i }).click();
  await expect(page.getByRole("heading", { name: /Morning Mobility/ })).toBeVisible();

  const capture = async (text: string) => {
    await page.keyboard.press("Control+k");
    await page.getByRole("button", { name: /quick capture/i }).click();
    await page.getByLabel(/capture text/i).fill(text);
    await page.getByRole("button", { name: /^capture$/i }).click();
  };

  // ACTION
  await capture("Revise Binary Trees");
  await expect(page.getByText(/Proposed:/)).toContainText(/action/i);
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await expect(page.getByText(/Sent to action/i)).toBeVisible();
  await page.keyboard.press("Escape");

  // EXPENSE
  await capture("Spent 1200 on food");
  await expect(page.getByText(/Proposed:/)).toContainText(/expense/i);
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await expect(page.getByText(/Sent to expense/i)).toBeVisible();
  await page.keyboard.press("Escape");

  // ROUTINE
  await capture("Morning Mobility done");
  await page.getByRole("button", { name: /^confirm$/i }).click();
  await expect(page.getByText(/Sent to routine check ?in/i)).toBeVisible();
  await page.keyboard.press("Escape");

  // AMBIGUOUS -> keep in Inbox
  await capture("mysterious note about nothing in particular");
  await page.getByRole("button", { name: /keep in inbox/i }).click();
  await expect(page).toHaveURL(/#\/capture-inbox/);
  await expect(page.getByText("mysterious note about nothing in particular")).toBeVisible();

  // exactly one canonical write each
  await hashTo(page, "#/money/transactions", /Transactions/i);
  await expect(page.getByText("1200").first()).toBeVisible();
  await hashTo(page, "#/routine", /Routine/i);
  await page.getByRole("link", { name: /Morning Mobility/ }).click();
  await expect(page.getByText(/History \(1\)/)).toBeVisible();

  // ambiguous capture survives a hard reload
  await hardReload(page);
  await hashTo(page, "#/capture-inbox", /Capture Inbox/i);
  await expect(page.getByText("mysterious note about nothing in particular")).toBeVisible();
});

test("the Planner Plan Builder & Capacity forms have no critical/serious a11y violations", async ({
  page,
}) => {
  await freshBoot(page);
  await hashTo(page, "#/planner", /Work needing placement/i);
  await page.getByLabel("Block title", { exact: true }).waitFor({ timeout: 15_000 });
  const results = await new AxeBuilder({ page }).include("form").withTags(["wcag2a", "wcag2aa"]).analyze();
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
});
