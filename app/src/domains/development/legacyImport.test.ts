import { describe, it, expect } from "vitest";
import { resolveLegacyDevelopment } from "./legacyImport";

const LEGACY = {
  projects: JSON.stringify([
    {
      id: "proj-pbos",
      title: "Performance Buddy OS",
      status: "active",
      description: "APIs",
      skillIds: ["skill-react", "skill-ghost"], // ghost link dropped
    },
    { id: "proj-pbos", title: "dupe" },
  ]),
  skills: JSON.stringify([
    { id: "skill-react", title: "React", category: "FE", knowledgePercent: 70, practicePercent: 55 },
  ]),
  milestones: JSON.stringify([
    { id: "m2", projectId: "proj-pbos", title: "Second", completed: false, order: 2 },
    { id: "m1", projectId: "proj-pbos", title: "First", completed: true, order: 1 },
    { id: "m-ghost", projectId: "no-project", title: "Orphan", order: 3 },
  ]),
  evidence: JSON.stringify([
    { id: "e1", skillId: "skill-react", projectId: "proj-pbos", title: "Built layout", provenance: "independent", date: "2026-08-01" },
    { id: "e2", skillId: "skill-react", projectId: "ghost-proj", title: "AI hook", provenance: "ai-assisted", date: "2026-08-02" },
    { id: "e3", skillId: "no-skill", title: "Orphan", provenance: "independent", date: "" },
  ]),
};

describe("resolveLegacyDevelopment", () => {
  const { graph, report } = resolveLegacyDevelopment(LEGACY);

  it("preserves IDs and skips a duplicate project", () => {
    expect(graph.projects.map((p) => p.id)).toEqual(["proj-pbos"]);
    expect(report.repairs.join(" ")).toMatch(/duplicate project id/);
  });

  it("resolves the legacy Project.skillIds[] into links, dropping dangling ones", () => {
    expect(graph.links).toEqual([{ projectId: "proj-pbos", skillId: "skill-react" }]);
    expect(report.repairs.join(" ")).toMatch(/skill-ghost/);
  });

  it("maps legacy `order` → `position` and sorts", () => {
    const forProj = graph.milestones.filter((m) => m.projectId === "proj-pbos");
    expect(forProj.map((m) => m.title)).toEqual(["First", "Second"]);
    expect(forProj.map((m) => m.position)).toEqual([0, 1]);
  });

  it("drops rows whose parent is missing and reports them", () => {
    expect(graph.milestones.find((m) => m.id === "m-ghost")).toBeUndefined();
    expect(graph.evidence.find((e) => e.id === "e3")).toBeUndefined();
    expect(report.repairs.join(" ")).toMatch(/m-ghost .* dropped/);
    expect(report.repairs.join(" ")).toMatch(/e3 .* dropped/);
  });

  it("keeps evidence whose project is missing, but nulls the project link", () => {
    const e2 = graph.evidence.find((e) => e.id === "e2")!;
    expect(e2.projectId).toBeNull();
    expect(report.repairs.join(" ")).toMatch(/e2 .* not found/);
  });

  it("never fabricates evidence or capability numbers", () => {
    // one usable evidence per real skill; nothing invented
    expect(graph.evidence.map((e) => e.id).sort()).toEqual(["e1", "e2"]);
    expect(graph.skills[0].knowledgePercent).toBe(70);
    expect("evidencePercent" in graph.skills[0]).toBe(false);
  });

  it("reports malformed blobs instead of throwing", () => {
    const r = resolveLegacyDevelopment({
      projects: "{bad",
      skills: null,
      milestones: "[]",
      evidence: null,
    });
    expect(r.report.malformed).toContain("pbos:development-projects");
    expect(r.graph.projects).toEqual([]);
  });

  it("empty input yields an empty graph", () => {
    const r = resolveLegacyDevelopment({
      projects: null,
      skills: null,
      milestones: null,
      evidence: null,
    });
    expect(r.graph).toEqual({ projects: [], skills: [], milestones: [], evidence: [], links: [] });
  });
});
