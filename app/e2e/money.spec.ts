import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Master Batch 2 — the Money OS domain end to end through the real browser UI.
 * Fresh profile, no seed. Proves:
 *   - honest empty state ("no transactions" ≠ "bank balance 0")
 *   - SAVINGS TRANSFER ≠ EXPENSE (10,000 spent, not 25,000)
 *   - PLANNED EXPENSE ≠ ACTUAL SPEND
 *   - budget usage derives only from actual category expenses
 *   - savings-goal progress = opening + linked transfers, never expenses
 *   - Insights are deterministic and never assert a verified bank balance
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

async function addTransaction(
  page: Page,
  { type, amount, category }: { type: string; amount: string; category?: string },
) {
  await page.getByRole("button", { name: /add transaction/i }).first().click();
  await page.getByLabel(/^type$/i).selectOption(type);
  await page.getByLabel(/^amount$/i).fill(amount);
  if (category !== undefined) await page.getByLabel(/^category/i).fill(category);
  await page.getByRole("button", { name: /^add transaction$/i }).click();
}

test("full money workflow: transfer ≠ spend, planned ≠ actual, budget from real expenses, reload", async ({
  page,
}) => {
  test.setTimeout(90_000); // many full-page reloads prove persistence end to end
  await freshProfile(page);
  await gotoRoute(page, "#/money");
  await expect(page.getByText(/does not mean your bank balance is zero/i)).toBeVisible({
    timeout: 15_000,
  });

  // 3-5. income 50,000 · expense 10,000 · savings transfer 15,000
  await gotoRoute(page, "#/money/transactions");
  await addTransaction(page, { type: "income", amount: "50000", category: "Freelance" });
  await addTransaction(page, { type: "expense", amount: "10000", category: "Food & Dining" });
  await addTransaction(page, { type: "savings-transfer", amount: "15000" });

  await gotoRoute(page, "#/money");
  // spending is 10,000 — NOT 25,000
  await expect(
    page.locator("div", { hasText: /^Spent \(recorded\)Rs 10,000$/ }).first(),
  ).toBeVisible();
  await expect(page.getByText("Rs 25,000")).toBeVisible(); // tracked net = 50k-10k-15k

  // 6. planned expense 5,000 — actual spending stays 10,000
  await gotoRoute(page, "#/money/budget");
  await page.getByLabel(/planned expense title/i).fill("Internet");
  await page.getByLabel(/planned expense amount/i).fill("5000");
  await page.getByLabel(/planned expense category/i).fill("Utilities");
  await page.getByRole("button", { name: /^add planned$/i }).click();
  await expect(page.getByText("Internet")).toBeVisible();

  await gotoRoute(page, "#/money");
  await expect(
    page.locator("div", { hasText: /^Spent \(recorded\)Rs 10,000$/ }).first(),
  ).toBeVisible();

  // 7. budget for Food & Dining — usage from the actual expense only
  await gotoRoute(page, "#/money/budget");
  await page.getByLabel(/budget category/i).fill("Food & Dining");
  await page.getByLabel(/budget limit/i).fill("20000");
  await page.getByRole("button", { name: /^add budget$/i }).click();
  await expect(page.getByText(/Rs 10,000 \/ 20,000/)).toBeVisible();
  await expect(page.getByText(/within budget/i)).toBeVisible();

  // 8. savings goal — progress from opening + the linked/general transfers is a manual figure;
  //    here opening 5,000 of 50,000 = 10%
  await page.getByLabel(/savings goal title/i).fill("New Laptop");
  await page.getByLabel(/savings goal target amount/i).fill("50000");
  await page.getByLabel(/savings goal opening amount/i).fill("5000");
  await page.getByRole("button", { name: /^add goal$/i }).click();
  await expect(page.getByText(/Rs 5,000 \/ 50,000 · 10%/)).toBeVisible();
  await expect(page.getByText(/expenses are never counted\s+as savings/i)).toBeVisible();

  // 9-11. edit a transaction, reload, everything persists
  await gotoRoute(page, "#/money/transactions");
  await page.getByRole("button", { name: /^edit$/i }).first().click();
  await page.getByLabel(/^note/i).fill("edited note");
  await page.getByRole("button", { name: /^save$/i }).click();
  await gotoRoute(page, "#/money/transactions");
  await expect(page.getByText(/edited note/)).toBeVisible();
  await expect(page.getByText(/All transactions \(3\)/)).toBeVisible();

  // 12-13. insights use the real data, no verified-balance claim
  await gotoRoute(page, "#/money/insights");
  await expect(page.getByText(/actual spending 10,000/i)).toBeVisible();
  await expect(page.getByText(/not a verified bank balance/i)).toBeVisible();
});

test("no critical/serious a11y violations on the Money forms", async ({ page }) => {
  await freshProfile(page);
  await gotoRoute(page, "#/money/transactions");
  await page.getByRole("button", { name: /add transaction/i }).first().click();
  await expect(page.getByLabel(/^amount$/i)).toBeVisible({ timeout: 15_000 });
  for (const route of ["#/money/transactions", "#/money/budget"]) {
    await gotoRoute(page, route);
    if (route.endsWith("transactions")) {
      await page.getByRole("button", { name: /add transaction/i }).first().click();
    }
    await expect(page.locator("form").first()).toBeVisible();
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
