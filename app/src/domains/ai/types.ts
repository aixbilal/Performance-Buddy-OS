/**
 * Performance Buddy OS — AI provider boundary (Batch 6).
 *
 * Per docs 24.12 (Provider Abstraction) and 24.13 (Provider Failure Handling):
 * domain logic never imports a vendor SDK. A provider ADAPTER translates the
 * common `AIRequest` contract into a vendor call and normalises the response,
 * usage, and every failure class. Secrets live in a credential boundary and
 * never enter prompts, logs, or client-visible config.
 *
 *   AI output is UNTRUSTED INPUT until it passes schema + allowlist + domain
 *   validation (docs 23 invariant 5). A `ProposedRecommendation` is never a
 *   mutation — it is a candidate for the deterministic Apply pipeline.
 */

export type AIRole = "system" | "user" | "assistant";
export type AIMessage = { role: AIRole; content: string };

/** Deterministic, already-permitted context — assembled by PBOS, never a raw DB dump. */
export type ContextManifest = {
  includedDomains: string[];
  excludedDomains: string[];
  /** Human-readable bullet facts only. No JSON, no private note bodies, no marks. */
  facts: string[];
};

export type AIRequest = {
  /** Short task label, e.g. "weekly-review-recommendations", "coach-chat". */
  task: string;
  messages: AIMessage[];
  context: ContextManifest;
  /** Ask the provider for structured recommendation proposals in its reply. */
  wantRecommendations?: boolean;
};

export type ProposalConfidence = "high" | "moderate" | "limited";

export type ProposedRecommendation = {
  /** Must match an allowlisted Apply-adapter key or it is rejected. */
  kind: string;
  domain: string;
  title: string;
  rationale: string;
  evidence: string[];
  confidence: ProposalConfidence;
  /** Opaque kind-specific parameters — validated by the adapter, never executed raw. */
  proposedParams: Record<string, unknown>;
};

export type AIFailureClass =
  | "not-configured"
  | "disabled"
  | "timeout"
  | "network"
  | "auth"
  | "rate-limit"
  | "malformed"
  | "empty"
  | "content-refused"
  | "unknown";

export type AIResponse =
  | { ok: true; text: string; proposals: ProposedRecommendation[] }
  | { ok: false; failure: AIFailureClass; message: string };

export interface AIProvider {
  readonly id: string;
  readonly kind: "fake" | "remote" | "null";
  /** Whether a real call could succeed right now (no network round-trip). */
  status(): { ready: boolean; failure?: AIFailureClass };
  complete(req: AIRequest): Promise<AIResponse>;
}

export type AIProviderConfig = {
  providerId: string; // "fake" | "openai-compatible"
  model: string;
  baseUrl: string;
  enabled: boolean;
};

export const DEFAULT_AI_CONFIG: AIProviderConfig = {
  providerId: "fake",
  model: "",
  baseUrl: "",
  enabled: true,
};
