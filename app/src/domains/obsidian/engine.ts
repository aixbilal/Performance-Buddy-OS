/**
 * Deterministic Obsidian metadata engine — pure functions, no filesystem.
 *
 * Search is LEXICAL ONLY (docs 16.09): exact → prefix → contains across
 * title / filename / relative path. No vector search, no embeddings, no RAG.
 */

import type { LinkResolution, NoteLink, ObsidianNote } from "./types";

function norm(s: string): string {
  return s.toLowerCase().trim();
}

/** Rank: 0 exact (any field) · 1 prefix · 2 contains · -1 no match. */
export function noteMatchRank(note: ObsidianNote, query: string): number {
  const q = norm(query);
  if (!q) return 2;
  const fields = [note.title, note.filename, note.relativePath].map(norm);
  if (fields.some((f) => f === q || f === `${q}.md`)) return 0;
  if (fields.some((f) => f.startsWith(q))) return 1;
  if (fields.some((f) => f.includes(q))) return 2;
  return -1;
}

/** Deterministic search: filtered by match, then rank, then path A→Z. */
export function searchNotes(notes: ObsidianNote[], query: string): ObsidianNote[] {
  return notes
    .map((n) => ({ n, r: noteMatchRank(n, query) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.n.relativePath.localeCompare(b.n.relativePath))
    .map((x) => x.n);
}

/**
 * Resolve a link against the current index:
 *   ok         — an indexed note exists at that path and is present on disk
 *   stale      — indexed, but the file is gone (existsOnDisk === false)
 *   unindexed  — no index row (vault disconnected, or never scanned that path)
 */
export function resolveLink(link: NoteLink, notes: ObsidianNote[]): LinkResolution {
  const note = notes.find((n) => n.relativePath === link.relativePath);
  if (!note) return "unindexed";
  return note.existsOnDisk ? "ok" : "stale";
}

/** Find an indexed note by an arbitrary free-text reference (path / filename / title). */
export function matchNoteByReference(
  notes: ObsidianNote[],
  reference: string,
): ObsidianNote | undefined {
  const r = norm(reference);
  if (!r) return undefined;
  const bare = r.replace(/\.md$/, "");
  return notes.find((n) => {
    const path = norm(n.relativePath).replace(/\.md$/, "");
    const file = norm(n.filename).replace(/\.md$/, "");
    return path === bare || file === bare || norm(n.title) === r || path.endsWith(`/${bare}`);
  });
}

/** A stable-ish local id for the browser-dev adapter. */
export function devNoteId(relativePath: string): string {
  let h = 0;
  for (let i = 0; i < relativePath.length; i++) h = (h * 31 + relativePath.charCodeAt(i)) | 0;
  return `note_${(h >>> 0).toString(16)}`;
}
