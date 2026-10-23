import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CROSS_CUTTING_GUARANTEES,
  EVIDENCE,
  MATRIX,
  REQUIRED_DOMAINS,
  STATUS,
  formatAcceptanceReport,
  parseRequirementTitles,
  runAcceptanceMatrix,
  validateCoverage,
  validateTraceability
} from "../scripts/product/e2e-matrix.mjs";
import { SCHEMA_VERSION } from "../site/dexie-foundation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const clone = (value) => JSON.parse(JSON.stringify(value));
const pkg = JSON.parse(read("package.json"));
const moduleSource = read("scripts/product/e2e-matrix.mjs");
const protocol = read("docs/product/e2e-certification.md");
const developerGuide = read("docs/product/developer-guide.md");
const acceptanceChecklist = read("docs/product/acceptance-checklist.md");

function loadSpecs() {
  const capabilities = [...new Set(MATRIX.map((entry) => entry.capability))].sort();
  return Object.fromEntries(capabilities.map((capability) => [
    capability,
    read("openspec/specs/" + capability + "/spec.md")
  ]));
}

const specs = loadSpecs();

test("1.1 the report is frozen, deterministic and exposes the four evidence classes", async () => {
  const first = await runAcceptanceMatrix({ specs });
  const second = await runAcceptanceMatrix({ specs });
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.scenarios), true);
  assert.equal(Object.isFrozen(first.counts), true);
  assert.equal(Object.isFrozen(first.scenarios[0]), true);
  assert.deepEqual(Object.values(EVIDENCE).sort(), ["ci", "incident", "limitation", "real-dexie"].sort());
  assert.deepEqual(Object.values(STATUS).sort(), ["failed", "not-run", "open", "passed", "pending"].sort());
  assert.ok(Array.isArray(first.scenarios) && first.scenarios.length === MATRIX.length);
  assert.ok(Array.isArray(first.realDexie) && first.realDexie.length > 0);
  assert.ok(Array.isArray(first.limitations) && first.limitations.length > 0);
  assert.ok(Array.isArray(first.incidents));
  for (const scenario of first.scenarios) {
    assert.equal(scenario.ci.evidence, EVIDENCE.CI);
    assert.ok(Array.isArray(scenario.realDexie) || scenario.realDexie.length === 0);
    assert.ok(Array.isArray(scenario.limitations) || scenario.limitations.length === 0);
  }
  for (const observation of first.realDexie) {
    assert.equal(observation.evidence, EVIDENCE.REAL_DEXIE);
    assert.equal(observation.status, STATUS.PENDING);
  }
  for (const limitation of first.limitations) {
    assert.equal(limitation.evidence, EVIDENCE.LIMITATION);
  }
  const report = formatAcceptanceReport(first);
  for (const section of ["CI", "Recette Dexie réelle", "Limites", "Incidents ouverts"]) {
    assert.ok(report.includes(section), "missing report section " + section);
  }
});

test("1.2 canonical traceability resolves valid references and rejects unknown ones", () => {
  assert.ok(parseRequirementTitles(specs["local-indexeddb-persistence"]).includes("Autonomous local bootstrap"));
  const valid = validateTraceability(MATRIX, specs);
  assert.equal(valid.ok, true);
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.checked, MATRIX.length);

  const unknownCapability = clone(MATRIX);
  unknownCapability[0].capability = "capacite-inexistante";
  const capabilityResult = validateTraceability(unknownCapability, specs);
  assert.equal(capabilityResult.ok, false);
  assert.ok(capabilityResult.errors.some((error) =>
    error.reason === "unknown-capability" && error.capability === "capacite-inexistante"));

  const unknownRequirement = clone(MATRIX);
  unknownRequirement[0].requirement = "Exigence inexistante";
  const requirementResult = validateTraceability(unknownRequirement, specs);
  assert.equal(requirementResult.ok, false);
  assert.ok(requirementResult.errors.some((error) =>
    error.reason === "unknown-requirement" && error.requirement === "Exigence inexistante"));
});

test("1.3 required-domain coverage fails with the missing domain and without CI evidence", async () => {
  assert.equal(validateCoverage(MATRIX).ok, true);
  const missingRestore = MATRIX.filter((entry) => entry.domain !== "restore");
  const missingReport = await runAcceptanceMatrix({ matrix: missingRestore, specs });
  assert.equal(missingReport.ok, false);
  assert.ok(missingReport.coverage.missingDomains.includes("restore"));
  assert.ok(missingReport.problems.includes("missing-domain:restore"));

  const withoutCi = clone(MATRIX);
  const entry = withoutCi.find((candidate) => candidate.domain === "restore");
  entry.automated = [];
  const withoutCiReport = await runAcceptanceMatrix({ matrix: withoutCi, specs });
  assert.equal(withoutCiReport.ok, false);
  assert.ok(withoutCiReport.coverage.missingCi.includes("restore"));
  const scenario = withoutCiReport.scenarios.find((candidate) => candidate.id === entry.id);
  assert.equal(scenario.ci.status, STATUS.FAILED);
  assert.equal(scenario.ci.reason, "missing-ci-evidence");
  assert.equal(scenario.ok, false);
});

test("1.4 an open incident blocks the report, manual evidence stays pending and a failing check stays failed", async () => {
  const incident = await runAcceptanceMatrix({
    specs,
    incidents: [{
      id: "incident-e2e-synthetic",
      severity: "high",
      status: STATUS.OPEN,
      description: "Incident synthétique de recette."
    }]
  });
  assert.equal(incident.ok, false);
  assert.ok(incident.problems.includes("open-incident:incident-e2e-synthetic"));
  assert.ok(incident.incidents.some((item) =>
    item.id === "incident-e2e-synthetic" && item.status === STATUS.OPEN && item.severity === "high"));
  for (const observation of incident.realDexie) assert.equal(observation.status, STATUS.PENDING);

  const failingMatrix = clone(MATRIX);
  const failingEntry = failingMatrix.find((candidate) => candidate.id === "local-only-bootstrap");
  failingEntry.automated = [{
    id: "forced-failure",
    label: "Contrôle volontairement en échec",
    run() {
      return false;
    }
  }];
  const failing = await runAcceptanceMatrix({ matrix: failingMatrix, specs });
  assert.equal(failing.ok, false);
  const scenario = failing.scenarios.find((candidate) => candidate.id === "local-only-bootstrap");
  assert.equal(scenario.ci.status, STATUS.FAILED);
  assert.equal(scenario.ci.checks[0].status, STATUS.FAILED);
  assert.equal(scenario.ok, false);
  assert.ok(failing.problems.includes("ci-failed:local-only-bootstrap"));
});

test("1.5 the runner is pure and the report exposes no secret or business fixture field", async () => {
  assert.doesNotMatch(moduleSource, /\bfetch\s*\(/);
  assert.doesNotMatch(moduleSource, /XMLHttpRequest|WebSocket|EventSource/);
  assert.doesNotMatch(moduleSource, /new Date|Date\.now|performance\.now/);
  assert.doesNotMatch(moduleSource, /Math\.random|crypto\.randomUUID/);
  assert.doesNotMatch(moduleSource, /node:fs|readFileSync|writeFileSync|readdirSync/);
  assert.doesNotMatch(moduleSource, /process\.env/);
  assert.doesNotMatch(moduleSource, /openai|openrouter/i);
  assert.doesNotMatch(moduleSource, /localStorage|indexedDB/);
  assert.doesNotMatch(moduleSource, /\bdocument\s*\./);
  assert.doesNotMatch(moduleSource, /from\s+["']node:/);

  const report = await runAcceptanceMatrix({ specs });
  const text = formatAcceptanceReport(report);
  for (const forbidden of [
    "Note synthétique locale",
    "Sujet synthétique A",
    "user-e2e-synthetic",
    "Titre divergents synthétique"
  ]) {
    assert.equal(text.includes(forbidden), false, "report leaked " + forbidden);
  }
  assert.doesNotMatch(text, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  assert.doesNotMatch(text, /:\/\/[^/\s]+@/);
});

test("2.1-2.5 every required and cross-cutting journey has a passing CI scenario", async () => {
  const report = await runAcceptanceMatrix({ specs });
  assert.equal(report.ok, true);
  assert.equal(report.counts.ciFailed, 0);
  assert.equal(report.counts.openIncidents, 0);
  assert.deepEqual(report.coverage.missingDomains, []);
  assert.deepEqual(report.coverage.missingCi, []);
  assert.deepEqual(report.coverage.missingManualOrLimitation, []);
  assert.deepEqual(report.coverage.missingGuarantees, []);
  for (const domain of REQUIRED_DOMAINS) {
    const scenarios = report.scenarios.filter((scenario) => scenario.domain === domain);
    assert.ok(scenarios.length > 0, "missing scenario for " + domain);
    assert.ok(scenarios.some((scenario) => scenario.ci.status === STATUS.PASSED), "no passing CI for " + domain);
  }
  for (const guarantee of CROSS_CUTTING_GUARANTEES) {
    assert.ok(Array.isArray(report.guarantees[guarantee]), "missing guarantee " + guarantee);
    assert.ok(report.guarantees[guarantee].length > 0, "guarantee not linked " + guarantee);
    for (const domain of report.guarantees[guarantee]) {
      assert.ok(REQUIRED_DOMAINS.includes(domain), "unknown domain for guarantee " + guarantee);
    }
  }
  const expectedIds = [
    "local-only-bootstrap",
    "activation-consent",
    "first-sync-evidence",
    "target-classification",
    "divergence-blocked",
    "concurrent-plans",
    "reimport-idempotence",
    "restore-relations",
    "logout-with-pending",
    "url-isolation",
    "account-binding",
    "network-error-states",
    "truthful-local-write-states",
    "redacted-diagnostics",
    "repeated-operations-idempotence"
  ];
  for (const id of expectedIds) {
    const scenario = report.scenarios.find((candidate) => candidate.id === id);
    assert.ok(scenario, "missing scenario " + id);
    assert.equal(scenario.ci.status, STATUS.PASSED, "scenario failed " + id);
  }
});

test("2.6 the reference modern IndexedDB backup of 5 subjects and 18 steps survives the deterministic path", async () => {
  const report = await runAcceptanceMatrix({ specs });
  const scenario = report.scenarios.find((candidate) => candidate.id === "reference-modern-backup-journey");
  assert.ok(scenario);
  assert.equal(scenario.ci.status, STATUS.PASSED);
  assert.deepEqual(scenario.ci.checks.map((check) => check.id).sort(), [
    "reference-modern-backup",
    "reference-modern-reconciliation"
  ]);
  assert.equal(scenario.ci.checks.every((check) => check.status === STATUS.PASSED), true);
});

test("3.1-3.4 the manual protocol and its links keep real evidence separate from CI", () => {
  for (const topic of [
    "instance Dexie Cloud de test isolée",
    "Chrome mobile",
    "deux profils",
    "second navigateur",
    "OTP email réelle",
    "hors ligne",
    "réseau intermittent",
    "propagation",
    "sauvegarde IndexedDB moderne",
    "threadstep.document.v1",
    "legacy:",
    "Recette Dexie réelle",
    "Limites",
    "Incidents ouverts",
    "non exécutée",
    "partielle"
  ]) {
    assert.ok(protocol.includes(topic), "protocol missing topic " + topic);
  }
  const templateStart = protocol.indexOf("```text");
  const templateEnd = protocol.indexOf("```", templateStart + 7);
  assert.ok(templateStart !== -1 && templateEnd > templateStart, "report template missing");
  const template = protocol.slice(templateStart, templateEnd);
  for (const section of ["CI", "Recette Dexie réelle", "Limites", "Incidents ouverts"]) {
    assert.ok(template.includes(section), "template missing section " + section);
  }
  assert.match(template, /non exécuté/);
  assert.match(template, /partiel/);
  assert.match(protocol, /une observation non exécutée reste `non exécutée`/);
  assert.match(template, /\[ \]|Statut :/);

  for (const capability of [
    "dexie-cloud-configuration",
    "dexie-local-database",
    "email-otp-authentication",
    "legacy-document-migration",
    "local-first-business-persistence",
    "cloud-migration-reconciliation"
  ]) {
    assert.ok(protocol.includes(capability), "protocol missing legacy capability " + capability);
  }
  assert.ok(protocol.includes("openspec/changes/archive/"));
  assert.match(protocol, /Aucun fichier sous `openspec\/changes\/archive\/` n'a été modifié/);

  for (const document of [developerGuide, acceptanceChecklist]) {
    assert.ok(document.includes("e2e-certification.md"), "missing protocol link");
    assert.match(document, /CI/);
    assert.match(document, /manuelle|manuelles/);
  }
});

test("3.5 fixtures and protocol contain only synthetic data and example hosts", () => {
  for (const source of [moduleSource, protocol]) {
    assert.doesNotMatch(source, /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    assert.doesNotMatch(source, /:\/\/[^/\s]+@/);
    assert.doesNotMatch(source, /http:\/\//);
    assert.doesNotMatch(source, /otp\s*[:=]\s*["']?\d{3,}/i);
    assert.doesNotMatch(source, /(token|jeton)\s*[:=]\s*["']?[A-Za-z0-9_-]{8,}/i);
    for (const realPattern of ["Projet client", "Réunion d'équipe", "Facture réelle"]) {
      assert.equal(source.includes(realPattern), false);
    }
  }
  assert.ok(moduleSource.includes("legacy:"));
  assert.ok(moduleSource.includes(".dexie.cloud"));
  assert.ok(protocol.includes("legacy:"));
  assert.ok(protocol.includes(".dexie.cloud"));
  assert.ok(protocol.includes("e2e-example.dexie.cloud"));
});

test("4.1 the check chain covers the module and keeps runtime dependencies and schema unchanged", () => {
  assert.ok(pkg.scripts.check.includes("node --check scripts/product/e2e-matrix.mjs"));
  assert.deepEqual(pkg.dependencies, {
    dexie: "4.4.6",
    "dexie-cloud-addon": "4.4.15"
  });
  assert.deepEqual(pkg.devDependencies, { esbuild: "0.25.10", vite: "7.3.7" });
  assert.equal(SCHEMA_VERSION, 3);
});
