/**
 * Performance Buddy OS — Obsidian vault boundary (Batch 5).
 *
 * OWNERSHIP LOCK (docs 16.01): Obsidian owns the authoritative Markdown note
 * body. PBOS owns metadata + governed references only. There is no note-body
 * field anywhere in this model — a preview is read on demand and never stored.
 *
 *   Knowledge Topic ≠ Obsidian Note
 *   Knowledge Evidence ≠ Obsidian Note
 *   Note linked ≠ Mastery   ·   Note read ≠ Mastery
 *
 * The index is DISPOSABLE — a rescan can wipe and rebuild `notes` with zero
 * data loss. A `NoteLink` is keyed by the stable relative path so it SURVIVES a
 * rescan and a missing file; the Knowledge Topic is never touched because a
 * file moved.
 */

export type VaultStatus = "connected" | "disconnected" | "missing";

/** Persisted single-row vault configuration (mirrors `obsidian_config`). */
export type ObsidianConfig = {
  vaultPath: string;
  vaultId: string;
  status: VaultStatus;
  connectedAt: string | null;
  lastScanAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/** One indexed Markdown file — METADATA ONLY (mirrors `obsidian_notes`). */
export type ObsidianNote = {
  id: string;
  relativePath: string;
  title: string;
  filename: string;
  /** Opaque filesystem modification marker (epoch ms as a string) or null. */
  modifiedAt: string | null;
  sizeBytes: number;
  /** false = indexed before, now missing on disk — shown as "stale". */
  existsOnDisk: boolean;
  indexedAt: string;
};

/** A governed Knowledge-Topic ↔ note reference (mirrors `knowledge_topic_note_links`). */
export type NoteLink = {
  id: string;
  topicId: string;
  relativePath: string;
  title: string;
  linkedAt: string;
};

export type ObsidianGraph = {
  config: ObsidianConfig | null;
  notes: ObsidianNote[];
  links: NoteLink[];
};

export type ScanReport = {
  indexed: number;
  stale: number;
  skippedNonMd: number;
};

export type NotePreview = {
  relativePath: string;
  content: string;
  truncated: boolean;
};

/** The Notes Hub's mutually-exclusive top-level states (docs 16.02 / 18). */
export type HubState =
  | "loading"
  | "not-connected"
  | "empty" // connected, zero Markdown found
  | "indexed"
  | "missing" // configured vault is offline / gone
  | "error";

/** Resolution of a linked note against the current index. */
export type LinkResolution = "ok" | "stale" | "unindexed";
