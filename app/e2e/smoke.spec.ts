import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Minimal smoke coverage — proves the Playwright Test + axe toolchain runs
 * against the real Vite-served app. Not a full E2E suite.
 */
test("app shell mounts", async ({ page }) => {
  await page.goto("/");
  // React mounts into #root.
  await expect(page.locator("#root")).not.toBeEmpty();
});

test("no critical/serious accessibility violations on first paint", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(
    blocking,
    `axe violations:\n${blocking.map((v) => `- ${v.id}: ${v.help}`).join("\n")}`,
  ).toEqual([]);
});
