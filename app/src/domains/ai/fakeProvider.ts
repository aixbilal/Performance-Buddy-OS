/**
 * Deterministic FAKE provider — the ONLY provider wired by default and the ONLY
 * one used in automated tests (docs §34: no paid AI calls in CI). It stands in
 * for a real model by producing a fixed, explainable proposal set from the
 * permitted context facts.
 *
 * `mode` lets a test drive every failure class the real boundary must handle.
 */

import type {
  AIProvider,
  AIRequest,
  AIResponse,
  ProposedRecommendation,
} from "./types";

export type FakeMode = "ok" | "timeout" | "network" | "auth" | "rate-limit" | "malformed" | "empty";

/** Pull a "Topic Name" out of a fact bullet like "[Knowledge] Binary Trees is review-due". */
function firstTopicFrom(facts: string[], marker = "is review-due|has no evidence|under-studied"): string | null {
  for (const f of facts) {
    const m = f.match(new RegExp(`\\]\\s+([A-Z][\\w &-]+?)\\s+(${marker})`));
    if (m) return m[1].trim();
  }
  return null;
}

export class FakeProvider implements AIProvider {
  readonly id = "fake";
  readonly kind = "fake" as const;
  private mode: FakeMode;

  constructor(mode: FakeMode = "ok") {
    this.mode = mode;
  }

  setMode(m: FakeMode) {
    this.mode = m;
  }

  status() {
    if (this.mode === "auth") return { ready: false, failure: "auth" as const };
    return { ready: true };
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    switch (this.mode) {
      case "timeout":
        return { ok: false, failure: "timeout", message: "The AI provider did not respond in time." };
      case "network":
        return { ok: false, failure: "network", message: "No network connection to the AI provider." };
      case "auth":
        return { ok: false, failure: "auth", message: "The AI provider rejected the credentials." };
      case "rate-limit":
        return { ok: false, failure: "rate-limit", message: "The AI provider is rate-limiting requests." };
      case "malformed":
        return { ok: false, failure: "malformed", message: "The AI provider returned an unparseable response." };
      case "empty":
        return { ok: true, text: "", proposals: [] };
      default:
        break;
    }

    const facts = req.context.facts;
    const proposals: ProposedRecommendation[] = [];

    if (req.wantRecommendations) {
      const inc = (d: string) => req.context.includedDomains.includes(d);
      const reviewTopic = firstTopicFrom(facts, "is review-due");
      const noEvidenceTopic = firstTopicFrom(facts, "has no evidence");
      const topic = reviewTopic ?? noEvidenceTopic;

      if (reviewTopic && inc("Knowledge")) {
        proposals.push({
          kind: "set-knowledge-review",
          domain: "Knowledge",
          title: `Schedule a review for ${reviewTopic}`,
          rationale: `${reviewTopic} is flagged review-due in the permitted context.`,
          evidence: facts.filter((f) => f.includes(reviewTopic)),
          confidence: "moderate",
          proposedParams: { topicTitle: reviewTopic, inDays: 3 },
        });
      }
      if (noEvidenceTopic && !reviewTopic && inc("Today")) {
        proposals.push({
          kind: "create-action",
          domain: "Today",
          title: `Add an Action: study ${noEvidenceTopic}`,
          rationale: `${noEvidenceTopic} has no recorded evidence yet.`,
          evidence: facts.filter((f) => f.includes(noEvidenceTopic)),
          confidence: "limited",
          proposedParams: { title: `Study ${noEvidenceTopic}` },
        });
      }
      if (inc("Planning")) {
        proposals.push({
          kind: "schedule-block",
          domain: "Planning",
          title: `Schedule a 60-minute study block${topic ? ` for ${topic}` : ""}`,
          rationale:
            facts.find((f) => /under-studied|scheduled \d+h of \d+h/.test(f)) ??
            "There is capacity headroom this week for a focused block.",
          evidence: facts.filter((f) => f.includes("Planning")),
          confidence: "moderate",
          proposedParams: {
            title: `Study${topic ? `: ${topic}` : ""}`,
            day: 1,
            startMinute: 17 * 60,
            durationMinutes: 60,
          },
        });
      }
      const routineFriction = facts.find((f) => /consistency|completion has been low/i.test(f));
      if (routineFriction && req.context.includedDomains.includes("Routines")) {
        proposals.push({
          kind: "adjust-routine-cadence",
          domain: "Routines",
          title: "Reduce the weekly target for the low-consistency routine",
          rationale: routineFriction,
          evidence: [routineFriction],
          confidence: "limited",
          proposedParams: { match: "evening", timesPerWeek: 3 },
        });
      }
    }

    const text = proposals.length
      ? `Based on ${req.context.includedDomains.join(", ") || "no permitted domains"}, here ${
          proposals.length === 1 ? "is 1 proposal" : `are ${proposals.length} proposals`
        }. Each is a suggestion for you to accept, modify, or reject — nothing changes until you apply it.`
      : `Based on the permitted context I don't have a concrete change to propose right now. That is a valid outcome, not an error.`;

    return { ok: true, text, proposals };
  }
}
