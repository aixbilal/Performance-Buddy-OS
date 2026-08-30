import { Link } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { EmptyState } from "../../components/EmptyState";
import { useKnowledge } from "./store";

/**
 * Notes Hub — V1 structural screen.
 *
 * There is NO Obsidian filesystem integration in this build. This screen is
 * deliberately truthful about that: it never shows scanned vault files, indexed
 * Markdown, or note bodies. It only reports the real connection state and the
 * Source references PBOS already holds (which are pointers, not content).
 */
export function NotesHubPage() {
  const { topics, sources } = useKnowledge();
  const obsidianRefs = sources.filter((s) => s.type === "obsidian-note");

  return (
    <div className="space-y-6">
      <div>
        <Link to="/knowledge" className="text-text-muted text-xs hover:text-text-secondary">
          ← Knowledge
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">Notes Hub</h2>
        <p className="text-text-muted text-sm">
          Where your Knowledge topics and your note references come together.
        </p>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Badge tone="warning">Obsidian not connected</Badge>
        </div>
        <p className="text-text-secondary text-sm">
          PBOS is not reading any Obsidian vault. No files have been scanned, no Markdown has been
          indexed, and no note content is stored here. Obsidian owns your note bodies; PBOS owns the
          relationships and context around them.
        </p>
        <p className="text-text-disabled text-xs mt-2">
          Connecting a real vault (filesystem access) is a later batch. Until then you can still
          attach <em>references</em> to a note — a path or title — from any Knowledge topic.
        </p>
      </Card>

      <Card title={`Note references PBOS is holding (${obsidianRefs.length})`}>
        {obsidianRefs.length === 0 ? (
          <EmptyState
            title="No Obsidian references yet"
            description="Open a Knowledge topic and add a source of type “Obsidian note (reference)”. It stores the path/title only — not the note itself."
          />
        ) : (
          <div className="space-y-2">
            {obsidianRefs.map((s) => {
              const topic = topics.find((t) => t.id === s.topicId);
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0"
                >
                  <div>
                    <div className="text-text-primary text-sm">{s.title}</div>
                    <div className="text-text-muted text-xs">{s.reference || "no path set"}</div>
                  </div>
                  {topic && (
                    <Link
                      to={`/knowledge/${topic.id}`}
                      className="text-text-secondary text-xs underline hover:text-text-primary"
                    >
                      {topic.title}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
