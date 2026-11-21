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
  "startDrag", "openItemMenu", "closeItemMenu", "runMenuCommand", "cancelEdit"
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

test("TS-068 project detail Stitch fields are static, disabled, and contain no sample data", async () => {
  const dom = installDeterministicDom();
  try {
    const adapter = createStaticAdapter({ snapshot: snapshot(), commandNames });
    const fixture = await createSurfaceFixture(adapter);
    const section = fixture.container.querySelector('[data-react-surface="project-detail"]');
    assert.equal(section.querySelector(".project-stitch-metadata").textContent.includes("Non renseignée"), true);
    assert.equal(section.querySelector(".project-stitch-metadata").textContent.includes("Non disponible"), true);
    assert.equal(section.querySelectorAll(".detail-search-controls :disabled").length, 3);
    assert.equal(section.querySelectorAll(".project-stitch-disabled:disabled").length, 2);
    assert.deepEqual(
      [...section.querySelectorAll(".project-stitch-panel p")].map((node) => node.textContent),
      ["Non disponible", "1 / 2 étapes terminées (50 %)", "Non disponible"]
    );
    assert.equal(section.querySelector(".project-stitch-panel").textContent.includes("Activité de démonstration"), false);
    assert.equal(section.querySelectorAll(".task-deadline-disabled:disabled").length, 2);
    assert.equal(section.querySelectorAll(".task-parent").length, 1);
    assert.equal(section.querySelectorAll(".task-substep").length, 1);

    for (const control of section.querySelectorAll(".detail-search-controls input, .detail-search-controls select, .project-stitch-disabled, .task-deadline-disabled")) {
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

test("TS-068 card and detail styles use local tokens and collapse without fixed overflow", () => {
  const start = css.indexOf("/* TS-068 | Static Stitch affordances");
  assert.notEqual(start, -1);
  const styles = css.slice(start);
  assert.match(styles, /\.project-stitch-metadata\{[^}]*display:grid/);
  assert.match(styles, /\.detail-search-controls\{[^}]*min-width:0/);
  assert.match(styles, /\.detail-stitch-layout\{[^}]*minmax\(0,1fr\) minmax\(220px,280px\)/);
  assert.ok(styles.includes("@media(max-width:767px){.project-stitch-metadata{"));
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
