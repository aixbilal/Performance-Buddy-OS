/**
 * Native desktop E2E — proves WebdriverIO drives the REAL Performance Buddy OS
 * renderer inside the packaged Tauri window (Batch 0 infrastructure proof).
 *
 * Interaction goes through `browser.tauri.execute(fn)` (from @wdio/tauri-service
 * + tauri-plugin-wdio), which runs JS inside the actual PBOS frontend — the
 * supported, reliable path on Windows/WebView2. Everything asserted below is
 * the real renderer, real routes, and a real click handler firing.
 *
 * Not a full suite. It must: launch PBOS, see the real renderer, locate a real
 * PBOS element, interact with a real control, navigate two routes, assert state.
 */

// @wdio/tauri-service augments `browser` with `.tauri`; declare it loosely here.
declare const browser: WebdriverIO.Browser & {
  tauri: { execute: <T>(fn: () => T) => Promise<T> };
};

async function frontendText(): Promise<string> {
  return await browser.tauri.execute(() => document.body?.innerText || "");
}

describe("PBOS native desktop shell — renderer E2E", () => {
  it("renders the real app, fires a real control, and navigates two routes", async () => {
    // 1. Real renderer: past the startup splash the PBOS app shell has mounted.
    await browser.waitUntil(
      async () => /Today|Focus Mode|Goals|Onboarding/.test(await frontendText()),
      { timeout: 60_000, timeoutMsg: "PBOS app shell never rendered" },
    );

    const hasRoot = await browser.tauri.execute(
      () => !!document.getElementById("root") && document.getElementById("root")!.childElementCount > 0,
    );
    expect(hasRoot).toBe(true);

    // 2. Route one — Focus. Locate a real element, fire its real click handler.
    await browser.tauri.execute(() => {
      window.location.hash = "#/focus";
    });
    await browser.waitUntil(async () => (await frontendText()).includes("Focus Mode"), {
      timeout: 20_000,
      timeoutMsg: "Focus route did not render",
    });

    const clickedStart = await browser.tauri.execute(() => {
      const btn = [...document.querySelectorAll("button")].find(
        (b) => b.textContent?.trim() === "Start",
      ) as HTMLButtonElement | undefined;
      if (!btn) return false;
      btn.click();
      return true;
    });
    expect(clickedStart).toBe(true);

    await browser.waitUntil(async () => (await frontendText()).includes("Pause"), {
      timeout: 15_000,
      timeoutMsg: "Focus session did not start after the real Start click",
    });

    // 3. Route two — Goals. Assert the resulting UI state.
    await browser.tauri.execute(() => {
      window.location.hash = "#/goals";
    });
    await browser.waitUntil(async () => (await frontendText()).includes("Active Goals"), {
      timeout: 20_000,
      timeoutMsg: "Goals route did not render",
    });

    const goalsText = await frontendText();
    expect(goalsText).toContain("Active Goals");
    expect(goalsText).toContain("GOALS NEEDING ATTENTION");
  });

  it("persists through the real Tauri → Rust → SQLite path", async () => {
    // db_status proves the migrated schema is live.
    const status = await browser.tauri.execute(() =>
      (window as unknown as { __TAURI__: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } } }).__TAURI__.core.invoke("db_status"),
    );
    expect((status as { schema_version: number }).schema_version).toBe(1);
    expect((status as { localstorage_migrated: boolean }).localstorage_migrated).toBe(true);

    // Write via the real command, then read it back via the real command.
    const probeKey = "pbos:__e2e_probe__";
    await browser.tauri.execute(() =>
      (window as unknown as { __TAURI__: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } } }).__TAURI__.core.invoke("kv_set", {
        key: "pbos:__e2e_probe__",
        value: JSON.stringify({ ok: true, n: 3 }),
      }),
    );
    const all = (await browser.tauri.execute(() =>
      (window as unknown as { __TAURI__: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } } }).__TAURI__.core.invoke("kv_get_all"),
    )) as { key: string; value: string }[];

    const probe = all.find((e) => e.key === probeKey);
    expect(probe).toBeTruthy();
    expect(JSON.parse(probe!.value)).toEqual({ ok: true, n: 3 });

    // No duplication: exactly one row for the key.
    expect(all.filter((e) => e.key === probeKey)).toHaveLength(1);

    // Clean up the probe so reruns start clean.
    await browser.tauri.execute(() =>
      (window as unknown as { __TAURI__: { core: { invoke: (c: string, a?: unknown) => Promise<unknown> } } }).__TAURI__.core.invoke("kv_delete", { key: "pbos:__e2e_probe__" }),
    );
  });
});
