import { describe, it, expect } from "vitest";
import { matchType, rankResults, rebuildIndex } from "./engine";
import type { SearchResult } from "./types";

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    id: "r1",
    entityType: "knowledge-topic",
    title: "Binary Trees",
    subtitle: "Data Structures",
    domain: "Knowledge",
    canonicalRoute: "/knowledge/topic-binary-trees",
    keywords: ["trees", "traversal"],
    updatedAt: "2026-08-27",
    ...overrides,
  };
}

describe("matchType — the exact tier order from §9", () => {
  it("matches exact title case-insensitively", () => {
    expect(matchType("binary trees", result({}))).toBe("exact");
  });
  it("matches prefix", () => {
    expect(matchType("binary", result({}))).toBe("prefix");
  });
  it("matches contains when the query is in the middle of the title, not at the start", () => {
    expect(matchType("trees", result({ title: "Advanced Binary Trees" }))).toBe("contains");
  });
  it("matches a true contains (not prefix)", () => {
    expect(matchType("trees", result({ title: "Advanced Binary Structures with Trees" }))).toBe("contains");
  });
  it("matches metadata/keywords when title does not match", () => {
    expect(matchType("traversal", result({}))).toBe("metadata");
  });
  it("returns none for a genuinely unrelated query", () => {
    expect(matchType("money budget", result({}))).toBe("none");
  });
});

describe("rankResults — context/recency boost, never override tier order (§9)", () => {
  it("ranks an exact match above a prefix match even if the prefix match is recent and in-context", () => {
    const exactMatch = result({ id: "exact", title: "Binary Trees", domain: "Knowledge" });
    const prefixMatch = result({ id: "prefix", title: "Binary Trees Advanced Topics", domain: "Development" });

    const ranked = rankResults("Binary Trees", [prefixMatch, exactMatch], ["prefix"], "Development");

    // Even though "prefix" is recent AND matches the context domain, it must
    // not outrank the genuinely exact match — this is the core §9 guarantee.
    expect(ranked[0].result.id).toBe("exact");
  });

  it("uses recency/context to break ties WITHIN the same tier", () => {
    const a = result({ id: "a", title: "Binary Trees", domain: "Knowledge" });
    const b = result({ id: "b", title: "Binary Trees", domain: "Academics" });

    const ranked = rankResults("Binary Trees", [a, b], [], "Academics");
    // Both are exact matches; "b" gets the context boost and should rank first.
    expect(ranked[0].result.id).toBe("b");
  });

  it("excludes results with no match at all", () => {
    const unrelated = result({ id: "x", title: "Money Overview", keywords: ["budget"] });
    const ranked = rankResults("binary trees", [unrelated]);
    expect(ranked).toHaveLength(0);
  });
});

describe("rebuildIndex — derived, not authoritative (§10)", () => {
  it("produces an equivalent index from the same source entries, proving it's safely rebuildable", () => {
    const source = [result({ id: "a" }), result({ id: "b", title: "Something Else" })];
    const rebuilt1 = rebuildIndex(source);
    const rebuilt2 = rebuildIndex(source);
    expect(rebuilt1).toEqual(rebuilt2);
    expect(rebuilt1).toEqual(source);
  });

  it("does not mutate the source entries it was built from", () => {
    const source = [result({ id: "a" })];
    const snapshot = JSON.stringify(source);
    const rebuilt = rebuildIndex(source);
    rebuilt[0].title = "Corrupted Index Entry";
    // Source must remain untouched even if the derived index copy is mutated.
    expect(JSON.stringify(source)).toBe(snapshot);
  });
});
