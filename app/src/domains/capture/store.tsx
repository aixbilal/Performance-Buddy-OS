import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { CaptureInboxItem } from "./types";
import { classifyCapture, requiresManualReview } from "./engine";
import { usePerformance } from "../performance/store";
import { useMoney } from "../money/store";

type CaptureContextValue = {
  inbox: CaptureInboxItem[];
  capture: (rawText: string) => CaptureInboxItem;
  /** Confirms a proposal and routes it into the REAL existing engine — never a duplicate creation path. */
  confirmItem: (itemId: string) => void;
  dismissItem: (itemId: string) => void;
};

const CaptureContext = createContext<CaptureContextValue | null>(null);

export function CaptureProvider({ children }: { children: ReactNode }) {
  const [inbox, setInbox] = useState<CaptureInboxItem[]>([]);
  const { addAction } = usePerformance();
  const { addTransaction } = useMoney();

  const capture = (rawText: string): CaptureInboxItem => {
    const proposal = classifyCapture(rawText);
    const item: CaptureInboxItem = {
      id: `cap-${Date.now()}`,
      rawText,
      status: requiresManualReview(proposal) ? "unprocessed" : "proposed",
      proposal,
      createdAt: new Date().toISOString(),
    };
    setInbox((prev) => [item, ...prev]);
    return item;
  };

  // §16/§20: confirming routes into the SAME engines every other creation
  // path uses — addAction and addTransaction already existed before Quick
  // Capture; nothing new was built specifically for this feature.
  const confirmItem = (itemId: string) => {
    setInbox((prev) => {
      const item = prev.find((i) => i.id === itemId);
      if (!item || !item.proposal) return prev;

      if (item.proposal.type === "action") {
        addAction({
          systemId: "sys-weekly-study", // default system — real UI would let the user pick
          title: String(item.proposal.fields.title ?? item.rawText),
          context: "Quick Capture",
          status: "not-started",
          estMinutes: 30,
          priority: "medium",
          triggerTiming: "Unscheduled",
        });
      } else if (item.proposal.type === "expense") {
        addTransaction({
          type: "expense",
          amount: Number(item.proposal.fields.amount) || 0,
          category: "Quick Capture",
          description: String(item.proposal.fields.description ?? item.rawText),
          date: new Date().toISOString().slice(0, 10),
        });
      }
      // routine-checkin / unclassified: left for manual resolution in their
      // own domain — not every capture type has a single safe one-call target.

      return prev.map((i) => (i.id === itemId ? { ...i, status: "resolved" } : i));
    });
  };

  const dismissItem = (itemId: string) => {
    setInbox((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: "resolved" } : i)));
  };

  const value = useMemo(
    () => ({ inbox, capture, confirmItem, dismissItem }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [inbox]
  );

  return <CaptureContext.Provider value={value}>{children}</CaptureContext.Provider>;
}

export function useCapture() {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used within CaptureProvider");
  return ctx;
}
