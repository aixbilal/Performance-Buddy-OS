/**
 * Durable persistence for the Quick Capture inbox.
 *
 *   store.tsx  ->  CaptureRepo  ->  { Tauri commands -> Rust -> SQLite }
 *                              \->  { localStorage JSON }  (browser dev only)
 *
 * The inbox holds UNRESOLVED raw capture only. Resolved rows keep a light
 * `resolution` record (what engine handled it) — never the resulting entity.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { CaptureInboxItem, CaptureProposal, CaptureResolution, CaptureType } from "./types";

export type CaptureImportReport = { ran: boolean; itemsImported: number };

export interface CaptureRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<CaptureInboxItem[]>;
  upsert(item: CaptureInboxItem): Promise<void>;
  remove(id: string): Promise<void>;
  importItems(items: CaptureInboxItem[]): Promise<CaptureImportReport>;
}

// --- wire row (matches capture.rs CaptureInboxRow) ----------------------

type CaptureRow = {
  id: string;
  rawText: string;
  proposedType: string | null;
  parsedPayload: string | null;
  status: string;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
};

const CAPTURE_TYPES: CaptureType[] = ["action", "expense", "routine-checkin", "note", "unclassified"];

function toRow(i: CaptureInboxItem): CaptureRow {
  return {
    id: i.id,
    rawText: i.rawText,
    proposedType: i.proposal?.type ?? null,
    parsedPayload: i.proposal
      ? JSON.stringify({ confidence: i.proposal.confidence, fields: i.proposal.fields })
      : null,
    status: i.status,
    resolution: i.resolution ? JSON.stringify(i.resolution) : null,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function fromRow(r: CaptureRow): CaptureInboxItem {
  let proposal: CaptureProposal | null = null;
  if (r.proposedType && CAPTURE_TYPES.includes(r.proposedType as CaptureType)) {
    let confidence: "high" | "low" = "low";
    let fields: Record<string, string | number> = {};
    try {
      const p = r.parsedPayload ? JSON.parse(r.parsedPayload) : {};
      confidence = p.confidence === "high" ? "high" : "low";
      fields = p.fields && typeof p.fields === "object" ? p.fields : {};
    } catch {
      /* corrupt payload — keep the type, drop the fields */
    }
    proposal = { type: r.proposedType as CaptureType, confidence, fields };
  }
  let resolution: CaptureResolution | null = null;
  if (r.resolution) {
    try {
      resolution = JSON.parse(r.resolution) as CaptureResolution;
    } catch {
      resolution = null;
    }
  }
  return {
    id: r.id,
    rawText: r.rawText,
    status: r.status === "proposed" ? "proposed" : r.status === "resolved" ? "resolved" : "unprocessed",
    proposal,
    resolution,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

// --- Tauri / SQLite --------------------------------------------------

class SqliteRepo implements CaptureRepo {
  readonly kind = "sqlite" as const;
  async load() {
    const rows = await invoke<CaptureRow[]>("capture_load");
    return rows.map(fromRow);
  }
  async upsert(item: CaptureInboxItem) {
    await invoke("capture_upsert", { item: toRow(item) });
  }
  async remove(id: string) {
    await invoke("capture_delete", { id });
  }
  async importItems(items: CaptureInboxItem[]) {
    const r = (await invoke("capture_import", { import: { items: items.map(toRow) } })) as Record<
      string,
      unknown
    >;
    return {
      ran: !!r.ran,
      itemsImported: Number(r.itemsImported ?? r.items_imported ?? 0),
    };
  }
}

// --- localStorage (browser dev fallback) --------------------------

const LS_KEY = "pbos:capture-inbox-v2";
const LS_IMPORT_MARK = "pbos:capture-inbox-v2-imported";

export class LocalRepo implements CaptureRepo {
  readonly kind = "localStorage" as const;

  private read(): CaptureInboxItem[] {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as CaptureRow[]).map(fromRow) : [];
    } catch {
      return [];
    }
  }
  private write(items: CaptureInboxItem[]) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items.map(toRow)));
  }

  async load() {
    return this.read().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async upsert(item: CaptureInboxItem) {
    const items = this.read();
    const i = items.findIndex((x) => x.id === item.id);
    if (i >= 0) items[i] = { ...item, createdAt: items[i].createdAt };
    else items.push(item);
    this.write(items);
  }
  async remove(id: string) {
    this.write(this.read().filter((x) => x.id !== id));
  }
  async importItems(incoming: CaptureInboxItem[]): Promise<CaptureImportReport> {
    if (window.localStorage.getItem(LS_IMPORT_MARK)) return { ran: false, itemsImported: 0 };
    const items = this.read();
    let itemsImported = 0;
    for (const it of incoming) {
      if (items.some((x) => x.id === it.id)) continue;
      items.push(it);
      itemsImported++;
    }
    this.write(items);
    window.localStorage.setItem(LS_IMPORT_MARK, new Date().toISOString());
    return { ran: true, itemsImported };
  }
}

export function makeCaptureRepo(): CaptureRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
