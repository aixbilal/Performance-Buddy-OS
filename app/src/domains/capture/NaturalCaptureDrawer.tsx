/**
 * Natural Capture drawer (V2 Phase D).
 *
 * A global, keyboard-accessible overlay — NOT a sidebar route. Opens from a
 * shortcut (Ctrl/Cmd+Shift+C), the Command Palette, a Today entry point, or any
 * `pbos:open-natural-capture` event. `/capture-inbox` stays the durable
 * unresolved / history route.
 *
 * Flow: type → PBOS persists the raw text first, runs the deterministic local
 * engine, and shows a bundle of `fact` ("You said") / `interpretation`
 * ("PBOS interpreted") proposals. Each is reviewed and applied through the
 * shared mutation engine. No chatbot bubbles, no AI orb, no neon.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/Button";
import { useCapture } from "./store";
import { CaptureProposalItem } from "./CaptureProposalItem";
import type { CaptureProposalRecord } from "../adaptive/types";

type Phase = "idle" | "parsing" | "review";

export function NaturalCaptureDrawer() {
  const { captureNatural, proposalsFor, decideProposal, applyProposal, backend } = useCapture();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("pbos:open-natural-capture", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pbos:open-natural-capture", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setPhase("idle");
      setText("");
      setCaptureId(null);
      queueMicrotask(() => inputRef.current?.focus());
    }
  }, [open]);

  const proposals = useMemo(
    () => (captureId ? proposalsFor(captureId) : []),
    [captureId, proposalsFor],
  );
  const noStructure = phase === "review" && proposals.length === 0;

  const submit = async () => {
    const raw = text.trim();
    if (!raw) return;
    setPhase("parsing");
    const { item } = await captureNatural(raw);
    setCaptureId(item.id);
    setPhase("review");
  };

  const onDecide = async (
    p: CaptureProposalRecord,
    decision: "accepted" | "rejected",
  ) => {
    setBusyId(p.id);
    await decideProposal(p.id, decision);
    if (decision === "accepted") {
      const res = await applyProposal(p.id);
      if (!res.ok) {
        // leave the proposal accepted/failed — the row shows the reason
      }
    }
    setBusyId(null);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex justify-end z-50"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Natural Capture"
        className="h-full w-full max-w-md bg-surface-raised border-l border-border-subtle shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="p-4 border-b border-border-subtle flex items-center justify-between">
          <div>
            <h2 className="t-title text-text-primary">Natural Capture</h2>
            <p className="t-caption text-text-muted">
              Tell PBOS what happened — it structures it, you approve the changes.
            </p>
          </div>
          <Button variant="icon" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label htmlFor="nc-input" className="sr-only">
              What happened?
            </label>
            <textarea
              id="nc-input"
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void submit();
              }}
              rows={3}
              placeholder="e.g. Prof covered AVL trees today. Spent 1200 on groceries and did 25 min of German."
              className="w-full bg-surface-inset border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary resize-y"
            />
            <div className="flex items-center gap-2 mt-2">
              <Button onClick={() => void submit()} disabled={!text.trim() || phase === "parsing"}>
                {phase === "parsing" ? "Reading…" : "Structure this"}
              </Button>
              <span className="t-caption text-text-muted">
                {backend === "localStorage" ? "Saved locally" : "Saved"} · ⌘⏎
              </span>
            </div>
          </div>

          {phase === "review" && (
            <div className="space-y-3">
              {noStructure ? (
                <div className="bg-surface-inset border border-border-subtle rounded-md p-3">
                  <p className="text-sm text-text-secondary">
                    Nothing structured to propose — your note is safe in the{" "}
                    <button
                      className="text-text-primary underline"
                      onClick={() => {
                        setOpen(false);
                        navigate("/capture-inbox");
                      }}
                    >
                      Capture Inbox
                    </button>
                    . Classify it there when you like.
                  </p>
                </div>
              ) : (
                <>
                  <p className="t-caption text-text-muted uppercase tracking-wide">
                    {proposals.length} proposal{proposals.length === 1 ? "" : "s"}
                  </p>
                  {proposals.map((p) => (
                    <CaptureProposalItem
                      key={p.id}
                      proposal={p}
                      busy={busyId === p.id}
                      onAccept={() => void onDecide(p, "accepted")}
                      onReject={() => void onDecide(p, "rejected")}
                    />
                  ))}
                  <div className="pt-1">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setOpen(false);
                        navigate("/capture-inbox");
                      }}
                    >
                      Review the rest in Capture Inbox →
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

