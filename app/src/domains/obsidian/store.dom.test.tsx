// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import { KnowledgeProvider, useKnowledge } from "../knowledge/store";
import { ObsidianProvider, useObsidian } from "./store";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

/* eslint-disable react/globals */
let obs: ReturnType<typeof useObsidian>;
let know: ReturnType<typeof useKnowledge>;

function Probe() {
  obs = useObsidian();
  know = useKnowledge();
  return <div data-testid="ready">{String(obs.loaded && know.loaded)}</div>;
}
function Harness() {
  return (
    <KnowledgeProvider>
      <ObsidianProvider>
        <Probe />
      </ObsidianProvider>
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

describe("Obsidian store — vault boundary, note links never touch mastery", () => {
  it("moves not-connected → indexed on connect + refresh; states are distinct", async () => {
    await mount();
    expect(obs.hubState).toBe("not-connected");

    await act(async () => {
      await obs.connect("demo-vault");
    });
    // connected but not scanned yet → empty
    expect(["empty", "indexed"]).toContain(obs.hubState);

    await act(async () => {
      await obs.refresh();
    });
    expect(obs.hubState).toBe("indexed");
    expect(obs.notes.length).toBeGreaterThanOrEqual(3);
    expect(obs.lastScan?.skippedNonMd ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("linking a note to a Knowledge topic changes NO mastery, and unlink is clean", async () => {
    await mount();
    await act(async () => {
      know.createTopic({ title: "Binary Trees", category: "academic", context: "DS", relatedGoalId: null });
    });
    const kId = know.topics[0].id;
    expect(know.topics[0].hasEvidence).toBe(false);

    await act(async () => {
      await obs.connect("demo-vault");
    });
    await act(async () => {
      await obs.refresh();
    });
    await act(async () => {
      await obs.linkNote(kId, "Binary Trees.md");
    });
    expect(obs.linksForTopic(kId)).toHaveLength(1);
    expect(obs.resolveLinkState(obs.linksForTopic(kId)[0])).toBe("ok");

    // mastery is still unknown — a link is not evidence
    expect(know.topics[0].hasEvidence).toBe(false);
    expect(know.getEvidenceForTopic(kId)).toHaveLength(0);

    await act(async () => {
      await obs.unlinkNote(obs.linksForTopic(kId)[0].id);
    });
    expect(obs.linksForTopic(kId)).toHaveLength(0);
    expect(know.topics.find((t) => t.id === kId)).toBeDefined(); // topic untouched
  });

  it("an externally-removed linked file shows as stale; the Knowledge topic + its evidence survive", async () => {
    await mount();
    await act(async () => {
      know.createTopic({ title: "Graphs", category: "academic", context: "DS", relatedGoalId: null });
    });
    const kId = know.topics[0].id;
    await act(async () => {
      know.addEvidence(kId, { type: "recall", title: "drill", score: 7, maxScore: 10, date: "2026-02-01" });
    });
    await act(async () => {
      await obs.connect("demo-vault");
      await obs.refresh();
    });
    await act(async () => {
      await obs.linkNote(kId, "Binary Trees.md");
    });
    await act(async () => {
      await obs.simulateExternalRemoval!(["Binary Trees.md"]);
    });

    const link = obs.linksForTopic(kId)[0];
    expect(link).toBeDefined();
    expect(obs.resolveLinkState(link)).toBe("stale");
    // Knowledge is fully intact
    expect(know.getEvidenceForTopic(kId)).toHaveLength(1);
    expect(know.topics[0].hasEvidence).toBe(true);
  });

  it("disconnect keeps links (as unindexed) and never errors mastery; reconnect re-indexes", async () => {
    await mount();
    await act(async () => {
      know.createTopic({ title: "T", category: "general", context: "", relatedGoalId: null });
    });
    const kId = know.topics[0].id;
    await act(async () => {
      await obs.connect("demo-vault");
      await obs.refresh();
      await obs.linkNote(kId, "React/Hooks.md");
    });
    await act(async () => {
      await obs.disconnect();
    });
    expect(obs.hubState).toBe("not-connected");
    expect(obs.linksForTopic(kId)).toHaveLength(1);
    expect(obs.resolveLinkState(obs.linksForTopic(kId)[0])).toBe("unindexed");

    await act(async () => {
      await obs.connect("demo-vault");
      await obs.refresh();
    });
    expect(obs.resolveLinkState(obs.linksForTopic(kId)[0])).toBe("ok");
  });
});
