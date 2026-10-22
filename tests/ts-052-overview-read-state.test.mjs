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
  buildOverviewReadPresentation,
  overviewLoaderText
} from "../site/overview-read-state.js";

const source = readFileSync(
  new URL("../site/overview-read-state.js", import.meta.url),
  "utf8"
);

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

function presentation(overrides = {}) {
  return buildOverviewReadPresentation(input(overrides));
}

test("TS-052 constants, loader text and unknown input are deterministic", () => {
  assert.equal(OVERVIEW_LOADER_DELAY_MS, 250);
  assert.equal(OVERVIEW_DURABLE_WAIT_MS, 8000);
  assert.equal(OVERVIEW_LOADER_TEXT, "Chargement de vos projets…");
  assert.equal(overviewLoaderText(), OVERVIEW_LOADER_TEXT);
  assert.deepEqual(buildOverviewReadPresentation(), buildOverviewReadPresentation(null));
  const local = presentation({ configured: false });
  assert.equal(local.state, OVERVIEW_PRESENTATION_STATE.AWAITING_READ);
  assert.equal(local.actionRequired, false);
});

test("TS-052 healthy loading, connecting, initial and in-sync never need attention", () => {
  const steps = [
    { session: SESSION_STATE.LOADING, documentLoaded: false },
    { session: SESSION_STATE.AUTHENTICATED, documentLoaded: false },
    { session: SESSION_STATE.AUTHENTICATED, documentLoaded: false },
    { session: SESSION_STATE.AUTHENTICATED, documentLoaded: true }
  ];
  for (const step of steps) {
    const view = presentation(step);
    assert.equal(view.actionRequired, false);
    assert.equal(view.summaryVisible, false);
    assert.equal(view.summaryText, "");
  }
  assert.equal(presentation(steps[0]).state, OVERVIEW_PRESENTATION_STATE.INITIALIZING);
  assert.equal(presentation(steps[1]).state, OVERVIEW_PRESENTATION_STATE.AWAITING_READ);
  assert.equal(presentation(steps[3]).state, OVERVIEW_PRESENTATION_STATE.AVAILABLE);
});

test("TS-052 in-sync and a completed pull alone never prove projects are available", () => {
  const view = presentation({ documentLoaded: false });
  assert.equal(view.state, OVERVIEW_PRESENTATION_STATE.AWAITING_READ);
  assert.equal(view.projectsAvailable, false);
  assert.equal(view.loaderVisible, false);
});

test("TS-052 an authorized pending read exposes the stable placeholder only after the delay", () => {
  const early = presentation({ elapsedMs: OVERVIEW_LOADER_DELAY_MS - 1 });
  assert.equal(early.state, OVERVIEW_PRESENTATION_STATE.AWAITING_READ);
  assert.equal(early.loaderVisible, false);
  const visible = presentation({ elapsedMs: OVERVIEW_LOADER_DELAY_MS });
  assert.equal(visible.loaderVisible, true);
  assert.equal(visible.actionRequired, false);
  const resolved = presentation({ documentLoaded: true, elapsedMs: OVERVIEW_LOADER_DELAY_MS });
  assert.equal(resolved.state, OVERVIEW_PRESENTATION_STATE.AVAILABLE);
  assert.equal(resolved.loaderVisible, false);
});

test("TS-052 available projects stay available across transient native phase changes", () => {
  const first = presentation({ documentLoaded: true });
  for (const overrides of [
    { elapsedMs: 500 },
    { elapsedMs: OVERVIEW_DURABLE_WAIT_MS },
    { binding: BINDING_DIAGNOSTIC_STATE.UNBOUND }
  ]) {
    const view = presentation({ documentLoaded: true, ...overrides });
    assert.equal(view.state, OVERVIEW_PRESENTATION_STATE.AVAILABLE, JSON.stringify(overrides));
    assert.equal(view.loaderVisible, false);
    assert.equal(view.actionRequired, false);
  }
  assert.equal(first.actionRequired, false);
});

test("TS-052 confirmed read and write errors are immediate and actionable", () => {
  const read = presentation({ readError: true });
  assert.equal(read.state, OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED);
  assert.equal(read.reason, "read-error");
  assert.equal(read.summaryVisible, true);
  assert.match(read.summaryText, /Paramètres > Synchronisation/);
  assert.equal(read.loaderVisible, false);

  const write = presentation({
    writeError: true
  });
  assert.equal(write.state, OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED);
  assert.equal(write.reason, "write-error");

  const writes = presentation({ localWrites: LOCAL_WRITE_STATE.ERROR });
  assert.equal(writes.reason, "write-error");
});

test("TS-052 expired and refused sessions require a safe reconnection action", () => {
  for (const session of [SESSION_STATE.EXPIRED, SESSION_STATE.REFUSED, SESSION_STATE.SIGNED_OUT]) {
    const view = presentation({ session, documentLoaded: false });
    assert.equal(view.state, OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED, session);
    assert.equal(view.actionRequired, true);
    assert.match(view.summaryText, /Paramètres > Synchronisation/);
  }
});

test("TS-052 binding unverified, mismatch and destination mismatch are blocking", () => {
  for (const binding of [
    BINDING_DIAGNOSTIC_STATE.UNVERIFIED,
    BINDING_DIAGNOSTIC_STATE.MISMATCH,
    BINDING_DIAGNOSTIC_STATE.DESTINATION_MISMATCH
  ]) {
    const view = presentation({ binding, documentLoaded: true });
    assert.equal(view.state, OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED, binding);
    assert.equal(view.reason, "binding");
    assert.equal(view.projectsAvailable, false);
  }
  const mismatch = presentation({ baseMismatch: true });
  assert.equal(mismatch.reason, "binding");
});

test("TS-052 indeterminate binding and loading session stay silent until durable wait", () => {
  const indeterminate = presentation({ binding: BINDING_DIAGNOSTIC_STATE.INDETERMINATE });
  assert.equal(indeterminate.state, OVERVIEW_PRESENTATION_STATE.INITIALIZING);
  assert.equal(indeterminate.actionRequired, false);
  assert.equal(indeterminate.loaderVisible, false);

  const durable = presentation({
    binding: BINDING_DIAGNOSTIC_STATE.INDETERMINATE,
    elapsedMs: OVERVIEW_DURABLE_WAIT_MS
  });
  assert.equal(durable.state, OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED);
  assert.equal(durable.reason, "durable-wait");

  const loading = presentation({ session: SESSION_STATE.LOADING });
  assert.equal(loading.state, OVERVIEW_PRESENTATION_STATE.INITIALIZING);
  assert.equal(presentation({
    session: SESSION_STATE.LOADING,
    elapsedMs: OVERVIEW_DURABLE_WAIT_MS - 1
  }).state, OVERVIEW_PRESENTATION_STATE.INITIALIZING);
});

test("TS-052 local workspace reads before showing projects and explains durable waits", () => {
  const reading = presentation({ configured: false, elapsedMs: OVERVIEW_LOADER_DELAY_MS });
  assert.equal(reading.state, OVERVIEW_PRESENTATION_STATE.AWAITING_READ);
  assert.equal(reading.loaderVisible, true);
  assert.equal(reading.actionRequired, false);

  const durable = presentation({ configured: false, elapsedMs: OVERVIEW_DURABLE_WAIT_MS - 1 });
  assert.equal(durable.state, OVERVIEW_PRESENTATION_STATE.AWAITING_READ);
  assert.equal(durable.actionRequired, false);
  assert.equal(presentation({
    configured: false,
    elapsedMs: OVERVIEW_DURABLE_WAIT_MS
  }).state, OVERVIEW_PRESENTATION_STATE.ACTION_REQUIRED);

  const localError = presentation({ configured: false, readError: true });
  assert.equal(localError.reason, "read-error");
  assert.match(localError.summaryText, /Paramètres > Synchronisation/);
});

test("TS-052 durable wait only appears after its deterministic threshold", () => {
  assert.equal(presentation({ elapsedMs: OVERVIEW_DURABLE_WAIT_MS - 1 }).actionRequired, false);
  const durable = presentation({ elapsedMs: OVERVIEW_DURABLE_WAIT_MS });
  assert.equal(durable.actionRequired, true);
  assert.equal(durable.reason, "durable-wait");
  assert.equal(durable.loaderVisible, false);
  assert.match(durable.summaryText, /se prolonge/);
});

test("TS-052 identical inputs produce identical states and announcement keys", () => {
  const first = presentation({ elapsedMs: OVERVIEW_LOADER_DELAY_MS });
  const second = presentation({ elapsedMs: OVERVIEW_LOADER_DELAY_MS });
  assert.deepEqual(first, second);
  assert.equal(first.announcementKey, second.announcementKey);
  assert.equal(first.summaryKey, "");
  const action = presentation({ readError: true });
  assert.equal(action.announcementKey, "action:read-error");
  assert.match(action.summaryKey, /^read-error:/);
  assert.notEqual(action.summaryKey, "");
});

test("TS-052 presentation output never exposes sensitive or business content", () => {
  const view = presentation({
    readError: true,
    email: "alice@example.com",
    otp: "985412",
    token: "tok_live_secret",
    title: "Titre métier confidentiel",
    note: "Note métier privée",
    rawError: "Error: raw secret 985412"
  });
  assert.equal(JSON.stringify(view).includes("alice@example.com"), false);
  assert.equal(JSON.stringify(view).includes("985412"), false);
  assert.equal(JSON.stringify(view).includes("tok_live_secret"), false);
  assert.equal(JSON.stringify(view).includes("Titre métier confidentiel"), false);
  assert.equal(JSON.stringify(view).includes("Note métier privée"), false);
  assert.equal(JSON.stringify(view).includes("raw secret"), false);
});

test("TS-052 the pure model has no DOM, storage, network, native or timer access", () => {
  for (const forbidden of [
    /\bdocument\b/, /\bwindow\b/, /localStorage/, /IndexedDB/i,
    /fetch\s*\(/, /Dexie/, /\.subscribe\s*\(/, /setTimeout/, /setInterval/,
    /clearTimeout/, /\.commit\s*\(/, /\.open\s*\(/
  ]) {
    assert.doesNotMatch(source, forbidden, String(forbidden));
  }
  assert.match(source, /export function buildOverviewReadPresentation/);
});
