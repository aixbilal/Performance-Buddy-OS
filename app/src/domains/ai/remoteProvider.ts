/**
 * RemoteOpenAIProvider — the real provider boundary (OpenAI-compatible
 * chat/completions). Structurally complete per docs 24.13: it normalises every
 * failure class, preserves the caller's input, and treats the model reply as
 * untrusted until it parses + schema-validates.
 *
 * The API KEY is never stored by PBOS. It is read at call time from the
 * `VITE_PBOS_AI_API_KEY` build/runtime env var (a credential boundary). If it is
 * absent the provider reports `not-configured` and makes no request. This file
 * is never exercised by the automated tests — the FakeProvider covers the
 * contract; this is the seam a packaged build uses.
 */

import type {
  AIFailureClass,
  AIProvider,
  AIRequest,
  AIResponse,
  ProposedRecommendation,
} from "./types";

const TIMEOUT_MS = 30_000;
const MAX_TEXT = 8_000;

function apiKey(): string | null {
  try {
    const k = (import.meta as { env?: Record<string, string> }).env?.VITE_PBOS_AI_API_KEY;
    return k && k.trim() ? k.trim() : null;
  } catch {
    return null;
  }
}

function sanitize(s: unknown): string {
  return String(s ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_TEXT);
}

function coerceProposals(raw: unknown): ProposedRecommendation[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { proposals?: unknown }).proposals;
  if (!Array.isArray(list)) return [];
  const out: ProposedRecommendation[] = [];
  for (const p of list) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    if (typeof o.kind !== "string" || typeof o.title !== "string") continue;
    out.push({
      kind: sanitize(o.kind),
      domain: sanitize(o.domain) || "Planning",
      title: sanitize(o.title),
      rationale: sanitize(o.rationale),
      evidence: Array.isArray(o.evidence) ? o.evidence.map(sanitize).slice(0, 8) : [],
      confidence:
        o.confidence === "high" || o.confidence === "moderate" ? o.confidence : "limited",
      proposedParams:
        o.proposedParams && typeof o.proposedParams === "object"
          ? (o.proposedParams as Record<string, unknown>)
          : {},
    });
  }
  return out;
}

export class RemoteOpenAIProvider implements AIProvider {
  readonly id = "openai-compatible";
  readonly kind = "remote" as const;
  private cfg: { baseUrl: string; model: string };
  constructor(cfg: { baseUrl: string; model: string }) {
    this.cfg = cfg;
  }

  status() {
    if (!apiKey()) return { ready: false, failure: "not-configured" as const };
    if (!this.cfg.baseUrl) return { ready: false, failure: "not-configured" as const };
    return { ready: true };
  }

  async complete(req: AIRequest): Promise<AIResponse> {
    const key = apiKey();
    if (!key || !this.cfg.baseUrl) {
      return { ok: false, failure: "not-configured", message: "No AI provider credentials are configured." };
    }

    const system =
      "You are the Performance Buddy OS coach. You may ONLY propose changes; you never apply them. " +
      "Use only the facts provided. If asked for recommendations, reply with strict JSON " +
      '{ "text": string, "proposals": [{ "kind", "domain", "title", "rationale", "evidence": string[], "confidence", "proposedParams": object }] }. ' +
      "Valid kinds: create-action, schedule-block, set-knowledge-review, adjust-routine-cadence.";
    const contextBlock =
      `Included domains: ${req.context.includedDomains.join(", ") || "none"}.\n` +
      `Excluded (do not reference): ${req.context.excludedDomains.join(", ")}.\n` +
      `Facts:\n${req.context.facts.map((f) => `- ${f}`).join("\n") || "- (none)"}`;

    const body = {
      model: this.cfg.model || "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "system", content: contextBlock },
        ...req.messages,
      ],
      temperature: 0.2,
      ...(req.wantRecommendations ? { response_format: { type: "json_object" as const } } : {}),
    };

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
    } catch (e) {
      clearTimeout(timer);
      const failure: AIFailureClass =
        e instanceof DOMException && e.name === "AbortError" ? "timeout" : "network";
      return { ok: false, failure, message: "The AI provider could not be reached. Your input is kept." };
    }
    clearTimeout(timer);

    if (res.status === 401 || res.status === 403) {
      return { ok: false, failure: "auth", message: "The AI provider rejected the credentials." };
    }
    if (res.status === 429) {
      return { ok: false, failure: "rate-limit", message: "The AI provider is rate-limiting. Try again shortly." };
    }
    if (!res.ok) {
      return { ok: false, failure: "unknown", message: `The AI provider returned ${res.status}.` };
    }

    let json: unknown;
    try {
      json = await res.json();
    } catch {
      return { ok: false, failure: "malformed", message: "The AI provider returned an unreadable response." };
    }
    const content = sanitize(
      (json as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0]?.message?.content,
    );
    if (!content) {
      return { ok: false, failure: "empty", message: "The AI provider returned an empty response." };
    }

    if (!req.wantRecommendations) {
      return { ok: true, text: content, proposals: [] };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      return { ok: false, failure: "malformed", message: "The AI provider did not return valid JSON." };
    }
    return {
      ok: true,
      text: sanitize((parsed as { text?: unknown })?.text) || "Proposals ready for your review.",
      proposals: coerceProposals(parsed),
    };
  }
}
