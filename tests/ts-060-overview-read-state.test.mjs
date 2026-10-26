import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BINDING_DIAGNOSTIC_STATE,
  LOCAL_WRITE_STATE,
  SESSION_STATE
} from "../site/sync-diagnostics.js";
import {
  OVERVIEW_DURABLE_WAIT_MS,
  OVERVIEW_LOADER_DELAY_MS,
  OVERVIEW_LOADER_TEXT,
  OVERVIEW_PRESENTATION_STATE,
  buildOverviewReadPresentation
} from "../site/overview-read-state.js";
import { decideProjectDetailSurface } from "../site/project-detail/surface-decision.js";

const appSource = readFileSync(new URL("../site/app.js", import.meta.url), "utf8");
const modelSource = readFileSync(new URL("../site/overview-read-state.js", import.meta.url), "utf8");

function input(overrides = {}) {
  return {
    configured: true,
    session: SESSION_STATE.AUTHENTICATED,
    binding: BINDING_DIAGNOSTIC_STATE.BOUND,
    documentLoaded: false,
    readError: false,
    writeError: false,
    localWrites: LOCAL_WRITE_STATE.NONE,
    baseMismatch: false,
    elapsedMs: 0,
    ...overrides
  };
}

const presentation = (overrides = {}) => buildOverviewReadPresentation(input(overrides));

test("TS-060 Overview keeps the TS-052 thresholds and never shows an early loader", () => {
  assert.equal(OVERVIEW_LOADER_DELAY_MS, 250);
  assert.equal(OVERVIEW_DURABLE_WAIT_MS, 8000);
  assert.equal(OVERVIEW_LOADER_TEXT, "Chargement de vos projets…");
  for (const elapsed of [0, 1, 100, OVERVIEW_LOADER_DELAY_MS - 1]) {
    const view = presentation({ elapsedMs: elapsed });
    assert.equal(view.state, OVERVIEW_PRESENTATION_STATE.AWAITING_READ, String(elapsed));
    assert.equal(view.loaderVisible, false, String(elapsed));
    assert.equal(view.actionRequired, false, String(elapsed));
    assert.equal(view.summaryVisible, false, String(elapsed));
    assert.equal(view.projectsAvailable, false, String(elapsed));
  }
  const loaded = presentation({ elapsedMs: OVERVIEW_LOADER_DELAY_MS });
  assert.equal(loaded.loaderVisible, true);
  assert.equal(loaded.actionRequired, false);
  assert.equal(loaded.summaryText, "");
  assert.equal(loaded.announcementKey, "loader");
});

test("TS-060 the stable loader becomes a durable wait at 8000 ms without a diagnostic flash", () => {
  const justBefore = presentation({ elapsedMs: OVERVIEW_DURABLE_WAIT_MS - 1 });
  assert.equal(justBefore.loaderVisible, true);
  assert.equal(justBefore.actionRequired, false);
  const durable = presentation({ elapsedMs: OVERVIEW_DURABLE_WAIT_MS });
  assert.equal(durable.state, OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED);
  assert.equal(durable.reason, "durable-wait");
  assert.equal(durable.loaderVisible, false);
  assert.equal(durable.summaryVisible, true);
  assert.match(durable.summaryText, /se prolonge/);
  assert.equal(durable.projectsAvailable, false);

  for (const elapsed of [0, OVERVIEW_LOADER_DELAY_MS, OVERVIEW_DURABLE_WAIT_MS - 1]) {
    const view = presentation({ elapsedMs: elapsed });
    assert.equal(view.summaryKey, "");
    assert.equal(view.summaryVisible, false);
    assert.notEqual(view.announcementKey.startsWith("action:"), true);
  }
});

test("TS-060 a pending authorized read never presents a false empty state or zero projects", () => {
  for (const overrides of [
    { configured: true },
    { configured: false },
    { documentLoaded: false, elapsedMs: OVERVIEW_LOADER_DELAY_MS }
  ]) {
    const view = presentation(overrides);
    assert.notEqual(view.state, OVERVIEW_PRESENTATION_STATE.AVAILABLE, JSON.stringify(overrides));
    assert.equal(view.projectsAvailable, false, JSON.stringify(overrides));
    assert.equal(view.actionRequired, false, JSON.stringify(overrides));
  }
  const readError = presentation({ readError: true });
  assert.equal(readError.actionRequired, true);
  assert.equal(readError.projectsAvailable, false);
});

test("TS-060 projects stay available across a background refresh and only real errors act", () => {
  const available = presentation({ documentLoaded: true });
  assert.equal(available.state, OVERVIEW_PRESENTATION_STATE.AVAILABLE);
  assert.equal(available.projectsAvailable, true);
  for (const overrides of [
    { elapsedMs: 500 },
    { elapsedMs: OVERVIEW_DURABLE_WAIT_MS },
    { binding: BINDING_DIAGNOSTIC_STATE.UNBOUND }
  ]) {
    const view = presentation({ documentLoaded: true, ...overrides });
    assert.equal(view.state, OVERVIEW_PRESENTATION_STATE.AVAILABLE, JSON.stringify(overrides));
    assert.equal(view.projectsAvailable, true, JSON.stringify(overrides));
    assert.equal(view.actionRequired, false, JSON.stringify(overrides));
  }
  for (const overrides of [
    { readError: true },
    { writeError: true },
    { baseMismatch: true },
    { binding: BINDING_DIAGNOSTIC_STATE.UNVERIFIED }
  ]) {
    assert.equal(presentation({ documentLoaded: true, ...overrides }).actionRequired, true);
  }
});

test("TS-060 the overview route mounts only the bounded card surface and keeps the announcement keys", () => {
  const decision = decideProjectDetailSurface({
    route: { view: "overview" },
    businessAllowed: true,
    isLoadingBlocked: false,
    documentLoaded: true,
    projectExists: true
  });
  assert.equal(decision.mount, false);

  const overviewStart = appSource.indexOf('releaseProjectDetailSurface("route-overview")');
  const overviewEnd = appSource.indexOf("replaceSubjectsInCurrentView(nextSubjects, uxSnapshot);", overviewStart);
  assert.ok(overviewStart > 0 && overviewEnd > overviewStart);
  const overviewBranch = appSource.slice(overviewStart, overviewEnd);
  assert.doesNotMatch(overviewBranch, /createProjectDetailSurface|createRoot/);
  assert.match(overviewBranch, /renderSuggestion\(\)/);
  assert.match(overviewBranch, /renderUrgencyList\(\)/);
  assert.match(overviewBranch, /renderOverviewSurface\(uxSnapshot, explicitUxFocus\)/);
  assert.match(overviewBranch, /overviewFilteredSubjects\(/);
  assert.match(appSource, /from "\.\/overview\/OverviewSurface\.jsx"/);
  assert.match(appSource, /function overviewSurfaceCanMount\(\)/);
  assert.match(appSource, /function renderOverviewSurface\(uxSnapshot, explicitFocus\)/);

  assert.match(appSource, /from "\.\/overview-read-state\.js"/);
  assert.match(appSource, /OVERVIEW_LOADER_DELAY_MS/);
  assert.match(appSource, /OVERVIEW_DURABLE_WAIT_MS/);
  assert.match(appSource, /presentation\.state === OVERVIEW_PRESENTATION_STATE\.AWAITING_READ/);

  const loader = presentation({ elapsedMs: OVERVIEW_LOADER_DELAY_MS });
  const durable = presentation({ elapsedMs: OVERVIEW_DURABLE_WAIT_MS });
  assert.equal(loader.announcementKey, "loader");
  assert.equal(durable.announcementKey, "action:durable-wait");
  const error = presentation({ readError: true });
  assert.equal(error.announcementKey, "action:read-error");
  assert.notEqual(error.summaryKey, "");
});

test("TS-060 the Overview model stays pure and reuses existing signals only", () => {
  for (const forbidden of [
    /\bdocument\b/, /\bwindow\b/, /localStorage/, /IndexedDB/i,
    /fetch\s*\(/, /Dexie/, /\.subscribe\s*\(/, /setTimeout/, /setInterval/,
    /clearTimeout/, /\.commit\s*\(/, /\.open\s*\(/
  ]) {
    assert.doesNotMatch(modelSource, forbidden, String(forbidden));
  }
  assert.match(modelSource, /export const OVERVIEW_LOADER_DELAY_MS = 250;/);
  assert.match(modelSource, /export const OVERVIEW_DURABLE_WAIT_MS = 8000;/);
  assert.match(modelSource, /export const OVERVIEW_LOADER_TEXT = "Chargement de vos projets…";/);
  assert.match(modelSource, /from "\.\/sync-diagnostics\.js"/);
});
