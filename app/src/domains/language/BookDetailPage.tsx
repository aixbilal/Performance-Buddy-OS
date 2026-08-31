import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { useKnowledge } from "../knowledge/store";
import { useObsidian } from "../obsidian/store";
import { useLanguage } from "./store";
import { BOOK_STATUSES } from "./types";

const TONE = {
  reading: "success",
  completed: "neutral",
  paused: "warning",
  "to-read": "neutral",
} as const;
const STATUS_LABEL = (s: string) =>
  s === "to-read" ? "To read" : s.charAt(0).toUpperCase() + s.slice(1);
const todayIso = () => new Date().toISOString().slice(0, 10);

export function BookDetailPage() {
  const { bookId } = useParams();
  const navigate = useNavigate();
  const lang = useLanguage();
  const { topics } = useKnowledge();
  const obs = useObsidian();
  const book = lang.getBook(bookId ?? "");

  const [page, setPage] = useState("");
  const [chapter, setChapter] = useState("");
  const [rsFrom, setRsFrom] = useState("");
  const [rsTo, setRsTo] = useState("");
  const [rsMin, setRsMin] = useState("20");
  const [rsErr, setRsErr] = useState<string | null>(null);

  if (!book) {
    return (
      <div className="space-y-3">
        <Link to="/language" className="text-text-muted text-xs hover:text-text-secondary">
          ← Reading &amp; Language
        </Link>
        <p className="text-text-muted text-sm">Book not found.</p>
      </div>
    );
  }

  const rp = lang.getReadingProgress(book);
  const readingSessions = lang.getReadingSessionsForBook(book.id);
  const linkedTopic = book.knowledgeTopicId
    ? topics.find((t) => t.id === book.knowledgeTopicId)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/language" className="text-text-muted text-xs hover:text-text-secondary">
            ← Reading &amp; Language
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">
            {book.title}
            {book.archived && (
              <span className="ml-2">
                <Badge>archived</Badge>
              </span>
            )}
          </h2>
          <p className="text-text-muted text-sm">{book.author || "unknown author"}</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={lang.saveState} />
          <Badge tone={TONE[book.status]}>{STATUS_LABEL(book.status)}</Badge>
          <button
            onClick={() => navigate(`/language/books/${book.id}/edit`)}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Edit
          </button>
          <button
            onClick={() => lang.archiveBook(book.id, !book.archived)}
            className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-text-secondary"
          >
            {book.archived ? "Unarchive" : "Archive"}
          </button>
          <button
            onClick={() => {
              lang.deleteBook(book.id);
              navigate("/language");
            }}
            className="px-3 py-1.5 rounded-md text-text-muted text-xs hover:text-status-danger"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Reading progress</div>
          {rp.percent === null ? (
            <>
              <div className="text-text-primary text-lg font-semibold">Page {rp.currentPage}</div>
              <p className="text-text-disabled text-[11px] mt-1">
                Total pages not tracked — a percent isn't shown. This is not 0%. Add a total on Edit
                to see one.
              </p>
            </>
          ) : (
            <>
              <div className="text-text-primary text-lg font-semibold">{rp.percent}%</div>
              <p className="text-text-disabled text-[11px] mt-1">
                Page {rp.currentPage} of {rp.totalPages}
                {book.currentChapter ? ` · chapter ${book.currentChapter}` : ""}. Pages read are
                activity, not understanding.
              </p>
            </>
          )}
          <form
            className="flex items-end gap-2 mt-3"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              lang.updateBookProgress(
                book.id,
                page.trim() === "" ? book.currentPage : Number(page),
                chapter.trim() === "" ? undefined : Number(chapter),
              );
              setPage("");
              setChapter("");
            }}
          >
            <label className="text-text-secondary text-[11px]">
              Set current page
              <input
                value={page}
                onChange={(e) => setPage(e.target.value)}
                aria-label="Set current page"
                type="number"
                placeholder={String(book.currentPage)}
                className="block mt-1 w-24 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </label>
            <label className="text-text-secondary text-[11px]">
              Chapter
              <input
                value={chapter}
                onChange={(e) => setChapter(e.target.value)}
                aria-label="Set current chapter"
                type="number"
                placeholder={String(book.currentChapter)}
                className="block mt-1 w-20 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </label>
            <button
              type="submit"
              className="px-2.5 py-1 rounded bg-action-secondary text-text-primary text-[11px] font-medium"
            >
              Update
            </button>
          </form>
          <div className="flex gap-1.5 mt-3">
            {BOOK_STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => lang.setBookStatus(book.id, s)}
                aria-pressed={book.status === s}
                className={`px-2 py-1 rounded text-[11px] border ${
                  book.status === s
                    ? "bg-action-primary text-text-inverse border-transparent"
                    : "bg-surface-inset text-text-secondary border-border-subtle"
                }`}
              >
                {STATUS_LABEL(s)}
              </button>
            ))}
          </div>
        </Card>

        <Card>
          <div className="text-text-muted text-xs mb-1">Knowledge concept</div>
          {linkedTopic ? (
            <div className="flex items-center justify-between">
              <Link
                to={`/knowledge/${linkedTopic.id}`}
                className="text-text-primary text-sm underline hover:text-text-secondary"
              >
                {linkedTopic.title}
              </Link>
              <button
                onClick={() => lang.unlinkBookTopic(book.id)}
                className="text-text-muted text-[11px] hover:text-text-secondary underline"
              >
                Unlink
              </button>
            </div>
          ) : book.knowledgeTopicId ? (
            <p className="text-text-muted text-xs">
              Linked concept no longer exists — the link was cleared. The book is unaffected.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="book-link-topic">
                Link a Knowledge concept to {book.title}
              </label>
              <select
                id="book-link-topic"
                defaultValue=""
                onChange={(e) => e.target.value && lang.linkBookTopic(book.id, e.target.value)}
                className="bg-surface-inset border border-border-subtle rounded-md px-2 py-1.5 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <option value="">No concept linked</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="text-text-muted text-xs mt-4 mb-1">Note reference</div>
          {book.noteRef ? (
            (() => {
              const vaultConnected =
                obs.hubState === "indexed" || obs.hubState === "empty";
              const matched = vaultConnected
                ? obs.findNoteByReference(book.noteRef)
                : undefined;
              return (
                <p className="text-text-secondary text-xs break-all">
                  {book.noteRef}
                  {matched ? (
                    <span className="block mt-1">
                      <Badge tone="success">matched in vault</Badge>{" "}
                      <button
                        onClick={() => obs.openNote(matched.relativePath)}
                        className="text-text-secondary text-[11px] underline hover:text-text-primary"
                      >
                        Open note
                      </button>
                    </span>
                  ) : vaultConnected ? (
                    <span className="text-text-disabled block text-[11px] mt-0.5">
                      Unresolved — no indexed note in the connected vault matches this reference.
                    </span>
                  ) : (
                    <span className="text-text-disabled block text-[11px] mt-0.5">
                      A plain pointer you entered. Connect a vault in the Notes Hub to resolve it.
                    </span>
                  )}
                </p>
              );
            })()
          ) : (
            <p className="text-text-muted text-xs">
              No note reference. Add one in the book's editor, or link notes from the Notes Hub.
            </p>
          )}
        </Card>
      </div>

      <Card title={`Reading Sessions (${readingSessions.length})`}>
        <form
          className="mb-4 border border-border-subtle rounded-md p-3 flex items-end gap-2 flex-wrap"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await lang.logReadingSession(book.id, {
              date: todayIso(),
              fromPage: rsFrom.trim() === "" ? book.currentPage : Number(rsFrom),
              toPage: rsTo.trim() === "" ? book.currentPage : Number(rsTo),
              durationMinutes: Number(rsMin),
              notes: "",
            });
            if (res.ok) {
              setRsFrom("");
              setRsTo("");
              setRsMin("20");
              setRsErr(null);
            } else {
              setRsErr(res.errors._ ?? Object.values(res.errors)[0] ?? "Invalid session.");
            }
          }}
        >
          <label className="text-text-secondary text-[11px]">
            From page
            <input
              value={rsFrom}
              onChange={(e) => setRsFrom(e.target.value)}
              aria-label="Reading session from page"
              type="number"
              placeholder={String(book.currentPage)}
              className="block mt-1 w-20 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-[11px]">
            To page
            <input
              value={rsTo}
              onChange={(e) => setRsTo(e.target.value)}
              aria-label="Reading session to page"
              type="number"
              className="block mt-1 w-20 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <label className="text-text-secondary text-[11px]">
            Minutes
            <input
              value={rsMin}
              onChange={(e) => setRsMin(e.target.value)}
              aria-label="Reading session minutes"
              type="number"
              className="block mt-1 w-20 bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            />
          </label>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Log Reading
          </button>
          {rsErr && <p className="text-status-danger text-[11px] w-full">{rsErr}</p>}
        </form>
        <p className="text-text-disabled text-[11px] mb-2">
          Logging where you read to advances your page position. It never records Knowledge mastery.
        </p>
        {readingSessions.length === 0 ? (
          <div className="text-text-muted text-xs">No reading sessions yet.</div>
        ) : (
          <div className="space-y-1">
            {readingSessions.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
              >
                <span className="text-text-primary text-sm">
                  {s.date} · p.{s.fromPage}–{s.toPage}
                </span>
                <span className="flex items-center gap-2 text-text-muted text-xs">
                  {s.durationMinutes} min
                  <button
                    onClick={() => lang.deleteReadingSession(s.id)}
                    aria-label={`Delete reading session on ${s.date}`}
                    className="text-[11px] hover:text-status-danger underline"
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
