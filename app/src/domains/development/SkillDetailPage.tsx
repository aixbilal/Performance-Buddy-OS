import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { SaveIndicator } from "../../components/SaveIndicator";
import { EvidenceList, type EvidenceView } from "../../components/EvidenceList";
import { useDevelopment } from "./store";
import { useKnowledge } from "../knowledge/store";
import { derivePercentToLevel } from "./engine";
import { PROVENANCES, SKILL_LEVELS, type Provenance, type SkillLevel } from "./types";

const PROVENANCE_LABEL: Record<Provenance, string> = {
  independent: "Independent",
  "ai-assisted-reviewed": "AI-assisted + Reviewed",
  "ai-assisted": "AI-assisted (unreviewed)",
};
const PROVENANCE_TONE = {
  independent: "success",
  "ai-assisted-reviewed": "success",
  "ai-assisted": "warning",
} as const;
const LEVEL_TONE = {
  "not-started": "neutral",
  learning: "warning",
  developing: "warning",
  strong: "success",
} as const;

export function SkillDetailPage() {
  const { skillId } = useParams();
  const navigate = useNavigate();
  const dev = useDevelopment();
  const knowledge = useKnowledge();
  const skill = dev.getSkill(skillId ?? "");
  const [handoffMsg, setHandoffMsg] = useState<string | null>(null);

  const [evForm, setEvForm] = useState({
    title: "",
    provenance: "independent" as Provenance,
    projectId: "" as string,
    date: "",
  });
  const [evError, setEvError] = useState<string | null>(null);
  const [showEvForm, setShowEvForm] = useState(false);

  if (!skill) {
    return (
      <div className="space-y-3">
        <Link to="/development" className="text-text-muted text-xs hover:text-text-secondary">
          ← Development
        </Link>
        <p className="text-text-muted text-sm">Skill not found.</p>
      </div>
    );
  }

  const evidenceList = dev.getEvidenceForSkill(skill.id);
  const evidenceScore = dev.getSkillEvidenceScore(skill.id);
  const relatedProjects = dev.getProjectsForSkill(skill.id);
  const hasEvidence = evidenceList.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/development" className="text-text-muted text-xs hover:text-text-secondary">
            ← Development
          </Link>
          <h2 className="text-text-primary text-xl font-semibold mt-1">{skill.title}</h2>
          <p className="text-text-muted text-sm">{skill.category || "Uncategorised"}</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveIndicator state={dev.saveState} />
          <button
            onClick={() => navigate(`/development/skills/${skill.id}/edit`)}
            className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
          >
            Edit Skill
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Axis
          label="Knowledge"
          percent={skill.knowledgePercent}
          note="Can explain it clearly."
        />
        <Axis
          label="Practice"
          percent={skill.practicePercent}
          note="Has done it, help allowed."
        />
        <Card>
          <div className="text-text-muted text-xs mb-1">Evidence</div>
          {!hasEvidence ? (
            <>
              <Badge>no evidence yet</Badge>
              <div className="text-text-primary text-lg font-semibold mt-1">—</div>
            </>
          ) : (
            <>
              <Badge tone={LEVEL_TONE[derivePercentToLevel(evidenceScore.evidencePercent)]}>
                {derivePercentToLevel(evidenceScore.evidencePercent)}
              </Badge>
              <div className="text-text-primary text-lg font-semibold mt-1">
                {evidenceScore.evidencePercent}%
              </div>
            </>
          )}
          <p className="text-text-disabled text-[10px] mt-1">Independently demonstrated.</p>
        </Card>
      </div>

      {evidenceScore.excludedCount > 0 && (
        <div
          role="status"
          className="bg-status-warning/10 border border-status-warning/30 rounded-md px-4 py-3 text-xs text-status-warning"
        >
          {evidenceScore.excludedCount} of {evidenceList.length} evidence record(s) are AI-assisted
          but not yet reviewed/explained back — shown below, excluded from the Evidence score above.
          AI writing code does not automatically count as you independently understanding it.
        </div>
      )}

      <Card title="Linked Knowledge concept">
        <p className="text-text-disabled text-[10px] mb-2">
          Development owns practice and capability; Knowledge owns conceptual mastery. Linking a
          concept references it — it does not copy or change its mastery.
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="skill-knowledge-link" className="sr-only">
            Link {skill.title} to a Knowledge concept
          </label>
          <select
            id="skill-knowledge-link"
            value={skill.knowledgeTopicId ?? ""}
            onChange={(e) => dev.linkSkillKnowledge(skill.id, e.target.value || null)}
            className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
          >
            <option value="">— not linked —</option>
            {knowledge.topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          {skill.knowledgeTopicId &&
            (() => {
              const kt = knowledge.getTopic(skill.knowledgeTopicId);
              return kt ? (
                <span className="text-text-muted text-xs">
                  Knowledge mastery:{" "}
                  <span className="text-text-secondary">
                    {kt.hasEvidence ? `${kt.masteryPercent}% (${kt.state})` : "no evidence yet"}
                  </span>
                </span>
              ) : (
                <span className="text-text-muted text-xs">linked concept was deleted</span>
              );
            })()}
        </div>
      </Card>

      <Card title="Learning Path / Roadmap">
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5 text-text-secondary">
            <input
              type="checkbox"
              checked={skill.roadmapPosition !== null}
              aria-label="On the learning path"
              onChange={(e) =>
                dev.setSkillRoadmap(skill.id, {
                  onPath: e.target.checked,
                  targetLevel: skill.roadmapTargetLevel,
                })
              }
              className="accent-action-primary"
            />
            On the learning path
          </label>
          {skill.roadmapPosition !== null && (
            <label className="flex items-center gap-1.5 text-text-secondary">
              Target level
              <select
                value={skill.roadmapTargetLevel ?? ""}
                aria-label="Roadmap target level"
                onChange={(e) =>
                  dev.setSkillRoadmap(skill.id, {
                    onPath: true,
                    targetLevel: (e.target.value || null) as SkillLevel | null,
                  })
                }
                className="bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <option value="">— none —</option>
                {SKILL_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </Card>

      <Card
        title={`Evidence (${evidenceList.length})`}
        action={
          <button
            onClick={() => setShowEvForm((v) => !v)}
            className="px-2.5 py-1 rounded-md bg-action-primary text-text-inverse text-[11px] font-medium"
          >
            {showEvForm ? "Close" : "Add Evidence"}
          </button>
        }
      >
        <p className="text-text-disabled text-[10px] mb-2">
          Record what you actually did and how it was produced. Provenance decides whether it counts
          toward independent capability.
        </p>

        {showEvForm && (
          <form
            className="mb-3 border border-border-subtle rounded-md p-3 space-y-2"
            noValidate
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await dev.addEvidence(skill.id, {
                title: evForm.title,
                provenance: evForm.provenance,
                projectId: evForm.projectId || null,
                date: evForm.date.trim(),
              });
              if (res.ok) {
                setShowEvForm(false);
                setEvForm({ title: "", provenance: "independent", projectId: "", date: "" });
                setEvError(null);
              } else {
                setEvError(res.errors._ ?? Object.values(res.errors)[0] ?? "Invalid evidence.");
              }
            }}
          >
            <label className="block text-text-secondary text-xs">
              What did you do?
              <input
                value={evForm.title}
                onChange={(e) => setEvForm((p) => ({ ...p, title: e.target.value }))}
                aria-label="Evidence description"
                placeholder="e.g. Built the dashboard layout myself"
                className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1.5 text-text-primary text-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-text-secondary text-xs">
                Provenance
                <select
                  value={evForm.provenance}
                  onChange={(e) =>
                    setEvForm((p) => ({ ...p, provenance: e.target.value as Provenance }))
                  }
                  aria-label="Evidence provenance"
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  {PROVENANCES.map((pv) => (
                    <option key={pv} value={pv}>
                      {PROVENANCE_LABEL[pv]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-text-secondary text-xs">
                Project (optional)
                <select
                  value={evForm.projectId}
                  onChange={(e) => setEvForm((p) => ({ ...p, projectId: e.target.value }))}
                  aria-label="Evidence project"
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                  <option value="">—</option>
                  {dev.projects
                    .filter((p) => !p.archived)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-text-secondary text-xs">
                Date (optional)
                <input
                  type="date"
                  value={evForm.date}
                  onChange={(e) => setEvForm((p) => ({ ...p, date: e.target.value }))}
                  aria-label="Evidence date"
                  className="block mt-1 w-full bg-surface-inset border border-border-subtle rounded px-2 py-1 text-text-primary text-xs outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
                />
              </label>
            </div>
            {evError && <p className="text-status-danger text-[11px]">{evError}</p>}
            <button
              type="submit"
              className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium"
            >
              Add Evidence
            </button>
          </form>
        )}

        {handoffMsg && (
          <p role="status" className="text-text-secondary text-[11px] mb-2">
            {handoffMsg}
          </p>
        )}
        {evidenceList.length === 0 && !showEvForm ? (
          <div className="text-text-muted text-xs">
            No evidence recorded yet — capability is unknown until it is.
          </div>
        ) : (
          <EvidenceList
            items={evidenceList.map<EvidenceView>((e) => {
              const handedOff = !!e.knowledgeEvidenceId;
              const eligible = e.provenance !== "ai-assisted";
              return {
                id: e.id,
                title: e.title,
                kind: "practice",
                date: e.date || null,
                context: e.projectId
                  ? (dev.getProject(e.projectId)?.title ?? "project")
                  : null,
                provenance: PROVENANCE_LABEL[e.provenance],
                provenanceTone: PROVENANCE_TONE[e.provenance],
                onDelete: () => dev.deleteEvidence(e.id),
                action: handedOff ? (
                  <span className="text-text-disabled text-[11px]">in Knowledge</span>
                ) : skill.knowledgeTopicId && eligible ? (
                  <button
                    onClick={async () => {
                      const res = await dev.sendEvidenceToKnowledge(e.id);
                      setHandoffMsg(
                        res.ok
                          ? res.already
                            ? "Already recorded in Knowledge — no duplicate."
                            : "Recorded as one Knowledge Evidence record."
                          : res.reason === "unreviewed-ai"
                            ? "Unreviewed AI-assisted evidence can't be handed to Knowledge."
                            : res.reason === "no-knowledge-link"
                              ? "Link a Knowledge concept first."
                              : `Could not record: ${res.reason}`,
                      );
                    }}
                    aria-label={`Send evidence "${e.title}" to Knowledge`}
                    className="text-text-secondary text-[11px] underline hover:text-text-primary"
                  >
                    Send to Knowledge
                  </button>
                ) : !eligible ? (
                  <span className="text-text-disabled text-[11px]">not independent</span>
                ) : undefined,
              };
            })}
            emptyLabel="No evidence recorded yet — capability is unknown until it is."
          />
        )}
      </Card>

      {relatedProjects.length > 0 && (
        <Card title="Projects Using This Skill">
          <div className="space-y-1">
            {relatedProjects.map((p) => (
              <Link
                key={p.id}
                to={`/development/projects/${p.id}`}
                className="flex items-center justify-between py-1.5 hover:bg-surface-inset -mx-2 px-2 rounded-md"
              >
                <span className="text-text-primary text-sm">{p.title}</span>
                <span className="text-text-muted text-xs">{p.description}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function Axis({ label, percent, note }: { label: string; percent: number; note: string }) {
  return (
    <Card>
      <div className="text-text-muted text-xs mb-1">{label}</div>
      <Badge tone={LEVEL_TONE[derivePercentToLevel(percent)]}>{derivePercentToLevel(percent)}</Badge>
      <div className="text-text-primary text-lg font-semibold mt-1">{percent}%</div>
      <p className="text-text-disabled text-[10px] mt-1">{note}</p>
    </Card>
  );
}
