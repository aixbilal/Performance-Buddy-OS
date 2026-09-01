import { Link, useNavigate } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { SaveIndicator } from "../../components/SaveIndicator";
import { LoadingState } from "../../components/StateViews";
import { useKnowledge } from "./store";

const STATE_TONE = {
  new: "neutral",
  learning: "warning",
  developing: "warning",
  strong: "success",
} as const;

export function KnowledgeOverviewPage() {
  const navigate = useNavigate();
  const { topics, getReviewQueue, saveState, loaded } = useKnowledge();
  const reviewQueue = getReviewQueue();

  if (!loaded) return <LoadingState label="Loading your knowledge…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-text-primary text-xl font-semibold">Knowledge</h2>
          <p className="text-text-muted text-sm">
            Track what you know, what you're learning, and what deserves review next.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={saveState} />
          <button
            onClick={() => navigate("/knowledge/new")}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
          >
            Add Topic
          </button>
          <Link
            to="/knowledge/notes"
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Notes Hub
          </Link>
        </div>
      </div>

      {loaded && topics.length === 0 ? (
        <Card>
          <EmptyState
            icon="📚"
            title="No topics yet"
            description="Add a topic for anything you're learning. Mastery is built from evidence you record — quizzes, recall drills, practice — never a slider."
            primaryAction={{ label: "Add your first topic", onClick: () => navigate("/knowledge/new") }}
          />
        </Card>
      ) : (
        <>
          <Card title="All Topics">
            <div className="grid grid-cols-4 gap-3">
              {topics.map((t) => (
                <Link key={t.id} to={`/knowledge/${t.id}`}>
                  <div className="bg-surface-inset border border-border-subtle rounded-md p-3 h-full">
                    <div className="text-text-muted text-[11px] mb-1 capitalize">
                      {t.category}
                      {t.context && ` · ${t.context}`}
                    </div>
                    <div className="text-text-primary text-sm font-medium mb-2">{t.title}</div>
                    <div className="w-full h-1.5 rounded-full bg-surface-overlay overflow-hidden mb-1">
                      <div
                        className="h-full bg-action-primary"
                        style={{ width: `${t.masteryPercent}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Badge tone={STATE_TONE[t.state]}>{t.state}</Badge>
                      <span className="text-text-secondary text-[11px]">
                        {t.hasEvidence ? `${t.masteryPercent}% mastery` : "no evidence yet"}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card title={`Review Queue (${reviewQueue.length} due)`}>
            {reviewQueue.length === 0 ? (
              <div className="text-text-muted text-xs">Nothing due for review right now.</div>
            ) : (
              <div className="space-y-2">
                {reviewQueue.map((t) => (
                  <Link
                    key={t.id}
                    to={`/knowledge/${t.id}`}
                    className="flex items-center justify-between py-1.5 hover:bg-surface-inset -mx-2 px-2 rounded-md"
                  >
                    <div>
                      <div className="text-text-primary text-sm">{t.title}</div>
                      <div className="text-text-muted text-xs capitalize">
                        {t.category}
                        {t.context && ` · ${t.context}`}
                      </div>
                    </div>
                    <Badge tone={STATE_TONE[t.state]}>{t.state}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
