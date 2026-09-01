/**
 * Goal Builder — `/goals/new` (manual + AI proposal) and `/goals/:goalId/edit`.
 *
 * Human-in-the-loop rule (docs 11.01 / spec "Goal Builder & AI Proposal"):
 * an AI proposal is NEVER auto-created. Accept/Modify only *prefills the same
 * builder*; the user still has to press Create Goal. Reject creates nothing.
 * There is no real AI provider in Batch 1 — this deterministic proposal only
 * proves the workflow.
 */
import { useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Badge } from "../../components/Badge";
import { usePerformance } from "./store";
import {
  EMPTY_GOAL_FORM,
  GoalForm,
  type GoalFormValues,
} from "./GoalForm";
import type { GoalInput } from "./types";
import { Button } from "../../components/Button";

type Tab = "manual" | "ai";

const DETERMINISTIC_PROPOSAL = {
  id: "goal-proposal-cars",
  title: "Learn 30 important cars this month",
  domain: "knowledge" as const,
  type: "learning" as const,
  rationale:
    "You've shown recurring interest in cars and knowledge retention. This goal is specific, measurable and time-bound.",
  benefits: ["Broader knowledge", "Better recall", "Daily progress habit"],
  prefill: (): GoalFormValues => ({
    ...EMPTY_GOAL_FORM,
    title: "Learn 30 important cars this month",
    domain: "knowledge",
    type: "learning",
    priority: "normal",
    metricCurrent: "0",
    metricTarget: "30",
    metricUnit: "cars",
    detail: "Expand automotive knowledge through consistent daily learning.",
  }),
};

export function GoalBuilderPage() {
  const { goalId } = useParams();
  const navigate = useNavigate();
  const { getGoal, createGoal, updateGoal, saveState } = usePerformance();

  const editing = goalId ? getGoal(goalId) : undefined;
  const isEdit = Boolean(goalId);

  const initialForm = useMemo<GoalFormValues>(() => {
    if (editing) {
      return {
        title: editing.title,
        type: editing.type,
        domain: editing.domain,
        priority: editing.priority,
        deadline: editing.deadline ?? "",
        metricCurrent: editing.metric ? String(editing.metric.current) : "",
        metricTarget: editing.metric ? String(editing.metric.target) : "",
        metricUnit: editing.metric ? editing.metric.unit : "",
        detail: editing.detail,
      };
    }
    return EMPTY_GOAL_FORM;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId]);

  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>(searchParams.get("tab") === "ai" ? "ai" : "manual");
  const [form, setForm] = useState<GoalFormValues>(initialForm);
  const [proposalHandled, setProposalHandled] = useState<null | "accepted" | "modified" | "rejected">(
    null,
  );
  const [createdBy, setCreatedBy] = useState<"user" | "ai-approved">("user");
  // Force GoalForm to remount when we prefill from a proposal.
  const [formKey, setFormKey] = useState(0);

  if (isEdit && !editing) {
    return (
      <div className="space-y-3">
        <button onClick={() => navigate("/goals")} className="text-text-muted text-xs hover:text-text-secondary">
          ← Goals
        </button>
        <p className="text-text-muted text-sm">That goal doesn't exist.</p>
      </div>
    );
  }

  const submit = async (input: GoalInput) => {
    const res = isEdit && goalId ? await updateGoal(goalId, input) : await createGoal(input, createdBy);
    if (res.ok) navigate(`/goals/${res.id}`);
    return res;
  };

  const applyProposal = (mode: "accepted" | "modified") => {
    setForm(DETERMINISTIC_PROPOSAL.prefill());
    setCreatedBy("ai-approved");
    setProposalHandled(mode);
    setTab("manual");
    setFormKey((k) => k + 1);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <button onClick={() => navigate(isEdit ? `/goals/${goalId}` : "/goals")} className="text-text-muted text-xs hover:text-text-secondary">
          ← {isEdit ? "Goal" : "Goals"}
        </button>
        <h2 className="t-h2 text-text-primary mt-1">
          {isEdit ? "Edit Goal" : "Goal Builder"}
        </h2>
        <p className="text-text-muted text-sm">
          {isEdit
            ? "Update this desired outcome. Changes are validated and saved to your local database."
            : "Turn long-term intent into a measurable goal. Manual and AI-proposed goals use the same builder."}
        </p>
      </div>

      {!isEdit && (
        <div className="flex gap-1 border-b border-border-subtle" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "manual"}
            onClick={() => setTab("manual")}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === "manual"
                ? "border-accent-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            Manual Build
          </button>
          <button
            role="tab"
            aria-selected={tab === "ai"}
            onClick={() => setTab("ai")}
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === "ai"
                ? "border-accent-primary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-secondary"
            }`}
          >
            AI Proposal
          </button>
        </div>
      )}

      {tab === "manual" || isEdit ? (
        <Card>
          {createdBy === "ai-approved" && !isEdit && (
            <div className="mb-3 text-[11px] text-text-muted flex items-center gap-2">
              <Badge tone="ai">AI-proposed</Badge>
              Prefilled from a proposal — review and press Create Goal to confirm.
            </div>
          )}
          <GoalForm
            key={formKey}
            initial={form}
            submitLabel={isEdit ? "Save Goal" : "Create Goal"}
            busy={saveState === "saving"}
            onSubmit={submit}
            onCancel={() => navigate(isEdit ? `/goals/${goalId}` : "/goals")}
          />
        </Card>
      ) : (
        <Card title="AI Suggested Goal">
          {proposalHandled === "rejected" ? (
            <p className="text-text-muted text-xs">
              Proposal rejected — nothing was created. Switch to Manual Build to add a goal yourself.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="text-text-primary text-sm font-medium">{DETERMINISTIC_PROPOSAL.title}</div>
                <Badge tone="ai">{DETERMINISTIC_PROPOSAL.domain}</Badge>
              </div>
              <p className="text-text-secondary text-xs">{DETERMINISTIC_PROPOSAL.rationale}</p>
              <ul className="text-text-muted text-xs list-disc list-inside space-y-0.5">
                {DETERMINISTIC_PROPOSAL.benefits.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="text-text-muted text-[11px]">
                Accepting or modifying opens the builder prefilled — it does not create anything until you
                press Create Goal.
              </p>
              <div className="flex gap-2">
                <Button variant="primary" onClick={() => applyProposal("accepted")}>
                  Accept
                </Button>
                <Button variant="secondary" onClick={() => applyProposal("modified")}>
                  Modify
                </Button>
                <Button variant="ghost" onClick={() => setProposalHandled("rejected")}>
                  Reject
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
