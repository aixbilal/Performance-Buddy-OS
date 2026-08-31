/**
 * Language Learning Session — the active practice-capture surface
 * (V1 Day 09 §5.3 / §5.5). Recording a session is Language-domain state only.
 * A Knowledge-evidence record is created ONLY when the user explicitly asks
 * for it after a real recall check — completion / minutes never do it.
 */
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { SelectField, TextArea, TextField } from "../../components/FormFields";
import { useKnowledge } from "../knowledge/store";
import { useLanguage } from "./store";
import { SESSION_ACTIVITIES, type SessionActivity } from "./types";

const TITLE_CASE = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const todayIso = () => new Date().toISOString().slice(0, 10);

export function LearningSessionPage() {
  const { pathId } = useParams();
  const lang = useLanguage();
  const { addEvidence } = useKnowledge();
  const path = lang.getPath(pathId ?? "");

  const [unitId, setUnitId] = useState("");
  const [activity, setActivity] = useState<SessionActivity>("lesson");
  const [minutes, setMinutes] = useState("30");
  const [recall, setRecall] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [logged, setLogged] = useState<{ sessionId: string; unitId: string | null } | null>(null);
  const [evidenceMsg, setEvidenceMsg] = useState<string | null>(null);

  if (!path) {
    return (
      <div className="space-y-3">
        <Link to="/language" className="text-text-muted text-xs hover:text-text-secondary">
          ← Reading &amp; Language
        </Link>
        <p className="text-text-muted text-sm">Language path not found.</p>
      </div>
    );
  }

  const units = lang.getUnitsForPath(path.id);
  const chosenUnit = logged?.unitId ? units.find((u) => u.id === logged.unitId) : undefined;
  const linkedTopicId = chosenUnit?.knowledgeTopicId ?? null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await lang.logSession(path.id, {
      unitId: unitId || null,
      date: todayIso(),
      durationMinutes: Number(minutes),
      activity,
      notes,
      recallScore: recall.trim() === "" ? null : Number(recall),
      recallMax: 10,
    });
    if (!res.ok) {
      setErrors(res.errors);
      return;
    }
    setErrors({});
    setLogged({ sessionId: res.id, unitId: unitId || null });
  };

  const recordEvidence = async () => {
    if (!linkedTopicId) return;
    const score = recall.trim() === "" ? null : Number(recall);
    if (score === null) {
      setEvidenceMsg("Add a recall score first — a session without one proves nothing was retained.");
      return;
    }
    const r = await addEvidence(linkedTopicId, {
      type: "recall",
      title: `${path.language} — ${chosenUnit?.title ?? "practice"} recall check`,
      score,
      maxScore: 10,
      date: todayIso(),
    });
    setEvidenceMsg(
      r.ok
        ? "Recorded as Knowledge evidence for the linked concept."
        : "Could not record evidence — the linked concept may have been removed.",
    );
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link
          to={`/language/paths/${path.id}`}
          className="text-text-muted text-xs hover:text-text-secondary"
        >
          ← {path.title}
        </Link>
        <h2 className="text-text-primary text-xl font-semibold mt-1">Learning Session</h2>
        <p className="text-text-muted text-sm">
          {path.language}
          {path.targetLevel ? ` → ${path.targetLevel}` : ""}. Record what you actually practised.
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Unit (optional)"
              value={unitId}
              options={["", ...units.map((u) => u.id)]}
              onChange={setUnitId}
              labelFor={(id) =>
                id === "" ? "— whole path —" : (units.find((u) => u.id === id)?.title ?? id)
              }
            />
            <SelectField
              label="Activity"
              value={activity}
              options={SESSION_ACTIVITIES}
              onChange={(x) => setActivity(x)}
              labelFor={TITLE_CASE}
              error={errors.activity}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Minutes practised"
              type="number"
              value={minutes}
              onChange={setMinutes}
              error={errors.durationMinutes}
            />
            <TextField
              label="Recall score (optional, out of 10)"
              type="number"
              value={recall}
              onChange={setRecall}
              error={errors.recallScore}
              hint="Only fill this in if you did a genuine recall/test check."
            />
          </div>
          <TextArea
            label="Notes / reflection (optional)"
            value={notes}
            onChange={setNotes}
            error={errors.notes}
            rows={2}
          />
          {errors._ && <p className="text-status-danger text-xs">{errors._}</p>}
          <button
            type="submit"
            disabled={lang.saveState === "saving"}
            className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium disabled:opacity-50"
          >
            Log Session
          </button>
        </form>
      </Card>

      {logged && (
        <Card title="Session logged">
          <p className="text-text-secondary text-xs">
            Recorded on the path{chosenUnit ? `, and “${chosenUnit.title}” marked complete` : ""}. This
            changed Language progress only.
          </p>
          <div className="mt-3">
            {linkedTopicId ? (
              <>
                <button
                  onClick={recordEvidence}
                  className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium"
                >
                  Record recall as Knowledge evidence
                </button>
                <p className="text-text-disabled text-[11px] mt-1">
                  Optional and explicit — Knowledge mastery is never updated automatically.
                </p>
              </>
            ) : (
              <p className="text-text-muted text-xs">
                No Knowledge concept is linked to this unit, so there is nothing to add evidence to.
                Link one from the path's Units list if you want to track retention.
              </p>
            )}
            {evidenceMsg && <p className="text-text-secondary text-xs mt-2">{evidenceMsg}</p>}
          </div>
          <div className="mt-3">
            <Link
              to={`/language/paths/${path.id}`}
              className="text-text-secondary text-xs underline hover:text-text-primary"
            >
              Back to the path
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
