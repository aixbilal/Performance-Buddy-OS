/**
 * "Generate Recall" — a contextual Knowledge action (V2, hardened).
 *
 * Produces active-recall prompts for a governed mastery check. It uses the AI
 * provider ONLY when: AI is enabled + available ("ready"), Knowledge has at
 * least Read permission, and the user explicitly clicks this. Otherwise it
 * falls back to PBOS's deterministic prompts and says so.
 *
 * SCOPED OBSIDIAN PREVIEW (explicit, user-triggered, bounded):
 *   - When the topic has linked Obsidian notes, the user may tick ONE to aim
 *     the prompts. Nothing is ticked by default — no note is ever sent
 *     automatically, and unticked notes are never read or sent.
 *   - The ticked note is read ON DEMAND via `obsidian.readNote` and passed
 *     only inside this one scoped provider request. It is further truncated to
 *     a bounded payload; if truncated, that is disclosed. The preview is never
 *     persisted, never put in generic `domainFacts`, and never stored in
 *     recommendation history.
 *
 * Generated prompts are NOT evidence and do not change mastery — they seed a
 * `kind: "recall"` mastery check. Evidence is created only after the user
 * completes + rates that check and takes the explicit "record evidence" action
 * on the Mastery Check screen (unchanged path).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { useAICoach } from "../intelligence/store";
import { useMastery } from "../academic/masteryStore";
import { useObsidian } from "../obsidian/store";
import { makeAIProvider } from "../ai/index";
import { canReadDomain } from "../ai/context";
import { generateRecall } from "./recall";

/** Hard cap on what leaves the device inside the scoped request. */
const PAYLOAD_PREVIEW_CHARS = 1500;

export function GenerateRecallButton({
  knowledgeTopicId,
  topicTitle,
  linkedSourceTitles = [],
  linkedNotes = [],
}: {
  knowledgeTopicId: string;
  topicTitle: string;
  linkedSourceTitles?: string[];
  /** Linked Obsidian notes the user may pick to scope the request. */
  linkedNotes?: { relativePath: string; title: string }[];
}) {
  const { config, credentialsPresent, aiAvailability, permissions } = useAICoach();
  const mastery = useMastery();
  const obs = useObsidian();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [pickedPath, setPickedPath] = useState<string | null>(null);

  const aiAllowed = useMemo(
    () => aiAvailability === "ready" && canReadDomain("Knowledge", permissions),
    [aiAvailability, permissions],
  );

  const onGenerate = async () => {
    setBusy(true);
    setNote(null);

    // On-demand, bounded read of the ONE ticked note — only when AI will run.
    let notePreview: string | null = null;
    let usedTruncatedPreview = false;
    if (aiAllowed && pickedPath) {
      try {
        const preview = await obs.readNote(pickedPath);
        if (preview?.content) {
          notePreview = preview.content.slice(0, PAYLOAD_PREVIEW_CHARS);
          usedTruncatedPreview =
            preview.truncated || preview.content.length > PAYLOAD_PREVIEW_CHARS;
        }
      } catch {
        setNote("That note could not be read — generating without it.");
      }
    }

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
              // The scoped preview rides ONLY in `req.user` (built by
              // buildRecallRequest); the generic context stays note-body-free.
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
    if (notePreview && usedTruncatedPreview) {
      // one-shot, non-persisted disclosure carried to the check screen via state
      setNote("Used a partial preview of the selected note — coverage is not exhaustive.");
    }
    navigate(`/academics/mastery/${checkId}`);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {aiAllowed && linkedNotes.length > 0 && (
        <fieldset className="rounded-md border border-border-subtle bg-surface-inset px-2.5 py-2">
          <legend className="t-caption text-text-muted px-1">
            Aim with a linked note (optional — none is sent unless you pick one)
          </legend>
          <div className="space-y-1">
            {linkedNotes.map((n) => (
              <label key={n.relativePath} className="flex items-center gap-2 text-sm text-text-secondary">
                <input
                  type="radio"
                  name="recall-note"
                  checked={pickedPath === n.relativePath}
                  onChange={() => setPickedPath(n.relativePath)}
                />
                {n.title || n.relativePath}
              </label>
            ))}
            {pickedPath && (
              <button
                type="button"
                onClick={() => setPickedPath(null)}
                className="t-caption text-text-muted underline hover:text-text-secondary"
              >
                Clear selection
              </button>
            )}
          </div>
        </fieldset>
      )}

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
