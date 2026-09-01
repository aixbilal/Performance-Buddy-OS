/**
 * Knowledge — "Generate Recall" support (V2 Phase H).
 *
 * Produces structured recall/practice PROMPTS for a governed mastery check.
 * Hard boundaries (blueprint 07 §12.1):
 *   - Generated prompts alone are NOT Knowledge Evidence and never change
 *     mastery. Only a COMPLETED + evaluated mastery check, followed by the
 *     user's explicit "record evidence" action, creates evidence — that path
 *     is unchanged and lives in `academic/masteryStore`.
 *   - The generic AI context never carries Obsidian note bodies. A note
 *     preview may be included ONLY in this one user-triggered, permission-
 *     gated request, and only when the user picked that note. It is never
 *     persisted as a second note body.
 *   - No vector DB / RAG. Deterministic templated prompts are the offline
 *     fallback and the honest default when AI is unavailable.
 */

export type RecallGenerationSource = "ai" | "deterministic" | "unavailable";

export type RecallResult = {
  source: RecallGenerationSource;
  /** Prompt strings, ready to become `MasteryItem`s (kind: "recall"). */
  items: string[];
  /** Shown when `source === "unavailable"`. */
  message: string | null;
};

const DEFAULT_COUNT = 5;

/** Deterministic, content-light prompts — always available, never fabricates facts. */
export function deterministicRecallPrompts(
  topicTitle: string,
  linkedSourceTitles: string[] = [],
  count = DEFAULT_COUNT,
): string[] {
  const t = topicTitle.trim() || "this topic";
  const base = [
    `Explain ${t} in your own words, without looking anything up.`,
    `What is the core idea of ${t}, and why does it matter?`,
    `Give a concrete example where ${t} applies, and one where it does not.`,
    `What is a common mistake or misconception about ${t}?`,
    `How would you check whether you have really understood ${t}?`,
    `What does ${t} depend on, and what depends on it?`,
    `Describe ${t} to someone who has never heard of it, in two sentences.`,
  ];
  const fromSources = linkedSourceTitles
    .filter((s) => s.trim().length > 0)
    .map((s) => `How does ${t} connect to "${s.trim()}"?`);
  return [...fromSources, ...base].slice(0, Math.max(1, count));
}

/**
 * The scoped AI request for recall generation. `notePreview` is included ONLY
 * when the user selected a linked note for this action — never from generic
 * domain facts.
 */
export function buildRecallRequest(
  topicTitle: string,
  opts: { notePreview?: string | null; count?: number } = {},
): { system: string; user: string } {
  const count = opts.count ?? DEFAULT_COUNT;
  const preview = opts.notePreview?.trim();
  return {
    system:
      "You write short active-recall study prompts. Output ONE prompt per line, " +
      "no numbering, no answers, no preamble. Prompts must be answerable from " +
      "understanding, not lookup.",
    user:
      `Topic: ${topicTitle}\n` +
      `Write ${count} distinct active-recall prompts for this topic.` +
      (preview
        ? `\n\nThe learner selected this note excerpt as scope (do not quote it back, use it only to aim the prompts):\n"""${preview.slice(0, 1500)}"""`
        : ""),
  };
}

/** Parse a provider's line-per-prompt reply into clean prompt strings. */
export function parseRecallItems(text: string, count = DEFAULT_COUNT): string[] {
  return text
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter((l) => l.length > 3)
    .slice(0, Math.max(1, count));
}

/**
 * Decide + produce recall prompts. `runProvider` is injected so this stays pure
 * and testable; it is only called when `aiAllowed` is true (AI enabled +
 * available + Knowledge has permission + the user explicitly invoked this).
 */
export async function generateRecall(args: {
  topicTitle: string;
  linkedSourceTitles?: string[];
  notePreview?: string | null;
  count?: number;
  aiAllowed: boolean;
  runProvider?: (req: { system: string; user: string }) => Promise<{ ok: boolean; text: string }>;
}): Promise<RecallResult> {
  const count = args.count ?? DEFAULT_COUNT;
  if (args.aiAllowed && args.runProvider) {
    try {
      const res = await args.runProvider(
        buildRecallRequest(args.topicTitle, { notePreview: args.notePreview, count }),
      );
      if (res.ok) {
        const items = parseRecallItems(res.text, count);
        if (items.length > 0) return { source: "ai", items, message: null };
      }
    } catch {
      /* fall through to deterministic */
    }
    // provider failed — fall back, but say so honestly
    return {
      source: "deterministic",
      items: deterministicRecallPrompts(args.topicTitle, args.linkedSourceTitles, count),
      message: "AI was unavailable — these are PBOS's standard recall prompts.",
    };
  }
  if (!args.aiAllowed) {
    return {
      source: "deterministic",
      items: deterministicRecallPrompts(args.topicTitle, args.linkedSourceTitles, count),
      message: null,
    };
  }
  return { source: "unavailable", items: [], message: "AI recall is not available right now." };
}
