/**
 * Native desktop E2E infrastructure smoke test.
 *
 * Proves the WebdriverIO + @wdio/tauri-service chain is operational on this
 * machine: tauri-driver + msedgedriver launch, a WebView2 WebDriver session is
 * created against the packaged Tauri binary, and WDIO commands round-trip.
 *
 * Driving the PBOS renderer's own DOM (asserting on `#root`, app content, or
 * `browser.tauri.execute()`) additionally requires the `tauri-plugin-wdio`
 * integration in `src-tauri` (plugin + `withGlobalTauri` + a `wdio:default`
 * capability). That is a PBOS product-source change and is intentionally not
 * done here — see the wdio.conf.ts header. Until then the session attaches to a
 * blank WebView2 document, which this test reports but does not fail on.
 */
describe("Performance Buddy OS desktop shell — E2E infrastructure", () => {
  it("creates a live WebView2 session against the Tauri binary", async () => {
    expect(browser.sessionId).toBeTruthy();
    expect(String(browser.capabilities.browserName).toLowerCase()).toContain(
      "webview2",
    );

    // Commands round-trip through tauri-driver -> msedgedriver -> WebView2.
    const url = await browser.getUrl();
    const source = await browser.getPageSource();
    expect(typeof url).toBe("string");
    expect(typeof source).toBe("string");

    console.log(`[e2e] session ${browser.sessionId} | url: ${url}`);
    console.log(
      `[e2e] renderer DOM ${source.length} bytes` +
        (source.includes('id="root"')
          ? " (PBOS #root present)"
          : " (blank webview — tauri-plugin-wdio not integrated)"),
    );
  });
});
