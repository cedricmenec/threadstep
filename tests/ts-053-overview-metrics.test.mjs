import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  emptyDocument,
  newSubject,
  newItem,
  setItemPriority,
  promoteItemToTopLevel,
  planRemoval,
  restoreRemoval,
  parseDocument,
  subjectMetrics,
  overviewMetrics,
  overviewSummaryLabel,
  subjectUrgencyLabel,
  subjectProgressLabel
} from "../site/core.js";

const item = (id, priority = "normal", done = false, parentId = null) => ({
  id, title: id, priority, done, parentId
});

const subject = (id, items = []) => ({ id, title: id, items });

const doc = (...subjects) => ({ version: 1, subjects });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("TS-053 subject and overview metrics count every record once", () => {
  assert.deepEqual(subjectMetrics(subject("s1")), {
    total: 0, done: 0, pending: 0, urgentPending: 0, active: false
  });
  assert.deepEqual(overviewMetrics(emptyDocument()), {
    activeProjects: 0, pendingSteps: 0, urgentSteps: 0
  });

  const parentsAndChild = subject("s1", [
    item("p1", "normal", true),
    item("p2", "urgent", false),
    item("c1", "normal", true, "p1")
  ]);
  assert.deepEqual(subjectMetrics(parentsAndChild), {
    total: 3, done: 2, pending: 1, urgentPending: 1, active: true
  });

  const multiple = doc(
    subject("s1", [item("a1", "urgent", false)]),
    subject("s2", [item("b1", "normal", true)]),
    subject("s3")
  );
  assert.deepEqual(overviewMetrics(multiple), {
    activeProjects: 1, pendingSteps: 1, urgentSteps: 1
  });

  assert.deepEqual(overviewMetrics(null), {
    activeProjects: 0, pendingSteps: 0, urgentSteps: 0
  });
});

test("TS-053 a completed parent with a remaining child keeps the project active", () => {
  const metrics = subjectMetrics(subject("s1", [
    item("parent", "normal", true),
    item("child", "urgent", false, "parent")
  ]));
  assert.equal(metrics.total, 2);
  assert.equal(metrics.done, 1);
  assert.equal(metrics.pending, 1);
  assert.equal(metrics.urgentPending, 1);
  assert.equal(metrics.active, true);
});

test("TS-053 a completed urgent step is never counted as an urgency", () => {
  const metrics = subjectMetrics(subject("s1", [
    item("done-urgent", "urgent", true),
    item("todo-urgent", "urgent", false)
  ]));
  assert.equal(metrics.urgentPending, 1);
  assert.equal(overviewMetrics(doc(subject("s1", [item("done-urgent", "urgent", true)]))).urgentSteps, 0);
});

test("TS-053 French synthesis labels use singular and plural agreement", () => {
  assert.equal(
    overviewSummaryLabel({ activeProjects: 0, pendingSteps: 0, urgentSteps: 0 }),
    "0 projet actif · 0 étape en attente · 0 urgence en attente"
  );
  assert.equal(
    overviewSummaryLabel({ activeProjects: 1, pendingSteps: 1, urgentSteps: 1 }),
    "1 projet actif · 1 étape en attente · 1 urgence en attente"
  );
  assert.equal(
    overviewSummaryLabel({ activeProjects: 2, pendingSteps: 5, urgentSteps: 3 }),
    "2 projets actifs · 5 étapes en attente · 3 urgences en attente"
  );
  assert.equal(
    overviewSummaryLabel({ activeProjects: "2", pendingSteps: NaN, urgentSteps: -1 }),
    "0 projet actif · 0 étape en attente · 0 urgence en attente"
  );
});

test("TS-053 card urgency labels use singular and plural agreement", () => {
  assert.equal(subjectUrgencyLabel(0), "0 urgence restante");
  assert.equal(subjectUrgencyLabel(1), "1 urgence restante");
  assert.equal(subjectUrgencyLabel(4), "4 urgences restantes");
});

test("TS-053 progress labels round to the nearest integer and omit empty percentages", () => {
  assert.equal(subjectProgressLabel([]), "Aucune étape");
  assert.equal(subjectProgressLabel([item("a"), item("b")]), "0 / 2 étapes terminées (0 %)");
  assert.equal(subjectProgressLabel([item("a", "normal", true)]), "1 / 1 étape terminée (100 %)");
  assert.equal(
    subjectProgressLabel([item("a", "normal", true), item("b", "normal", true), item("c", "normal", true)]),
    "3 / 3 étapes terminées (100 %)"
  );
  assert.equal(
    subjectProgressLabel([
      item("p1", "normal", true),
      item("p2", "normal", false),
      item("c1", "normal", true, "p1")
    ]),
    "2 / 3 étapes terminées (67 %)"
  );
  assert.equal(
    subjectProgressLabel([item("a", "normal", true), ...Array.from({ length: 5 }, (_, i) => item("n" + i))]),
    "1 / 6 étapes terminées (17 %)"
  );
});

test("TS-053 metrics and labels do not mutate their inputs", () => {
  const fixture = doc(
    subject("s1", [
      item("p1", "urgent", true),
      item("p2", "normal", false),
      item("c1", "urgent", false, "p2")
    ]),
    subject("s2", [])
  );
  const before = clone(fixture);
  subjectMetrics(fixture.subjects[0]);
  overviewMetrics(fixture);
  overviewSummaryLabel(overviewMetrics(fixture));
  subjectUrgencyLabel(2);
  subjectProgressLabel(fixture.subjects[0].items);
  assert.deepEqual(fixture, before);
});

test("TS-053 metrics and labels reference no storage, network, DOM, timer or auth API", () => {
  const core = readFileSync(new URL("../site/core.js", import.meta.url), "utf8");
  const start = core.indexOf("function countItemMetrics(");
  const end = core.indexOf("export function nextActionSuggestion(");
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const block = core.slice(start, end);
  for (const forbidden of [
    /localStorage/, /indexedDB/i, /Dexie/, /fetch\s*\(/,
    /document\.(create|query|getElement|body)/, /window\./, /setTimeout/, /setInterval/, /requestAnimationFrame/,
    /authenticat/i, /sessionStorage/, /WebSocket/, /XMLHttpRequest/
  ]) {
    assert.doesNotMatch(block, forbidden, String(forbidden));
  }
  for (const fn of [subjectMetrics, overviewMetrics, overviewSummaryLabel, subjectUrgencyLabel, subjectProgressLabel]) {
    assert.doesNotMatch(fn.toString(), /innerHTML|localStorage|indexedDB|fetch\s*\(|setTimeout/);
  }
});

test("TS-053 aggregates follow creation, completion, priority and promotion transitions", () => {
  let document = emptyDocument();
  assert.deepEqual(overviewMetrics(document), { activeProjects: 0, pendingSteps: 0, urgentSteps: 0 });

  const created = newSubject("Projet", "s1");
  created.items.push(newItem("Nouvelle étape", "normal", "i1"));
  document = { ...document, subjects: [created] };
  assert.deepEqual(overviewMetrics(document), { activeProjects: 1, pendingSteps: 1, urgentSteps: 0 });

  document = {
    ...document,
    subjects: [{
      ...document.subjects[0],
      items: document.subjects[0].items.map((entry) => ({ ...entry, done: true }))
    }]
  };
  assert.deepEqual(overviewMetrics(document), { activeProjects: 0, pendingSteps: 0, urgentSteps: 0 });

  document = {
    ...document,
    subjects: [{
      ...document.subjects[0],
      items: [
        ...document.subjects[0].items.map((entry) => ({ ...entry, done: false })),
        item("i2", "normal", false),
        item("i3", "normal", false, "i2")
      ]
    }]
  };
  document = setItemPriority(document, "s1", "i3", "urgent");
  assert.deepEqual(overviewMetrics(document), { activeProjects: 1, pendingSteps: 3, urgentSteps: 1 });
  assert.equal(subjectProgressLabel(document.subjects[0].items), "0 / 3 étapes terminées (0 %)");

  const promoted = promoteItemToTopLevel(document, "s1", "i3");
  assert.notEqual(promoted, document);
  assert.deepEqual(overviewMetrics(promoted), overviewMetrics(document));
  assert.equal(subjectMetrics(promoted.subjects[0]).total, 3);
});

test("TS-053 removal and undo restore exact aggregates", () => {
  const document = doc(subject("s1", [
    item("p1", "urgent", false),
    item("c1", "urgent", false, "p1"),
    item("p2", "normal", true)
  ]), subject("s2", [item("o1", "normal", false)]));
  const before = overviewMetrics(document);
  assert.deepEqual(before, { activeProjects: 2, pendingSteps: 3, urgentSteps: 2 });

  const removal = planRemoval(document, "s1", "p1");
  assert.deepEqual(overviewMetrics(removal.document), {
    activeProjects: 1, pendingSteps: 1, urgentSteps: 0
  });
  const restored = restoreRemoval(removal.document, removal.removal);
  assert.deepEqual(overviewMetrics(restored), before);
});

test("TS-053 import-shaped replacement keeps aggregates and adds no indicator fields", () => {
  const original = doc(subject("s1", [
    item("p1", "urgent", true),
    item("c1", "urgent", false, "p1")
  ]));
  const serialized = JSON.stringify(original);
  const imported = parseDocument(serialized);
  assert.deepEqual(overviewMetrics(imported), overviewMetrics(original));
  assert.equal(JSON.stringify(imported), serialized);
  for (const subjectEntry of imported.subjects) {
    assert.deepEqual(Object.keys(subjectEntry).sort(), ["id", "items", "title"]);
    for (const entry of subjectEntry.items) {
      assert.deepEqual(Object.keys(entry).sort(), ["done", "id", "parentId", "priority", "title"]);
    }
  }
});
