import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONNECTION_STATE,
  INITIAL_PULL,
  REMOTE_EVIDENCE,
  SESSION_STATE,
  SYNC_PHASE,
  buildSyncDiagnostic
} from "../site/sync-diagnostics.js";
import {
  REPORT_SECTION_KEYS,
  buildSyncDiagnosticReport,
  describeBrowserContext,
  writeReportToClipboard,
  createDiagnosticSharingController,
  SHARE_STATUS
} from "../site/sync-diagnostic-report.js";

const URL_A = "https://alpha.dexie.cloud";
const USER = Object.freeze({ isLoggedIn: true, userId: "account-123" });
const moduleSource = readFileSync(new URL("../site/sync-diagnostic-report.js", import.meta.url), "utf8");

function completePersisted(overrides = {}) {
  return {
    initiallySynced: true,
    remoteDbId: "remote-1",
    serverRevision: 42,
    realms: ["account-123"],
    databaseUrl: URL_A,
    ...overrides
  };
}

function baseInput(overrides = {}) {
  return {
    configured: true,
    databaseUrl: URL_A,
    online: true,
    user: USER,
    syncState: { status: "connected", phase: "in-sync" },
    persistedSyncState: completePersisted(),
    localWrites: "none",
    binding: "bound",
    ...overrides
  };
}

function reportFor(input, extra = {}) {
  return buildSyncDiagnosticReport({
    diagnostic: buildSyncDiagnostic(input),
    now: new Date("2026-10-21T10:20:30Z"),
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36",
    localBase: "empty",
    ...extra
  });
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function expectedLocal(date) {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) +
    " (UTC" + sign + pad(Math.floor(absolute / 60)) + ":" + pad(absolute % 60) + ")";
}

function sectionText(report, key) {
  const found = report.sections.find((entry) => entry.key === key);
  assert.ok(found, key);
  return found.entries.map((entry) => entry.key + " : " + entry.value).join("\n");
}

test("TS-051 report exposes every stable section key and both injected timestamps", () => {
  const now = new Date("2026-10-21T10:20:30Z");
  const report = reportFor(baseInput(), { now });
  assert.deepEqual(report.sections.map((entry) => entry.key), [...REPORT_SECTION_KEYS]);
  for (const key of REPORT_SECTION_KEYS) {
    assert.match(report.text, new RegExp("## .+"));
    assert.ok(report.sections.find((entry) => entry.key === key).entries.length > 0, key);
  }
  assert.ok(report.text.includes("`horodatage-local` : " + expectedLocal(now)));
  assert.ok(report.text.includes("`horodatage-utc` : " + now.toISOString()));
  assert.ok(report.sections.every((entry) => entry.entries.every((item) =>
    typeof item.key === "string" && item.key.length > 0 && typeof item.value === "string")));
});

test("TS-051 report allowlists its source and never copies trapped sensitive values", () => {
  const email = "alice@example.com";
  const otp = "12345678";
  const token = "tok_live_SECRET123";
  const cookie = "session=abcdef";
  const accountId = "acct_987654";
  const title = "Titre métier confidentiel";
  const note = "Note métier privée";
  const rawUrl = "https://user:pass@cloud.example/db?token=" + token + "#fragment";
  const rawMessage = "Internal failure for " + email + " code " + otp;
  const stack = "Error: secret at worker.js:42";
  const traps = [email, otp, token, cookie, accountId, title, note, rawUrl, rawMessage, stack,
    "user:pass", "cloud.example", "fragment"];

  const report = reportFor({
    configured: true,
    databaseUrl: rawUrl,
    online: false,
    user: { isLoading: true },
    syncState: { status: "error", phase: "error", error: { name: "Error", message: rawMessage, stack } },
    persistedSyncState: completePersisted({
      error: { name: "Error", message: rawMessage, stack },
      remoteDbId: token
    }),
    retryError: { name: "ReadError", message: rawMessage, stack },
    readError: { message: rawMessage, stack },
    localWrites: "error",
    binding: "unverified",
    workspace: {
      type: "synchronized",
      effectiveBase: email,
      url: rawUrl,
      remoteDbId: token
    },
    bootstrap: { cause: "missing-attestation", origin: "historical-unverified" }
  }, {
    userAgent: "Mozilla/5.0 " + email + " " + token + " Chrome/141.0.0.0 Safari/537.36",
    build: token
  });

  for (const trap of traps) {
    assert.ok(!report.text.includes(trap), "report must not contain " + trap);
  }
  assert.ok(report.text.includes("Chrome 141"));
  assert.ok(report.text.includes("base-locale-active"));
  assert.match(sectionText(report, "workspace"), /origine-cloud : masquée par défaut/);
  assert.ok(report.text.includes("masquée par défaut"));
  assert.ok(report.text.includes("version-application` : non disponible"));
  assert.ok(report.unavailable.includes("version-application"));
});

test("TS-051 report distinguishes the four session states, refusal and the historical ambiguity", () => {
  const loading = reportFor(baseInput({ user: { isLoading: true }, persistedSyncState: null,
    syncState: { status: "connecting", phase: "initial" } }));
  assert.match(sectionText(loading, "session"), /restauration/i);
  assert.match(loading.text, /pull initial en attente/i);
  assert.match(loading.text, /lecture distante non attestée/i);

  const signedOut = reportFor(baseInput({ user: null, persistedSyncState: null }));
  assert.match(sectionText(signedOut, "session"), /session absente/i);
  assert.match(sectionText(signedOut, "session"), /sans refus natif observé/i);

  const authenticated = reportFor(baseInput());
  assert.match(sectionText(authenticated, "session"), /Session authentifiée observée/);

  const refused = reportFor(baseInput({ authRefusal: "origin-refusal" }));
  assert.match(sectionText(refused, "session"), /refus natif explicitement constaté/i);
  assert.match(sectionText(refused, "errors"), /origine\/origin-refused/);
  assert.doesNotMatch(sectionText(refused, "session"), /session absente :/i);

  assert.match(signedOut.text, /« session absente ou refusée » ne prouve pas/i);
  assert.match(signedOut.text, /non attestée/i);
  assert.match(signedOut.text, /le Cloud n'est pas considéré comme vide/i);
  assert.doesNotMatch(signedOut.text, /migration proposée|purge proposée|récupération proposée/i);
});

test("TS-051 report covers offline, pulls, remote evidence and UNVERIFIED cache wording", () => {
  const offline = reportFor(baseInput({ online: false, syncState: { status: "offline", phase: "offline" } }));
  assert.match(sectionText(offline, "network"), /Hors ligne/);
  assert.match(sectionText(offline, "connection"), /Hors ligne/);

  const pending = reportFor(baseInput({ persistedSyncState: null,
    syncState: { status: "connecting", phase: "initial" }, binding: "unverified" }));
  assert.equal(pending.sections.find((entry) => entry.key === "initial-pull")
    .entries.find((entry) => entry.key === "pull-initial").value, "Pull initial en attente");
  assert.match(sectionText(pending, "remote-evidence"), /cache masqué ou non vérifié/);
  assert.match(sectionText(pending, "remote-evidence"), /absence-de-preuve : oui/);

  const failed = reportFor(baseInput({ syncState: { status: "error", phase: "error" } }));
  assert.match(sectionText(failed, "initial-pull"), /en échec/);
  assert.match(sectionText(failed, "remote-evidence"), /Lecture distante bloquée|État distant non déterminé/);

  const complete = reportFor(baseInput());
  assert.match(sectionText(complete, "initial-pull"), /terminé/);
  assert.equal(complete.sections.find((entry) => entry.key === "remote-evidence")
    .entries.find((entry) => entry.key === "preuve-distante").value, "Synchronisation initiale attestée");
});

test("TS-051 native phase alone never becomes remote success evidence", () => {
  const report = reportFor(baseInput({
    persistedSyncState: { initiallySynced: false },
    user: null,
    binding: "unauthenticated"
  }));
  const remote = sectionText(report, "remote-evidence");
  assert.doesNotMatch(remote, /attestée sauf|succès distant attesté/i);
  assert.match(report.text, /une phase native favorable ne prouve pas/i);
  assert.match(remote, /non attestée|non déterminé|bloquée/i);
  assert.match(remote, /Cloud n'est pas considéré comme vide/);
});

test("TS-051 local base, masked cache and missing proof stay distinct", () => {
  const empty = reportFor(baseInput({ binding: "unverified" }), { localBase: "empty" });
  assert.match(sectionText(empty, "remote-evidence"), /base-locale-vide-observee : vide observée/);
  assert.match(sectionText(empty, "remote-evidence"), /base-distante-vide-attestee : non/);
  assert.match(sectionText(empty, "remote-evidence"), /cache masqué ou non vérifié/);

  const unknown = reportFor(baseInput(), { localBase: undefined });
  assert.match(sectionText(unknown, "remote-evidence"), /base-locale-vide-observee : non disponible/);
  assert.ok(unknown.unavailable.includes("base-locale-vide-observee"));
});

test("TS-051 browser context is limited to family and major version", () => {
  assert.equal(describeBrowserContext(
    "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/141.0.6030.0 Mobile Safari/537.36"
  ).label, "Chrome 141");
  assert.equal(describeBrowserContext(
    "Mozilla/5.0 (Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121.0 Mobile Safari/537.36"
  ).label, "Samsung Internet 25");
  assert.equal(describeBrowserContext(
    "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/130.0"
  ).label, "Firefox 130");
  assert.equal(describeBrowserContext("something unknown").label, "non disponible");
  assert.equal(describeBrowserContext(undefined).label, "non disponible");
});

test("TS-051 lifecycle is explicit: unavailable without instrumentation and bounded with it", () => {
  const absent = reportFor(baseInput());
  assert.match(sectionText(absent, "lifecycle"), /db-open-etat : non disponible/);
  assert.ok(absent.unavailable.includes("db-open-age-dernier"));
  assert.ok(absent.unavailable.includes("currentUser-emission-initiale"));

  const present = reportFor(baseInput(), {
    lifecycle: {
      dbOpen: { state: "pending", startedAgeSeconds: 15, lastAgeSeconds: 15 },
      observables: {
        currentUser: { emissions: 2, initialEmissionAgeSeconds: 20, lastChangeAgeSeconds: 5 },
        syncState: { emissions: 1, initialEmissionAgeSeconds: 20, lastChangeAgeSeconds: 20 },
        persistedSyncState: { emissions: 0, initialEmissionAgeSeconds: null, lastChangeAgeSeconds: null }
      },
      otp: { state: "succeeded", requestedAgeSeconds: 40, lastAgeSeconds: 30 }
    }
  });
  assert.match(sectionText(present, "lifecycle"), /db-open-etat : en attente/);
  assert.match(sectionText(present, "lifecycle"), /db-open-age-demarrage : 15 s/);
  assert.match(sectionText(present, "lifecycle"), /currentUser-emission-initiale : 20 s/);
  assert.match(sectionText(present, "lifecycle"), /currentUser-dernier-changement : 5 s/);
  assert.match(sectionText(present, "lifecycle"), /otp-demande : réussi/);
});

test("TS-051 report module is I/O-free, DOM-free and has no raw-share option", () => {
  for (const pattern of [
    /\bwindow\b/, /\bdocument\b/, /\bnavigator\b/, /\bfetch\s*\(/, /XMLHttpRequest/,
    /sendBeacon/, /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/, /\btelemetry\b/,
    /rawShare|shareRaw|includeRaw/
  ]) {
    assert.doesNotMatch(moduleSource, pattern);
  }
});

test("TS-051 clipboard helper reports success only after a resolved write", async () => {
  let written = null;
  const success = await writeReportToClipboard("rapport", async (text) => { written = text; });
  assert.equal(success.status, SHARE_STATUS.SUCCESS);
  assert.equal(written, "rapport");
  assert.equal((await writeReportToClipboard("rapport", null)).status, SHARE_STATUS.MANUAL);
  assert.equal((await writeReportToClipboard("rapport", () => { throw new Error("denied"); })).status,
    SHARE_STATUS.MANUAL);
  assert.equal((await writeReportToClipboard("rapport", async () => {
    throw new Error("denied");
  })).status, SHARE_STATUS.MANUAL);
});

test("TS-051 sharing controller preserves preview, recomputes and never fakes success", async () => {
  let current = "premier rapport";
  let writeText = async () => {};
  const statuses = [];
  const controller = createDiagnosticSharingController({
    buildReport: () => ({ text: current, sections: [], unavailable: [] }),
    getWriteText: () => writeText,
    onChange: (state) => statuses.push(state.status.kind)
  });

  assert.equal(controller.getState().hasReport, false);
  assert.equal(controller.getState().text, null);
  const preview = controller.openPreview();
  assert.equal(preview, "premier rapport");
  assert.equal(controller.getState().previewOpen, true);

  current = "deuxième rapport";
  controller.refreshPreview();
  assert.equal(controller.getState().text, "deuxième rapport");
  assert.equal(controller.getState().previewOpen, true);

  const copied = await controller.copy();
  assert.equal(copied.copied, true);
  assert.equal(copied.text, "deuxième rapport");
  assert.equal(controller.getState().status.kind, SHARE_STATUS.SUCCESS);

  writeText = async () => { throw new Error("denied"); };
  current = "troisième rapport";
  const refused = await controller.copy();
  assert.equal(refused.copied, false);
  assert.equal(refused.manual, true);
  assert.equal(controller.getState().status.kind, SHARE_STATUS.MANUAL);
  assert.equal(controller.getState().previewOpen, true);
  assert.equal(refused.text, "troisième rapport");
  assert.match(controller.getState().status.message, /copiez-le manuellement/i);
  assert.doesNotMatch(controller.getState().status.message, /Diagnostic copié/);
});

test("TS-051 sharing controller opens the manual preview when the clipboard API is absent", async () => {
  const controller = createDiagnosticSharingController({
    buildReport: () => ({ text: "rapport complet", sections: [], unavailable: [] }),
    getWriteText: () => null
  });
  const result = await controller.copy();
  assert.equal(result.copied, false);
  assert.equal(controller.getState().previewOpen, true);
  assert.equal(controller.getState().text, "rapport complet");
  assert.equal(controller.getState().status.kind, SHARE_STATUS.MANUAL);
});
