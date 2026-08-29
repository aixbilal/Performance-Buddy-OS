import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../domains/search/store";
import { useCapture } from "../domains/capture/store";

/**
 * Day 16 §6: Ctrl+K opens, Esc closes and restores exact prior context (this
 * is a modal overlay, not a route change — closing it never navigates away
 * from wherever the user was). Arrow keys navigate, Enter opens the
 * canonical route (§12 — never a duplicate search-specific detail screen).
 */

const QUICK_COMMANDS = [
  { id: "cmd.today", title: "Go to Today", route: "/" },
  { id: "cmd.goals", title: "Go to Goals", route: "/goals" },
  { id: "cmd.planner", title: "Open Planner", route: "/calendar" },
  { id: "cmd.aicoach", title: "Open AI Coach", route: "/ai-coach" },
  { id: "cmd.settings", title: "Open Settings", route: "/settings" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [captureMode, setCaptureMode] = useState(false);
  const [captureText, setCaptureText] = useState("");
  const navigate = useNavigate();
  const { search, recordRecent } = useSearch();
  const { capture } = useCapture();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
        setCaptureMode(false);
        setQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

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
        navigate(commandMatches[selectedIndex].route);
      } else {
        const result = results[selectedIndex - commandMatches.length];
        if (result) {
          recordRecent(result.result.id);
          navigate(result.result.canonicalRoute); // §12 — canonical route, never a duplicate view
        }
      }
      close();
    }
  };

  const close = () => {
    setOpen(false);
    setCaptureMode(false);
    setQuery("");
    setCaptureText("");
    setSelectedIndex(0);
  };

  const submitCapture = () => {
    if (!captureText.trim()) return;
    capture(captureText); // §18 — raw text goes into the real classification pipeline, never lost
    setCaptureText("");
    close();
  };

  if (!open) return null;

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
            <input
              autoFocus
              value={captureText}
              onChange={(e) => setCaptureText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCapture()}
              placeholder="e.g. Spent Rs 450 on lunch"
              className="w-full bg-surface-inset border border-border-subtle rounded-md px-3 py-2 text-text-primary text-sm"
            />
            <div className="flex gap-2 mt-3">
              <button onClick={submitCapture} className="px-3 py-1.5 rounded-md bg-action-primary text-text-inverse text-xs font-medium">
                Capture
              </button>
              <button onClick={() => setCaptureMode(false)} className="px-3 py-1.5 rounded-md bg-action-secondary text-text-primary text-xs font-medium">
                Back to Search
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="p-3 border-b border-border-subtle flex items-center gap-2">
              <span className="text-text-disabled text-sm">⌘</span>
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
                  <div className="text-text-disabled text-[10px] uppercase px-2 mb-1">Commands</div>
                  {commandMatches.map((c, i) => (
                    <div
                      key={c.id}
                      className={`px-2 py-1.5 rounded-md text-sm cursor-pointer ${
                        i === selectedIndex ? "bg-surface-selected text-text-primary" : "text-text-secondary"
                      }`}
                      onClick={() => {
                        navigate(c.route);
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
                  <div className="text-text-disabled text-[10px] uppercase px-2 mb-1">Results</div>
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
                        <span className="text-text-disabled text-xs">{r.result.domain}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {query && results.length === 0 && commandMatches.length === 0 && (
                <div className="text-text-muted text-xs px-2 py-3">No results — try Quick Capture instead.</div>
              )}
            </div>
            <div className="px-3 py-2 border-t border-border-subtle text-text-disabled text-[10px] flex gap-3">
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
