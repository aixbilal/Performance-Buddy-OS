import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright Test — permanent browser/renderer regression + visual QA for the
 * PBOS web frontend (the same bundle Tauri loads in its webview).
 *
 * This is Playwright Test, NOT Playwright MCP.
 *
 * Uses the system-installed Google Chrome (`channel: "chrome"`) so CI/dev boxes
 * do not need to download Playwright's bundled Chromium. To use bundled
 * browsers instead, run `npx playwright install chromium` and drop the channel.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
