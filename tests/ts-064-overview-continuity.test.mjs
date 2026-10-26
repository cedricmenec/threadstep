import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import {
  OVERVIEW_TEST_COMMANDS,
  createOverviewFixture,
  installDeterministicDom
} from "./helpers/ts-064-overview-harness.mjs";

const app = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");

function item(id, priority = "normal", done = false, parentId = null) {
  return { id, title: id, priority, done, parentId };
}

function makeAdapter({ transient = {}, subjects } = {}) {
  const state = {
    document: {
      version: 1,
      subjects: subjects || [{
        id: "p1",
        title: "Projet A",
        items: [item("i1", "urgent"), item("i2"), item("i3"), item("c1", "normal", false, "i1")]
      }]
    },
    route: { view: "overview" },
    identity: { type: "local" },
    allowed: true,
    blocked: false,
    presentation: {
      state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
      actionRequired: false,
      projectsAvailable: true
    },
    transient: {
      expandedParents: [],
      openMenuId: null,
      editingItemId: null,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null,
      projectFilter: "all",
      ...transient
    }
  };
  const calls = [];
  const handlers = {};
  for (const name of OVERVIEW_TEST_COMMANDS) {
    handlers[name] = (...args) => {
      calls.push([name, args]);
      return true;
    };
  }
  const adapter = createOverviewAdapter({
    getDocument: () => state.document,
    getRoute: () => state.route,
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => state.identity,
    isBusinessAllowed: () => state.allowed,
    isLoadingBlocked: () => state.blocked,
    getPresentation: () => state.presentation,
    commands: handlers
  });
  return { adapter, state, calls };
}

function setValue(node, value) {
  const prototype = node.tagName === "TEXTAREA"
    ? globalThis.HTMLTextAreaElement.prototype
    : globalThis.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value").set;
  setter.call(node, value);
  node.dispatchEvent(new globalThis.Event("input", { bubbles: true }));
}

test("TS-064 an in-place update preserves focus, expanded parents and node identity", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state } = makeAdapter({ transient: { expandedParents: ["i1"] } });
    const fixture = await createOverviewFixture(adapter);
    const card = fixture.container.querySelector('.subject[data-subject="p1"]');
    const parent = fixture.container.querySelector('.task[data-item="i1"]');
    const childList = fixture.container.querySelector("#substeps-i1");
    assert.ok(childList);
    const menuButton = fixture.container.querySelector('.task[data-item="i2"] .task-menu-button');
    menuButton.focus();
    assert.equal(dom.document.activeElement, menuButton);

    dom.window.scrollY = 720;
    card.getBoundingClientRect = () => ({ top: -120, bottom: 480, height: 600 });

    state.document = {
      version: 1,
      subjects: [{
        id: "p1",
        title: "Projet A",
        items: [item("i1", "urgent"), item("i2"), item("i3"), item("i4"), item("c1", "normal", false, "i1")]
      }]
    };
    fixture.rerender();

    assert.equal(fixture.container.querySelector('.subject[data-subject="p1"]'), card);
    assert.equal(fixture.container.querySelector('.task[data-item="i1"]'), parent);
    assert.equal(fixture.container.querySelector("#substeps-i1"), childList);
    assert.equal(dom.document.activeElement, menuButton);
    assert.equal(menuButton.isConnected, true);
    assert.equal(dom.window.scrollY, 720);
    assert.deepEqual(state.transient.expandedParents, ["i1"]);
    assert.equal(fixture.container.querySelectorAll(".task-substep").length, 1);
    assert.equal(fixture.container.querySelector('.task[data-item="c1"]').isConnected, true);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 an unsaved editor draft and the active filter survive a refresh", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state, calls } = makeAdapter({ transient: { editingItemId: "i2" } });
    const fixture = await createOverviewFixture(adapter);
    const input = fixture.container.querySelector(".task-edit-title");
    assert.ok(input);
    setValue(input, "Brouillon non enregistré");
    assert.equal(input.value, "Brouillon non enregistré");

    state.transient.projectFilter = "urgent";
    state.document = {
      version: 1,
      subjects: [
        {
          id: "p1",
          title: "Projet A",
          items: [item("i1", "urgent"), item("i2"), item("i3"), item("i4")]
        },
        { id: "p2", title: "Projet B", items: [item("j1", "urgent")] }
      ]
    };
    fixture.rerender();
    assert.equal(fixture.container.querySelector(".task-edit-title"), input);
    assert.equal(input.value, "Brouillon non enregistré");
    assert.equal(adapter.getSnapshot().filter, "urgent");
    assert.deepEqual(
      [...fixture.container.querySelectorAll(".subject")].map((node) => node.dataset.subject),
      ["p1", "p2"]
    );
    assert.deepEqual(calls, []);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 an open task menu stays open and focused during an in-place update", async () => {
  const dom = installDeterministicDom();
  try {
    const { adapter, state } = makeAdapter({ transient: { openMenuId: "i2" } });
    const fixture = await createOverviewFixture(adapter);
    const menu = fixture.container.querySelector("#task-menu-i2");
    assert.ok(menu);
    const edit = menu.querySelector(".task-menu-edit");
    edit.focus();

    state.document = {
      version: 1,
      subjects: [{ id: "p1", title: "Projet A", items: [item("i1", "urgent"), item("i2"), item("i3"), item("i4")] }]
    };
    fixture.rerender();
    assert.equal(fixture.container.querySelector("#task-menu-i2"), menu);
    assert.equal(dom.document.activeElement, edit);
    assert.equal(edit.isConnected, true);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-064 applyFocus returns to a connected Overview control and never a detached node", () => {
  const dom = installDeterministicDom();
  try {
    dom.document.body.innerHTML = `
      <div id="subjects">
        <section class="subject" data-subject="p1" tabindex="-1">
          <div class="subject-controls">
            <button class="secondary subject-open" data-subject="p1">Ouvrir</button>
          </div>
          <form class="task-form" data-subject="p1"><input></form>
          <ul class="tasks">
            <li class="task task-parent" data-item="i1">
              <div class="task-row"><input class="task-check"></div>
              <button class="subtle task-menu-button"></button>
            </li>
          </ul>
        </section>
      </div>`;
    const subjectsEl = dom.document.querySelector("#subjects");
    const applyFocusCode = app.slice(
      app.indexOf("function applyFocus()"),
      app.indexOf("function renderSuggestion()")
    );
    const state = {
      subjectsEl,
      pendingNavigationFocus: null,
      editingItemId: null,
      renamingSubject: false,
      focusDetailHeading: false,
      focusOpenSubjectId: null,
      focusRenameControl: false,
      focusSubjectId: null,
      focusItemId: null,
      pendingCollapseFocus: null,
      pendingPriorityFocus: null,
      pendingMenuFocus: null,
      pendingMoveFocus: null
    };
    const context = { ...state, document: dom.document, Number, Math };
    const run = (patch) => {
      Object.assign(context, patch);
      runInNewContext(applyFocusCode + "\napplyFocus();", context);
    };

    run({ focusOpenSubjectId: "p1" });
    assert.equal(dom.document.activeElement.classList.contains("subject-open"), true);
    assert.equal(dom.document.activeElement.isConnected, true);

    run({ focusOpenSubjectId: null, focusSubjectId: "p1" });
    assert.equal(dom.document.activeElement.classList.contains("subject"), true);
    assert.equal(dom.document.activeElement.isConnected, true);

    const focusCode = app.slice(
      app.indexOf("function uxSubject(id)"),
      app.indexOf("function captureUxContinuity(")
    );
    const focusContext = { subjectsEl, document: dom.document };
    runInNewContext(focusCode + "\n;({ uxFocusIdentity, uxFindFocus });", focusContext);
    const menu = subjectsEl.querySelector(".task-menu-button");
    menu.focus();
    const identity = focusContext.uxFocusIdentity(menu);
    assert.equal(identity.kind, "task");
    assert.equal(identity.subjectId, "p1");
    assert.equal(identity.itemId, "i1");
    assert.equal(identity.control, ".task-menu-button");
    subjectsEl.querySelector(".task").remove();
    const replacement = focusContext.uxFindFocus(identity);
    assert.ok(replacement);
    assert.equal(replacement.isConnected, true);
    assert.equal(replacement.closest(".task"), null);
    assert.match(app, /!snapshot\.focusedNode\.isConnected/);
    assert.match(app, /function resetExpandedViewState\(\)/);
    assert.match(app, /shouldResetExpandedParents\(expandedParentIdentityKey, identity\)/);
    assert.match(app, /isViewEntry\(route, nextRoute\)\) resetExpandedViewState\(\)/);
  } finally {
    dom.cleanup();
  }
});
