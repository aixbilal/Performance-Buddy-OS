import { describe, it, expect } from "vitest";
import { FakeProvider } from "./fakeProvider";
import { makeAIProvider, NullProvider } from "./index";
import { RemoteOpenAIProvider } from "./remoteProvider";
import type { AIRequest } from "./types";
import { DEFAULT_AI_CONFIG } from "./types";

const req = (over: Partial<AIRequest> = {}): AIRequest => ({
  task: "weekly-review-recommendations",
  messages: [{ role: "user", content: "suggest changes" }],
  context: {
    includedDomains: ["Knowledge", "Planning"],
    excludedDomains: ["Money"],
    facts: [
      "[Knowledge] Binary Trees is review-due",
      "[Planning] weekly scheduled 8h of 21h capacity",
      "[Academics] Data Structures under-studied vs plan",
    ],
    ...(over.context ?? {}),
  },
  wantRecommendations: true,
  ...over,
});

describe("FakeProvider — deterministic, drives every failure class", () => {
  it("ok mode produces allowlisted structured proposals from the facts", async () => {
    const res = await new FakeProvider("ok").complete(req());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.proposals.length).toBeGreaterThanOrEqual(1);
    expect(res.proposals.map((p) => p.kind)).toContain("set-knowledge-review");
    expect(res.proposals.every((p) => typeof p.proposedParams === "object")).toBe(true);
  });

  it("empty mode is ok with zero proposals; not an error", async () => {
    const res = await new FakeProvider("empty").complete(req());
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.proposals).toEqual([]);
  });

  it.each(["timeout", "network", "auth", "rate-limit", "malformed"] as const)(
    "%s mode returns a typed failure, never a fake success",
    async (mode) => {
      const res = await new FakeProvider(mode).complete(req());
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.failure).toBe(mode);
    },
  );

  it("does not propose for a domain missing from includedDomains", async () => {
    const res = await new FakeProvider("ok").complete(
      req({ context: { includedDomains: ["Knowledge"], excludedDomains: ["Planning", "Routines"], facts: ["[Academics] Data Structures under-studied vs plan"] } }),
    );
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.proposals.some((p) => p.domain === "Planning")).toBe(false);
  });
});

describe("makeAIProvider — config-driven selection, never changes authority", () => {
  it("returns the FakeProvider by default", () => {
    expect(makeAIProvider(DEFAULT_AI_CONFIG, false).kind).toBe("fake");
  });
  it("returns a disabled NullProvider when config.enabled is false", () => {
    const p = makeAIProvider({ ...DEFAULT_AI_CONFIG, enabled: false }, true);
    expect(p.kind).toBe("null");
    expect(p.status().failure).toBe("disabled");
  });
  it("openai-compatible without a credential falls back to not-configured", () => {
    const p = makeAIProvider(
      { providerId: "openai-compatible", model: "m", baseUrl: "https://x/v1", enabled: true },
      false,
    );
    expect(p.kind).toBe("null");
    expect(p.status().failure).toBe("not-configured");
  });
  it("openai-compatible with a credential + baseUrl selects the remote adapter", () => {
    const p = makeAIProvider(
      { providerId: "openai-compatible", model: "m", baseUrl: "https://x/v1", enabled: true },
      true,
    );
    expect(p.kind).toBe("remote");
    expect(p instanceof RemoteOpenAIProvider).toBe(true);
  });
});

describe("NullProvider — never makes a call", () => {
  it("complete returns the fixed failure", async () => {
    const res = await new NullProvider("not-configured").complete(req());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure).toBe("not-configured");
  });
});

describe("RemoteOpenAIProvider — reports not-configured without a key", () => {
  it("status + complete fail closed when no VITE_PBOS_AI_API_KEY is set", async () => {
    const p = new RemoteOpenAIProvider({ baseUrl: "https://x/v1", model: "m" });
    expect(p.status().ready).toBe(false);
    const res = await p.complete(req());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.failure).toBe("not-configured");
  });
});
