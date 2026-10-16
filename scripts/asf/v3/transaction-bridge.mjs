/**
 * ASF-V3-004: fail-closed composition seam for the future child claim and
 * nominal controller continuation.
 *
 * All dependencies are INJECTED, so these functions cannot dispatch/pay and
 * cannot authorize a live runner. In a later reviewed PR, bind them only to:
 *   #69 canonical V3 replay and transition logic;
 *   #70 read-only authenticated run provenance and remote Git CAS;
 *   this PR's SHA-pinned GitHub snapshot port.
 * NEVER substitute workflow inputs or a no-op validator.
 */
import { canonicalize, contentSha256 } from "../waves/hash.mjs";
const WAVE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const TASK = /^TS-[0-9]{3}$/;
const RUN = /^[1-9][0-9]{0,17}$/;
const SHA = /^[a-f0-9]{40}$/;
const BOT = "threadstep-software-factory[bot]";
const CHILD_REF = ".github/workflows/agent-openspec.yml@refs/heads/main";
const CONTROLLER_REF = ".github/workflows/backlog-orchestrator-v3.yml@refs/heads/main";
const gate = (status, code, info = {}) =>
  Object.freeze({ ok: status === "checkpoint_committed", status, code, ...info });
const deny = code => gate("rejected", code);
const uncertain = code => gate("uncertain", code);
function contract(ports) {
  return ports && ["loadSnapshot", "verifyRun", "transition", "replayJournal",
    "commitJournal"].every(x => typeof ports[x] === "function");
}
function validRuntime(r, repo, expectedRef, event) {
  return r && RUN.test(String(r.runId ?? "")) && r.repository === repo &&
    r.ref === "refs/heads/main" &&
    r.workflowRef === repo + "/" + expectedRef &&
    r.eventName === event && r.actor === BOT && r.runAttempt === 1 &&
    SHA.test(r.headSha ?? "");
}
function authorization(manifest) {
  return {
    repository: manifest.repository,
    owner: manifest.authorization.actor,
    ownerRunId: manifest.authorization.runId,
    sourceSha: manifest.backlogCommit,
    ownerWorkflowRef: manifest.authorization.workflowRef
  };
}
function verified(proof, manifest, runId, headSha, kind, expectedEvent) {
  const e = proof?.evidence;
  return proof?.ok === true && proof.status === "verified_observation" &&
    e && e.repository === manifest.repository && e.kind === kind &&
    String(e.originalRunId) === String(manifest.authorization.runId) &&
    String(e.verifiedRunId) === String(runId) &&
    e.originalHeadSha === manifest.backlogCommit &&
    e.verifiedHeadSha === headSha &&
    e.workflowEvent === expectedEvent &&
    e.workflowPath === (kind === "child" ? CHILD_REF : CONTROLLER_REF).split("@")[0] &&
    typeof e.observationHash === "string" && /^[a-f0-9]{64}$/.test(e.observationHash);
}
function newJournalValid(old, newJournal, expectedStatus, expectedEventType) {
  return newJournal && newJournal.status === expectedStatus &&
    newJournal.revision === old.revision + 1 &&
    newJournal.reserved === old.reserved &&
    newJournal.delivered === old.delivered &&
    Array.isArray(newJournal.events) &&
    newJournal.events.length === old.events.length + 1 &&
    newJournal.events.at(-1)?.type === expectedEventType &&
    newJournal.events.at(-1)?.seq === newJournal.revision;
}
async function load(ports, waveId) {
  const snapshot = await ports.loadSnapshot(waveId);
  if (!snapshot?.ok || !SHA.test(snapshot.headSha ?? "") ||
    !snapshot.manifest || !snapshot.journal ||
    snapshot.manifest.schemaVersion !== 2 ||
    snapshot.manifest.waveId !== waveId ||
    snapshot.journal.waveId !== waveId ||
    snapshot.journal.manifestHash !== contentSha256(snapshot.manifest)) return null;
  return snapshot;
}
async function persist(ports, waveId, snapshot, next, expectedStatus, eventName) {
  if (!newJournalValid(snapshot.journal, next, expectedStatus, eventName))
    return deny("transition_contract_violation");
  try {
    const confirmed = ports.replayJournal(snapshot.manifest, next);
    if (!confirmed || canonicalize(confirmed) !== canonicalize(next))
      return deny("new_journal_replay_invalid");
  } catch { return deny("new_journal_replay_invalid"); }
  let committed;
  try {
    committed = await ports.commitJournal({
      waveId, expectedHeadSha: snapshot.headSha, journal: next,
      // The storage adapter cannot accept a noop validator. It is still
      // required to replay against the immutable loaded manifest itself.
      validateJournal: candidate => {
        try {
          return canonicalize(candidate) === canonicalize(next) &&
            canonicalize(ports.replayJournal(snapshot.manifest, candidate)) === canonicalize(candidate);
        } catch { return false; }
      }
    });
  } catch { return uncertain("journal_commit_exception"); }
  if (committed?.ok !== true || committed.status !== "persisted" ||
    !SHA.test(committed.newHeadSha ?? "") ||
    committed.newHeadSha === snapshot.headSha) {
    return committed?.status === "conflict" ?
      deny("remote_cas_conflict") : uncertain("commit_not_confirmed");
  }
  return gate("checkpoint_committed", eventName === "CLAIM_CHILD" ?
    "single_run_claim_committed" : "continuation_checkpoint_committed",
    { waveId, journalRevision: next.revision,
      newHeadSha: committed.newHeadSha,
      reservationId: next.active?.reservationId ?? null });
}

/**
 * Attempt to persist CLAIM_CHILD under exact child run identity. Success
 * indicates COMMITTED JOURNAL ONLY, never a permission for a paid model call:
 * global mutex, live ACK binding and workflow guard still need review.
 */
export async function attemptV3ChildClaim(ports, { waveId, taskId, runtime } = {}) {
  if (!contract(ports) || !WAVE.test(waveId ?? "") || !TASK.test(taskId ?? ""))
    return deny("invalid_claim_request");
  let snapshot;
  try { snapshot = await load(ports, waveId); }
  catch { return uncertain("wave_snapshot_unavailable"); }
  if (!snapshot) return uncertain("wave_snapshot_unavailable");
  const { manifest, journal } = snapshot;
  if (!validRuntime(runtime, manifest.repository, CHILD_REF, "workflow_dispatch"))
    return deny("untrusted_runtime_context");
  if (journal.status !== "CHILD_ACKNOWLEDGED" ||
    journal.active?.taskId !== taskId ||
    String(journal.active?.childRunId ?? "") !== String(runtime.runId) ||
    !RUN.test(String(runtime.runId)) ||
    !manifest.candidateTasks?.some(c => c.id === taskId))
    return deny("no_unique_child_ack");
  // Provenance inputs are constructed from the trusted Git commit, never job
  // inputs. runtime itself must come from a trusted runner context provider.
  let observation;
  try {
    observation = await ports.verifyRun({
      authorization: authorization(manifest),
      reservation: { kind: "child", repository: manifest.repository,
        runId: String(runtime.runId), headSha: runtime.headSha },
      context: runtime, kind: "child"
    });
  } catch { return uncertain("github_provenance_unavailable"); }
  if (!verified(observation, manifest, runtime.runId, runtime.headSha,
    "child", "workflow_dispatch"))
    return observation?.status === "uncertain" ?
      uncertain("github_provenance_unavailable") : deny("github_provenance_not_verified");
  let next;
  try {
    next = ports.transition(manifest, journal, {
      type: "CLAIM_CHILD", taskId, childRunId: String(runtime.runId),
      runAttempt: 1, workflowRef: manifest.repository + "/" + CHILD_REF
    }, journal.revision);
  } catch { return deny("claim_transition_refused"); }
  if (next.active?.childRunId !== String(runtime.runId) ||
    next.active?.taskId !== taskId ||
    next.active?.reservationId !== journal.active.reservationId)
    return deny("claim_identity_diverged");
  return persist(ports, waveId, snapshot, next, "EXECUTING", "CLAIM_CHILD");
}

/**
 * A continuation is allowed only AFTER a successful DELIVERED checkpoint.
 * Never creates a new initial authorization or resets paid reservations.
 */
export async function attemptV3ControllerAttach(ports, { waveId, runtime } = {}) {
  if (!contract(ports) || !WAVE.test(waveId ?? ""))
    return deny("invalid_continuation_request");
  let snapshot;
  try { snapshot = await load(ports, waveId); }
  catch { return uncertain("wave_snapshot_unavailable"); }
  if (!snapshot) return uncertain("wave_snapshot_unavailable");
  const { manifest, journal } = snapshot;
  if (!validRuntime(runtime, manifest.repository, CONTROLLER_REF, "repository_dispatch"))
    return deny("untrusted_runtime_context");
  if (journal.status !== "READY" || journal.awaitingController !== true ||
    journal.active !== null || journal.events?.at(-1)?.type !== "CHECKPOINT" ||
    journal.reserved >= manifest.limits.maxTaskStarts ||
    String(runtime.runId) === String(manifest.authorization.runId))
    return deny("no_nominal_checkpoint");
  let observation;
  try {
    observation = await ports.verifyRun({
      authorization: authorization(manifest),
      reservation: { kind: "continuation", repository: manifest.repository,
        runId: String(runtime.runId), headSha: runtime.headSha },
      context: runtime, kind: "continuation"
    });
  } catch { return uncertain("github_provenance_unavailable"); }
  if (!verified(observation, manifest, runtime.runId, runtime.headSha,
    "continuation", "repository_dispatch"))
    return observation?.status === "uncertain" ?
      uncertain("github_provenance_unavailable") : deny("github_provenance_not_verified");

  const event = {
    type: "ATTACH_CONTROLLER", controllerRunId: String(runtime.runId),
    checkpointRevision: journal.revision, checkpointHash: contentSha256(journal),
    origin: {
      runId: String(manifest.authorization.runId),
      actor: manifest.authorization.actor,
      workflowRef: manifest.authorization.workflowRef,
      sourceSha: manifest.backlogCommit,
      event: "workflow_dispatch", attempt: 1, headBranch: "main"
    },
    controller: {
      runId: String(runtime.runId),
      workflowRef: manifest.repository + "/" + CONTROLLER_REF,
      repository: manifest.repository,
      event: "repository_dispatch", headBranch: "main"
    }
  };
  let next;
  try { next = ports.transition(manifest, journal, event, journal.revision); }
  catch { return deny("continuation_transition_refused"); }
  if (next.awaitingController !== false ||
    next.reserved !== journal.reserved ||
    next.delivered !== journal.delivered ||
    !next.controllers?.includes(String(runtime.runId)))
    return deny("continuation_mandate_diverged");
  return persist(ports, waveId, snapshot, next, "READY", "ATTACH_CONTROLLER");
}
