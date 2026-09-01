import { test, expect, type Page } from "@playwright/test";

/**
 * Batch 9 — visual-system regression guards. Deliberately structural, not
 * pixel-perfect: they assert the canonical fonts actually load and apply, the
 * command search is a real focusable control, the context rail shows only
 * where a route provides it, and representative pages do not overflow
 * horizontally at the minimum supported desktop width.
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
  // The shell's command-search button only exists once AppGate has rendered the
  // real app (past splash + onboarding), and AppGate's own post-boot
  // router.navigate("/") has settled.
  await page.waitForSelector('header button[aria-label="Search or run a command"]', {
    state: "visible",
    timeout: 25_000,
  });
  await expect(page.locator("header h1")).toHaveText("Today");
}

async function gotoRoute(page: Page, hash: string, title: string) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  await expect(page.locator("header h1")).toHaveText(title);
}

test("canonical fonts are actually loaded and applied", async ({ page }) => {
  await boot(page);

  const loaded = await page.evaluate(async () => {
    await (document as Document).fonts.ready;
    return {
      inter: document.fonts.check('400 16px "Inter Variable"'),
      grotesk: document.fonts.check('600 24px "Space Grotesk Variable"'),
      mono: document.fonts.check('500 16px "JetBrains Mono Variable"'),
    };
  });
  expect(loaded.inter).toBe(true);
  expect(loaded.grotesk).toBe(true);
  expect(loaded.mono).toBe(true);

  const bodyFont = await page.evaluate(
    () => getComputedStyle(document.body).fontFamily,
  );
  expect(bodyFont).toContain("Inter Variable");

  const heading = page.locator("h1").first();
  await expect(heading).toBeVisible();
  const headingFont = await heading.evaluate(
    (el) => getComputedStyle(el).fontFamily,
  );
  expect(headingFont).toContain("Space Grotesk Variable");
});

test("command search is a focusable control that opens the palette", async ({
  page,
}) => {
  await boot(page);

  const search = page.getByRole("button", { name: /search or run a command/i });
  await expect(search).toBeVisible();
  await search.focus();
  await expect(search).toBeFocused();
  await search.click();

  await expect(
    page.getByPlaceholder(/search pbos or run a command/i),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});

test("context rail appears only where a route provides it", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  await boot(page);

  // Today provides no rail.
  await expect(
    page.getByRole("complementary", { name: "Context" }),
  ).toHaveCount(0);

  // Focus does.
  await gotoRoute(page, "/focus", "Focus");
  await expect(
    page.getByRole("complementary", { name: "Context" }),
  ).toBeVisible();

  // Leaving Focus removes it again.
  await gotoRoute(page, "/academics", "Academics");
  await expect(
    page.getByRole("complementary", { name: "Context" }),
  ).toHaveCount(0);
});

test("long user-entered text wraps instead of forcing horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 860 });
  await boot(page);
  await gotoRoute(page, "/goals/new", "Goal Builder");

  const long =
    "Advanced Data Structures and Algorithmic Analysis with Amortized Complexity, Persistent Trees and Competitive Programming Practice";
  await page.getByLabel("Goal name").fill(long);
  await page.getByLabel("Why this matters (optional)").fill(long + " " + long);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

const ROUTES: Array<[string, string]> = [
  ["/", "Today"],
  ["/planner", "Planner"],
  ["/calendar", "Calendar"],
  ["/focus", "Focus"],
  ["/academics", "Academics"],
  ["/money", "Money"],
  ["/analytics", "Analytics"],
  ["/ai-coach/workspace", "AI Coach Workspace"],
  ["/settings", "Settings"],
];

// Desktop-first: 1024 is the minimum supported width, up to 1920.
const WIDTHS = [1024, 1280, 1440, 1600, 1920];

for (const width of WIDTHS) {
  test(`no horizontal overflow at ${width}px across representative screens`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 900 });
    await boot(page);
    for (const [hash, title] of ROUTES) {
      if (hash !== "/") await gotoRoute(page, hash, title);
      const overflow = await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      );
      expect(overflow, `${hash} overflows at ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}
