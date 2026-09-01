import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useObsidian } from "../obsidian/store";
import { useKnowledge } from "./store";
import type { ObsidianNote } from "../obsidian/types";

/**
 * Notes Hub — the V1 Obsidian slice (docs 16.01–16.09).
 *
 * PBOS reads a chosen vault READ-ONLY and indexes METADATA ONLY (path, title,
 * mtime, size, existence). No note bodies are stored; a preview is streamed on
 * demand. The index is disposable — "Refresh" rebuilds it. Linking a note to a
 * Knowledge Topic is a governed reference; it never changes mastery, and a
 * missing file never deletes Knowledge.
 */
export function NotesHubPage() {
  const obs = useObsidian();
  const { topics } = useKnowledge();
  const [pathInput, setPathInput] = useState("");
  const [query, setQuery] = useState("");
  const pathFieldId = useId();
  const searchFieldId = useId();

  const topicName = useMemo(() => {
    const m: Record<string, string> = {};
    for (const t of topics) m[t.id] = t.title;
    return m;
  }, [topics]);

  const results = obs.search(query);
  const isAdapter = obs.backend === "adapter";

  // NOTE: LOADING ≠ NOT-CONNECTED is already handled below via
  // `obs.hubState === "loading"` (the store returns "loading" until the
  // durable Obsidian config resolves) and `obs.actionError` for scan errors.

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/knowledge" className="text-text-muted text-xs hover:text-text-secondary">
            ← Knowledge
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">Notes Hub</h2>
          <p className="text-text-muted text-sm">
            Read-only view of your Obsidian vault. PBOS indexes note metadata only — Obsidian keeps
            the note bodies.
          </p>
        </div>
        <SaveIndicator state={obs.saveState} />
      </div>

      {isAdapter && (
        <div
          role="note"
          className="bg-surface-inset border border-border-subtle rounded-md px-4 py-2 text-xs text-text-secondary"
        >
          Browser preview: this uses a small demo-vault adapter, not your real filesystem. Real
          vault reads run in the desktop app.
        </div>
      )}

      {obs.actionError && (
        <div
          role="alert"
          className="bg-status-danger/10 border border-status-danger/30 rounded-md px-4 py-3 text-xs text-status-danger"
        >
          {obs.actionError}
        </div>
      )}

      {obs.hubState === "loading" && (
        <Card>
          <p className="text-text-muted text-sm">Loading vault status…</p>
        </Card>
      )}

      {obs.hubState === "error" && (
        <Card>
          <Badge tone="danger">Vault error</Badge>
          <p className="text-text-secondary text-sm mt-2">
            {obs.loadError ?? "The vault index could not be read."}
          </p>
          <p className="text-text-secondary text-xs mt-1">
            Your Knowledge topics, sources and evidence are unaffected — this is a notes-index
            problem only.
          </p>
        </Card>
      )}

      {obs.hubState === "not-connected" && (
        <Card>
          <div className="flex items-center gap-2 mb-2">
            <Badge tone="warning">No vault connected</Badge>
          </div>
          <p className="text-text-secondary text-sm">
            Choose the folder of the Obsidian vault PBOS may read. Access is read-only and stays
            inside that folder; nothing is written to your notes.
          </p>
          <form
            className="mt-3 flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await obs.connect(pathInput);
              if (res.ok) {
                setPathInput("");
                await obs.refresh();
              }
            }}
          >
            <div className="flex-1 min-w-[16rem]">
              <label htmlFor={pathFieldId} className="block text-text-secondary text-xs mb-1">
                Vault folder path
              </label>
              <input
                id={pathFieldId}
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder={isAdapter ? "e.g. demo-vault" : "e.g. C:\\Users\\you\\Obsidian\\Study"}
                className="block w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
            >
              Connect vault
            </button>
          </form>
        </Card>
      )}

      {obs.hubState === "missing" && (
        <Card>
          <Badge tone="danger">Vault offline / missing</Badge>
          <p className="text-text-secondary text-sm mt-2">
            The configured vault at <code className="text-text-primary">{obs.config?.vaultPath}</code>{" "}
            can't be reached. Scanning is paused. Your linked notes are kept as references and your
            Knowledge data is untouched.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => obs.refresh()}
              className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
            >
              Try reconnecting
            </button>
            <button
              onClick={() => obs.disconnect()}
              className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
            >
              Disconnect vault
            </button>
          </div>
        </Card>
      )}

      {(obs.hubState === "empty" || obs.hubState === "indexed") && (
        <>
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-text-secondary">
                <span className="text-text-primary font-medium">Connected</span> ·{" "}
                <code className="text-text-muted">{obs.config?.vaultPath}</code>
                {obs.lastScan && (
                  <span className="text-text-muted">
                    {" "}
                    · last scan indexed {obs.lastScan.indexed}, {obs.lastScan.stale} stale,{" "}
                    {obs.lastScan.skippedNonMd} non-Markdown skipped
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => obs.refresh()}
                  className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
                >
                  Refresh index
                </button>
                <button
                  onClick={() => obs.disconnect()}
                  className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </Card>

          {obs.hubState === "empty" ? (
            <Card>
              <EmptyState
                icon="🗂️"
                title="No Markdown notes found"
                description="The vault is connected but no .md files were indexed. Add notes in Obsidian, then Refresh the index."
              />
            </Card>
          ) : (
            <Card title={`Indexed notes (${obs.notes.length})`}>
              <div className="mb-3">
                <label htmlFor={searchFieldId} className="block text-text-secondary text-xs mb-1">
                  Search notes by title, filename or path
                </label>
                <input
                  id={searchFieldId}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. hooks"
                  className="block w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
              </div>
              {results.length === 0 ? (
                <div className="text-text-muted text-xs">No notes match “{query}”.</div>
              ) : (
                <ul className="space-y-1.5" data-testid="notes-hub-list">
                  {results.map((n) => (
                    <NoteRow key={n.id} note={n} topicName={topicName} />
                  ))}
                </ul>
              )}
            </Card>
          )}

          {obs.links.length > 0 && (
            <Card title={`Linked to Knowledge (${obs.links.length})`}>
              <ul className="space-y-1.5">
                {obs.links.map((l) => {
                  const state = obs.resolveLinkState(l);
                  return (
                    <li
                      key={l.id}
                      className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
                    >
                      <div>
                        <div className="text-text-primary text-sm">{l.title}</div>
                        <div className="text-text-muted text-xs">{l.relativePath}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {state === "ok" && <Badge tone="success">in vault</Badge>}
                        {state === "stale" && <Badge tone="danger">missing / stale</Badge>}
                        {state === "unindexed" && <Badge tone="warning">not indexed</Badge>}
                        <Link
                          to={`/knowledge/${l.topicId}`}
                          className="text-text-secondary text-xs underline hover:text-text-primary"
                        >
                          {topicName[l.topicId] ?? "topic"}
                        </Link>
                        <button
                          onClick={() => obs.unlinkNote(l.id)}
                          aria-label={`Unlink ${l.title} from ${topicName[l.topicId] ?? "topic"}`}
                          className="text-text-muted text-[11px] hover:text-status-danger underline"
                        >
                          Unlink
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {isAdapter && obs.simulateExternalRemoval && obs.notes.some((n) => n.existsOnDisk) && (
            <Card title="Preview tools">
              <p className="text-text-secondary text-[11px] mb-2">
                Demo adapter only — mimic an external editor deleting a file, then the index shows
                it as stale on the next scan.
              </p>
              <div className="flex flex-wrap gap-2">
                {obs.notes
                  .filter((n) => n.existsOnDisk)
                  .map((n) => (
                    <button
                      key={n.id}
                      onClick={() => obs.simulateExternalRemoval?.([n.relativePath])}
                      aria-label={`Simulate removing ${n.relativePath} from the vault`}
                      className="px-2 py-1 rounded bg-action-secondary text-text-primary text-[11px]"
                    >
                      Remove {n.filename}
                    </button>
                  ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function NoteRow({
  note,
  topicName,
}: {
  note: ObsidianNote;
  topicName: Record<string, string>;
}) {
  const obs = useObsidian();
  const { topics } = useKnowledge();
  const [pick, setPick] = useState("");
  const selectId = useId();
  const linkedHere = obs.links.filter((l) => l.relativePath === note.relativePath);

  return (
    <li className="py-2 border-b border-border-subtle last:border-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-text-primary text-sm flex items-center gap-2">
            {note.title}
            {!note.existsOnDisk && <Badge tone="danger">missing / stale</Badge>}
          </div>
          <div className="text-text-secondary text-xs truncate">{note.relativePath}</div>
          {linkedHere.length > 0 && (
            <div className="text-text-secondary text-[11px] mt-0.5">
              linked to {linkedHere.map((l) => topicName[l.topicId] ?? "topic").join(", ")}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => obs.openNote(note.relativePath)}
            aria-label={`Open ${note.title} in Obsidian`}
            disabled={!note.existsOnDisk}
            className="text-text-secondary text-[11px] underline hover:text-text-primary disabled:opacity-40 disabled:no-underline"
          >
            Open
          </button>
          <button
            onClick={() => obs.revealNote(note.relativePath)}
            aria-label={`Reveal ${note.title} in the file manager`}
            disabled={!note.existsOnDisk}
            className="text-text-secondary text-[11px] underline hover:text-text-primary disabled:opacity-40 disabled:no-underline"
          >
            Reveal
          </button>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <label htmlFor={selectId} className="sr-only">
          Link {note.title} to a Knowledge topic
        </label>
        <select
          id={selectId}
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <option value="">Link to a Knowledge topic…</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
        <button
          onClick={async () => {
            if (!pick) return;
            const res = await obs.linkNote(pick, note.relativePath);
            if (res.ok) setPick("");
          }}
          disabled={!pick}
          className="px-2 py-1 rounded bg-action-primary text-text-inverse text-[11px] font-medium disabled:opacity-40"
        >
          Link
        </button>
      </div>
    </li>
  );
}
