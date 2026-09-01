/**
 * Persistence for the Obsidian vault boundary.
 *
 *   store.tsx  ->  ObsidianRepo  ->  { obsidian_* Tauri commands -> Rust -> real FS + SQLite }
 *                               \->  { a browser-dev ADAPTER over localStorage }
 *
 * The browser adapter is NOT a native filesystem. It is an explicitly-labelled
 * demo vault so the Notes Hub UI + its states can be exercised without Tauri
 * (per the Batch 5 brief §29: "DO NOT fake native filesystem claims. Use a
 * controlled repository/adapter UI workflow for browser tests."). Real
 * filesystem correctness is proven by the Rust tests in `obsidian.rs`.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import { assertObsidianScanOk } from "../persistence/testControls";
import { devNoteId } from "./engine";
import type {
  NotePreview,
  ObsidianConfig,
  ObsidianGraph,
  ObsidianNote,
  ScanReport,
} from "./types";

export interface ObsidianRepo {
  readonly kind: "sqlite" | "adapter";
  load(): Promise<ObsidianGraph>;
  connect(path: string): Promise<ObsidianConfig>;
  disconnect(): Promise<void>;
  scan(): Promise<ScanReport>;
  linkNote(topicId: string, relativePath: string): Promise<void>;
  unlinkNote(id: string): Promise<void>;
  readNote(relativePath: string): Promise<NotePreview>;
  openNote(relativePath: string): Promise<void>;
  revealNote(relativePath: string): Promise<void>;
  /** Dev-adapter only — simulate an external editor removing files, then rescan. */
  simulateExternalRemoval?(relativePaths: string[]): Promise<void>;
}

// --- Tauri / real filesystem + SQLite -----------------------------------

class SqliteRepo implements ObsidianRepo {
  readonly kind = "sqlite" as const;
  async load() {
    return await invoke<ObsidianGraph>("obsidian_load");
  }
  async connect(path: string) {
    return await invoke<ObsidianConfig>("obsidian_connect_vault", { path });
  }
  async disconnect() {
    await invoke("obsidian_disconnect_vault");
  }
  async scan() {
    return await invoke<ScanReport>("obsidian_scan");
  }
  async linkNote(topicId: string, relativePath: string) {
    await invoke("obsidian_link_note", { topicId, relativePath });
  }
  async unlinkNote(id: string) {
    await invoke("obsidian_unlink_note", { id });
  }
  async readNote(relativePath: string) {
    return await invoke<NotePreview>("obsidian_read_note", { relativePath });
  }
  async openNote(relativePath: string) {
    await invoke("obsidian_open_note", { relativePath });
  }
  async revealNote(relativePath: string) {
    await invoke("obsidian_reveal_note", { relativePath });
  }
}

// --- Browser-dev adapter (localStorage) --------------------------------

type DiskFile = {
  relativePath: string;
  title: string;
  content: string;
  modifiedAt: string;
  sizeBytes: number;
};

const K_CONFIG = "pbos:obsidian-config-v1";
const K_DISK = "pbos:obsidian-disk-v1"; // the simulated "files on the user's machine"
const K_NOTES = "pbos:obsidian-notes-v1"; // the disposable index
const K_LINKS = "pbos:obsidian-links-v1";

/** A tiny demo vault materialised the first time a path is connected. */
const FIXTURE_DISK: DiskFile[] = [
  { relativePath: "Binary Trees.md", title: "Binary Trees", content: "# Binary Trees\n\nTraversals, balancing, and BST invariants.\n", modifiedAt: "1", sizeBytes: 62 },
  { relativePath: "React/Hooks.md", title: "Hooks", content: "# Hooks\n\nuseState, useEffect, useMemo.\n", modifiedAt: "2", sizeBytes: 40 },
  { relativePath: "React/Effects deep dive.md", title: "Effects deep dive", content: "no heading here, just prose\n", modifiedAt: "3", sizeBytes: 27 },
  { relativePath: "Notes/Ideas.md", title: "Ideas", content: "# Ideas\n\n- ship batch 5\n", modifiedAt: "4", sizeBytes: 24 },
  { relativePath: "Attachments/diagram.png", title: "diagram", content: "", modifiedAt: "5", sizeBytes: 999 },
  { relativePath: "scratch.txt", title: "scratch", content: "todo", modifiedAt: "6", sizeBytes: 4 },
];

const PREVIEW_MAX = 64 * 1024;
const nowMs = () => String(Date.now());
const isMd = (p: string) => /\.(md|markdown)$/i.test(p);

class AdapterRepo implements ObsidianRepo {
  readonly kind = "adapter" as const;

  private read<T>(k: string, fallback: T): T {
    try {
      const raw = window.localStorage.getItem(k);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }
  private write(k: string, v: unknown) {
    window.localStorage.setItem(k, JSON.stringify(v));
  }

  private disk(): DiskFile[] {
    return this.read<DiskFile[]>(K_DISK, []);
  }

  async load(): Promise<ObsidianGraph> {
    return {
      config: this.read<ObsidianConfig | null>(K_CONFIG, null),
      notes: this.read<ObsidianNote[]>(K_NOTES, []),
      links: this.read(K_LINKS, []),
    };
  }

  async connect(path: string): Promise<ObsidianConfig> {
    if (!path.trim()) throw new Error("Enter a vault folder path.");
    if (!window.localStorage.getItem(K_DISK)) this.write(K_DISK, FIXTURE_DISK);
    const existing = this.read<ObsidianConfig | null>(K_CONFIG, null);
    const cfg: ObsidianConfig = {
      vaultPath: path.trim(),
      vaultId: `vault_${devNoteId(path.trim()).slice(5)}`,
      status: "connected",
      connectedAt: nowMs(),
      lastScanAt: null,
      createdAt: existing?.createdAt ?? nowMs(),
      updatedAt: nowMs(),
    };
    this.write(K_CONFIG, cfg);
    return cfg;
  }

  async disconnect(): Promise<void> {
    const cfg = this.read<ObsidianConfig | null>(K_CONFIG, null);
    if (cfg) this.write(K_CONFIG, { ...cfg, status: "disconnected", lastScanAt: null, updatedAt: nowMs() });
    this.write(K_NOTES, []); // disposable index cleared; links + disk untouched
  }

  async scan(): Promise<ScanReport> {
    assertObsidianScanOk(); // dev/test-only scan-failure injection (no-op in production)
    const cfg = this.read<ObsidianConfig | null>(K_CONFIG, null);
    if (!cfg) throw new Error("No vault connected.");
    const disk = this.disk();
    const mdFiles = disk.filter((f) => isMd(f.relativePath));
    const skippedNonMd = disk.length - mdFiles.length;
    const links = this.read<{ relativePath: string }[]>(K_LINKS, []);
    const linkedPaths = new Set(links.map((l) => l.relativePath));

    const prev = this.read<ObsidianNote[]>(K_NOTES, []);
    const onDisk = new Set(mdFiles.map((f) => f.relativePath));
    const next: ObsidianNote[] = mdFiles.map((f) => ({
      id: devNoteId(f.relativePath),
      relativePath: f.relativePath,
      title: f.title,
      filename: f.relativePath.split("/").pop() ?? f.relativePath,
      modifiedAt: f.modifiedAt,
      sizeBytes: f.sizeBytes,
      existsOnDisk: true,
      indexedAt: nowMs(),
    }));
    // keep previously-indexed-but-now-missing rows only if a Topic links them
    let stale = 0;
    for (const p of prev) {
      if (!onDisk.has(p.relativePath) && linkedPaths.has(p.relativePath)) {
        next.push({ ...p, existsOnDisk: false, indexedAt: nowMs() });
        stale++;
      }
    }
    next.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
    this.write(K_NOTES, next);
    this.write(K_CONFIG, { ...cfg, status: "connected", lastScanAt: nowMs(), updatedAt: nowMs() });
    return { indexed: mdFiles.length, stale, skippedNonMd };
  }

  async linkNote(topicId: string, relativePath: string): Promise<void> {
    const rel = relativePath.trim();
    const links = this.read<
      { id: string; topicId: string; relativePath: string; title: string; linkedAt: string }[]
    >(K_LINKS, []);
    if (links.some((l) => l.topicId === topicId && l.relativePath === rel)) return;
    const note = this.read<ObsidianNote[]>(K_NOTES, []).find((n) => n.relativePath === rel);
    links.push({
      id: `lnk_${devNoteId(`${topicId}|${rel}`).slice(5)}`,
      topicId,
      relativePath: rel,
      title: note?.title ?? (rel.split("/").pop() ?? rel).replace(/\.md$/i, ""),
      linkedAt: nowMs(),
    });
    this.write(K_LINKS, links);
  }

  async unlinkNote(id: string): Promise<void> {
    this.write(
      K_LINKS,
      this.read<{ id: string }[]>(K_LINKS, []).filter((l) => l.id !== id),
    );
  }

  async readNote(relativePath: string): Promise<NotePreview> {
    const f = this.disk().find((x) => x.relativePath === relativePath.trim());
    if (!f) throw new Error("note file is missing from the vault");
    return {
      relativePath: f.relativePath,
      content: f.content.slice(0, PREVIEW_MAX),
      truncated: f.content.length > PREVIEW_MAX,
    };
  }

  async openNote(): Promise<void> {
    throw new Error("Opening files in Obsidian needs the desktop app — not available in the browser preview.");
  }
  async revealNote(): Promise<void> {
    throw new Error("Revealing files in your file manager needs the desktop app — not available in the browser preview.");
  }

  async simulateExternalRemoval(relativePaths: string[]): Promise<void> {
    const gone = new Set(relativePaths);
    this.write(
      K_DISK,
      this.disk().filter((f) => !gone.has(f.relativePath)),
    );
    await this.scan();
  }
}

export function makeObsidianRepo(): ObsidianRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new AdapterRepo();
}
