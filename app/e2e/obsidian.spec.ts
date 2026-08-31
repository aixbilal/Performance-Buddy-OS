import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Batch 5 — the KNOWLEDGE / OBSIDIAN boundary through the real browser UI.
 *
 * Browser mode has no native filesystem, so this drives the labelled dev-vault
 * ADAPTER (see obsidian/repo.ts) — real filesystem correctness lives in the
 * Rust tests in obsidian.rs. What this proves through the UI: connect → index →
 * search → link to a Knowledge Topic → the Topic shows the note and its mastery
 * is UNCHANGED → an externally-removed linked file goes "missing / stale"
 * (never deletes Knowledge) → links + evidence survive a reload.
 */

const APP_READY = /Onboarding|Today's Plan|Resume step|No topics yet|Knowledge|Notes Hub/;

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

async function addTopic(page: Page, title: string) {
  await hashTo(page, "#/knowledge/new", /topic title/i);
  await page.getByLabel(/topic title/i).fill(title);
  await page.getByRole("button", { name: /^(add topic|create topic)$/i }).click();
  await expect(page.getByRole("heading", { name: new RegExp(title) })).toBeVisible();
}

async function connectVaultAndScan(page: Page) {
  await hashTo(page, "#/knowledge/notes", /no vault connected/i);
  await page.getByLabel(/vault folder path/i).fill("demo-vault");
  await page.getByRole("button", { name: /connect vault/i }).click();
  await expect(page.getByText("Binary Trees.md", { exact: true }).first()).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(/indexed notes \(/i)).toBeVisible();
}

test("connect → index → search → link a note to a Topic; mastery is unchanged", async ({ page }) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await addTopic(page, "Binary Trees");
  await connectVaultAndScan(page);

  // deterministic lexical search narrows the list
  await page.getByLabel(/search notes/i).fill("hooks");
  await expect(page.getByText("React/Hooks.md", { exact: true })).toBeVisible();
  await expect(page.getByText("Binary Trees.md", { exact: true })).toHaveCount(0);
  await page.getByLabel(/search notes/i).fill("");

  // link the Binary Trees note to the Binary Trees Topic
  const row = page.locator("li", { hasText: "Binary Trees.md" }).first();
  await row.getByRole("combobox", { name: /link binary trees.*knowledge topic/i }).selectOption({
    label: "Binary Trees",
  });
  await row.getByRole("button", { name: /^link$/i }).click();
  await expect(row.getByText(/linked to Binary Trees/i)).toBeVisible();

  // the Topic shows the linked note, and mastery is STILL unknown
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  await expect(page.getByText(/Linked Notes — Obsidian \(1\)/)).toBeVisible();
  await expect(page.getByText(/in vault/i).first()).toBeVisible();
  await expect(page.getByText(/mastery is unknown until it is/i)).toBeVisible();
});

test("an externally-removed linked file goes stale — Knowledge is never deleted; survives reload", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await addTopic(page, "Binary Trees");
  // give the topic a piece of evidence so we can prove Knowledge is untouched later
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  await page.getByRole("button", { name: /record evidence/i }).click();
  await page.getByLabel(/what was it\?/i).fill("Traversal drill");
  await page.getByLabel(/^score$/i).fill("8");
  await page.getByLabel(/out of/i).fill("10");
  await page.getByRole("button", { name: /^record evidence$/i }).click();
  await expect(page.getByText("Traversal drill")).toBeVisible();

  await connectVaultAndScan(page);
  const row = page.locator("li", { hasText: "Binary Trees.md" }).first();
  await row.getByRole("combobox", { name: /link binary trees.*knowledge topic/i }).selectOption({
    label: "Binary Trees",
  });
  await row.getByRole("button", { name: /^link$/i }).click();
  await expect(row.getByText(/linked to Binary Trees/i)).toBeVisible();

  // simulate an external editor deleting the file, then the index shows it stale
  await page.getByRole("button", { name: /simulate removing Binary Trees\.md/i }).click();
  await expect(page.getByText(/missing \/ stale/i).first()).toBeVisible();

  // Knowledge is fully intact
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  await expect(page.getByText("Traversal drill")).toBeVisible();
  await expect(page.getByText("8 / 10")).toBeVisible();
  await expect(page.getByText(/Linked Notes — Obsidian \(1\)/)).toBeVisible();
  await expect(page.getByText(/missing \/ stale/i).first()).toBeVisible();

  // reload — link + stale state + evidence all persist
  await hardReload(page);
  await hashTo(page, "#/knowledge", /Knowledge/i);
  await page.getByRole("link", { name: /Binary Trees/ }).first().click();
  await expect(page.getByText("Traversal drill")).toBeVisible();
  await expect(page.getByText(/missing \/ stale/i).first()).toBeVisible();
});

test("the Notes Hub has no critical/serious a11y violations once a vault is connected", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await freshBoot(page);
  await addTopic(page, "Binary Trees");
  await connectVaultAndScan(page);
  // Scoped to the indexed-note rows + their link/open controls (the surface this
  // batch adds). The AppShell command-search box and shared Card <h3> tokens are
  // a pre-existing global contrast item owned by Batch 9.
  const results = await new AxeBuilder({ page })
    .include('[data-testid="notes-hub-list"]')
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === "critical" || v.impact === "serious",
  );
  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
});
