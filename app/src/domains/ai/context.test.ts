import { describe, it, expect } from "vitest";
import { buildContextManifest, describeContextManifest, type DomainPermissions } from "./context";

const permissions: DomainPermissions = {
  Academics: "read-recommend",
  Knowledge: "read",
  Planning: "read-recommend",
  Money: "no-access",
};

const facts = {
  Academics: ["CGPA 3.2 across 30 credits"],
  Knowledge: ["Binary Trees is review-due"],
  Planning: ["weekly scheduled 12h of 21h capacity"],
  Money: ["balance Rs 50,000"], // must never appear
};

describe("buildContextManifest — permitted intersection only (docs 30.05)", () => {
  it("includes requested ∩ (read | read-recommend); excludes everything else explicitly", () => {
    const m = buildContextManifest(["Academics", "Knowledge", "Money", "Development"], permissions, facts);
    expect(m.includedDomains).toEqual(["Academics", "Knowledge"]);
    expect(m.excludedDomains).toContain("Money");
    expect(m.excludedDomains).toContain("Planning"); // not requested
    expect(m.facts).toEqual([
      "[Academics] CGPA 3.2 across 30 credits",
      "[Knowledge] Binary Trees is review-due",
    ]);
    expect(m.facts.join(" ")).not.toContain("Rs 50,000");
  });

  it("a no-access domain is never included even when requested and it has facts", () => {
    const m = buildContextManifest(["Money"], permissions, facts);
    expect(m.includedDomains).toEqual([]);
    expect(m.facts).toEqual([]);
    expect(m.excludedDomains).toContain("Money");
  });

  it("describeContextManifest gives a human summary, never raw JSON", () => {
    const m = buildContextManifest(["Academics"], permissions, facts);
    const d = describeContextManifest(m);
    expect(d.included).toEqual(["[Academics] CGPA 3.2 across 30 credits"]);
    expect(d.excluded).toContain("Money");
  });
});
