// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeObsidianRepo } from "./repo";

// Force the browser-dev adapter (no Tauri).
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

beforeEach(() => window.localStorage.clear());

describe("ObsidianRepo — browser-dev adapter", () => {
  it("is the adapter, not sqlite, and starts with no config", async () => {
    const repo = makeObsidianRepo();
    expect(repo.kind).toBe("adapter");
    const g = await repo.load();
    expect(g.config).toBeNull();
    expect(g.notes).toEqual([]);
    expect(g.links).toEqual([]);
  });

  it("connect seeds a demo vault; scan indexes .md only and counts non-md skipped", async () => {
    const repo = makeObsidianRepo();
    const cfg = await repo.connect("demo-vault");
    expect(cfg.status).toBe("connected");
    // connect does not scan
    expect((await repo.load()).notes).toEqual([]);

    const report = await repo.scan();
    expect(report.indexed).toBeGreaterThanOrEqual(3);
    expect(report.skippedNonMd).toBeGreaterThanOrEqual(1); // .txt + .png in the fixture
    const g = await repo.load();
    const paths = g.notes.map((n) => n.relativePath);
    expect(paths).toContain("Binary Trees.md");
    expect(paths).toContain("React/Hooks.md");
    expect(paths.some((p) => p.endsWith(".txt") || p.endsWith(".png"))).toBe(false);
  });

  it("a link is keyed by path and survives a rescan; an externally-removed linked file goes stale, not gone", async () => {
    const repo = makeObsidianRepo();
    await repo.connect("demo-vault");
    await repo.scan();
    await repo.linkNote("kt1", "Binary Trees.md");
    expect((await repo.load()).links).toHaveLength(1);

    await repo.simulateExternalRemoval!(["Binary Trees.md"]);
    const g = await repo.load();
    // link kept
    expect(g.links.map((l) => l.relativePath)).toEqual(["Binary Trees.md"]);
    // note retained as stale (because a link references it), not deleted
    const bt = g.notes.find((n) => n.relativePath === "Binary Trees.md");
    expect(bt?.existsOnDisk).toBe(false);
  });

  it("an unlinked missing file is purged on rescan (disposable index)", async () => {
    const repo = makeObsidianRepo();
    await repo.connect("demo-vault");
    await repo.scan();
    await repo.simulateExternalRemoval!(["Notes/Ideas.md"]);
    const g = await repo.load();
    expect(g.notes.some((n) => n.relativePath === "Notes/Ideas.md")).toBe(false);
  });

  it("disconnect clears the disposable index but keeps links; files (fixture disk) untouched", async () => {
    const repo = makeObsidianRepo();
    await repo.connect("demo-vault");
    await repo.scan();
    await repo.linkNote("kt1", "React/Hooks.md");
    await repo.disconnect();
    const g = await repo.load();
    expect(g.notes).toEqual([]);
    expect(g.links).toHaveLength(1);
    expect(g.config?.status).toBe("disconnected");
    // reconnect + rescan brings the index back
    await repo.connect("demo-vault");
    const report = await repo.scan();
    expect(report.indexed).toBeGreaterThanOrEqual(3);
  });

  it("readNote returns bounded content; open/reveal honestly fail in the browser", async () => {
    const repo = makeObsidianRepo();
    await repo.connect("demo-vault");
    await repo.scan();
    const preview = await repo.readNote("Binary Trees.md");
    expect(preview.content).toContain("# Binary Trees");
    await expect(repo.openNote("Binary Trees.md")).rejects.toThrow(/desktop app/i);
    await expect(repo.revealNote("Binary Trees.md")).rejects.toThrow(/desktop app/i);
  });

  it("linkNote is idempotent per (topic, path)", async () => {
    const repo = makeObsidianRepo();
    await repo.connect("demo-vault");
    await repo.scan();
    await repo.linkNote("kt1", "React/Hooks.md");
    await repo.linkNote("kt1", "React/Hooks.md");
    expect((await repo.load()).links).toHaveLength(1);
  });
});
