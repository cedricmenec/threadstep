#!/usr/bin/env node
/**
 * Pure, deterministic scheduler core (ASF-V2-004).
 *
 * The core answers a single question — which task inside an already authorized
 * wave should start next — from injected inputs only. It performs no network
 * access, reads no clock, mutates no input and launches nothing. Every decision
 * is derived from a frozen wave manifest, a validated backlog snapshot, GitHub
 * delivery evidence and the append-only execution journal.
 *
 * Fail-closed rule: unknown references, malformed or ambiguous evidence and a
 * definition whose hash diverges from the authorized manifest never authorize a
 * selection. They yield STOP_UNCERTAIN so that no paid call can follow.
 *
 * Normative references:
 *   - docs/factory/specs/scheduler-v1.md (decisions, eligibility, ordering)
 *   - docs/factory/specs/backlog-v2.md (index projection, delivery evidence)
 */

export const POLICY_VERSION = "asf-sched-v1";

export const DECISION = Object.freeze({
  SELECT: "SELECT",
  NO_WORK: "NO_WORK",
  QUOTA_REACHED: "QUOTA_REACHED",
  WAITING_DEPENDENCIES: "WAITING_DEPENDENCIES",
  STOP_FAILED: "STOP_FAILED",
  STOP_UNCERTAIN: "STOP_UNCERTAIN"
});

/** V1 wave policy: only product / ready / automation allowed / risk low. */
export const DEFAULT_POLICY = Object.freeze({
  policyVersion: POLICY_VERSION,
  type: "product",
  automation: "allowed",
  risk: "low"
});

const PRIORITY_RANK = Object.freeze({ critical: 0, high: 1, normal: 2, low: 3 });
const UNKNOWN_PRIORITY_RANK = Object.keys(PRIORITY_RANK).length;
const ID_PATTERN = /^[A-Z][A-Z0-9]*-[0-9]{1,4}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const DELIVERY_STATES = Object.freeze(["verified", "unknown"]);
const CONFLICT_STATES = Object.freeze(["conflict", "clear", "unknown"]);

function codeUnit(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalizePolicy(policy) {
  const source = policy && typeof policy === "object" ? policy : DEFAULT_POLICY;
  return {
    policyVersion: typeof source.policyVersion === "string" ? source.policyVersion : POLICY_VERSION,
    type: source.type ?? DEFAULT_POLICY.type,
    automation: source.automation ?? DEFAULT_POLICY.automation,
    risk: source.risk ?? DEFAULT_POLICY.risk
  };
}

function diagnostic(code, id, message) {
  return { code, id: id ?? null, message };
}

function reportProblem(errors, byId = new Map()) {
  return Object.freeze({ ok: errors.length === 0, errors, byId });
}

function findCycles(nodes) {
  const cycles = [];
  const seen = new Set();
  const state = new Map();
  const stack = [];
  const visit = id => {
    state.set(id, 1);
    stack.push(id);
    for (const dependency of nodes.get(id).depends_on) {
      if (!nodes.has(dependency)) continue;
      const status = state.get(dependency) ?? 0;
      if (status === 1) {
        const cycle = stack.slice(stack.indexOf(dependency)).concat(dependency);
        const key = [...cycle].sort(codeUnit).join(",");
        if (!seen.has(key)) { seen.add(key); cycles.push(cycle); }
      } else if (status === 0) {
        visit(dependency);
      }
    }
    stack.pop();
    state.set(id, 2);
  };
  for (const id of [...nodes.keys()].sort(codeUnit)) {
    if ((state.get(id) ?? 0) === 0) visit(id);
  }
  return cycles;
}

/**
 * Validate an injected backlog snapshot (the compact projection produced by
 * ASF-V2-002) without reading the filesystem. Purely structural: it re-checks
 * uniqueness, references, cycles and the presence of the authorized content
 * hash so that a malformed index can never be interpreted as work.
 */
export function validateBacklog(snapshot) {
  const errors = [];
  const active = Array.isArray(snapshot?.active) ? snapshot.active : null;
  const archive = Array.isArray(snapshot?.archive) ? snapshot.archive : null;
  if (!active || !archive) {
    errors.push(diagnostic("invalid_snapshot", null,
      "snapshot must expose active and archive arrays"));
    return reportProblem(errors);
  }
  const diagnostics = Array.isArray(snapshot.diagnostics) ? snapshot.diagnostics : [];
  for (const entry of diagnostics) {
    errors.push(diagnostic("index_diagnostic", entry?.path ?? null,
      "index diagnostic: " + (entry?.message ?? String(entry))));
  }

  const byId = new Map();
  for (const card of [...active, ...archive]) {
    if (!card || typeof card.id !== "string" || !ID_PATTERN.test(card.id)) {
      errors.push(diagnostic("unsafe_id", card?.id ?? null,
        "task card has an unsafe or missing id"));
      continue;
    }
    if (byId.has(card.id)) {
      errors.push(diagnostic("duplicate_id", card.id,
        'duplicate task id "' + card.id + '"'));
      continue;
    }
    for (const field of ["type", "status", "priority", "automation", "risk", "created_at"]) {
      if (typeof card[field] !== "string") {
        errors.push(diagnostic("malformed_card", card.id,
          'task card "' + card.id + '" is missing a scalar "' + field + '"'));
      }
    }
    if (!SHA256_PATTERN.test(card.content_sha256 ?? "")) {
      errors.push(diagnostic("missing_hash", card.id,
        'task card "' + card.id + '" has no authorized content hash'));
    }
    byId.set(card.id, card);
  }

  for (const card of byId.values()) {
    if (!Array.isArray(card.depends_on)) {
      errors.push(diagnostic("malformed_dependency", card.id, "depends_on must be a list"));
      continue;
    }
    const seen = new Set();
    for (const dependency of card.depends_on) {
      if (typeof dependency !== "string" || !ID_PATTERN.test(dependency)) {
        errors.push(diagnostic("unsafe_dependency", card.id,
          'unsafe dependency "' + String(dependency) + '"'));
        continue;
      }
      if (dependency === card.id) {
        errors.push(diagnostic("self_dependency", card.id, "a task cannot depend on itself"));
        continue;
      }
      if (seen.has(dependency)) {
        errors.push(diagnostic("duplicate_dependency", card.id,
          'duplicate dependency "' + dependency + '"'));
        continue;
      }
      seen.add(dependency);
      if (!byId.has(dependency)) {
        errors.push(diagnostic("unknown_dependency", card.id,
          'unknown dependency "' + dependency + '"'));
      }
    }
  }

  for (const cycle of findCycles(byId)) {
    errors.push(diagnostic("dependency_cycle", cycle[0],
      "dependency cycle: " + cycle.join(" -> ")));
  }

  errors.sort((a, b) => codeUnit(a.id ?? "", b.id ?? "") ||
    codeUnit(a.code, b.code) || codeUnit(a.message, b.message));
  return reportProblem(errors, byId);
}

function policyExclusions(card, policy) {
  const reasons = [];
  if (card.type !== policy.type) reasons.push("type_not_" + policy.type);
  if (card.status !== "ready") reasons.push("status_" + card.status);
  if (card.automation !== policy.automation) {
    reasons.push(card.automation === "manual" ? "manual_only" : "automation_" + card.automation);
  }
  if (card.risk !== policy.risk) reasons.push("risk_" + card.risk);
  return reasons;
}

/**
 * Freeze the candidate set at wave opening. Candidates match the V1 wave
 * policy even when a dependency is not yet delivered: eligibility is decided
 * later, once delivery evidence exists. Never returns candidates from a
 * snapshot that failed validation.
 */
export function buildWaveCandidates(snapshot, policy = DEFAULT_POLICY) {
  const normalized = normalizePolicy(policy);
  const validation = validateBacklog(snapshot);
  if (!validation.ok) {
    return Object.freeze({
      ok: false, policyVersion: normalized.policyVersion,
      candidateTasks: [], excluded: [], errors: validation.errors
    });
  }
  const candidateTasks = [];
  const excluded = [];
  for (const card of [...snapshot.active].sort((a, b) => codeUnit(a.id, b.id))) {
    const reasons = policyExclusions(card, normalized);
    if (reasons.length) excluded.push(Object.freeze({ id: card.id, reasons }));
    else candidateTasks.push(Object.freeze({ id: card.id, sha256: card.content_sha256 }));
  }
  return Object.freeze({
    ok: true, policyVersion: normalized.policyVersion,
    candidateTasks, excluded, errors: []
  });
}

function collectEvidence(source, allowed, field) {
  const map = new Map();
  if (source === undefined || source === null) return map;
  const entries = source instanceof Map ? [...source.entries()] : Object.entries(source);
  for (const [id, raw] of entries) {
    if (typeof id !== "string" || !ID_PATTERN.test(id)) {
      throw new TypeError("Invalid " + field + " task id");
    }
    const status = typeof raw === "string" ? raw : raw?.status;
    if (typeof status !== "string" || !allowed.includes(status)) {
      throw new TypeError("Invalid " + field + " status for " + id);
    }
    const proof = raw && typeof raw === "object" ? (raw.proof ?? null) : null;
    map.set(id, { status, proof });
  }
  return map;
}

function normalizeEvidence(evidence) {
  if (evidence === undefined || evidence === null) {
    return { deliveries: new Map(), conflicts: new Map(), ambiguous: false };
  }
  if (typeof evidence !== "object") throw new TypeError("evidence must be an object");
  return {
    deliveries: collectEvidence(evidence.deliveries, DELIVERY_STATES, "delivery"),
    conflicts: collectEvidence(evidence.conflicts, CONFLICT_STATES, "conflict"),
    ambiguous: evidence.ambiguity === true
  };
}

function classify(card, normalized, policy) {
  const reasons = [];
  const exclusions = policyExclusions(card, policy);
  if (!exclusions.length) reasons.push("ready", "automation_allowed", "risk_low");

  if (normalized.deliveries.get(card.id)?.status === "verified") {
    exclusions.push("already_delivered");
  } else {
    reasons.push("not_delivered");
  }

  if (normalized.conflicts.get(card.id)?.status === "conflict") {
    exclusions.push("blocked");
  }

  const dependencies = Array.isArray(card.depends_on) ? card.depends_on : [];
  const deliveredDependencies = dependencies.every(dependency =>
    normalized.deliveries.get(dependency)?.status === "verified");
  if (dependencies.length && !deliveredDependencies) {
    exclusions.push("dependencies_not_delivered");
  } else if (dependencies.length) {
    reasons.push("dependencies_delivered");
  }
  if (SHA256_PATTERN.test(card.content_sha256 ?? "")) reasons.push("content_hash_authorized");

  return {
    id: card.id,
    eligible: exclusions.length === 0,
    reasons: exclusions.length === 0 ? reasons : [],
    exclusions
  };
}

/**
 * Classify a single task against the injected policy and evidence. The task is
 * never selected here; this is a pure verdict usable for explanations.
 */
export function classifyEligibility(task, snapshot, evidence, policy = DEFAULT_POLICY) {
  const validation = validateBacklog(snapshot);
  if (!validation.ok || !task || !validation.byId.has(task.id)) {
    return Object.freeze({ id: task?.id ?? null, eligible: false, reasons: [], exclusions: ["invalid_backlog"] });
  }
  let normalized;
  try {
    normalized = normalizeEvidence(evidence);
  } catch {
    return Object.freeze({ id: task.id, eligible: false, reasons: [], exclusions: ["malformed_evidence"] });
  }
  if (normalized.ambiguous) {
    return Object.freeze({ id: task.id, eligible: false, reasons: [], exclusions: ["ambiguous_evidence"] });
  }
  return Object.freeze(classify(validation.byId.get(task.id), normalized, normalizePolicy(policy)));
}

function manifestDivergence(manifest, byId) {
  const divergences = [];
  const candidates = Array.isArray(manifest?.candidateTasks) ? manifest.candidateTasks : [];
  for (const entry of candidates) {
    const card = byId.get(entry?.id);
    if (!card) {
      divergences.push({ id: entry?.id ?? null, reason: "manifest_candidate_missing" });
      continue;
    }
    if (card.content_sha256 !== entry.sha256) {
      divergences.push({ id: card.id, reason: "hash_divergence" });
    }
  }
  return divergences;
}

function attemptList(journal) {
  return Array.isArray(journal?.attempts) ? journal.attempts.filter(Boolean) : [];
}

function decision(name, extra = {}) {
  return Object.freeze({
    decision: name,
    reason: [],
    exclusions: [],
    ...extra
  });
}

function evidenceAmbiguous(normalized) {
  if (normalized.ambiguous) return true;
  for (const entry of normalized.deliveries.values()) {
    if (entry.status === "unknown") return true;
  }
  for (const entry of normalized.conflicts.values()) {
    if (entry.status === "unknown") return true;
  }
  return false;
}

/**
 * Decide the next task for an authorized wave.
 *
 * Inputs stay untouched: `manifest` is the immutable frozen authorization,
 * `snapshot` is the validated backlog projection, `evidence` carries GitHub
 * delivery/conflict observations (`verified | conflict | clear | unknown`) and
 * `journal` is the append-only execution state (`attempts`, `quota`, optional
 * `observedAt` provided by the adapter). Unknown PR/run state, a divergent
 * content hash or a malformed journal stop with STOP_UNCERTAIN before any
 * paid call; an exhausted quota yields QUOTA_REACHED.
 */
export function selectNextTask(manifest, snapshot, evidence, journal = {}) {
  const observedAt = typeof journal.observedAt === "string" ? journal.observedAt : null;

  const quota = journal?.quota ?? {};
  const taskStarts = quota.taskStarts ?? 0;
  const maxTaskStarts = quota.maxTaskStarts;
  if (!Number.isInteger(taskStarts) || taskStarts < 0 ||
      !Number.isInteger(maxTaskStarts) || maxTaskStarts < 0) {
    return decision(DECISION.STOP_UNCERTAIN, { observedAt, reason: ["malformed_quota"] });
  }
  if (taskStarts >= maxTaskStarts) {
    return decision(DECISION.QUOTA_REACHED, { observedAt, reason: ["quota_exhausted"] });
  }

  const attempts = attemptList(journal);
  if (attempts.some(attempt => attempt.status === "failed")) {
    return decision(DECISION.STOP_FAILED, { observedAt, reason: ["attempt_failed"] });
  }

  const validation = validateBacklog(snapshot);
  if (!validation.ok) {
    return decision(DECISION.STOP_UNCERTAIN, {
      observedAt,
      reason: ["invalid_backlog", ...validation.errors.map(error => error.code)]
    });
  }

  let normalized;
  try {
    normalized = normalizeEvidence(evidence);
  } catch {
    return decision(DECISION.STOP_UNCERTAIN, { observedAt, reason: ["malformed_evidence"] });
  }
  if (evidenceAmbiguous(normalized)) {
    return decision(DECISION.STOP_UNCERTAIN, { observedAt, reason: ["ambiguous_evidence"] });
  }

  const divergences = manifestDivergence(manifest, validation.byId);
  if (divergences.length) {
    return decision(DECISION.STOP_UNCERTAIN, {
      observedAt,
      reason: ["definition_divergence", ...divergences.map(entry => entry.reason)],
      exclusions: Object.freeze(divergences.map(entry => Object.freeze({
        id: entry.id, reasons: [entry.reason]
      })))
    });
  }

  const policy = normalizePolicy(manifest?.policy);
  const candidateIds = (Array.isArray(manifest?.candidateTasks) ? manifest.candidateTasks : [])
    .map(entry => entry.id).filter(id => typeof id === "string");
  const attemptedIds = new Set(attempts.map(attempt => attempt.taskId).filter(Boolean));
  const exclusions = [];
  const eligible = [];
  const verdicts = new Map();
  let remaining = 0;

  for (const id of candidateIds) {
    const card = validation.byId.get(id);
    if (!card) continue;
    if (attemptedIds.has(id)) {
      exclusions.push({ id, reasons: ["already_attempted"] });
      continue;
    }
    remaining++;
    const verdict = classify(card, normalized, policy);
    verdicts.set(id, verdict);
    if (verdict.eligible) eligible.push(card);
    else exclusions.push({ id, reasons: verdict.exclusions });
  }

  eligible.sort(compareByPriorityThenAgeThenId);
  exclusions.sort((a, b) => codeUnit(a.id, b.id));

  if (eligible.length) {
    const chosen = eligible[0];
    const verdict = verdicts.get(chosen.id);
    const references = chosen.depends_on.map(dependency => ({
      dependency,
      delivery: normalized.deliveries.get(dependency)?.status ?? "missing",
      proof: normalized.deliveries.get(dependency)?.proof ?? null
    }));
    return decision(DECISION.SELECT, {
      observedAt,
      taskId: chosen.id,
      reason: verdict.reasons,
      exclusions: Object.freeze(exclusions.map(entry => Object.freeze(entry))),
      references: Object.freeze(references)
    });
  }

  // Per scheduler-v1 §5 the remaining verdicts are refined with explicit
  // reasons: only an undelivered dependency means the wave is genuinely
  // waiting; any other remaining-but-ineligible candidate is NO_WORK.
  const waiting = exclusions.some(entry => entry.reasons.includes("dependencies_not_delivered"));
  return decision(waiting ? DECISION.WAITING_DEPENDENCIES : DECISION.NO_WORK, {
    observedAt,
    reason: [waiting ? "no_eligible_candidate" : remaining > 0 ? "candidates_not_actionable" : "no_candidate"],
    exclusions: Object.freeze(exclusions.map(entry => Object.freeze(entry)))
  });
}

function compareByPriorityThenAgeThenId(a, b) {
  const priority = (PRIORITY_RANK[a.priority] ?? UNKNOWN_PRIORITY_RANK) -
    (PRIORITY_RANK[b.priority] ?? UNKNOWN_PRIORITY_RANK);
  if (priority) return priority;
  const age = codeUnit(a.created_at ?? "", b.created_at ?? "");
  if (age) return age;
  return codeUnit(a.id, b.id);
}

/**
 * Produce a readable explanation of a wave decision: the selected task, the
 * deterministic ordering of eligible candidates and the exclusion reasons.
 * Pure and side-effect free; it never selects for execution by itself.
 */
export function explainWave(manifest, snapshot, evidence, journal = {}) {
  const selection = selectNextTask(manifest, snapshot, evidence, journal);
  const validation = validateBacklog(snapshot);
  let ordered = [];
  let normalized = { deliveries: new Map(), conflicts: new Map(), ambiguous: true };
  try {
    normalized = normalizeEvidence(evidence);
  } catch { /* keep ambiguous */ }

  if (validation.ok && !evidenceAmbiguous(normalized)) {
    const policy = normalizePolicy(manifest?.policy);
    const candidateIds = (Array.isArray(manifest?.candidateTasks) ? manifest.candidateTasks : [])
      .map(entry => entry.id).filter(id => typeof id === "string");
    for (const id of candidateIds) {
      const card = validation.byId.get(id);
      if (!card) continue;
      const verdict = classify(card, normalized, policy);
      if (verdict.eligible) {
        ordered.push({ id: card.id, priority: card.priority, created_at: card.created_at });
      }
    }
    ordered.sort((a, b) =>
      compareByPriorityThenAgeThenId(validation.byId.get(a.id), validation.byId.get(b.id)));
  }

  return Object.freeze({
    decision: selection.decision,
    selected: selection.taskId ?? null,
    reason: selection.reason,
    order: Object.freeze(ordered.map(entry => Object.freeze(entry))),
    exclusions: selection.exclusions
  });
}
