// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { DevelopmentProvider } from "./store";
import { KnowledgeProvider } from "../knowledge/store";
import { DevelopmentOverviewPage } from "./DevelopmentOverviewPage";
import { ProjectDetailPage } from "./ProjectDetailPage";
import { SkillDetailPage } from "./SkillDetailPage";
import { LearningPathPage } from "./LearningPathPage";
import { ProjectBuilderPage, SkillBuilderPage } from "./DevelopmentBuilderPages";

vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => false, invoke: vi.fn() }));

function App({ start = "/development" }: { start?: string }) {
  return (
    <KnowledgeProvider>
    <DevelopmentProvider>
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/development" element={<DevelopmentOverviewPage />} />
          <Route path="/development/learning-path" element={<LearningPathPage />} />
          <Route path="/development/projects/new" element={<ProjectBuilderPage />} />
          <Route path="/development/projects/:projectId" element={<ProjectDetailPage />} />
          <Route path="/development/projects/:projectId/edit" element={<ProjectBuilderPage />} />
          <Route path="/development/skills/new" element={<SkillBuilderPage />} />
          <Route path="/development/skills/:skillId" element={<SkillDetailPage />} />
          <Route path="/development/skills/:skillId/edit" element={<SkillBuilderPage />} />
        </Routes>
      </MemoryRouter>
    </DevelopmentProvider>
    </KnowledgeProvider>
  );
}

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

async function addProject(user: ReturnType<typeof userEvent.setup>, title: string) {
  await screen.findAllByRole("button", { name: /add (your first project|project)/i }); // wait past LOADING
  const start =
    screen.queryByRole("button", { name: /add your first project/i }) ??
    screen.getByRole("button", { name: "Add Project" });
  await user.click(start);
  await user.type(await screen.findByLabelText(/project name/i), title);
  await user.click(screen.getByRole("button", { name: /^add project$/i }));
  await screen.findByRole("heading", { name: new RegExp(title) });
}

async function addSkill(user: ReturnType<typeof userEvent.setup>, title: string) {
  await screen.findAllByRole("button", { name: /^add skill$/i }); // wait past LOADING
  await user.click(screen.getByRole("button", { name: "Add Skill" }));
  await user.type(await screen.findByLabelText(/skill name/i), title);
  await user.click(screen.getByRole("button", { name: /^add skill$/i }));
  await screen.findByRole("heading", { name: new RegExp(title) });
}

describe("Development — driven through the real UI", () => {
  it("honest empty state → create a project that appears immediately", async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText(/nothing here yet/i)).toBeInTheDocument();
    await addProject(user, "Performance Buddy OS");
    expect(screen.getByRole("heading", { name: /Performance Buddy OS/ })).toBeInTheDocument();
    expect(screen.getByText(/No milestones yet — not 0%/i)).toBeInTheDocument();
  });

  it("validation failure preserves the other input", async () => {
    const user = userEvent.setup();
    render(<App start="/development/projects/new" />);
    const desc = await screen.findByLabelText(/description/i);
    await user.type(desc, "keep me");
    await user.click(screen.getByRole("button", { name: /^add project$/i }));
    expect(await screen.findByText(/give the project a title/i)).toBeInTheDocument();
    expect((desc as HTMLTextAreaElement).value).toBe("keep me");
  });

  it("adds + completes a milestone; project progress is milestone-derived, not skill capability", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addProject(user, "Performance Buddy OS");

    await user.type(screen.getByLabelText(/new milestone title/i), "Build dashboard");
    await user.click(screen.getByRole("button", { name: /^add milestone$/i }));
    expect(await screen.findByText("Build dashboard")).toBeInTheDocument();
    // 0/1 -> progress shows a real ratio now, "0%"
    expect(screen.getByText("0%")).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: /mark build dashboard complete/i }));
    expect(await screen.findByText("100%")).toBeInTheDocument();
  });

  it("links a Skill to a Project and the Skill's capability is NOT raised by linking", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSkill(user, "React");
    // React skill has no evidence yet
    expect(screen.getByText(/capability is unknown until it is/i)).toBeInTheDocument();

    render(<App start="/development" />);
    await addProject(user, "Performance Buddy OS");
    const linkSelect = await screen.findByLabelText(/link a skill to performance buddy os/i);
    await user.selectOptions(linkSelect, within(linkSelect).getByRole("option", { name: "React" }));
    await user.click(screen.getByRole("button", { name: /^link$/i }));
    expect(await screen.findByRole("button", { name: /^unlink$/i })).toBeInTheDocument();
    // linking recorded no evidence
    expect(screen.getByText(/linking a skill does not raise its capability/i)).toBeInTheDocument();
  });

  it("records evidence with provenance — unreviewed AI-assisted is shown but excluded from the score", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSkill(user, "React");

    // 1) independent evidence -> Evidence 100%
    await user.click(screen.getByRole("button", { name: /add evidence/i }));
    await user.type(await screen.findByLabelText(/evidence description/i), "Built layout myself");
    await user.click(screen.getByRole("button", { name: /^add evidence$/i }));
    expect(await screen.findByText("100%")).toBeInTheDocument();

    // 2) add an unreviewed ai-assisted record -> now 1 of 2 counts -> 50% + warning
    await user.click(screen.getByRole("button", { name: /add evidence/i }));
    await user.type(await screen.findByLabelText(/evidence description/i), "AI wrote the hook");
    await user.selectOptions(
      screen.getByLabelText(/evidence provenance/i),
      "ai-assisted",
    );
    await user.click(screen.getByRole("button", { name: /^add evidence$/i }));
    expect(await screen.findByText("50%")).toBeInTheDocument();
    expect(screen.getByText(/excluded from the Evidence score/i)).toBeInTheDocument();
  });

  it("toggles a skill onto the Learning Path with a target level", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addSkill(user, "React");
    await user.click(screen.getByRole("checkbox", { name: /on the learning path/i }));
    await user.selectOptions(await screen.findByLabelText(/roadmap target level/i), "strong");

    render(<App start="/development/learning-path" />);
    expect(await screen.findByText("React")).toBeInTheDocument();
    expect(screen.getByText(/target: strong/i)).toBeInTheDocument();
  });
});
