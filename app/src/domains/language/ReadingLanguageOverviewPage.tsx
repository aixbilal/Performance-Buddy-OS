import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { useLanguage } from "./store";
import { Button } from "../../components/Button";

const PATH_TONE = { active: "success", paused: "warning", completed: "neutral" } as const;
const BOOK_TONE = {
  reading: "success",
  completed: "neutral",
  paused: "warning",
  "to-read": "neutral",
} as const;

export function ReadingLanguageOverviewPage() {
  const navigate = useNavigate();
  const lang = useLanguage();

  if (!lang.loaded) return <LoadingState label="Loading reading & language…" />;

  const paths = lang.getActivePaths();
  const books = lang.getActiveBooks();
  const recentSessions = lang.getRecentSessions(5);

  const nothing = lang.loaded && paths.length === 0 && books.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="t-h2 text-text-primary">Reading &amp; Language</h2>
          <p className="text-text-muted text-sm">
            What you're reading and learning, and how far along it is. Time and pages are activity —
            not mastery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={lang.saveState} />
          <Button variant="secondary" onClick={() => navigate("/language/books/new")}>
            Add Book
          </Button>
          <Button variant="primary" onClick={() => navigate("/language/paths/new")}>
            New Language Path
          </Button>
        </div>
      </div>

      {lang.loadError && (
        <div className="bg-status-warning/10 border border-status-warning/30 rounded-md px-4 py-3 text-xs text-status-warning">
          Your saved reading/language data couldn't be read ({lang.loadError}). Nothing was deleted.
        </div>
      )}

      {nothing ? (
        <Card>
          <EmptyState
            icon="📚"
            title="Nothing here yet"
            description="Add a book you're reading, or create a language path to track curriculum progress. Neither needs a Goal."
            primaryAction={{ label: "New Language Path", onClick: () => navigate("/language/paths/new") }}
            secondaryAction={{ label: "Add Book", onClick: () => navigate("/language/books/new") }}
          />
        </Card>
      ) : (
        <>
          <Card title="Language Paths">
            {paths.length === 0 ? (
              <div className="text-text-muted text-xs">
                No language paths yet —{" "}
                <Link to="/language/paths/new" className="underline hover:text-text-secondary">
                  create one
                </Link>
                .
              </div>
            ) : (
              <div className="space-y-2">
                {paths.map((p) => {
                  const progress = lang.getPathProgress(p.id);
                  const next = lang.getNextUnit(p.id);
                  return (
                    <div
                      key={p.id}
                      className="py-2 border-b border-border-subtle last:border-0"
                    >
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/language/paths/${p.id}`}
                          className="text-text-primary text-sm hover:text-text-secondary underline"
                        >
                          {p.title}
                        </Link>
                        <div className="flex items-center gap-2">
                          <Badge tone={PATH_TONE[p.status]}>{p.status}</Badge>
                          <span className="text-text-muted text-xs">
                            {progress.percent === null
                              ? "no units yet"
                              : `${progress.percent}% · ${progress.completed}/${progress.total} units`}
                          </span>
                        </div>
                      </div>
                      <div className="text-text-muted text-[11px] mt-0.5">
                        {p.language}
                        {p.targetLevel ? ` → ${p.targetLevel}` : ""} ·{" "}
                        {next ? `next: ${next.title}` : "no unit queued"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card title="Recent Learning Sessions">
              {recentSessions.length === 0 ? (
                <div className="text-text-muted text-xs">
                  No learning sessions logged yet.
                </div>
              ) : (
                <div className="space-y-1">
                  {recentSessions.map((s) => {
                    const path = lang.getPath(s.pathId);
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
                      >
                        <span className="text-text-primary text-sm">
                          {path?.language ?? "Language"} · {s.activity}
                        </span>
                        <span className="text-text-muted text-xs">
                          {s.date} · {s.durationMinutes} min
                          {s.recallScore !== null ? ` · recall ${s.recallScore}/${s.recallMax}` : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card title="Books">
              {books.length === 0 ? (
                <div className="text-text-muted text-xs">
                  No books yet —{" "}
                  <Link to="/language/books/new" className="underline hover:text-text-secondary">
                    add one
                  </Link>
                  .
                </div>
              ) : (
                <div className="space-y-1">
                  {books.map((b) => {
                    const rp = lang.getReadingProgress(b);
                    return (
                      <Link
                        key={b.id}
                        to={`/language/books/${b.id}`}
                        className="flex items-center justify-between py-1.5 hover:bg-surface-inset -mx-2 px-2 rounded-md"
                      >
                        <div>
                          <div className="text-text-primary text-sm">{b.title}</div>
                          <div className="text-text-muted text-xs">
                            {b.author || "unknown author"} ·{" "}
                            {rp.percent === null
                              ? `page ${rp.currentPage} (total not tracked)`
                              : `${rp.percent}% · p.${rp.currentPage}/${rp.totalPages}`}
                          </div>
                        </div>
                        <Badge tone={BOOK_TONE[b.status]}>{b.status}</Badge>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
