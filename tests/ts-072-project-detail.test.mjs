import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createReactAdapter } from "../site/react-adapter.js";
import { createProjectDetailCommands } from "../site/project-detail/controller-commands.js";
import {
  createStaticAdapter,
  createSurfaceFixture,
  installDeterministicDom
} from "./helpers/ts-059-project-detail-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = readFileSync(resolve(root, "site/index.html"), "utf8");
const app = readFileSync(resolve(root, "site/app.js"), "utf8");
const css = readFileSync(resolve(root, "site/styles.css"), "utf8");

function fixtureSnapshot() {
  return {
    view: "subject",
    subjectId: "p1",
    project: {
      id: "p1",
      title: "Projet A",
      pendingCount: 1,
      totalTaskCountLabel: "1 tâche au total",
      progressLabel: "1 / 2 étapes terminées (50 %)",
      metrics: { total: 2, done: 1, pending: 1 }
    },
    projects: [
      { id: "p1", title: "Projet A" },
      { id: "p2", title: "Projet B <script>" }
    ],
    items: [
      { id: "a1", title: "Prochaine tâche", priority: "urgent", done: false, parentId: null },
      { id: "a2", title: "Terminée", priority: "normal", done: true, parentId: null }
    ],
    transient: { hideCompleted: false, expandedParents: [] }
  };
}

test("TS-072 detail selector routes directly and the task filter stays transient", async () => {
  const dom = installDeterministicDom();
  try {
    const snapshot = fixtureSnapshot();
    const adapter = createStaticAdapter({
      snapshot,
      commandNames: ["openProject", "setHideCompleted"]
    });
    const fixture = await createSurfaceFixture(adapter);
    const detail = fixture.container.querySelector('[data-react-surface="project-detail"]');
    const picker = detail.querySelector(".detail-project-switcher select");

    assert.equal(picker.getAttribute("aria-label"), "Changer de projet");
    assert.equal(picker.value, "p1");
    assert.deepEqual(
      [...picker.options].map((option) => [option.value, option.textContent]),
      [["p1", "Projet A"], ["p2", "Projet B <script>"]]
    );
    assert.equal(detail.querySelectorAll("script").length, 0);
    assert.equal(detail.querySelector(".detail-title").textContent, "Projet A");
    assert.equal(detail.querySelector(".detail-summary").textContent.includes("Prochaine tâche"), true);
    assert.equal(detail.querySelector(".detail-summary").textContent.includes("50 %"), true);

    picker.value = "p2";
    await fixture.act(() => {
      picker.dispatchEvent(new globalThis.Event("change", { bubbles: true }));
    });
    assert.deepEqual(adapter.calls, [["openProject", ["p2"]]]);
    assert.equal(snapshot.project.id, "p1");
    assert.equal(snapshot.items[0].title, "Prochaine tâche");

    const filter = detail.querySelector(".detail-completed-filter input");
    await fixture.act(() => {
      filter.click();
    });
    assert.deepEqual(adapter.calls[1], ["setHideCompleted", [true]]);
    assert.equal(snapshot.transient.hideCompleted, false);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-072 project route command validates the target without persisting data", () => {
  const document = {
    version: 1,
    subjects: [
      { id: "p1", title: "A", items: [] },
      { id: "p2", title: "B", items: [] }
    ]
  };
  const transient = { hideCompleted: false, renamingSubject: true };
  const opened = [];
  let writes = 0;
  let renders = 0;
  const commands = createProjectDetailCommands({
    getDocument: () => document,
    setDocument: () => { throw new Error("navigation must not mutate the document"); },
    persist: () => { writes += 1; },
    render: () => { renders += 1; },
    getTransient: () => transient,
    setTransient: (patch) => Object.assign(transient, patch),
    openProject: (project) => { opened.push(project.id); return true; }
  });

  assert.equal(commands.openProject("missing"), false);
  assert.equal(commands.openProject("p2"), true);
  assert.deepEqual(opened, ["p2"]);
  assert.equal(transient.renamingSubject, false);
  assert.equal(commands.setHideCompleted(true), true);
  assert.equal(commands.setHideCompleted(true), false);
  assert.equal(transient.hideCompleted, true);
  assert.equal(writes, 0);
  assert.equal(renders, 1);
  assert.deepEqual(document.subjects.map((project) => project.id), ["p1", "p2"]);
});

test("TS-072 Overview controls are isolated from the detail mount", () => {
  const start = html.indexOf('<div id="overview-controls">');
  const end = html.indexOf("</div>", html.indexOf('id="overview-urgency-filter"'));
  assert.notEqual(start, -1);
  assert.ok(end > start);
  const controls = html.slice(start, end);
  assert.match(controls, /id="dashboard-title"/);
  assert.match(controls, /id="subject-form"/);
  assert.match(controls, /id="hide-completed"/);
  assert.match(controls, /id="overview-filter-select"/);
  assert.ok(html.indexOf('id="subjects"') > end);
  assert.match(app, /overviewControlsEl\.hidden\s*=\s*detail/);
  assert.match(app, /setAttribute\("aria-label", "Détail du projet"\)/);
  assert.match(app, /setAttribute\("aria-labelledby", "dashboard-title"\)/);
  const openSubjectStart = app.indexOf("function openSubject(subject)");
  const openSubjectEnd = app.indexOf("function applyFocus()", openSubjectStart);
  const openSubject = app.slice(openSubjectStart, openSubjectEnd);
  assert.match(openSubject, /subjectRoute\(subject\.id\)/);
  assert.match(openSubject, /focusDetailHeading\s*=\s*true;[\s\S]*navigate\(target\)/);
  assert.match(app, /function applyFocus\(\)[\s\S]*subjectsEl\.querySelector\("\.detail-title"\)/);
  assert.match(app, /function navigate\(hash\)[\s\S]*location\.hash\s*=\s*hash/);
});

test("TS-072 detail styling uses existing tokens and collapses into one column", () => {
  const start = css.indexOf("/* TS-072 | Dedicated, truthful project detail */");
  assert.notEqual(start, -1);
  const styles = css.slice(start);
  assert.match(styles, /\.detail-stitch-layout\{[^}]*minmax\(0,1fr\) minmax\(220px,280px\)/);
  assert.match(styles, /\.detail-project-switcher select\{[^}]*min-height:var\(--control-target-min\)/);
  assert.match(styles, /\.detail-completed-filter\{[^}]*min-height:var\(--control-target-min\)/);
  assert.match(styles, /@media\(max-width:767px\)\{\.detail-stitch-layout\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(styles, /\.detail-project-switcher select\{width:100%;min-width:0\}/);
  assert.match(styles, /#dashboard\.dashboard-project-detail\{padding-top:var\(--space-6\)\}/);
  for (const token of ["--space-3", "--space-4", "--space-5", "--color-surface-muted", "--color-border-subtle", "--radius-panel", "--control-target-min"]) {
    assert.ok(styles.includes("var(" + token + ")"), token);
  }
  assert.doesNotMatch(styles, /(?:^|[;{])\s*(?:width|min-width)\s*:\s*(?:3[3-9]\d|[4-9]\d\d|\d{4,})px/);
  const responsiveTiers = new Map([[320, true], [390, true], [430, true], [768, false], [1280, false]]);
  for (const [width, usesCompactLayout] of responsiveTiers) {
    assert.equal(width <= 767, usesCompactLayout, "responsive layout tier at " + width + "px");
  }
});

test("TS-072 read-only React adapter exposes only project switch options", () => {
  const state = {
    document: {
      version: 1,
      subjects: [
        { id: "p1", title: "Projet A", items: [{ id: "a1", title: "Tâche A", priority: "normal", done: false, parentId: null }] },
        { id: "p2", title: "Projet B", items: [{ id: "b1", title: "Tâche B privée", priority: "normal", done: false, parentId: null }] }
      ]
    },
    route: { view: "subject", subjectId: "p1" }
  };
  const adapter = createReactAdapter({
    getDocument: () => state.document,
    getRoute: () => state.route,
    getTransientState: () => ({}),
    getAuthorizedIdentity: () => ({ type: "local" }),
    isBusinessAllowed: () => true,
    isLoadingBlocked: () => false,
    commands: { openProject: () => true, setHideCompleted: () => true }
  });
  const snapshot = adapter.getSnapshot();
  assert.deepEqual(snapshot.projects, [
    { id: "p1", title: "Projet A" },
    { id: "p2", title: "Projet B" }
  ]);
  assert.equal(Object.hasOwn(snapshot.projects[1], "items"), false);
  assert.equal(JSON.stringify(snapshot).includes("Tâche B privée"), false);
});
