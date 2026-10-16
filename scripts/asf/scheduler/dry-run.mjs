#!/usr/bin/env node
/**
 * Scheduler dry-run CLI (ASF-V2-005).
 *
 * Inspects the scheduler decision for an authorized wave without any paid or
 * side effect: no OpenRouter call, no GitHub write, no quota reservation, no
 * journal write and no dispatch. It reuses the pure core (`./index.mjs`) so the
 * dry-run and the real scheduler share exactly the same decisions.
 *
 * It reads either a built-in fixture (`--fixture`) or the real backlog
 * projection produced by ASF-V2-002 (`--backlog`). Delivery evidence is never
 * invented: it is either supplied explicitly (`--evidence`) or considered
 * unavailable, in which case any actionable candidate yields STOP_UNCERTAIN.
 * An empty backlog still ends with NO_WORK and zero dispatch because there is
 * nothing to be uncertain about.
 *
 * Normative references:
 *   - docs/factory/specs/scheduler-v1.md §7 (simulation and observability)
 *   - docs/factory/specs/orchestrator-v1.md §3, §11 (dry-run never pays)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_POLICY, POLICY_VERSION,
  buildWaveCandidates, classifyEligibility, explainWave, selectNextTask
} from "./index.mjs";
import { loadFixture } from "./fixtures.mjs";
import { buildBacklogIndex } from "../backlog-index.mjs";

export const MAX_TASKS_LIMIT = 2;
export const DEFAULT_MAX_TASKS = 1;
const DEFAULT_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const ID_PATTERN = /^[A-Z][A-Z0-9]*-[0-9]{1,4}$/;

function codeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value)) deepFreeze(nested);
  }
  return value;
}

function normalizeMaxTasks(value) {
  const parsed = typeof value === "string" ? Number(value) : value;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_TASKS_LIMIT) {
    throw new Error("max-tasks must be an integer between 1 and " + MAX_TASKS_LIMIT);
  }
  return parsed;
}

function deliveryState(evidence, id) {
  const raw = evidence?.deliveries?.[id];
  const status = typeof raw === "string" ? raw : raw?.status;
  if (status === "verified") return "verified";
  if (status === "unknown") return "unknown";
  return "not_observed";
}

function conflictState(evidence, id) {
  const raw = evidence?.conflicts?.[id];
  const status = typeof raw === "string" ? raw : raw?.status;
  return typeof status === "string" ? status : "not_observed";
}

function evidenceIds(evidence, field, wanted) {
  const source = evidence?.[field];
  if (!source || typeof source !== "object") return [];
  return Object.keys(source)
    .filter(id => {
      const raw = source[id];
      const status = typeof raw === "string" ? raw : raw?.status;
      return status === wanted;
    })
    .sort(codeUnit);
}

/**
 * Merge hypothetical assumptions into a copy of the evidence. Used only to
 * compute a clearly-labelled projection; the merged map is never presented as
 * verified delivery.
 */
function withAssumptions(evidence, assumptions) {
  const deliveries = { ...(evidence?.deliveries ?? {}) };
  for (const id of assumptions) {
    if (!ID_PATTERN.test(id)) continue;
    if (deliveryState(evidence, id) === "verified") continue;
    deliveries[id] = { status: "verified", proof: null, hypothetical: true };
  }
  return {
    deliveries,
    conflicts: { ...(evidence?.conflicts ?? {}) },
    ...(evidence?.ambiguity === undefined ? {} : { ambiguity: evidence.ambiguity })
  };
}

function buildManifest(candidateTasks, maxTasks) {
  return {
    schemaVersion: 1,
    waveId: "dry-run",
    mode: "dry-run",
    repository: null,
    policyVersion: POLICY_VERSION,
    limits: { maxTaskStarts: maxTasks, maxConcurrentTasks: 1, maxPaidRetries: 0 },
    candidateTasks,
    policy: DEFAULT_POLICY
  };
}

function indexCards(snapshot) {
  const byId = new Map();
  for (const field of ["active", "archive"]) {
    if (!Array.isArray(snapshot?.[field])) continue;
    for (const card of snapshot[field]) if (card?.id) byId.set(card.id, card);
  }
  return byId;
}

/**
 * Build a complete, deterministic dry-run report. Pure with respect to the
 * given inputs: it never mutates them, reads no clock and performs no I/O.
 *
 * @param {object} input
 * @param {object} input.snapshot      validated backlog projection (ASF-V2-002)
 * @param {object} [input.evidence]    explicit delivery/conflict evidence
 * @param {string[]} [input.assumptions] hypothetical future deliveries (projection only)
 * @param {object} [input.journal]     attempts and quota, never written
 * @param {number} [input.maxTasks]    wave limit, 1..2
 * @param {string|null} [input.observedAt] adapter-provided timestamp
 * @param {string} [input.source]      provenance label for the report
 * @param {boolean} [input.evidenceAvailable] false = GitHub state unavailable
 */
export function buildDryRunReport({
  snapshot,
  evidence = {},
  assumptions = [],
  journal = {},
  maxTasks = DEFAULT_MAX_TASKS,
  observedAt = null,
  source = "unknown",
  evidenceAvailable = true
} = {}) {
  const limit = normalizeMaxTasks(maxTasks);
  const frozenAssumptions = [...new Set(
    (Array.isArray(assumptions) ? assumptions : []).filter(id => ID_PATTERN.test(id))
  )].sort(codeUnit);

  const candidateSet = buildWaveCandidates(snapshot, DEFAULT_POLICY);
  const manifest = buildManifest(candidateSet.candidateTasks, limit);

  const hasActionableCandidates = candidateSet.candidateTasks.length > 0;
  const effectiveEvidence = (!evidenceAvailable && hasActionableCandidates)
    ? { ambiguity: true }
    : evidence;

  const journalInput = {
    attempts: Array.isArray(journal?.attempts) ? journal.attempts : [],
    quota: {
      taskStarts: Number.isInteger(journal?.quota?.taskStarts) ? journal.quota.taskStarts : 0,
      maxTaskStarts: limit
    },
    ...(typeof observedAt === "string" ? { observedAt } : {})
  };

  const decision = selectNextTask(manifest, snapshot, effectiveEvidence, journalInput);
  const explanation = explainWave(manifest, snapshot, effectiveEvidence, journalInput);
  const byId = indexCards(snapshot);

  const candidates = candidateSet.candidateTasks.map(({ id }) => {
    const card = byId.get(id);
    const verdict = card
      ? classifyEligibility(card, snapshot, effectiveEvidence, DEFAULT_POLICY)
      : { id, eligible: false, reasons: [], exclusions: ["missing_card"] };
    return {
      id,
      priority: card?.priority ?? null,
      created_at: card?.created_at ?? null,
      depends_on: Array.isArray(card?.depends_on) ? [...card.depends_on] : [],
      content_sha256: card?.content_sha256 ?? null,
      delivery: deliveryState(evidence, id),
      conflict: conflictState(evidence, id),
      hypothetical_delivery: frozenAssumptions.includes(id),
      dependencies: (Array.isArray(card?.depends_on) ? card.depends_on : []).map(dependency => ({
        id: dependency,
        delivery: deliveryState(evidence, dependency),
        hypothetical_delivery: frozenAssumptions.includes(dependency)
      })),
      eligibility: verdict
    };
  });

  let projection = null;
  if (frozenAssumptions.length) {
    const projectedEvidence = withAssumptions(evidence, frozenAssumptions);
    const projectedDecision = selectNextTask(manifest, snapshot, projectedEvidence, journalInput);
    const projectedExplanation = explainWave(manifest, snapshot, projectedEvidence, journalInput);
    projection = {
      hypothetical: true,
      note: "Projection conditionnelle : les livraisons supposées ne sont pas vérifiées.",
      assumptions: frozenAssumptions,
      decision: projectedDecision.decision,
      selected: projectedDecision.taskId ?? null,
      reason: projectedDecision.reason,
      order: projectedExplanation.order
    };
  }

  const notes = [];
  if (!candidateSet.ok) {
    notes.push("Instantané de backlog invalide : arrêt fermé, aucune sélection.");
  }
  if (!evidenceAvailable && hasActionableCandidates) {
    notes.push("État GitHub indisponible : incertain, jamais présumé libre.");
  }
  if (projection) {
    notes.push("Une projection hypothétique n'est pas une preuve de livraison.");
  }

  return deepFreeze({
    mode: "dry-run",
    policyVersion: POLICY_VERSION,
    generatedAt: typeof observedAt === "string" ? observedAt : null,
    source,
    evidenceAvailable,
    maxTasks: limit,
    dispatchCount: 0,
    writesJournal: false,
    backlogValid: candidateSet.ok,
    validationErrors: candidateSet.errors,
    candidates,
    excludedCandidates: candidateSet.excluded,
    decision: {
      decision: decision.decision,
      taskId: decision.taskId ?? null,
      reason: decision.reason,
      exclusions: decision.exclusions,
      references: decision.references ?? []
    },
    order: explanation.order,
    evidence: {
      verified: evidenceIds(evidence, "deliveries", "verified"),
      unknown: evidenceIds(evidence, "deliveries", "unknown"),
      conflicts: evidenceIds(evidence, "conflicts", "conflict"),
      assumptions: frozenAssumptions
    },
    projection,
    notes
  });
}

function formatDependency(candidate) {
  if (!candidate.dependencies.length) return "-";
  return candidate.dependencies.map(dependency =>
    dependency.id + "=" + dependency.delivery +
    (dependency.hypothetical_delivery ? "+hypothétique" : "")
  ).join(", ");
}

/** Render a report as a short, human-readable French summary. */
export function formatHumanReport(report) {
  const lines = [];
  lines.push("ThreadStep Scheduler — simulation (dry-run)");
  lines.push("Politique : " + report.policyVersion +
    "   Limite de tâches : " + report.maxTasks);
  lines.push("Source des preuves : " + report.source +
    (report.evidenceAvailable ? "" : " (état GitHub indisponible)"));
  lines.push("");
  lines.push("Décision : " + report.decision.decision +
    (report.decision.taskId ? " → " + report.decision.taskId : ""));
  lines.push("Raison : " + (report.decision.reason.join(", ") || "(aucune)"));
  lines.push("Dispatch : " + report.dispatchCount + " (un dry-run ne déclenche jamais rien)");
  lines.push("");

  lines.push("Candidates (" + report.candidates.length + ") :");
  if (!report.candidates.length) lines.push("  (aucune)");
  for (const candidate of report.candidates) {
    lines.push("  - " + candidate.id +
      " [" + (candidate.priority ?? "?") + ", " + (candidate.created_at ?? "?") + "]" +
      " livraison=" + candidate.delivery +
      " dépendances=" + formatDependency(candidate) +
      (candidate.eligibility.eligible ? " → éligible" : " → " + candidate.eligibility.exclusions.join(",")));
  }
  lines.push("");

  lines.push("Exclusions :");
  const exclusions = report.decision.exclusions;
  if (!exclusions.length) lines.push("  (aucune)");
  for (const entry of exclusions) lines.push("  - " + entry.id + " : " + entry.reasons.join(", "));
  if (report.excludedCandidates.length) {
    for (const entry of report.excludedCandidates) {
      lines.push("  - " + entry.id + " (hors politique) : " + entry.reasons.join(", "));
    }
  }
  lines.push("");

  lines.push("Ordre potentiel :");
  if (!report.order.length) lines.push("  (aucun)");
  report.order.forEach((entry, index) => {
    lines.push("  " + (index + 1) + ". " + entry.id +
      " [" + entry.priority + ", " + entry.created_at + "]");
  });

  if (report.projection) {
    lines.push("");
    lines.push("Projection hypothétique (NON une preuve de livraison) :");
    lines.push("  Hypothèses : " + report.projection.assumptions.join(", "));
    lines.push("  Décision projetée : " + report.projection.decision +
      (report.projection.selected ? " → " + report.projection.selected : ""));
  }

  if (report.notes.length) {
    lines.push("");
    lines.push("Notes :");
    for (const note of report.notes) lines.push("  - " + note);
  }
  return lines.join("\n") + "\n";
}

/** Parse CLI arguments for the `dry-run` command. */
export function parseArgs(argv) {
  const args = [...argv];
  const options = {
    command: null,
    format: "human",
    maxTasks: DEFAULT_MAX_TASKS,
    fixture: null,
    backlog: null,
    evidence: null,
    observedAt: null
  };
  options.command = args.shift();
  if (options.command !== "dry-run") {
    throw new Error("Usage: dry-run.mjs dry-run [--fixture <name> | --backlog <dir>] " +
      "[--evidence <file>] [--max-tasks 1.." + MAX_TASKS_LIMIT + "] [--format json|human] " +
      "[--observed-at <iso>]");
  }
  while (args.length) {
    const flag = args.shift();
    if (flag === "--format") {
      const value = args.shift();
      if (value !== "json" && value !== "human") throw new Error("--format must be json or human");
      options.format = value;
    } else if (flag === "--max-tasks") {
      const value = args.shift();
      if (value === undefined) throw new Error("--max-tasks requires a value");
      options.maxTasks = normalizeMaxTasks(value);
    } else if (flag === "--fixture") {
      options.fixture = args.shift();
      if (!options.fixture) throw new Error("--fixture requires a name");
    } else if (flag === "--backlog") {
      options.backlog = args.shift();
      if (!options.backlog) throw new Error("--backlog requires a directory");
    } else if (flag === "--evidence") {
      options.evidence = args.shift();
      if (!options.evidence) throw new Error("--evidence requires a file");
    } else if (flag === "--observed-at") {
      options.observedAt = args.shift();
      if (!options.observedAt) throw new Error("--observed-at requires a value");
    } else {
      throw new Error("Unknown argument: " + flag);
    }
  }
  if (options.fixture && options.backlog) {
    throw new Error("Use either --fixture or --backlog, not both");
  }
  return options;
}

function readEvidenceFile(file) {
  const parsed = JSON.parse(readFileSync(resolve(file), "utf8"));
  const evidence = {
    deliveries: parsed?.deliveries ?? {},
    conflicts: parsed?.conflicts ?? {}
  };
  if (parsed?.ambiguity !== undefined) evidence.ambiguity = parsed.ambiguity;
  return {
    evidence,
    assumptions: Array.isArray(parsed?.assumptions) ? parsed.assumptions : [],
    observedAt: typeof parsed?.observedAt === "string" ? parsed.observedAt : null
  };
}

/** Resolve CLI options into a dry-run input scenario. */
export function loadScenario(options) {
  if (options.fixture) {
    const scenario = loadFixture(options.fixture);
    return {
      snapshot: scenario.snapshot,
      evidence: scenario.evidence ?? {},
      assumptions: scenario.assumptions ?? [],
      journal: scenario.journal ?? {},
      observedAt: options.observedAt ?? scenario.observedAt ?? null,
      source: "fixture:" + options.fixture,
      evidenceAvailable: true
    };
  }

  const root = resolve(options.backlog ?? DEFAULT_ROOT);
  const built = buildBacklogIndex({ root });
  const snapshot = {
    active: built.active,
    archive: built.archive,
    legacy: built.legacy,
    diagnostics: built.diagnostics
  };

  let evidence = {};
  let assumptions = [];
  let observedAt = options.observedAt ?? null;
  let evidenceAvailable = false;
  if (options.evidence) {
    const parsed = readEvidenceFile(options.evidence);
    evidence = parsed.evidence;
    assumptions = parsed.assumptions;
    observedAt = options.observedAt ?? parsed.observedAt ?? null;
    evidenceAvailable = true;
  }
  return {
    snapshot,
    evidence,
    assumptions,
    journal: {},
    observedAt,
    source: options.evidence ? "file:" + options.evidence : "backlog",
    evidenceAvailable
  };
}

function runCli() {
  const options = parseArgs(process.argv.slice(2));
  const scenario = loadScenario(options);
  const report = buildDryRunReport(scenario);
  if (options.format === "json") {
    process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  } else {
    process.stdout.write(formatHumanReport(report));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write("scheduler dry-run: " + error.message + "\n");
    process.exitCode = 1;
  }
}
