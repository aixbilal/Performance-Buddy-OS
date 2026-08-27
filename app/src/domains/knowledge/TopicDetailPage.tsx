import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { useKnowledge } from "./store";
import type { SourceType } from "./types";

const STATE_TONE = {
  new: "neutral",
  learning: "warning",
  developing: "warning",
  strong: "success",
} as const;

const SOURCE_LABEL: Record<SourceType, string> = {
  "obsidian-note": "Obsidian Note",
  "professor-material": "Professor Material",
  book: "Book",
  article: "Article",
  video: "Video",
  "ai-note": "AI Note",
};

export function TopicDetailPage() {
  const { topicId } = useParams();
  const { topics, getSourcesForTopic, getEvidenceForTopic, getTopicState } = useKnowledge();
  const topic = topics.find((t) => t.id === topicId);

  if (!topic) {
    return <div className="text-text-muted text-sm">Topic not found.</div>;
  }

  const sources = getSourcesForTopic(topic.id);
  const evidenceList = getEvidenceForTopic(topic.id);
  const state = getTopicState(topic);
  const reviewDue = topic.nextReviewDate ? new Date(topic.nextReviewDate) <= new Date() : false;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/knowledge" className="text-text-muted text-xs hover:text-text-secondary">
          ← Knowledge
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">{topic.title}</h2>
        <div className="flex items-center gap-2 mt-1">
          <Badge>{topic.category}</Badge>
          <span className="text-text-muted text-xs">{topic.context}</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <div className="text-text-muted text-xs mb-1">Current State</div>
          <div className="flex items-center gap-2">
            <Badge tone={STATE_TONE[state]}>{state}</Badge>
            {reviewDue && <Badge tone="warning">Review Due</Badge>}
          </div>
          <p className="text-text-disabled text-[10px] mt-1">
            "Strong" and "Review Due" can both be true — they're tracked separately.
          </p>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Mastery</div>
          <div className="text-text-primary text-lg font-semibold">{topic.masteryPercent}%</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Last Studied</div>
          <div className="text-text-primary text-sm">{topic.lastStudied ?? "Never"}</div>
        </Card>
        <Card>
          <div className="text-text-muted text-xs mb-1">Next Review</div>
          <div className="text-text-primary text-sm">{topic.nextReviewDate ?? "Not scheduled"}</div>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card title={`Notes & Sources (${sources.length})`}>
          <p className="text-text-disabled text-[10px] mb-2">
            References only — the actual note content lives in Obsidian, not duplicated here.
          </p>
          {sources.length === 0 ? (
            <div className="text-text-muted text-xs">No sources linked yet.</div>
          ) : (
            <div className="space-y-2">
              {sources.map((s) => (
                <div key={s.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                  <div>
                    <div className="text-text-primary text-sm">{s.title}</div>
                    <div className="text-text-muted text-xs">{s.reference}</div>
                  </div>
                  <Badge>{SOURCE_LABEL[s.type]}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={`Evidence / Recall (${evidenceList.length})`}>
          <p className="text-text-disabled text-[10px] mb-2">
            Mastery above is derived from this evidence, not a manual guess.
          </p>
          {evidenceList.length === 0 ? (
            <div className="text-text-muted text-xs">No evidence recorded yet — mastery is 0% until it is.</div>
          ) : (
            <div className="space-y-2">
              {evidenceList.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                  <div>
                    <div className="text-text-primary text-sm">{e.title}</div>
                    <div className="text-text-muted text-xs capitalize">
                      {e.type} · {e.date}
                    </div>
                  </div>
                  <span className="text-text-secondary text-xs">
                    {e.score} / {e.maxScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
