/**
 * Durable persistence for Mastery Checks (Batch 4).
 *
 *   masteryStore.tsx  ->  MasteryRepo  ->  { study_* Tauri commands -> Rust -> SQLite }
 *                                      \->  { localStorage JSON }  (browser dev only)
 *
 * `linkEvidence` is the idempotent evidence handoff — it sets `evidenceId` only
 * if currently null and returns the effective id.
 */
import { invoke, isTauri } from "@tauri-apps/api/core";
import type { MasteryCheck, MasteryItem } from "./masteryTypes";

type WireCheck = Omit<MasteryCheck, "items"> & { items: string };

const toWire = (c: MasteryCheck): WireCheck => ({ ...c, items: JSON.stringify(c.items) });
function fromWire(w: Record<string, unknown>): MasteryCheck {
  let items: MasteryItem[] = [];
  try {
    const parsed = typeof w.items === "string" ? JSON.parse(w.items) : w.items;
    if (Array.isArray(parsed)) items = parsed as MasteryItem[];
  } catch {
    /* corrupt items — keep the row, drop the detail */
  }
  return {
    id: String(w.id),
    academicTopicId: (w.academicTopicId as string | null) ?? null,
    knowledgeTopicId: (w.knowledgeTopicId as string | null) ?? null,
    courseId: (w.courseId as string | null) ?? null,
    topicTitle: String(w.topicTitle ?? ""),
    kind: w.kind === "recall" ? "recall" : "self-check",
    items,
    score: Number(w.score ?? 0),
    maxScore: Number(w.maxScore ?? 0),
    status: w.status === "completed" ? "completed" : "in-progress",
    evidenceId: (w.evidenceId as string | null) ?? null,
    createdAt: String(w.createdAt ?? ""),
    updatedAt: String(w.updatedAt ?? ""),
    completedAt: (w.completedAt as string | null) ?? null,
  };
}

export interface MasteryRepo {
  readonly kind: "sqlite" | "localStorage";
  load(): Promise<MasteryCheck[]>;
  upsert(check: MasteryCheck): Promise<void>;
  remove(id: string): Promise<void>;
  linkEvidence(checkId: string, evidenceId: string): Promise<string | null>;
}

// --- Tauri / SQLite ----------------------------------------------------

class SqliteRepo implements MasteryRepo {
  readonly kind = "sqlite" as const;
  async load() {
    const g = await invoke<{ masteryChecks: Record<string, unknown>[] }>("study_load");
    return (g.masteryChecks ?? []).map(fromWire);
  }
  async upsert(check: MasteryCheck) {
    await invoke("study_mastery_check_upsert", { check: toWire(check) });
  }
  async remove(id: string) {
    await invoke("study_mastery_check_delete", { id });
  }
  async linkEvidence(checkId: string, evidenceId: string) {
    return (await invoke<string | null>("study_mastery_link_evidence", { checkId, evidenceId })) ?? null;
  }
}

// --- localStorage (browser dev fallback) -----------------------------

const LS_KEY = "pbos:mastery-checks-v2";

export class LocalRepo implements MasteryRepo {
  readonly kind = "localStorage" as const;

  private read(): MasteryCheck[] {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const v = JSON.parse(raw);
      return Array.isArray(v) ? (v as Record<string, unknown>[]).map(fromWire) : [];
    } catch {
      return [];
    }
  }
  private write(rows: MasteryCheck[]) {
    window.localStorage.setItem(LS_KEY, JSON.stringify(rows.map(toWire)));
  }
  async load() {
    return this.read().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async upsert(check: MasteryCheck) {
    const rows = this.read();
    const i = rows.findIndex((r) => r.id === check.id);
    if (i >= 0) {
      // mirror Rust: the caller does not own evidenceId — preserve the stored one
      rows[i] = { ...check, createdAt: rows[i].createdAt, evidenceId: rows[i].evidenceId };
    } else {
      rows.push({ ...check, evidenceId: null });
    }
    this.write(rows);
  }
  async remove(id: string) {
    this.write(this.read().filter((r) => r.id !== id));
  }
  async linkEvidence(checkId: string, evidenceId: string) {
    const rows = this.read();
    const row = rows.find((r) => r.id === checkId);
    if (!row) return null;
    if (row.evidenceId) return row.evidenceId; // set once, never overwritten
    row.evidenceId = evidenceId;
    row.updatedAt = new Date().toISOString();
    this.write(rows);
    return evidenceId;
  }
}

export function makeMasteryRepo(): MasteryRepo {
  try {
    if (isTauri()) return new SqliteRepo();
  } catch {
    /* fall through */
  }
  return new LocalRepo();
}
