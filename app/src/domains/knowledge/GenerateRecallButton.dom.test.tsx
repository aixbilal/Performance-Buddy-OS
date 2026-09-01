// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// --- controlled stand-ins for the hooks the button uses -----------------
const state = {
  aiAvailability: "ready" as "ready" | "disabled",
  knowledgePermission: "read-recommend" as "read-recommend" | "no-access",
  providerText: "What is a graph?\nWhen is BFS better than DFS?",
  providerOk: true,
  readNote: vi.fn(async (_p: string) => ({
    relativePath: "notes/graphs.md",
    content: "graphs: nodes + edges; BFS layer by layer; DFS deep first. " + "x".repeat(4000),
    truncated: true,
  })),
  startCheck: vi.fn(async (_input: unknown) => "chk_1"),
  completeCalls: [] as { system: string; user: string }[],
};

vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("../intelligence/store", () => ({
  useAICoach: () => ({
    config: { providerId: "fake", model: "", baseUrl: "", enabled: true },
    credentialsPresent: false,
    aiAvailability: state.aiAvailability,
    permissions: { Knowledge: state.knowledgePermission },
  }),
}));
vi.mock("../academic/masteryStore", () => ({ useMastery: () => ({ startCheck: state.startCheck }) }));
vi.mock("../obsidian/store", () => ({ useObsidian: () => ({ readNote: state.readNote }) }));
vi.mock("../ai/index", () => ({
  makeAIProvider: () => ({
    async complete(req: { messages: { role: string; content: string }[] }) {
      state.completeCalls.push({
        system: req.messages.find((m) => m.role === "system")?.content ?? "",
        user: req.messages.find((m) => m.role === "user")?.content ?? "",
      });
      return state.providerOk
        ? { ok: true, text: state.providerText }
        : { ok: false, failure: "network", message: "down" };
    },
  }),
}));
vi.mock("../ai/context", () => ({
  canReadDomain: (_d: string, perms: Record<string, string>) =>
    perms.Knowledge === "read" || perms.Knowledge === "read-recommend",
}));

import { GenerateRecallButton } from "./GenerateRecallButton";

const linkedNotes = [
  { relativePath: "notes/graphs.md", title: "Graphs" },
  { relativePath: "notes/trees.md", title: "Trees" },
];

beforeEach(() => {
  state.aiAvailability = "ready";
  state.knowledgePermission = "read-recommend";
  state.providerText = "What is a graph?\nWhen is BFS better than DFS?";
  state.providerOk = true;
  state.completeCalls.length = 0;
  state.readNote.mockClear();
  state.startCheck.mockClear();
});

describe("GenerateRecallButton — scoped Obsidian preview", () => {
  it("no note ticked → no note is read and no note body is in the request", async () => {
    const user = userEvent.setup();
    render(<GenerateRecallButton knowledgeTopicId="k1" topicTitle="Graphs" linkedNotes={linkedNotes} />);
    await user.click(screen.getByRole("button", { name: /generate recall/i }));

    expect(state.readNote).not.toHaveBeenCalled();
    expect(state.completeCalls).toHaveLength(1);
    expect(state.completeCalls[0].user).not.toMatch(/note excerpt as scope/i);
    expect(state.completeCalls[0].user).not.toMatch(/nodes \+ edges/);
    expect(state.startCheck).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "recall", recallPrompts: ["What is a graph?", "When is BFS better than DFS?"] }),
    );
  });

  it("ticking exactly one note reads ONLY that note and scopes the request; truncation is disclosed", async () => {
    const user = userEvent.setup();
    render(<GenerateRecallButton knowledgeTopicId="k1" topicTitle="Graphs" linkedNotes={linkedNotes} />);
    await user.click(screen.getByRole("radio", { name: "Graphs" }));
    await user.click(screen.getByRole("button", { name: /generate recall/i }));

    expect(state.readNote).toHaveBeenCalledTimes(1);
    expect(state.readNote).toHaveBeenCalledWith("notes/graphs.md");
    const sent = state.completeCalls[0].user;
    expect(sent).toMatch(/note excerpt as scope/i);
    // the preview is bounded well under the 4000-char source
    expect(sent.length).toBeLessThan(3000);
    expect(await screen.findByText(/partial preview/i)).toBeInTheDocument();
  });

  it("permission denied → deterministic prompts, provider + readNote never touched", async () => {
    state.knowledgePermission = "no-access";
    const user = userEvent.setup();
    render(<GenerateRecallButton knowledgeTopicId="k1" topicTitle="Graphs" linkedNotes={linkedNotes} />);
    // the note picker is hidden entirely when AI is not allowed
    expect(screen.queryByRole("radio", { name: "Graphs" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /generate recall/i }));

    expect(state.readNote).not.toHaveBeenCalled();
    expect(state.completeCalls).toHaveLength(0);
    expect(state.startCheck).toHaveBeenCalledWith(expect.objectContaining({ kind: "recall" }));
    expect((state.startCheck.mock.calls[0]?.[0] as { recallPrompts: string[] }).recallPrompts.length).toBeGreaterThan(0);
  });

  it("provider failure → deterministic fallback with an honest message, still a governed check", async () => {
    state.providerOk = false;
    const user = userEvent.setup();
    render(<GenerateRecallButton knowledgeTopicId="k1" topicTitle="Graphs" linkedNotes={linkedNotes} />);
    await user.click(screen.getByRole("radio", { name: "Graphs" }));
    await user.click(screen.getByRole("button", { name: /generate recall/i }));

    // it tried, failed, fell back — a check is still started with real prompts
    expect(state.startCheck).toHaveBeenCalledWith(expect.objectContaining({ kind: "recall" }));
    expect((state.startCheck.mock.calls[0]?.[0] as { recallPrompts: string[] }).recallPrompts.length).toBeGreaterThan(0);
  });
});
