// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { KnowledgeProvider, useKnowledge } from "../knowledge/store";
import { DevelopmentProvider, useDevelopment } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let dev: ReturnType<typeof useDevelopment>;
let know: ReturnType<typeof useKnowledge>;

function Probe() {
  dev = useDevelopment();
  know = useKnowledge();
  return <div data-testid="ready">{String(dev.loaded && know.loaded)}</div>;
}
function Harness() {
  return (
    <KnowledgeProvider>
      <DevelopmentProvider>
        <Probe />
      </DevelopmentProvider>
    </KnowledgeProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

async function mount() {
  render(<Harness />);
  await waitFor(() => expect(screen.getByTestId("ready")).toHaveTextContent("true"));
}

async function seed() {
  await act(async () => {
    await dev.createSkill({ title: "React", category: "Frontend", knowledgePercent: 40, practicePercent: 20 });
  });
  await act(async () => {
    know.createTopic({ title: "React Hooks", category: "development", context: "", relatedGoalId: null });
  });
}

describe("Development ↔ Knowledge — reference + explicit evidence handoff", () => {
  it("a Skill references ONE Knowledge concept; Development capability is not raised by linking", async () => {
    await mount();
    await seed();
    const sId = dev.skills[0].id;
    const kId = know.topics[0].id;
    const before = dev.getSkillEvidenceScore(sId).evidencePercent;

    await act(async () => {
      await dev.linkSkillKnowledge(sId, kId);
    });
    expect(dev.getSkill(sId)!.knowledgeTopicId).toBe(kId);
    expect(dev.getSkillEvidenceScore(sId).evidencePercent).toBe(before); // unchanged
    expect(dev.getSkill(sId)!.knowledgePercent).toBe(40); // the axis is untouched

    // deleting the concept clears the reference; the Skill survives
    await act(async () => {
      await know.deleteTopic(kId);
    });
    expect(dev.getSkill(sId)).toBeDefined();
    expect(dev.getSkill(sId)!.knowledgeTopicId).toBeNull();
  });

  it("explicit evidence handoff creates exactly ONE Knowledge evidence row and is idempotent", async () => {
    await mount();
    await seed();
    const sId = dev.skills[0].id;
    const kId = know.topics[0].id;
    await act(async () => {
      await dev.linkSkillKnowledge(sId, kId);
    });
    await act(async () => {
      await dev.addEvidence(sId, {
        title: "Built the hooks layer myself",
        provenance: "independent",
        projectId: null,
        date: "2026-03-01",
      });
    });
    const evId = dev.getEvidenceForSkill(sId)[0].id;

    let res!: Awaited<ReturnType<typeof dev.sendEvidenceToKnowledge>>;
    await act(async () => {
      res = await dev.sendEvidenceToKnowledge(evId);
    });
    expect(res.ok).toBe(true);
    await waitFor(() => expect(know.getEvidenceForTopic(kId)).toHaveLength(1));
    expect(know.getEvidenceForTopic(kId)[0].type).toBe("practice");
    expect(know.getEvidenceForTopic(kId)[0].title).toMatch(/Skill evidence — React: Built the hooks/);

    // second send is a no-op — still exactly one row
    await act(async () => {
      res = await dev.sendEvidenceToKnowledge(evId);
    });
    expect(res.ok && res.already).toBe(true);
    expect(know.getEvidenceForTopic(kId)).toHaveLength(1);
  });

  it("raw unreviewed AI-assisted evidence can NOT be handed to Knowledge", async () => {
    await mount();
    await seed();
    const sId = dev.skills[0].id;
    const kId = know.topics[0].id;
    await act(async () => {
      await dev.linkSkillKnowledge(sId, kId);
    });
    await act(async () => {
      await dev.addEvidence(sId, {
        title: "AI wrote the reducer",
        provenance: "ai-assisted",
        projectId: null,
        date: "2026-03-02",
      });
    });
    const evId = dev.getEvidenceForSkill(sId)[0].id;
    let res!: Awaited<ReturnType<typeof dev.sendEvidenceToKnowledge>>;
    await act(async () => {
      res = await dev.sendEvidenceToKnowledge(evId);
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toBe("unreviewed-ai");
    expect(know.getEvidenceForTopic(kId)).toHaveLength(0);
  });

  it("handoff with no linked concept is refused — nothing is invented", async () => {
    await mount();
    await seed();
    const sId = dev.skills[0].id;
    await act(async () => {
      await dev.addEvidence(sId, {
        title: "Shipped a feature",
        provenance: "independent",
        projectId: null,
        date: "2026-03-03",
      });
    });
    const evId = dev.getEvidenceForSkill(sId)[0].id;
    let res!: Awaited<ReturnType<typeof dev.sendEvidenceToKnowledge>>;
    await act(async () => {
      res = await dev.sendEvidenceToKnowledge(evId);
    });
    expect(res.ok).toBe(false);
    expect(!res.ok && res.reason).toBe("no-knowledge-link");
    expect(know.topics[0].hasEvidence).toBe(false);
  });
});
