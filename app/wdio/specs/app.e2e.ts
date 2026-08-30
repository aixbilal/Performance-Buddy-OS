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
    expect(status.schema_version).toBe(3); // Batch 2A migration v3 (Academic + Knowledge)
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
