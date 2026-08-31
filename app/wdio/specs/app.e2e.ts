/**
 * Native desktop E2E — drives the REAL Performance Buddy OS renderer inside the
 * packaged Tauri window.
 *
 * Interaction goes through `browser.tauri.execute(fn)` (from @wdio/tauri-service
 * + tauri-plugin-wdio), which runs JS inside the actual PBOS frontend — the
 * supported, reliable path on Windows/WebView2.
 *
 *   Spec 1 (Batch 0): renderer proof + Tauri→Rust→SQLite round-trip.
 *   Spec 2 (Batch 1): the real-user Goal → System → Action scenario, then
 *                     verified straight out of SQLite via `perf_load`.
 */

// @wdio/tauri-service augments `browser` with `.tauri`; declare it loosely here.
declare const browser: WebdriverIO.Browser & {
  tauri: { execute: <T>(fn: () => T) => Promise<T> };
};

async function frontendText(): Promise<string> {
  return await browser.tauri.execute(() => document.body?.innerText || "");
}

async function invokeCmd<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  // args must be inlined into the executed function body (it is serialized).
  const src = `return window.__TAURI__.core.invoke(${JSON.stringify(cmd)}, ${JSON.stringify(args ?? {})})`;
  // eslint-disable-next-line no-new-func
  return (await browser.tauri.execute(new Function(src) as () => T)) as T;
}

/** set an <input>/<textarea> value the React way, or pick a <select> option. */
async function setField(selector: string, value: string): Promise<boolean> {
  const src = `
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    if (el.tagName === 'SELECT') {
      el.value = ${JSON.stringify(value)};
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;`;
  // eslint-disable-next-line no-new-func
  return (await browser.tauri.execute(new Function(src) as () => boolean)) as boolean;
}

/** click the first <button> whose trimmed text matches `re`. */
async function clickButton(re: string): Promise<boolean> {
  const src = `
    const rx = new RegExp(${JSON.stringify(re)}, 'i');
    const btn = [...document.querySelectorAll('button')].find(b => rx.test((b.textContent||'').trim()));
    if (!btn) return false; btn.click(); return true;`;
  // eslint-disable-next-line no-new-func
  return (await browser.tauri.execute(new Function(src) as () => boolean)) as boolean;
}

/** id of the input/textarea whose <label> text matches `re`. */
async function fieldIdByLabel(re: string): Promise<string | null> {
  const src = `
    const rx = new RegExp(${JSON.stringify(re)}, 'i');
    const lab = [...document.querySelectorAll('label')].find(l => rx.test(l.textContent||''));
    return lab && lab.getAttribute('for');`;
  // eslint-disable-next-line no-new-func
  return (await browser.tauri.execute(new Function(src) as () => string | null)) as string | null;
}

async function setByLabel(labelRe: string, value: string): Promise<boolean> {
  const id = await fieldIdByLabel(labelRe);
  return id ? setField(`#${id}`, value) : false;
}

async function nav(hash: string) {
  await browser.tauri.execute(new Function(`window.location.hash = ${JSON.stringify(hash)}`) as () => void);
}

async function waitForText(needle: string, timeout = 20_000) {
  await browser.waitUntil(async () => (await frontendText()).includes(needle), {
    timeout,
    timeoutMsg: `never saw "${needle}"`,
  });
}

describe("PBOS native desktop shell — renderer E2E", () => {
  it("renders the real app, fires a real control, and navigates two routes", async () => {
    await browser.waitUntil(
      async () => /Today|Focus Mode|Goals|Onboarding/.test(await frontendText()),
      { timeout: 60_000, timeoutMsg: "PBOS app shell never rendered" },
    );

    const hasRoot = await browser.tauri.execute(
      () => !!document.getElementById("root") && document.getElementById("root")!.childElementCount > 0,
    );
    expect(hasRoot).toBe(true);

    await nav("#/focus");
    await waitForText("Focus Mode");
    expect(await clickButton("^Start$")).toBe(true);
    await waitForText("Pause", 15_000);

    await nav("#/goals");
    await browser.waitUntil(
      async () => {
        const t = await frontendText();
        return t.includes("No goals yet") || t.includes("Create Goal");
      },
      { timeout: 20_000, timeoutMsg: "Goals route did not render" },
    );
  });

  it("persists through the real Tauri → Rust → SQLite path", async () => {
    const status = await invokeCmd<{ schema_version: number; localstorage_migrated: boolean }>("db_status");
    expect(status.schema_version).toBe(4); // Batch 2B migration v4 (Development + Fitness + Routines)
    expect(status.localstorage_migrated).toBe(true);

    await invokeCmd("kv_set", { key: "pbos:__e2e_probe__", value: JSON.stringify({ ok: true, n: 3 }) });
    const all = await invokeCmd<{ key: string; value: string }[]>("kv_get_all");
    const probe = all.find((e) => e.key === "pbos:__e2e_probe__");
    expect(probe).toBeTruthy();
    expect(JSON.parse(probe!.value)).toEqual({ ok: true, n: 3 });
    expect(all.filter((e) => e.key === "pbos:__e2e_probe__")).toHaveLength(1);
    await invokeCmd("kv_delete", { key: "pbos:__e2e_probe__" });
  });
});

describe("PBOS Batch 1 — real-user Goal → System → Action scenario", () => {
  it("creates the spine through the UI and verifies it straight out of SQLite", async () => {
    // 1. wipe the SQLite Performance spine (marker stays set → no re-import).
    await invokeCmd("perf_reset_for_test");

    // 2. Create a Goal via the builder (route always works regardless of the
    //    store's in-memory list; the final assertion reads SQLite, which the
    //    reset left empty).
    await nav("#/goals/new");
    await waitForText("Goal Builder");
    expect(await setByLabel("goal name", "Complete DSA revision")).toBe(true);
    expect(await clickButton("^create goal$")).toBe(true);
    await waitForText("Complete DSA revision");

    // 3. Create + link a System from the goal
    expect(await clickButton("manage systems")).toBe(true);
    await browser.pause(200);
    expect(await clickButton("create a system for this goal")).toBe(true);
    await waitForText("System name");
    expect(await setByLabel("system name", "Weekly DSA Study")).toBe(true);
    expect(await clickButton("^create system$")).toBe(true);
    await waitForText("Weekly DSA Study");
    await waitForText("Not enough activity yet"); // Unknown ≠ Zero

    // 4. Add an Action + progress its status via the explicit control
    expect(await clickButton("add action")).toBe(true);
    await waitForText("Estimate, minutes");
    expect(await setByLabel("^action$", "Revise Binary Trees")).toBe(true);
    expect(await clickButton("^add action$")).toBe(true);
    await waitForText("Revise Binary Trees");
    expect(await setField('select[id^="st-"]', "done")).toBe(true);
    await waitForText("100%");

    // 5. Verify the relationship from the Goal
    await nav("#/goals");
    await browser.pause(500);
    await browser.tauri.execute(() => {
      const link = [...document.querySelectorAll("a")].find((a) => /Complete DSA revision/i.test(a.textContent || ""));
      (link as HTMLAnchorElement)?.click();
    });
    await waitForText("Weekly DSA Study");

    // 6. Verify canonical records + relationships straight out of SQLite.
    //    The reset left SQLite empty, so this graph is exactly what the UI made.
    const graph = await invokeCmd<{
      goals: { id: string; title: string; lifecycle: string; metricTarget: number | null }[];
      systems: { id: string; title: string }[];
      actions: { id: string; title: string; status: string; systemId: string | null }[];
      links: { goalId: string; systemId: string }[];
    }>("perf_load");

    expect(graph.goals).toHaveLength(1);
    expect(graph.systems).toHaveLength(1);
    expect(graph.actions).toHaveLength(1);
    const goal = graph.goals.find((g) => g.title === "Complete DSA revision");
    const system = graph.systems.find((s) => s.title === "Weekly DSA Study");
    const action = graph.actions.find((a) => a.title === "Revise Binary Trees");
    expect(goal).toBeTruthy();
    expect(system).toBeTruthy();
    expect(action).toBeTruthy();
    expect(action!.systemId).toBe(system!.id); // one FK truth
    expect(action!.status).toBe("done");
    expect(graph.links).toEqual([{ goalId: goal!.id, systemId: system!.id }]); // one link truth
    expect(graph.links.filter((l) => l.goalId === goal!.id && l.systemId === system!.id)).toHaveLength(1);

    // cleanup so reruns start clean
    await invokeCmd("perf_reset_for_test");
  });
});

describe("PBOS Batch 2A — real-user Academic + Knowledge scenario", () => {
  it("creates a course, topic, knowledge concept + evidence, links them, and verifies straight out of SQLite", async () => {
    // 1. wipe both relational graphs (markers stay set → no re-import).
    await invokeCmd("acad_reset_for_test");
    await invokeCmd("know_reset_for_test");

    // 2. Create the canonical Knowledge concept + one piece of evidence via the UI.
    await nav("#/knowledge/new");
    await waitForText("Add Knowledge Topic");
    expect(await setByLabel("topic title", "Binary Trees")).toBe(true);
    expect(await clickButton("^add topic$")).toBe(true);
    await waitForText("No mastery evidence yet");
    expect(await clickButton("record evidence")).toBe(true);
    await waitForText("What was it");
    expect(await setByLabel("what was it", "Inorder traversal drill")).toBe(true);
    expect(await setByLabel("^score$", "8")).toBe(true);
    expect(await clickButton("^record evidence$")).toBe(true);
    await waitForText("80%"); // evidence-derived mastery

    // 3. Create the Course + Academic Topic via the UI.
    await nav("#/academics/new");
    await waitForText("Add Course");
    expect(await setByLabel("course name", "Data Structures")).toBe(true);
    expect(await clickButton("^add course$")).toBe(true);
    await waitForText("Weighted Score So Far");
    expect(await clickButton("^add topic$")).toBe(true);
    await waitForText("Topic title");
    expect(await setByLabel("topic title", "Binary Trees")).toBe(true);
    expect(await clickButton("^add topic$")).toBe(true);
    await waitForText("Not linked");

    // 4. Link the Academic Topic → the canonical Knowledge concept, through the UI.
    expect(
      await setField('select[id^="link-"]', await knowledgeTopicIdByTitle("Binary Trees")),
    ).toBe(true);
    expect(await clickButton("^link$")).toBe(true);
    await waitForText("Unlink Knowledge concept");

    // 5. Add an Assessment + marks via the UI.
    expect(await clickButton("^add assessment$")).toBe(true);
    await waitForText("Assessment title");
    expect(await setByLabel("assessment title", "Quiz 1")).toBe(true);
    expect(await setByLabel("total marks", "20")).toBe(true);
    expect(await setByLabel("weight %", "100")).toBe(true);
    expect(await clickButton("^add assessment$")).toBe(true);
    await waitForText("Quiz 1");
    expect(await setField('input[aria-label="Obtained marks for Quiz 1"]', "18")).toBe(true);
    // the marks field commits on blur → React listens for `focusout` (which bubbles).
    await browser.tauri.execute(() => {
      const el = document.querySelector(
        'input[aria-label="Obtained marks for Quiz 1"]',
      ) as HTMLInputElement | null;
      el?.dispatchEvent(new Event("focusout", { bubbles: true }));
    });
    await waitForText("90.0%"); // 18/20 * 100% weight, deterministic

    // 6. Add a Knowledge Source via the UI (back on the topic).
    await nav("#/knowledge");
    await waitForText("Binary Trees");
    await browser.pause(300);
    await browser.tauri.execute(() => {
      const link = [...document.querySelectorAll("a")].find((a) =>
        /Binary Trees/i.test(a.textContent || ""),
      );
      (link as HTMLAnchorElement)?.click();
    });
    // Card <h3> titles are CSS-uppercased; match on body copy instead.
    await waitForText("actual note content lives in Obsidian");
    expect(await clickButton("^add source$")).toBe(true);
    await waitForText("Source title");
    expect(await setByLabel("source title", "DSA Lecture 08")).toBe(true);
    await browser.pause(150); // let React flush the controlled-input change
    expect(await clickButton("^add source$")).toBe(true);
    await waitForText("DSA Lecture 08");
    // let every fire-and-forget write-through (invoke → Rust → SQLite) flush.
    await browser.pause(1200);

    // 7. Verify canonical records + the ONE cross-domain relationship straight out of SQLite.
    const acad = await invokeCmd<{
      courses: { id: string; title: string }[];
      topics: {
        id: string;
        title: string;
        courseId: string;
        professorCoverage: string;
        personalStudyPercent: number;
        knowledgeTopicId: string | null;
        masterySelfAssessed: number | null;
      }[];
      assessments: { id: string; title: string; obtainedMarks: number | null; weightPercent: number }[];
    }>("acad_load");
    const know = await invokeCmd<{
      topics: { id: string; title: string }[];
      sources: { id: string; title: string; topicId: string }[];
      evidence: { id: string; topicId: string; score: number; maxScore: number }[];
    }>("know_load");

    const course = acad.courses.find((c) => c.title === "Data Structures");
    const acadTopic = acad.topics.find((t) => t.title === "Binary Trees");
    const knowTopic = know.topics.find((t) => t.title === "Binary Trees");
    expect(course).toBeTruthy();
    expect(acadTopic).toBeTruthy();
    expect(knowTopic).toBeTruthy();

    // the ONE cross-domain link, owned by the Academic row
    expect(acadTopic!.courseId).toBe(course!.id);
    expect(acadTopic!.knowledgeTopicId).toBe(knowTopic!.id);
    // NO duplicate mastery truth on the Academic side
    expect(acadTopic!.masterySelfAssessed).toBeNull();
    expect("masteryPercent" in acadTopic!).toBe(false);

    // Knowledge owns evidence; exactly one concept, not duplicated by the link
    expect(know.topics.filter((t) => t.title === "Binary Trees")).toHaveLength(1);
    expect(know.evidence.filter((e) => e.topicId === knowTopic!.id)).toHaveLength(1);
    expect(know.sources.filter((s) => s.topicId === knowTopic!.id)).toHaveLength(1);

    // Assessment + marks persisted
    const quiz = acad.assessments.find((a) => a.title === "Quiz 1");
    expect(quiz!.obtainedMarks).toBe(18);
    expect(quiz!.weightPercent).toBe(100);

    // cleanup so reruns start clean
    await invokeCmd("acad_reset_for_test");
    await invokeCmd("know_reset_for_test");
  });
});

/** read a knowledge topic id straight from SQLite by its title (for UI selects). */
async function knowledgeTopicIdByTitle(title: string): Promise<string> {
  const g = await invokeCmd<{ topics: { id: string; title: string }[] }>("know_load");
  const t = g.topics.find((x) => x.title === title);
  if (!t) throw new Error(`knowledge topic "${title}" not found`);
  return t.id;
}

describe("PBOS Batch 2B — real-user Development scenario", () => {
  it("creates a project, skill, milestone + provenance-tagged evidence through the UI, verified from SQLite", async () => {
    await invokeCmd("dev_reset_for_test");

    // 1. Create a Skill via the UI.
    await nav("#/development/skills/new");
    await waitForText("Add Skill");
    expect(await setByLabel("skill name", "React")).toBe(true);
    expect(await clickButton("^add skill$")).toBe(true);
    await waitForText("capability is unknown until it is");

    // 2. Create a Project via the UI.
    await nav("#/development/projects/new");
    await waitForText("Add Project");
    expect(await setByLabel("project name", "Performance Buddy OS")).toBe(true);
    expect(await clickButton("^add project$")).toBe(true);
    await waitForText("Project progress");

    // 3. Add a milestone and complete it → milestone-derived progress.
    expect(await setByLabel("new milestone title", "Build dashboard")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add milestone$")).toBe(true);
    await waitForText("Build dashboard");
    await browser.tauri.execute(() => {
      const cb = [...document.querySelectorAll('input[type="checkbox"]')].find((c) =>
        /Build dashboard/i.test((c as HTMLInputElement).getAttribute("aria-label") || ""),
      ) as HTMLInputElement | undefined;
      cb?.click();
    });
    await waitForText("100%");

    // 4. Link the skill to the project through the UI.
    expect(await setField('select[id="link-skill"]', await devSkillIdByTitle("React"))).toBe(true);
    expect(await clickButton("^link$")).toBe(true);
    await waitForText("Unlink");

    // 5. Record an independent evidence record, then an unreviewed AI-assisted one.
    await browser.tauri.execute(() => {
      const link = [...document.querySelectorAll("a")].find((a) => /^React$/.test((a.textContent || "").trim()));
      (link as HTMLAnchorElement)?.click();
    });
    await waitForText("record");
    expect(await clickButton("add evidence")).toBe(true);
    await waitForText("What did you do");
    expect(await setField('input[aria-label="Evidence description"]', "Built the layout myself")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add evidence$")).toBe(true);
    await waitForText("100%");

    expect(await clickButton("add evidence")).toBe(true);
    await waitForText("What did you do");
    expect(await setField('input[aria-label="Evidence description"]', "AI wrote the hook, unreviewed")).toBe(true);
    expect(await setField('select[aria-label="Evidence provenance"]', "ai-assisted")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add evidence$")).toBe(true);
    await waitForText("excluded from the Evidence score");
    await browser.pause(1000);

    // 6. Verify canonical rows + relationships straight out of SQLite.
    const g = await invokeCmd<{
      projects: { id: string; title: string }[];
      skills: { id: string; title: string }[];
      milestones: { id: string; title: string; projectId: string; completed: boolean }[];
      evidence: { id: string; skillId: string; provenance: string }[];
      links: { projectId: string; skillId: string }[];
    }>("dev_load");

    const project = g.projects.find((p) => p.title === "Performance Buddy OS");
    const skill = g.skills.find((s) => s.title === "React");
    expect(project).toBeTruthy();
    expect(skill).toBeTruthy();
    // no evidence/capability number on the skill row — three separate axes only
    expect("evidencePercent" in skill!).toBe(false);

    expect(g.milestones.filter((m) => m.projectId === project!.id && m.completed)).toHaveLength(1);
    expect(g.links).toEqual([{ projectId: project!.id, skillId: skill!.id }]);
    const ev = g.evidence.filter((e) => e.skillId === skill!.id);
    expect(ev).toHaveLength(2);
    expect(ev.filter((e) => e.provenance === "independent")).toHaveLength(1);
    expect(ev.filter((e) => e.provenance === "ai-assisted")).toHaveLength(1);

    await invokeCmd("dev_reset_for_test");
  });
});

async function devSkillIdByTitle(title: string): Promise<string> {
  const g = await invokeCmd<{ skills: { id: string; title: string }[] }>("dev_load");
  const s = g.skills.find((x) => x.title === title);
  if (!s) throw new Error(`dev skill "${title}" not found`);
  return s.id;
}

describe("PBOS Batch 2B — real-user Fitness scenario", () => {
  it("creates a plan + session, logs an ACTUAL workout that differs, verifies the BASE PLAN is untouched in SQLite", async () => {
    await invokeCmd("fit_reset_for_test");

    // 1. create the BASE PLAN via the UI
    await nav("#/fitness/plans/new");
    await waitForText("Create Training Plan");
    expect(await setByLabel("plan name", "Weekly Training")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^create plan$")).toBe(true);
    await waitForText("this is the BASE PLAN");

    // 2. add a planned session (prescription: Push-ups 3 x 15)
    expect(await clickButton("^add session$")).toBe(true);
    await waitForText("Session title");
    expect(await setField('input[aria-label="Session title"]', "Upper Body")).toBe(true);
    expect(await setField('input[aria-label="Exercise 1 name"]', "Push-ups")).toBe(true);
    expect(await setField('input[aria-label="Exercise 1 sets"]', "3")).toBe(true);
    expect(await setField('input[aria-label="Exercise 1 target"]', "15")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add session$")).toBe(true);
    await waitForText("Push-ups — 3 × 15");

    // 3. start a workout and record ACTUALS that differ from the prescription
    expect(await clickButton("^start workout$")).toBe(true);
    await waitForText("recording the ACTUAL session");
    expect(await setField('input[aria-label="Push-ups sets completed"]', "3")).toBe(true);
    expect(await setField('input[aria-label="Push-ups reps completed"]', "15,14,11")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("complete workout")).toBe(true);
    await waitForText("completed");
    await browser.pause(1000);

    // 4. verify straight out of SQLite
    const g = await invokeCmd<{
      plans: { id: string; title: string; totalWeeks: number }[];
      plannedSessions: { id: string; title: string; exercises: { name: string; sets: number; reps: string }[] }[];
      workoutSessions: {
        id: string;
        planId: string | null;
        plannedSessionId: string | null;
        completed: boolean;
        exercisesPerformed: { name: string; setsCompleted: number; repsCompleted: string }[];
      }[];
    }>("fit_load");

    const plan = g.plans.find((p) => p.title === "Weekly Training");
    expect(plan).toBeTruthy();
    expect(g.plannedSessions).toHaveLength(1);
    const planned = g.plannedSessions[0];
    // BASE PLAN prescription is byte-for-byte what the user set — the actual workout did NOT rewrite it
    expect(planned.exercises).toEqual([{ name: "Push-ups", sets: 3, reps: "15" }]);

    expect(g.workoutSessions).toHaveLength(1);
    const w = g.workoutSessions[0];
    expect(w.completed).toBe(true);
    expect(w.planId).toBe(plan!.id);
    expect(w.plannedSessionId).toBe(planned.id);
    // the ACTUAL results differ from the prescription and are their own record
    expect(w.exercisesPerformed[0].repsCompleted).toBe("15,14,11");

    await invokeCmd("fit_reset_for_test");
  });
});

describe("PBOS Batch 2B — real-user Routine scenario", () => {
  it("creates a routine + check-in through the UI, updates today's log, verifies from SQLite", async () => {
    await invokeCmd("rtn_reset_for_test");

    // 1. Create a routine via the builder (defaults: daily, boolean).
    await nav("#/routine/new");
    await waitForText("New Routine");
    expect(await setByLabel("routine name", "Morning Mobility")).toBe(true);
    expect(await setByLabel("category", "Personal Care")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^create routine$")).toBe(true);
    await waitForText("Morning Mobility");
    await waitForText("no history yet"); // honest empty consistency — not 0%

    // 2. Today's check-in from Routine Detail: Partial, then correct it to Done
    //    (the check-in buttons render their state label as text).
    expect(await clickButton("^Partial$")).toBe(true);
    await waitForText("History (1)");
    expect(await clickButton("^Done$")).toBe(true);
    await waitForText("History (1)");
    await browser.pause(1000);

    // 3. Verify canonical rows straight out of SQLite.
    const g = await invokeCmd<{
      routines: {
        id: string;
        title: string;
        scheduleType: string;
        relatedSystemId: string | null;
        paused: boolean;
      }[];
      logs: { id: string; routineId: string; date: string; state: string }[];
    }>("rtn_load");

    expect(g.routines).toHaveLength(1);
    const routine = g.routines[0];
    expect(routine.title).toBe("Morning Mobility");
    expect(routine.scheduleType).toBe("daily");
    expect(routine.relatedSystemId).toBeNull();
    // consistency / streak is derived — never a stored column on the routine row
    expect("consistency" in routine).toBe(false);
    expect("streak" in routine).toBe(false);

    // exactly ONE canonical log for today, holding the corrected state
    expect(g.logs).toHaveLength(1);
    const today = new Date().toISOString().slice(0, 10);
    expect(g.logs[0].routineId).toBe(routine.id);
    expect(g.logs[0].date).toBe(today);
    expect(g.logs[0].state).toBe("complete");

    await invokeCmd("rtn_reset_for_test");
  });
});

describe("PBOS Batch 2 — real-user Reading & Language scenario", () => {
  it("creates a path + unit + session and a book, then verifies canonical rows from SQLite", async () => {
    await invokeCmd("lang_reset_for_test");

    // 1. Create a Language Path via the builder.
    await nav("#/language/paths/new");
    await waitForText("New Language Path");
    expect(await setByLabel("^language$", "German")).toBe(true);
    expect(await setByLabel("path title", "A1 Foundations")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^create path$")).toBe(true);
    await waitForText("A1 Foundations");
    await waitForText("No units yet — not 0%"); // honest empty progress — not 0%

    // 2. Add a unit, then log a learning session against it (no recall score).
    expect(await setField('input[aria-label="Unit title"]', "Basic Introductions")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add unit$")).toBe(true);
    await waitForText("Basic Introductions");
    expect(await clickButton("start learning session")).toBe(true);
    await waitForText("Learning Session");
    expect(await setByLabel("minutes practised", "30")).toBe(true);
    expect(await clickButton("^log session$")).toBe(true);
    await waitForText("Session logged");
    await browser.pause(1000);

    // 3. Add a Book with a known total.
    await nav("#/language/books/new");
    await waitForText("Add Book");
    expect(await setByLabel("^title$", "Deep Work")).toBe(true);
    expect(await setByLabel("total pages", "300")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add book$")).toBe(true);
    await waitForText("Deep Work");
    // advance the page position
    expect(await setField('input[aria-label="Set current page"]', "60")).toBe(true);
    expect(await clickButton("^update$")).toBe(true);
    await waitForText("20%");
    await browser.pause(1000);

    // 4. Verify canonical rows straight out of SQLite.
    const g = await invokeCmd<{
      paths: { id: string; language: string; title: string; relatedRoutineId: string | null }[];
      units: { id: string; pathId: string; completed: boolean; knowledgeTopicId: string | null }[];
      sessions: {
        id: string;
        pathId: string;
        unitId: string | null;
        durationMinutes: number;
        recallScore: number | null;
      }[];
      books: { id: string; title: string; currentPage: number; totalPages: number | null }[];
    }>("lang_load");

    expect(g.paths).toHaveLength(1);
    const path = g.paths[0];
    expect(path.language).toBe("German");
    expect(path.relatedRoutineId).toBeNull();
    // progress/mastery is derived — never a stored column on the path row
    expect("progressPercent" in path).toBe(false);
    expect("mastery" in path).toBe(false);

    expect(g.units).toHaveLength(1);
    // the completed session marked its linked unit done — mechanical only
    expect(g.units[0].completed).toBe(true);

    expect(g.sessions).toHaveLength(1);
    expect(g.sessions[0].pathId).toBe(path.id);
    expect(g.sessions[0].unitId).toBe(g.units[0].id);
    expect(g.sessions[0].durationMinutes).toBe(30);
    // minutes alone are not mastery — no recall check happened
    expect(g.sessions[0].recallScore).toBeNull();

    expect(g.books).toHaveLength(1);
    expect(g.books[0].title).toBe("Deep Work");
    expect(g.books[0].currentPage).toBe(60);
    expect(g.books[0].totalPages).toBe(300);

    await invokeCmd("lang_reset_for_test");
  });
});

describe("PBOS Batch 2 — real-user Money scenario", () => {
  it("records income + expense + savings transfer + planned + budget + goal, verified from SQLite", async () => {
    await invokeCmd("money_reset_for_test");

    // 1-3. three actual transactions via the Transactions screen
    await nav("#/money/transactions");
    await waitForText("No transactions yet");
    for (const [type, amount, category] of [
      ["income", "50000", "Freelance"],
      ["expense", "10000", "Food & Dining"],
      ["savings-transfer", "15000", ""],
    ] as const) {
      expect(await clickButton("add transaction")).toBe(true);
      await waitForText("Amount");
      expect(await setField('select[id^=":r"], form select', type)).toBe(true);
      expect(await setByLabel("^amount$", amount)).toBe(true);
      if (category) expect(await setByLabel("^category", category)).toBe(true);
      await browser.pause(120);
      expect(await clickButton("^add transaction$")).toBe(true);
      await browser.pause(200);
    }
    await waitForText("All transactions (3)");

    // 4. a planned expense + a budget + a savings goal on Budget & Savings
    await nav("#/money/budget");
    await waitForText("Category Budgets");
    expect(await setByLabel("planned expense title", "Internet")).toBe(true);
    expect(await setByLabel("planned expense amount", "5000")).toBe(true);
    expect(await setByLabel("planned expense category", "Utilities")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add planned$")).toBe(true);
    await waitForText("Internet");

    expect(await setByLabel("budget category", "Food & Dining")).toBe(true);
    expect(await setByLabel("budget limit", "20000")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add budget$")).toBe(true);

    expect(await setByLabel("savings goal title", "New Laptop")).toBe(true);
    expect(await setByLabel("savings goal target amount", "100000")).toBe(true);
    expect(await setByLabel("savings goal opening amount", "20000")).toBe(true);
    await browser.pause(120);
    expect(await clickButton("^add goal$")).toBe(true);
    await browser.pause(1000);

    // 5. verify canonical rows straight out of SQLite
    const g = await invokeCmd<{
      transactions: { id: string; type: string; amount: number; savingsGoalId: string | null }[];
      plannedExpenses: { id: string; amount: number; transactionId: string | null }[];
      budgets: { id: string; category: string; limitAmount: number }[];
      savingsGoals: { id: string; openingAmount: number; targetAmount: number }[];
    }>("money_load");

    // exactly 3 ACTUAL transactions; the transfer keeps its own type
    expect(g.transactions).toHaveLength(3);
    expect(g.transactions.filter((t) => t.type === "expense")).toHaveLength(1);
    expect(g.transactions.filter((t) => t.type === "savings-transfer")).toHaveLength(1);
    expect(g.transactions.filter((t) => t.type === "income")).toHaveLength(1);
    // the planned expense is its own row — NOT one of the actual transactions
    expect(g.plannedExpenses).toHaveLength(1);
    expect(g.plannedExpenses[0].transactionId).toBeNull();
    expect(g.budgets).toHaveLength(1);
    expect(g.savingsGoals).toHaveLength(1);
    expect(g.savingsGoals[0].openingAmount).toBe(20000);
    // no bank-verification / performance-score authority anywhere in the row shape
    expect("bankVerified" in g.transactions[0]).toBe(false);
    expect("performanceScore" in (g.savingsGoals[0] as object)).toBe(false);
    expect("currentAmount" in (g.savingsGoals[0] as object)).toBe(false);

    await invokeCmd("money_reset_for_test");
  });
});
