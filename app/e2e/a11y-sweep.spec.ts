import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 9 — representative accessibility sweep. One booted shell, every major
 * V1 surface visited, axe (wcag2a + wcag2aa) run scoped to the routed content.
 * Gate: zero critical / serious violations. Medium/minor are reported but do
 * not fail — they are logged for follow-up, never hidden.
 */

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

async function boot(page: Page) {
  await page.goto("/");
  await seedOnboardingComplete(page);
  await page.reload();
  await page.waitForSelector('header button[aria-label="Search or run a command"]', {
    state: "visible",
    timeout: 25_000,
  });
  await expect(page.locator("header h1")).toHaveText("Today");
}

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .include("#root")
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  const minor = results.violations.filter(
    (v) => v.impact !== "critical" && v.impact !== "serious",
  );
  if (minor.length) {
    console.log(
      `[a11y ${label}] non-blocking: ${minor.map((v) => `${v.id}(${v.impact})`).join(", ")}`,
    );
  }
  expect(
    blocking,
    `${label} axe:\n${blocking
      .map((v) => `- ${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target).join("\n  ")}`)
      .join("\n")}`,
  ).toEqual([]);
}

const ROUTES: Array<[string, string]> = [
  ["/", "Today"],
  ["/goals", "Goals"],
  ["/planner", "Planner"],
  ["/calendar", "Calendar"],
  ["/academics", "Academics"],
  ["/academics/study", "Normal Study"],
  ["/academics/sgpa-cgpa", "SGPA / CGPA"],
  ["/focus", "Focus"],
  ["/knowledge", "Knowledge"],
  ["/knowledge/notes", "Notes Hub"],
  ["/development", "Development"],
  ["/fitness", "Fitness"],
  ["/routine", "Routine"],
  ["/language", "Reading & Language"],
  ["/money", "Money"],
  ["/analytics", "Analytics"],
  ["/ai-coach", "AI Coach"],
  ["/settings", "Settings"],
];

test("representative V1 screens have no critical/serious a11y violations", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await boot(page);

  for (const [hash, title] of ROUTES) {
    await page.evaluate((h) => {
      window.location.hash = h;
    }, hash);
    await expect(page.locator("header h1")).toHaveText(title, { timeout: 15_000 });
    await scan(page, title);
  }

  // Command palette overlay.
  await page.getByRole("button", { name: /search or run a command/i }).click();
  await expect(page.getByPlaceholder(/search pbos or run a command/i)).toBeVisible();
  await scan(page, "Command Palette");
  await page.keyboard.press("Escape");
});

test("onboarding wizard has no critical/serious a11y violations", async ({
  page,
}) => {
  await page.goto("/#/onboarding");
  await page.waitForSelector("#root :not(:empty)");
  await expect(page.getByText(/Step 1 of 4/i)).toBeVisible({ timeout: 15_000 });
  await scan(page, "Onboarding");
});
