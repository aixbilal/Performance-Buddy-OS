import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../domains/search/store";
import { useCapture } from "../domains/capture/store";
import type { CaptureInboxItem, CaptureType } from "../domains/capture/types";
import { Button } from "../components/Button";

/**
 * Day 16 §6: Ctrl+K opens, Esc closes and restores exact prior context (this
 * is a modal overlay, not a route change). Arrow keys navigate, Enter opens the
 * canonical route (§12 — never a duplicate search-specific detail screen).
 *
 * Quick Capture (§18/§20): type → see the proposed classification → Confirm
 * (routes into the real domain engine) or Change type or Keep in Inbox. Nothing
 * is ever lost — every capture is persisted the moment it is typed.
 */

const QUICK_COMMANDS = [
  { id: "cmd.today", title: "Go to Today", route: "/" },
  { id: "cmd.capture", title: "Natural Capture — tell PBOS what happened", route: "pbos:natural-capture" },
  { id: "cmd.goals", title: "Go to Goals", route: "/goals" },
  { id: "cmd.planner", title: "Open Planner", route: "/planner" },
  { id: "cmd.calendar", title: "Open Calendar", route: "/calendar" },
  { id: "cmd.inbox", title: "Open Capture Inbox", route: "/capture-inbox" },
  { id: "cmd.aicoach", title: "Open AI Coach", route: "/ai-coach" },
  { id: "cmd.settings", title: "Open Settings", route: "/settings" },
];

/** A QUICK_COMMANDS `route` is either a real route or a `pbos:` action sentinel. */
function runCommandRoute(route: string, navigate: (to: string) => void) {
  if (route === "pbos:natural-capture") {
    window.dispatchEvent(new CustomEvent("pbos:open-natural-capture"));
    return;
  }
  navigate(route);
}

const CONFIRMABLE: CaptureType[] = ["action", "expense", "routine-checkin"];
const TYPE_CHOICES: CaptureType[] = ["action", "expense", "routine-checkin", "note"];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [captureMode, setCaptureMode] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const [pending, setPending] = useState<CaptureInboxItem | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const navigate = useNavigate();
  const { search, recordRecent } = useSearch();
  const { capture, confirmItem, reclassify, inbox } = useCapture();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) close();
    };
    const openFromShell = () => setOpen(true);
    window.addEventListener("keydown", handler);
    window.addEventListener("pbos:open-command-palette", openFromShell);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("pbos:open-command-palette", openFromShell);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // keep `pending` in sync with the store (status/proposal can change)
  const livePending = pending ? inbox.find((i) => i.id === pending.id) ?? pending : null;

  const results = query ? search(query) : [];
  const commandMatches = query
    ? QUICK_COMMANDS.filter((c) => c.title.toLowerCase().includes(query.toLowerCase()))
    : QUICK_COMMANDS;
  const totalItems = results.length + commandMatches.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, totalItems - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex < commandMatches.length) {
        runCommandRoute(commandMatches[selectedIndex].route, navigate);
      } else {
        const r = results[selectedIndex - commandMatches.length];
        if (r) {
          recordRecent(r.result.id);
          navigate(r.result.canonicalRoute);
        }
      }
      close();
    }
  };

  function close() {
    setOpen(false);
    setCaptureMode(false);
    setQuery("");
    setCaptureText("");
    setPending(null);
    setResult(null);
    setSelectedIndex(0);
  }

  const submitCapture = async () => {
    if (!captureText.trim()) return;
    // Persisted immediately — never lost, AI or not.
    const item = await capture(captureText);
    setPending(item);
    setResult(null);
    setCaptureText("");
  };

  const doConfirm = async () => {
    if (!livePending) return;
    const res = await confirmItem(livePending.id);
    if (res.ok) {
      setResult(`Sent to ${res.target.replace("-", " ")}.`);
    } else {
      setResult(res.error);
    }
  };

  if (!open) return null;

  const proposal = livePending?.proposal ?? null;
  const canConfirmInline = !!proposal && CONFIRMABLE.includes(proposal.type);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-24 z-50" onClick={close}>
      <div
        className="bg-surface-raised border border-border-subtle rounded-lg w-full max-w-xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {captureMode ? (
          <div className="p-4">
            <div className="text-text-muted text-xs mb-2">Quick Capture — type anything, PBOS classifies it</div>

            {!livePending && (
              <>
                <label className="sr-only" htmlFor="qc-input">
                  Capture text
                </label>
                <input
                  id="qc-input"
                  autoFocus
                  value={captureText}
                  onChange={(e) => setCaptureText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitCapture()}
                  placeholder="e.g. Spent Rs 450 on lunch"
                  className="w-full bg-surface-inset border border-border-subtle rounded-md px-3 py-2 text-text-primary text-sm"
                />
                <div className="flex gap-2 mt-3">
                  <Button variant="primary" onClick={submitCapture}>
                    Capture
                  </Button>
                  <Button variant="secondary" onClick={() => setCaptureMode(false)}>
                    Back to Search
                  </Button>
                </div>
              </>
            )}

            {livePending && (
              <div className="space-y-3">
                <div className="bg-surface-inset border border-border-subtle rounded-md p-3">
                  <div className="text-text-primary text-sm">{livePending.rawText}</div>
                  {proposal && (
                    <div className="text-text-secondary text-xs mt-1">
                      Proposed: <b className="capitalize">{proposal.type.replace("-", " ")}</b> ·{" "}
                      {proposal.confidence} confidence
                    </div>
                  )}
                  <div className="text-status-success text-[11px] mt-1">Saved — it is safe in your Capture Inbox.</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-text-muted text-[10px]">type:</span>
                  {TYPE_CHOICES.map((t) => (
                    <button
                      key={t}
                      onClick={() => reclassify(livePending.id, t)}
                      className={`px-2 py-1 rounded-md text-[11px] ${
                        proposal?.type === t ? "bg-surface-selected text-text-primary" : "text-text-muted hover:text-text-secondary"
                      }`}
                    >
                      {t.replace("-", " ")}
                    </button>
                  ))}
                </div>

                {result && <div className="text-text-secondary text-xs">{result}</div>}

                <div className="flex gap-2">
                  <Button variant="primary" onClick={doConfirm} disabled={!canConfirmInline}>
                    Confirm
                  </Button>
                  <Button variant="secondary" onClick={() => { close(); navigate("/capture-inbox"); }}>
                    Keep in Inbox
                  </Button>
                  <button
                    onClick={() => {
                      setPending(null);
                      setResult(null);
                    }}
                    className="px-3 py-1.5 rounded-md text-text-muted text-xs"
                  >
                    New capture
                  </button>
                </div>
                {!canConfirmInline && (
                  <p className="text-text-muted text-[10px]">
                    Notes have no V1 destination — keep it in the Inbox.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-border-subtle flex items-center gap-2">
              <span className="text-text-muted text-sm">⌘</span>
              <input
                autoFocus
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Search PBOS or run a command…"
                className="flex-1 bg-transparent text-text-primary text-sm outline-none"
              />
              <button onClick={() => setCaptureMode(true)} className="text-text-muted text-xs hover:text-text-secondary">
                Quick Capture →
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              {commandMatches.length > 0 && (
                <div className="mb-2">
                  <div className="text-text-muted text-[10px] uppercase px-2 mb-1">Commands</div>
                  {commandMatches.map((c, i) => (
                    <div
                      key={c.id}
                      className={`px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                        i === selectedIndex ? "bg-surface-selected text-text-primary" : "text-text-secondary"
                      }`}
                      onClick={() => {
                        runCommandRoute(c.route, navigate);
                        close();
                      }}
                    >
                      {c.title}
                    </div>
                  ))}
                </div>
              )}
              {results.length > 0 && (
                <div>
                  <div className="text-text-muted text-[10px] uppercase px-2 mb-1">Results</div>
                  {results.map((r, i) => {
                    const idx = commandMatches.length + i;
                    return (
                      <div
                        key={r.result.id}
                        className={`px-2 py-1.5 rounded-md text-sm cursor-pointer flex justify-between ${
                          idx === selectedIndex ? "bg-surface-selected text-text-primary" : "text-text-secondary"
                        }`}
                        onClick={() => {
                          recordRecent(r.result.id);
                          navigate(r.result.canonicalRoute);
                          close();
                        }}
                      >
                        <span>{r.result.title}</span>
                        <span className="text-text-muted text-xs">{r.result.domain}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {query && results.length === 0 && commandMatches.length === 0 && (
                <div className="text-text-muted text-xs px-2 py-3">No results — try Quick Capture instead.</div>
              )}
            </div>
            <div className="px-3 py-2 border-t border-border-subtle text-text-muted text-[10px] flex gap-3">
              <span>↑↓ Navigate</span>
              <span>Enter Open</span>
              <span>Esc Close</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
