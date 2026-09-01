/**
 * "Generate Recall" — a contextual Knowledge action (V2 Phase H).
 *
 * Produces active-recall prompts for a governed mastery check. It uses the AI
 * provider ONLY when: AI is enabled + available, Knowledge has at least Read
 * permission, and the user explicitly clicks this. Otherwise it falls back to
 * PBOS's deterministic prompts and says so.
 *
 * The generated prompts are NOT evidence and do not change mastery — they seed
 * a `kind: "recall"` mastery check. Evidence is created only after the user
 * completes + rates that check and takes the explicit "record evidence" action
 * on the Mastery Check screen (unchanged path). A selected note preview is sent
 * only in this one scoped request, never as generic domain facts.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { useAICoach } from "../intelligence/store";
import { useMastery } from "../academic/masteryStore";
import { makeAIProvider } from "../ai/index";
import { canReadDomain } from "../ai/context";
import { generateRecall } from "./recall";

export function GenerateRecallButton({
  knowledgeTopicId,
  topicTitle,
  linkedSourceTitles = [],
  notePreview = null,
}: {
  knowledgeTopicId: string;
  topicTitle: string;
  linkedSourceTitles?: string[];
  notePreview?: string | null;
}) {
  const { config, credentialsPresent, aiAvailability, permissions } = useAICoach();
  const mastery = useMastery();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const aiAllowed = useMemo(
    () => aiAvailability === "ready" && canReadDomain("Knowledge", permissions),
    [aiAvailability, permissions],
  );

  const onGenerate = async () => {
    setBusy(true);
    setNote(null);
    const provider = aiAllowed ? makeAIProvider(config, credentialsPresent) : null;
    const result = await generateRecall({
      topicTitle,
      linkedSourceTitles,
      notePreview,
      aiAllowed,
      runProvider: provider
        ? async (req) => {
            const res = await provider.complete({
              task: "knowledge-recall",
              messages: [
                { role: "system", content: req.system },
                { role: "user", content: req.user },
              ],
              context: { includedDomains: ["Knowledge"], excludedDomains: [], facts: [] },
              wantRecommendations: false,
            });
            return { ok: res.ok, text: res.ok ? res.text : "" };
          }
        : undefined,
    });

    if (result.items.length === 0) {
      setNote(result.message ?? "No recall prompts could be generated right now.");
      setBusy(false);
      return;
    }
    const checkId = await mastery.startCheck({
      academicTopicId: null,
      knowledgeTopicId,
      courseId: null,
      topicTitle,
      kind: "recall",
      recallPrompts: result.items,
    });
    setBusy(false);
    navigate(`/academics/mastery/${checkId}`);
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => void onGenerate()} disabled={busy}>
          {busy ? "Generating…" : "Generate Recall"}
        </Button>
        <span className="t-caption text-text-muted">
          {aiAllowed ? "AI-assisted" : "PBOS standard prompts"} · questions don't change mastery
        </span>
      </div>
      {note && <p className="t-caption text-status-warning">{note}</p>}
    </div>
  );
}
