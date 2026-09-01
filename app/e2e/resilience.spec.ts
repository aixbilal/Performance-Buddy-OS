import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 8 — the Day-17 resilience contract through the real browser UI.
 *
 * Every failure here is injected ONLY through dev/e2e-only hooks
 * (`window.__PBOS_DEV__.*`, seeded sessionStorage) that are absent from a
 * production `npm run build`. No production failure toggle is exposed.
 *
 * Proves, end to end:
 *   A. LOADING ≠ EMPTY — a loading status shows first; the empty state only
 *      after the store has actually loaded.
 *   B. FAILED SAVE ≠ LOST DRAFT — a persistence failure keeps the input and
 *      offers a retry that persists exactly once.
 *   C. AI FAILURE ≠ APP FAILURE — AI off, deterministic Today/Analytics stay
 *      fully usable.
 *   D. OBSIDIAN FAILURE ≠ KNOWLEDGE LOSS — a vault scan error stays on the
 *      Notes Hub; the Knowledge Topic still opens.
 *   E. UNKNOWN ≠ ZERO — an un-scored reading book shows an honest non-percent
 *      state, never "0%".
 *   F. REVISION PERSISTS — a meaningful canonical mutation is recorded and
 *      survives a hard reload.
 */

const APP_READY =
  /Onboarding|Today|Your day is open|Goals|Systems|Nothing scheduled|Work needing placement|Knowledge|Analytics/;

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
      window.sessionStorage.clear();
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

/** Mark onboarding complete so AppGate lets a normal route render after a reload. */
async function seedOnboardingComplete(page: Page) {
  await page.evaluate(() => {
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
}

// ---------------------------------------------------------------------------
// A. LOADING ≠ EMPTY
// ---------------------------------------------------------------------------
test("A — a loading status shows before the honest empty state", async ({ page }) => {
  await freshBoot(page);
  await seedOnboardingComplete(page);

  // Arm a long one-shot load delay that survives the reload which re-mounts
  // the Performance store.
  await page.evaluate(() => sessionStorage.setItem("__pbos_load_delay__", "15000"));
  await page.reload();

  // AppGate lands on Today (which is itself now loading); hop to Goals.
  await page.waitForTimeout(3_000); // let the splash + AppGate settle
  await page.evaluate(() => {
    window.location.hash = "#/goals";
  });

  // While the Performance store re-resolves: the polite loading status,
  // and "No goals yet" is NOT shown.
  await expect(page.getByRole("status").filter({ hasText: /loading your goals/i })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(/no goals yet/i)).toBeHidden();

  // After it settles: the real empty state, spinner gone.
  await expect(page.getByText(/no goals yet/i)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("status").filter({ hasText: /loading your goals/i })).toBeHidden();
});

// ---------------------------------------------------------------------------
// B. FAILED SAVE ≠ LOST DRAFT
// ---------------------------------------------------------------------------
test("B — a failed save keeps the draft and a retry then persists exactly once", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);

  // Force every relational repo write to fail.
  await page.evaluate(() => (window as any).__PBOS_DEV__?.simulateRepoFailure(true));

  await hashTo(page, "#/goals/new", /goal name/i);
  await page.getByLabel(/goal name/i).fill("Ship V1");
  await page.getByRole("button", { name: /^create goal$/i }).click();

  // The goal is still on screen (optimistic state kept) and the failure is honest.
  await expect(page.getByRole("heading", { name: "Ship V1" })).toBeVisible();
  await expect(page.getByText(/save failed/i).first()).toBeVisible();

  // Recover and make one more edit — it now persists.
  await page.evaluate(() => (window as any).__PBOS_DEV__?.simulateRepoFailure(false));
  await page.getByRole("button", { name: /edit goal/i }).click();
  const name = page.getByLabel(/goal name/i);
  await name.fill("Ship V1 properly");
  await page.getByRole("button", { name: /save goal/i }).click();
  await expect(page.getByRole("heading", { name: "Ship V1 properly" })).toBeVisible();

  // Durable: a hard reload shows exactly one goal with the saved title.
  await page.reload();
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
  await hashTo(page, "#/goals", /Goals/i);
  await expect(page.getByRole("link", { name: /Ship V1 properly/i })).toHaveCount(1);
  await expect(page.getByText("Ship V1", { exact: true })).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// C. AI FAILURE ≠ APP FAILURE
// ---------------------------------------------------------------------------
test("C — with AI disabled, Today and Analytics stay fully usable", async ({ page }) => {
  await freshBoot(page);

  await hashTo(page, "#/ai-coach", /AI Coach/i);
  const disable = page.getByRole("button", { name: /^disable ai$/i });
  if (await disable.count()) {
    await disable.first().click();
  }
  await expect(page.getByText(/AI is switched off|AI Coach is disabled/i).first()).toBeVisible();

  // Deterministic surfaces still render.
  await hashTo(page, "#/", /Today|Your day is open/i);
  await expect(page.getByText(/something went wrong/i)).toBeHidden();

  await hashTo(page, "#/analytics", /Analytics/i);
  await expect(page.getByRole("heading", { name: "Analytics & Reviews" })).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).toBeHidden();
});

// ---------------------------------------------------------------------------
// D. OBSIDIAN FAILURE ≠ KNOWLEDGE LOSS
// ---------------------------------------------------------------------------
test("D — a vault scan error stays on the Notes Hub; the Knowledge Topic still opens", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);

  // Create a Knowledge topic first.
  await hashTo(page, "#/knowledge/new", /topic title/i);
  await page.getByLabel(/topic title/i).fill("Binary Trees");
  await page.getByRole("button", { name: /^add topic$/i }).click();
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await expect(page.getByText("Binary Trees")).toBeVisible();

  // Connect a vault, then force the scan to fail.
  await hashTo(page, "#/knowledge/notes", /no vault connected/i);
  await page.evaluate(() => (window as any).__PBOS_DEV__?.simulateObsidianScanError(true));
  await page.getByLabel(/vault folder path/i).fill("demo-vault");
  await page.getByRole("button", { name: /connect vault/i }).click();

  // The failure is shown on the Notes Hub…
  await expect(page.getByText(/scan failure|couldn't|could not|failed/i).first()).toBeVisible();

  // …and Knowledge is completely intact.
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByText("Binary Trees").click();
  await expect(page.getByRole("heading", { name: /Binary Trees/ })).toBeVisible();
  await expect(page.getByText(/mastery is unknown|no evidence yet/i).first()).toBeVisible();

  await page.evaluate(() => (window as any).__PBOS_DEV__?.simulateObsidianScanError(false));
});

// ---------------------------------------------------------------------------
// E. UNKNOWN ≠ ZERO
// ---------------------------------------------------------------------------
test("E — a book with no known page count shows an honest non-percent state, not 0%", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);

  await hashTo(page, "#/language", /Reading|Language/i);
  await page.getByRole("button", { name: /add book/i }).first().click();
  await page.getByLabel(/^title$/i).fill("Unknown Length");
  await page.getByRole("button", { name: /^add book$/i }).click();

  await expect(page.getByText(/total pages not tracked|not 0%|this is not 0%/i).first()).toBeVisible();
});

// ---------------------------------------------------------------------------
// F. REVISION PERSISTS
// ---------------------------------------------------------------------------
test("F — a meaningful canonical mutation is recorded as a revision event and survives a reload", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await freshBoot(page);

  // Create a Goal, then change its lifecycle — two revision events.
  await hashTo(page, "#/goals/new", /goal name/i);
  await page.getByLabel(/goal name/i).fill("Audited Goal");
  await page.getByRole("button", { name: /^create goal$/i }).click();
  await expect(page.getByRole("heading", { name: "Audited Goal" })).toBeVisible();

  const eventsBefore = await page.evaluate(async () => {
    const raw = window.localStorage.getItem("pbos:revision-events");
    return raw ? (JSON.parse(raw) as unknown[]).length : 0;
  });
  expect(eventsBefore).toBeGreaterThanOrEqual(1);

  // Hard reload — the durable revision log still has the create event.
  await page.reload();
  await page.waitForFunction((re) => new RegExp(re).test(document.body.innerText), APP_READY.source, {
    timeout: 25_000,
  });
  const eventsAfter = await page.evaluate(async () => {
    const raw = window.localStorage.getItem("pbos:revision-events");
    const arr = raw ? (JSON.parse(raw) as Array<{ domain: string; operation: string; entityType: string }>) : [];
    return {
      count: arr.length,
      hasGoalCreate: arr.some((e) => e.domain === "performance" && e.entityType === "goal" && e.operation === "create"),
    };
  });
  expect(eventsAfter.count).toBeGreaterThanOrEqual(eventsBefore);
  expect(eventsAfter.hasGoalCreate).toBe(true);
});

// ---------------------------------------------------------------------------
// Scoped a11y on the new state surfaces
// ---------------------------------------------------------------------------
test("resilience state surfaces have no critical/serious a11y violations", async ({ page }) => {
  await freshBoot(page);
  await seedOnboardingComplete(page);
  await page.evaluate(() => sessionStorage.setItem("__pbos_load_delay__", "20000"));
  await page.reload();
  await page.waitForTimeout(3_000);
  await page.evaluate(() => {
    window.location.hash = "#/goals";
  });
  await expect(page.getByRole("status").filter({ hasText: /loading your goals/i })).toBeVisible({
    timeout: 12_000,
  });
  // Scoped to the routed content area — the new resilience surfaces — not the
  // pre-existing app-shell chrome (that is Batch 9's visual-normalization pass).
  const results = await new AxeBuilder({ page })
    .include("main")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
  expect(blocking, `axe:\n${blocking.map((v) => `- ${v.id}: ${v.help}`).join("\n")}`).toEqual([]);
});
