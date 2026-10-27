import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createOverviewAdapter } from "../site/overview/overview-adapter.js";
import { OVERVIEW_PRESENTATION_STATE } from "../site/overview-read-state.js";
import { createProjectDetailCommands } from "../site/project-detail/controller-commands.js";
import { NAV_MENU_ENTRIES, parseRoute, RESUME_KEY, STORAGE_KEY } from "../site/core.js";
import {
  OVERVIEW_TEST_COMMANDS,
  createOverviewFixture,
  installDeterministicDom,
  overviewSourceFiles
} from "./helpers/ts-064-overview-harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const css = read("site/styles.css");
const html = read("site/index.html");
const tokens = read("site/styles/tokens.css");
const tasks = read("openspec/changes/ts-066/tasks.md");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));

const startMarker = "/* TS-066 Overview presentation */";
const endMarker = "/* End TS-066 */";
const overviewCss = css.slice(css.indexOf(startMarker), css.indexOf(endMarker) + endMarker.length);

function tokenValue(name) {
  const match = new RegExp("--" + name + "\\s*:\\s*([^;]+);").exec(tokens);
  assert.ok(match, "missing token --" + name);
  return match[1].trim();
}

function definedTokens() {
  return new Set([...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
}

function ruleBody(source, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(escaped + "\\{([^}]*)\\}").exec(source);
  assert.ok(match, "missing rule " + selector);
  return match[1];
}

function item(id, priority = "normal", done = false, parentId = null, note = null) {
  return { id, title: id, priority, done, parentId, ...(note === null ? {} : { note }) };
}

function subject(id, items = []) {
  return { id, title: id, items };
}

function documentFixture(subjects) {
  return { version: 1, subjects };
}

function readyPresentation(overrides = {}) {
  return {
    state: OVERVIEW_PRESENTATION_STATE.AVAILABLE,
    actionRequired: false,
    projectsAvailable: true,
    ...overrides
  };
}

function makeAdapter({
  document: doc = documentFixture([subject("p1", [item("i1", "urgent")])]),
  route = { view: "overview" },
  identity = { type: "local" },
  allowed = true,
  blocked = false,
  presentation = readyPresentation(),
  transient = {}
} = {}) {
  const state = {
    document: doc,
    route,
    identity,
    allowed,
    blocked,
    presentation,
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

function text(node) {
  return node ? node.textContent : null;
}

function setValue(node, value) {
  const prototype = node.tagName === "SELECT"
    ? globalThis.HTMLSelectElement.prototype
    : node.tagName === "TEXTAREA"
      ? globalThis.HTMLTextAreaElement.prototype
      : globalThis.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, value);
  node.dispatchEvent(new globalThis.Event(
    node.tagName === "SELECT" ? "change" : "input",
    { bubbles: true }
  ));
}

test("TS-066 dependency gate verifies the delivered TS-065 change without a human GO gate", () => {
  assert.ok(existsSync(resolve(root, "openspec/changes/archive/2026-10-27-ts-065")));
  assert.ok(existsSync(resolve(root, "site/overview")));
  for (const file of [
    "tests/ts-065-overview-commands.test.mjs",
    "tests/ts-065-overview-continuity.test.mjs",
    "tests/ts-065-overview-editors.test.mjs",
    "tests/ts-065-overview-docs.test.mjs"
  ]) {
    assert.ok(existsSync(resolve(root, file)), file);
  }
  const checklist = tasks.slice(0, tasks.indexOf("## Manual acceptance"));
  assert.doesNotMatch(checklist, /GO manuel|attestation TS-065|bloqué par la recette/i);
});

function interactionSource() {
  return [
    ...overviewSourceFiles().map((entry) => entry.source),
    read("site/project-detail/TaskItem.jsx"),
    read("site/project-detail/TaskActionMenu.jsx"),
    read("site/ui/PriorityControl.jsx")
  ].join("\n");
}

test("TS-066 baseline keeps control classes, ids, accessible names, reading order and token values", () => {
  const source = interactionSource();
  for (const marker of [
    "subject-open",
    "overview-see-more",
    "task-check",
    "priority-control",
    "task-toggle",
    "task-handle",
    "overview-filter-all"
  ]) {
    assert.match(source + html, new RegExp(marker), marker);
  }
  assert.equal(tokenValue("control-target-min"), "44px");
  assert.equal((html.match(/id="overview-filter-all"/g) || []).length, 1);
  assert.equal((html.match(/id="subject-form"/g) || []).length, 1);
  assert.equal((html.match(/id="hide-completed"/g) || []).length, 1);
  assert.ok(
    html.indexOf('id="resume-card"') < html.indexOf('id="dashboard-title"')
    && html.indexOf('id="dashboard-title"') < html.indexOf('id="focus-suggest"')
    && html.indexOf('id="focus-suggest"') < html.indexOf('id="overview-urgencies"')
    && html.indexOf('id="overview-urgencies"') < html.indexOf('id="subject-form"')
    && html.indexOf('id="subject-form"') < html.indexOf('id="overview-urgency-filter"')
    && html.indexOf('id="overview-urgency-filter"') < html.indexOf('id="projects-loading"')
    && html.indexOf('id="projects-loading"') < html.indexOf('id="subjects"'),
    "Overview reading order changed"
  );
});

test("TS-066 Overview composition uses shared tokens and bounded spacing", () => {
  assert.ok(overviewCss.length > 0, "missing TS-066 CSS section");
  assert.equal((css.match(/TS-066 Overview presentation/g) || []).length, 1);
  const defined = definedTokens();
  for (const match of overviewCss.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    assert.ok(defined.has(match[1]), "undefined token " + match[1]);
  }
  assert.doesNotMatch(overviewCss, /--[a-z0-9-]+\s*:/, "TS-066 must not define tokens");
  for (const declaration of [
    "var(--space-3)",
    "var(--space-5)",
    "var(--space-6)",
    "var(--radius-panel)",
    "var(--radius-surface)",
    "var(--font-weight-heavy)",
    "var(--font-size-small)",
    "var(--line-height-control)",
    "var(--color-border-subtle)",
    "var(--color-text-control)",
    "var(--color-text-muted)",
    "var(--focus-outline)"
  ]) {
    assert.ok(overviewCss.includes(declaration), declaration);
  }
  for (const selector of [
    ".dashboard",
    ".dashboard>.section-top",
    ".dashboard h2",
    ".dashboard .counter",
    ".dashboard .resume-card",
    ".dashboard .focus-card",
    ".dashboard .overview-urgencies",
    ".dashboard .add-subject",
    ".dashboard .filter-toggle",
    ".dashboard .overview-urgency-filter"
  ]) {
    assert.ok(overviewCss.includes(selector), selector);
  }
  for (const body of overviewCss.split("}")) {
    if (!/color\s*:/.test(body)) continue;
    for (const declaration of body.match(/color\s*:\s*([^;]+)/g) || []) {
      assert.match(declaration, /var\(--color-/, "raw colour outside tokens: " + declaration);
    }
  }
});

test("TS-066 card and task-preview hierarchy keeps markup and preview markers", async () => {
  const dom = installDeterministicDom();
  try {
    const doc = documentFixture([
      subject("projet long", [
        item("parent", "urgent", false, null, "Note\nmultiligne"),
        item("child", "normal", false, "parent"),
        item("b", "normal"),
        item("c", "later"),
        item("d", "normal"),
        item("e", "normal"),
        item("f", "normal")
      ])
    ]);
    const { adapter, state } = makeAdapter({ document: doc, transient: { expandedParents: ["parent"] } });
    const fixture = await createOverviewFixture(adapter);
    const card = fixture.container.querySelector(".subject");
    assert.equal(text(card.querySelector("h3")), "projet long");
    assert.equal(card.querySelectorAll(".subject-head > div:first-child > p").length, 4);
    assert.deepEqual(
      [...card.querySelectorAll(".subject-controls button")].map((node) => node.className),
      ["secondary subject-open", "subtle subject-move", "subtle subject-move", "danger"]
    );
    assert.equal(card.querySelector(".task-area").querySelector(".task-form").dataset.subject, "projet long");
    assert.equal(card.querySelectorAll(".task-area > .tasks > .task").length, 5);
    assert.equal(card.querySelectorAll(".task-substep").length, 1);
    assert.equal(text(card.querySelector(".task-note")), "Note\nmultiligne");
    const seeMore = card.querySelector(".overview-see-more");
    assert.equal(text(seeMore), "Voir plus");
    assert.equal(seeMore.getAttribute("aria-label"), "Voir plus de tâches pour le projet projet long");
    assert.ok(card.querySelector(".task-area > .tasks").compareDocumentPosition(seeMore) & 4);
    state.transient.projectFilter = "all";
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-066 responsive tiers stay bounded and never scroll horizontally", () => {
  assert.match(overviewCss, /@media\(min-width:768px\)/);
  assert.match(css, /@media\(max-width:620px\)/);
  assert.match(css, /@media\(max-width:320px\)/);
  for (const width of [320, 390, 430, 768, 1280]) {
    const available = width - 30;
    assert.ok(available > 0, width + "px leaves a positive content width");
  }
  assert.match(ruleBody(overviewCss, ".dashboard"), /min-width:0/);
  assert.match(ruleBody(overviewCss, ".dashboard"), /max-width:100%/);
  assert.match(ruleBody(overviewCss, ".dashboard .subject"), /min-width:0/);
  assert.match(ruleBody(overviewCss, ".dashboard .subject"), /max-width:100%/);
  assert.match(ruleBody(overviewCss, ".dashboard .subject"), /overflow-wrap:anywhere/);
  assert.match(overviewCss, /\.dashboard \.subject-controls\{[^}]*flex-wrap:wrap/);
  assert.match(overviewCss, /\.dashboard \.children\{[^}]*max-width:100%/);
  assert.doesNotMatch(css, /overflow-x\s*:/);
  assert.doesNotMatch(css, /(?:^|[;{])\s*overflow-x\s*:\s*(?:auto|scroll)/);
  const fixedWidths = [...overviewCss.matchAll(/(?<![-\w])width:(\d+)px/g)].map((match) => Number(match[1]));
  for (const value of fixedWidths) {
    assert.ok(value < 320, "fixed width " + value + "px exceeds a 320px viewport");
  }
  assert.match(ruleBody(css, ".shell"), /max-width:var\(--content-max-width\)/);
  assert.equal(tokenValue("content-max-width"), "1000px");
});

test("TS-066 state, focus and disabled presentations remain distinguishable", () => {
  for (const selector of [
    ".dashboard .overview-see-more:focus-visible",
    ".dashboard .subject-open:focus-visible",
    ".dashboard .subject-move:focus-visible",
    ".dashboard .task-toggle:focus-visible",
    ".dashboard .task-handle:focus-visible",
    ".dashboard .task-check:focus-visible",
    ".dashboard .priority-control:focus-visible",
    ".dashboard .task.done>.task-row .task-title",
    ".dashboard .empty",
    ".dashboard .filtered-empty"
  ]) {
    assert.ok(overviewCss.includes(selector), selector);
  }
  for (const selector of [
    ".resume-card[hidden]",
    ".overview-urgencies[hidden]",
    ".projects-loading[hidden]",
    ".priority-urgent",
    ".priority-normal",
    ".priority-later",
    ".subject-progress",
    ".subject-move:disabled",
    ".task-menu-command:disabled"
  ]) {
    assert.ok(css.includes(selector), selector);
  }
  assert.match(html, /id="projects-loading"[^>]*aria-busy="true"/);
  assert.match(overviewCss, /\.dashboard \.task\.done>\.task-row \.task-title\{[^}]*text-decoration:line-through/);
  assert.match(overviewCss, /\.dashboard \.task\.done>\.task-row \.task-title\{[^}]*color:var\(--color-text-muted\)/);
});

test("TS-066 compiled Overview parity keeps controls, names, order and Voir plus placement", async () => {
  const dom = installDeterministicDom();
  try {
    const doc = documentFixture([
      subject("Projet A", [
        item("parent", "urgent", false, null, "Note A"),
        item("child", "normal", false, "parent"),
        item("other", "normal"),
        item("third", "later"),
        item("fourth", "normal"),
        item("fifth", "normal"),
        item("sixth", "normal")
      ])
    ]);
    const { adapter } = makeAdapter({ document: doc, transient: { expandedParents: ["parent"] } });
    const fixture = await createOverviewFixture(adapter);
    const card = fixture.container.querySelector(".subject");
    assert.equal(card.tagName, "SECTION");
    assert.equal(card.dataset.reactSurface, "overview-card");
    assert.equal(card.getAttribute("aria-label"), "Projet A");
    assert.equal(card.getAttribute("tabindex"), "-1");
    assert.deepEqual(
      [...card.querySelector(".subject-head > div:first-child").children].map((node) => node.tagName + "." + node.className),
      ["H3.", "P.small", "P.small subject-total", "P.small subject-urgency", "P.small subject-progress"]
    );
    assert.deepEqual(
      [...card.querySelectorAll(".subject-controls button")].map((node) => node.getAttribute("aria-label")),
      [
        "Ouvrir le projet Projet A",
        "Monter le sujet Projet A",
        "Descendre le sujet Projet A",
        "Supprimer le sujet Projet A"
      ]
    );
    assert.deepEqual(
      [...card.querySelectorAll(".task-area > .tasks > .task")].map((node) => node.dataset.item),
      ["parent", "other", "fourth", "fifth", "sixth"]
    );
    const childList = card.querySelector("#substeps-parent");
    assert.ok(childList);
    assert.equal(card.querySelectorAll("#substeps-parent > .task-substep").length, 1);
    assert.equal(card.querySelector(".task-check").getAttribute("aria-label"), "Terminer parent");
    assert.equal(
      card.querySelector(".priority-control").getAttribute("aria-label"),
      "Priorité de « parent » : Urgent"
    );
    const seeMore = card.querySelector(".overview-see-more");
    assert.equal(seeMore.parentElement.className, "task-area");
    assert.equal(seeMore.previousElementSibling.className, "tasks");
    assert.equal(card.querySelectorAll(".overview-see-more").length, 1);
    fixture.unmount();
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-066 tokens, dependencies and remote assets stay unchanged", () => {
  assert.equal(
    createHash("sha256").update(tokens).digest("hex"),
    "19500fecc96a4ca460ea29970fb960c1f5edc25973f377acf6b37dd24af6d2ef",
    "site/styles/tokens.css values changed"
  );
  assert.deepEqual(Object.keys(packageJson.dependencies).sort(), [
    "dexie",
    "dexie-cloud-addon",
    "react",
    "react-dom"
  ]);
  assert.deepEqual(packageJson.devDependencies, {
    esbuild: "0.25.10",
    jsdom: "30.1.3",
    vite: "7.3.7"
  });
  assert.deepEqual(packageLock.packages[""].dependencies, packageJson.dependencies);
  assert.deepEqual(packageLock.packages[""].devDependencies, packageJson.devDependencies);
  assert.equal((css.match(/@import\s+/g) || []).length, 1);
  assert.match(css, /^@import "\.\/styles\/tokens\.css";/);
  const withoutSvgNamespace = css.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, "");
  assert.doesNotMatch(withoutSvgNamespace, /https?:\/\//, "remote CSS URL");
  assert.doesNotMatch(css, /@font-face|fonts\.googleapis|cdn\.|unpkg|jsdelivr|tailwind/i);
  assert.doesNotMatch(html, /(?:src|href)="https?:\/\//);
});

test("TS-066 Overview components keep ownership, imports and side-effect boundaries", () => {
  for (const { name, source } of overviewSourceFiles()) {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /dangerouslySetInnerHTML|\binnerHTML\b/, name);
    assert.doesNotMatch(code, /location\.hash\s*=|pushState|replaceState|history\./, name);
    assert.doesNotMatch(code, /localStorage|sessionStorage|indexedDB|new\s+Dexie|\bfetch\s*\(|XMLHttpRequest|WebSocket/, name);
    assert.doesNotMatch(code, /threadstep\.[a-z]+\.v\d|threadstep\.[a-z-]+\.v\d/, name);
    for (const match of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      assert.match(
        match[1],
        /^(react|react\/jsx-runtime|\.\.\/core\.js|\.\.\/overview-read-state\.js|\.\.\/interaction-continuity\.js|\.\.\/project-detail\/|\.\.\/ui\/|\.\/)/,
        name + " unexpected import " + match[1]
      );
    }
  }
  assert.match(read("site/overview/ProjectCard.jsx"), /from "\.\.\/ui\/Button\.jsx"/);
  assert.match(read("site/overview/ProjectCard.jsx"), /from "\.\.\/project-detail\/CreateTaskForm\.jsx"/);
  assert.match(read("site/overview/OverviewTaskList.jsx"), /from "\.\.\/project-detail\/TaskItem\.jsx"/);
  assert.match(read("site/overview/OverviewCards.jsx"), /from "\.\/ProjectCard\.jsx"/);
  assert.deepEqual(parseRoute("#/"), { view: "overview" });
  assert.equal(STORAGE_KEY, "threadstep.document.v1");
  assert.equal(RESUME_KEY, "threadstep.resume.v1");
  assert.equal(NAV_MENU_ENTRIES.length, 4);
});

function continuityHarness({ transient = {} } = {}) {
  const state = {
    route: { view: "overview" },
    identity: { type: "local" },
    document: documentFixture([
      subject("p1", [
        item("a", "normal", false, null, "Note A"),
        item("parent", "normal"),
        item("child", "normal", false, "parent")
      ])
    ]),
    transient: {
      expandedParents: new Set(["parent"]),
      openMenuId: null,
      editingItemId: null,
      renamingSubject: false,
      hideCompleted: false,
      trackedItemId: null,
      revealItemId: null,
      projectFilter: "all",
      ...transient
    }
  };
  const counts = { persist: 0 };
  const commands = {};
  const base = createProjectDetailCommands({
    getDocument: () => state.document,
    setDocument: (next) => { state.document = next; },
    persist: () => { counts.persist += 1; },
    render: () => {},
    notify: () => {},
    getTransient: () => state.transient,
    setTransient: (patch) => Object.assign(state.transient, patch),
    removeAction: () => true,
    undoAction: () => true,
    startDragAction: () => true,
    cancelDragAction: () => true,
    navigate: () => {},
    promptText: () => "Sous-étape",
    randomId: () => "generated",
    getResumeRef: () => null,
    setResumeRef: () => {},
    saveResumePreference: () => Promise.resolve(true)
  });
  for (const [name, value] of Object.entries(base)) {
    if (typeof value === "function") commands[name] = value;
  }
  const adapter = createOverviewAdapter({
    getDocument: () => state.document,
    getRoute: () => state.route,
    getTransientState: () => state.transient,
    getAuthorizedIdentity: () => state.identity,
    isBusinessAllowed: () => true,
    isLoadingBlocked: () => false,
    getPresentation: () => readyPresentation(),
    commands
  });
  return { state, counts, adapter };
}

test("TS-066 same-context presentation update keeps focus, draft, expanded parent and filter", async () => {
  const dom = installDeterministicDom();
  const harness = continuityHarness();
  const fixture = await createOverviewFixture(harness.adapter);
  try {
    const input = fixture.container.querySelector(".task-form input");
    input.focus();
    await fixture.act(() => setValue(input, "Brouillon TS-066"));
    const childList = fixture.container.querySelector("#substeps-parent");
    assert.ok(childList);

    harness.state.document = documentFixture([
      subject("p1", [
        item("a", "normal", false, null, "Note A"),
        item("parent", "normal"),
        item("child", "normal", false, "parent"),
        item("later", "normal")
      ])
    ]);
    harness.state.transient.projectFilter = "all";
    fixture.rerender();

    assert.equal(fixture.container.querySelector(".task-form input"), input);
    assert.equal(input.isConnected, true);
    assert.equal(input.value, "Brouillon TS-066");
    assert.equal(dom.document.activeElement, input);
    assert.equal(fixture.container.querySelector("#substeps-parent"), childList);
    assert.equal(childList.isConnected, true);
    assert.equal(fixture.container.querySelectorAll("#substeps-parent > .task-substep").length, 1);
    assert.equal(harness.adapter.getSnapshot().transient.projectFilter, "all");
    assert.equal(harness.counts.persist, 0);
  } finally {
    fixture.unmount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    dom.cleanup();
  }
});

test("TS-066 route and identity boundaries still release the transient Overview context", () => {
  const doc = documentFixture([subject("p1", [item("a")])]);
  const route = makeAdapter({ document: doc, route: { view: "subject", subjectId: "p1" } });
  assert.equal(route.adapter.getSnapshot(), null);
  assert.equal(route.adapter.invalidationReason(), "route-not-overview");
  assert.equal(route.adapter.isInvalidated(), true);

  const identity = makeAdapter({ document: doc, identity: null });
  assert.equal(identity.adapter.getSnapshot(), null);
  assert.equal(identity.adapter.invalidationReason(), "identity-unavailable");
  assert.equal(identity.adapter.isInvalidated(), true);

  const stable = makeAdapter({ document: doc });
  assert.ok(stable.adapter.getSnapshot());
  stable.state.identity = { type: "synced", databaseName: "other", userDigest: "u" };
  assert.equal(stable.adapter.getSnapshot(), null);
  assert.equal(stable.adapter.invalidationReason(), "context-changed");
});

test("TS-066 documentation records visual map, tiers, tokens, continuity, rollback and limits", () => {
  const doc = read("docs/product/react-overview-presentation.md");
  for (const heading of [
    "Carte visuelle",
    "Paliers responsive",
    "Composants et tokens réutilisés",
    "Focus, scroll et continuité",
    "Retour arrière",
    "Preuves structurelles et recette humaine",
    "Limites"
  ]) {
    assert.match(doc, new RegExp("## " + heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), heading);
  }
  for (const phrase of [
    /320/,
    /390/,
    /430/,
    /768/,
    /1280/,
    /620px/,
    /min-width:768px/,
    /site\/overview\/ProjectCard\.jsx/,
    /site\/overview\/OverviewTaskList\.jsx/,
    /site\/overview\/OverviewCards\.jsx/,
    /site\/styles\/tokens\.css/,
    /site\/styles\.css/,
    /focus/,
    /scroll/,
    /npm run check/,
    /npm run build/,
    /npm run verify:build/,
    /non cochée par `apply`/,
    /Chrome Android/,
    /lecteur d'écran/,
    /NOT_RUN/
  ]) {
    assert.match(doc, phrase);
  }
  const guide = read("docs/product/developer-guide.md");
  assert.match(guide, /Présentation visuelle Overview \(TS-066\)/);
  for (const heading of ["Points d'entrée", "Tests et vérifications", "Retour arrière", "Limites de la vérification"]) {
    assert.match(guide, new RegExp("### " + heading), heading);
  }
  assert.match(guide, /docs\/product\/react-overview-presentation\.md/);
  assert.match(guide, /tests\/ts-066-overview-\*\.test\.mjs/);
  assert.match(guide, /site\/styles\.css/);
  assert.match(guide, /recette humaine/);
});

test("TS-066 scope stays limited to presentation, documentation, TS-066 tests and the change", () => {
  const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const changed = git(["status", "--porcelain"]).split("\n").filter(Boolean).map((line) => line.slice(3));
  const allowed = [
    "site/styles.css",
    "docs/product/react-overview-presentation.md",
    "docs/product/developer-guide.md",
    "tests/ts-066-overview-visual.test.mjs",
    "openspec/changes/ts-066/"
  ];
  for (const path of changed) {
    assert.ok(
      allowed.some((prefix) => path === prefix || path.startsWith(prefix)),
      "unexpected changed path " + path
    );
  }
  const protectedPaths = [
    "site/core.js",
    "site/app.js",
    "site/overview/",
    "site/ui/",
    "package.json",
    "package-lock.json",
    "AGENTS.md",
    ".github/workflows/",
    "backlog/",
    "openspec/specs/"
  ];
  assert.equal(git(["status", "--porcelain", "--", ...protectedPaths]).trim(), "");
});
