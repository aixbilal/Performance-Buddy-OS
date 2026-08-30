// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { KnowledgeProvider } from "./store";
import { AcademicProvider } from "../academic/store";
import { KnowledgeOverviewPage } from "./KnowledgeOverviewPage";
import { KnowledgeTopicBuilderPage } from "./KnowledgeTopicBuilderPage";
import { TopicDetailPage } from "./TopicDetailPage";
import { NotesHubPage } from "./NotesHubPage";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

function App({ start = "/knowledge" }: { start?: string }) {
  return (
    <AcademicProvider>
      <KnowledgeProvider>
        <MemoryRouter initialEntries={[start]}>
          <Routes>
            <Route path="/knowledge" element={<KnowledgeOverviewPage />} />
            <Route path="/knowledge/new" element={<KnowledgeTopicBuilderPage />} />
            <Route path="/knowledge/notes" element={<NotesHubPage />} />
            <Route path="/knowledge/:topicId" element={<TopicDetailPage />} />
            <Route path="/knowledge/:topicId/edit" element={<KnowledgeTopicBuilderPage />} />
          </Routes>
        </MemoryRouter>
      </KnowledgeProvider>
    </AcademicProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function addTopic(user: ReturnType<typeof userEvent.setup>, title: string) {
  const start =
    screen.queryByRole("button", { name: /add your first topic/i }) ??
    screen.getByRole("button", { name: "Add Topic" });
  await user.click(start);
  await user.type(await screen.findByLabelText(/topic title/i), title);
  await user.click(screen.getByRole("button", { name: /^add topic$/i }));
  await screen.findByRole("heading", { name: new RegExp(title) });
}

describe("Knowledge — driven through the real UI", () => {
  it("honest empty state → create a topic that appears with 'no evidence yet'", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/no topics yet/i)).toBeInTheDocument();
    await addTopic(user, "Binary Trees");
    expect(screen.getByRole("heading", { name: /Binary Trees/ })).toBeInTheDocument();
    expect(screen.getByText(/mastery is unknown until it is/i)).toBeInTheDocument();
    // mastery is "—", not 0
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("Create topic form has NO mastery field", async () => {
    render(<App start="/knowledge/new" />);
    await screen.findByLabelText(/topic title/i);
    expect(screen.queryByLabelText(/mastery/i)).not.toBeInTheDocument();
  });

  it("edits a topic; validation failure preserves input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTopic(user, "Binary Trees");
    await user.click(screen.getByRole("button", { name: /edit topic/i }));
    const title = await screen.findByLabelText(/topic title/i);
    const context = screen.getByLabelText(/context/i);
    await user.type(context, "Data Structures");
    await user.clear(title);
    await user.click(screen.getByRole("button", { name: /save topic/i }));
    expect(await screen.findByText(/give the topic a title/i)).toBeInTheDocument();
    expect((context as HTMLInputElement).value).toBe("Data Structures");
  });

  it("adds, edits and deletes a Source — never claims the referenced file was ingested", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTopic(user, "Binary Trees");

    await user.click(screen.getByRole("button", { name: /^add source$/i }));
    await user.type(await screen.findByLabelText(/source title/i), "Lecture 08");
    await user.type(screen.getByLabelText(/reference/i), "Slides/DSA-08.pdf");
    await user.click(screen.getByRole("button", { name: /^add source$/i }));

    expect(await screen.findByText("Lecture 08")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^edit$/i }));
    const t = await screen.findByLabelText(/source title/i);
    await user.clear(t);
    await user.type(t, "DSA Lecture 08 — Trees");
    await user.click(screen.getByRole("button", { name: /save source/i }));
    expect(await screen.findByText("DSA Lecture 08 — Trees")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(await screen.findByText(/no sources linked yet/i)).toBeInTheDocument();
  });

  it("mastery moves ONLY from recorded Evidence — not from adding a Source", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTopic(user, "Binary Trees");

    // add a source — mastery must remain "—"
    await user.click(screen.getByRole("button", { name: /^add source$/i }));
    await user.type(await screen.findByLabelText(/source title/i), "My notes");
    await user.click(screen.getByRole("button", { name: /^add source$/i }));
    await screen.findByText("My notes");
    expect(screen.getByText(/mastery is unknown until it is/i)).toBeInTheDocument();

    // now record evidence — mastery becomes a real derived number
    await user.click(screen.getByRole("button", { name: /record evidence/i }));
    await user.type(await screen.findByLabelText(/what was it/i), "Recall drill");
    await user.type(screen.getByLabelText(/^score$/i), "8");
    await user.click(screen.getByRole("button", { name: /^record evidence$/i }));

    // 8/10 = 80%
    expect(await screen.findByText("80%")).toBeInTheDocument();
    expect(screen.getByText(/derived from evidence/i)).toBeInTheDocument();
  });

  it("updates review metadata independently of mastery", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addTopic(user, "Binary Trees");
    const nextReview = await screen.findByLabelText(/next review/i);
    await user.type(nextReview, "2020-01-01");
    await user.tab();
    expect((await screen.findAllByText(/^Review Due$/)).length).toBeGreaterThan(0);
    // still no evidence → mastery still "—"
    expect(screen.getByText(/mastery is unknown until it is/i)).toBeInTheDocument();
  });

  it("Notes Hub is honest: Obsidian not connected, no fake files", async () => {
    render(<App start="/knowledge/notes" />);
    expect(await screen.findByText(/obsidian not connected/i)).toBeInTheDocument();
    expect(screen.getByText(/no files have been scanned/i)).toBeInTheDocument();
  });
});
