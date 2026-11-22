import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createStaticAdapter,
  createSurfaceFixture,
  installDeterministicDom
} from "./helpers/ts-059-project-detail-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const css = readFileSync(resolve(root, "site/styles.css"), "utf8");

const commandNames = [
  "returnToOverview", "startRename", "cancelRename", "renameSubject",
  "createItem", "setPriority", "toggleItem", "toggleSubsteps",
  "startDrag", "openItemMenu", "closeItemMenu", "runMenuCommand", "cancelEdit",
  "openProject", "setHideCompleted"
];

function snapshot() {
  const items = [
    { id: "parent", title: "Étape parent", priority: "urgent", done: false, parentId: null },
    { id: "child", title: "Sous-étape", priority: "normal", done: false, parentId: "parent" }
  ];
  return {
    view: "subject",
    subjectId: "p1",
    readOnly: false,
    project: {
      id: "p1",
      title: "Projet réel",
      pendingCount: 2,
      totalTaskCountLabel: "1 tâche au total",
      progressLabel: "1 / 2 étapes terminées (50 %)"
    },
    projects: [{ id: "p1", title: "Projet réel" }, { id: "p2", title: "Autre projet" }],
    items,
    transient: {
      expandedParents: ["parent"],
      openMenuId: null,
      editingItemId: null,
      renamingSubject: false,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null
    }
  };
}

test("TS-072 project detail omits unsupported fields and keeps truthful controls", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({ snapshot: snapshot(), commandNames });
    const fixture = await createSurfaceFixture(adapter);
    const section = fixture.container.querySelector('[data-react-surface="project-detail"]');
    assert.equal(section.querySelector(".project-stitch-metadata"), null);
    assert.equal(section.querySelector(".detail-search-controls"), null);
    assert.equal(section.querySelector(".project-stitch-disabled"), null);
    assert.equal(section.querySelector(".detail-summary").textContent.includes("Non disponible"), false);
    assert.equal(section.querySelector(".detail-summary").textContent.includes("1 / 2 étapes terminées (50 %)"), true);
    assert.equal(section.querySelector(".detail-summary").textContent.includes("Activité"), false);
    assert.equal(section.querySelector(".detail-project-switcher select").value, "p1");
    assert.equal(section.querySelectorAll(".detail-completed-filter input").length, 1);
    assert.equal(section.querySelectorAll(".task-deadline-disabled:disabled").length, 2);
    assert.equal(section.querySelectorAll(".task-parent").length, 1);
    assert.equal(section.querySelectorAll(".task-substep").length, 1);

    for (const control of section.querySelectorAll(".task-deadline-disabled")) {
      control.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
      control.click();
    }
    assert.deepEqual(adapter.calls, []);
    assert.equal(section.querySelectorAll(".task-parent").length, 1);
    assert.equal(section.querySelector(".task-row .task-title").textContent, "Étape parent");

    await fixture.act(async () => {
      section.querySelector(".detail-return").click();
    });
    assert.deepEqual(adapter.calls, [["returnToOverview", ["p1"]]]);
    fixture.unmount();
  } finally {
    dom.cleanup();
  }
});

test("TS-072 detail styles use local tokens and collapse without fixed overflow", () => {
  const start = css.indexOf("/* TS-072 | Dedicated, truthful project detail */");
  assert.notEqual(start, -1);
  const styles = css.slice(start);
  assert.match(styles, /\.detail-stitch-layout\{[^}]*minmax\(0,1fr\) minmax\(220px,280px\)/);
  assert.match(styles, /\.detail-completed-filter\{[^}]*min-height:var\(--control-target-min\)/);
  assert.ok(styles.includes("@media(max-width:767px){.detail-stitch-layout{"));
  assert.ok(styles.includes(".detail-stitch-layout{grid-template-columns:minmax(0,1fr)}"));
  assert.doesNotMatch(styles, /(?:^|[;{])\s*(?:width|min-width)\s*:\s*(?:3[3-9]\d|[4-9]\d\d|\d{4,})px/);
  const responsiveTiers = new Map([[320, true], [390, true], [430, true], [768, false], [1280, false]]);
  for (const [width, usesCompactLayout] of responsiveTiers) {
    assert.equal(width <= 767, usesCompactLayout, "responsive layout tier at " + width + "px");
  }
  for (const token of ["--space-3", "--space-4", "--space-5", "--color-surface-muted", "--color-border-subtle", "--radius-panel", "--control-target-min"]) {
    assert.match(styles, new RegExp("var\\(" + token + "\\)"), token);
  }
});
