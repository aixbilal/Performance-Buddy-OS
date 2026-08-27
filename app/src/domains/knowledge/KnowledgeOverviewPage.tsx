import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useKnowledge } from "./store";

const STATE_TONE = {
  new: "neutral",
  learning: "warning",
  developing: "warning",
  strong: "success",
} as const;

export function KnowledgeOverviewPage() {
  const { topics, getTopicState, getReviewQueue } = useKnowledge();
  const reviewQueue = getReviewQueue();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-text-primary text-xl font-semibold">Knowledge</h2>
        <p className="text-text-muted text-sm">Track what you know, what you're learning, and what deserves review next.</p>
      </div>

      <Card title="Currently Learning">
        <div className="grid grid-cols-4 gap-3">
          {topics.map((t) => (
            <Link key={t.id} to={`/knowledge/${t.id}`}>
              <div className="bg-surface-inset border border-border-subtle rounded-md p-3">
                <div className="text-text-muted text-[11px] mb-1 capitalize">
                  {t.category} · {t.context}
                </div>
                <div className="text-text-primary text-sm font-medium mb-2">{t.title}</div>
                <div className="w-full h-1.5 rounded-full bg-surface-overlay overflow-hidden mb-1">
                  <div className="h-full bg-action-primary" style={{ width: `${t.masteryPercent}%` }} />
                </div>
                <div className="text-text-secondary text-[11px]">{t.masteryPercent}% mastery</div>
              </div>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
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
                      {t.category} · {t.context}
                    </div>
                  </div>
                  <Badge tone={STATE_TONE[getTopicState(t)]}>{getTopicState(t)}</Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card title="All Topics">
          <div className="space-y-2">
            {topics.map((t) => (
              <Link
                key={t.id}
                to={`/knowledge/${t.id}`}
                className="flex items-center justify-between py-1.5 hover:bg-surface-inset -mx-2 px-2 rounded-md"
              >
                <div className="text-text-primary text-sm">{t.title}</div>
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary text-xs">{t.masteryPercent}%</span>
                  <Badge tone={STATE_TONE[getTopicState(t)]}>{getTopicState(t)}</Badge>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
