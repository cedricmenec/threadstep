/**
 * ASF V3 proposed operational-wave journal CAS adapter.
 *
 * The injected port is a privileged, trusted GitHub Git-Data adapter. This
 * module NEVER mints credentials, dispatches work, merges PRs or invokes an
 * agent. The port is not connected to workflows by this PR.
 *
 * Atomicity rationale: create a new commit with the EXPECTED tip as its ONLY
 * parent, then update the ref with force:false (fast-forward only). Two
 * contenders create siblings; at most one update can fast-forward the ref.
 * Never retry after an ambiguous write response.
 */
import { findSecretPaths } from "../waves/secrets.mjs";
const SHA = /^[a-f0-9]{40}$/;
const WAVE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const MAX_BYTES = 512 * 1024;

const result = (status, code, details = {}) =>
  Object.freeze({ ok: status === "persisted", status, code, ...details });
const rejected = code => result("rejected", code);
const unknown = code => result("uncertain", code);
function validPort(port) {
  return port && ["getRef", "getCommit", "createTree", "createCommit", "updateRef"]
    .every(name => typeof port[name] === "function");
}
function looksLikeConflict(e) {
  return e && (e.status === 409 || e.status === 422);
}

/**
 * commitJournalV3 accepts a STRICTLY VALIDATED journal for an existing branch.
 * validateJournal is REQUIRED and must replay every event against the trusted
 * manifest; it is an injected dependency until V3-002 is merged.
 *
 * Returned "persisted" means the fake/injected port produced the expected Git
 * sequence and acknowledged a matching ref read. It is NOT a test of GitHub
 * App permissions, trust or concurrency until a real provider is reviewed.
 */
export async function commitV3JournalCAS(port, {
  waveId, expectedHeadSha, journal, validateJournal
} = {}) {
  if (!WAVE.test(waveId ?? "") || !SHA.test(expectedHeadSha ?? ""))
    return rejected("unsafe_wave_or_head_sha");
  if (!validPort(port) || typeof validateJournal !== "function")
    return rejected("missing_trusted_git_port_or_validator");
  if (!journal || typeof journal !== "object" || Array.isArray(journal) ||
    journal.schemaVersion !== 2 || journal.waveId !== waveId ||
    !Number.isSafeInteger(journal.revision) || journal.revision < 1)
    return rejected("invalid_journal_contract");
  try {
    if (validateJournal(journal) !== true)
      return rejected("journal_replay_not_validated");
  } catch {
    return rejected("journal_replay_not_validated");
  }
  if (findSecretPaths(journal).length)
    return rejected("journal_contains_secret");
  const content = JSON.stringify(journal, null, 2) + "\n";
  if (Buffer.byteLength(content, "utf8") > MAX_BYTES)
    return rejected("journal_size_limit");

  const branchRef = "refs/heads/asf/waves/" + waveId;
  let stage = "read";
  try {
    const before = await port.getRef(branchRef);
    if (!before || !SHA.test(before.sha ?? ""))
      return unknown("remote_head_unavailable");
    if (before.sha !== expectedHeadSha)
      return result("conflict", "remote_head_moved");

    const parent = await port.getCommit(expectedHeadSha);
    if (!parent || parent.sha !== expectedHeadSha || !SHA.test(parent.treeSha ?? ""))
      return unknown("expected_commit_unavailable");

    stage = "prepare";
    const tree = await port.createTree({
      baseTreeSha: parent.treeSha,
      files: [{ path: "journal.json", mode: "100644", type: "blob", content }]
    });
    if (!tree || !SHA.test(tree.sha ?? ""))
      return unknown("tree_write_ambiguous");

    const created = await port.createCommit({
      treeSha: tree.sha, parents: [expectedHeadSha],
      message: "chore(asf): V3 journal checkpoint revision " + journal.revision
    });
    if (!created || !SHA.test(created.sha ?? ""))
      return unknown("commit_creation_ambiguous");
    // createCommit creates a detached object, never changes the branch.
    stage = "update";
    await port.updateRef({ ref: branchRef, sha: created.sha, force: false });

    // Read-back is a proof of a visible ref, not authorization to retry.
    stage = "confirm";
    const after = await port.getRef(branchRef);
    if (!after || after.sha !== created.sha) return unknown("ref_confirmation_unknown");
    const committed = await port.getCommit(created.sha);
    if (!committed || committed.sha !== created.sha ||
      !Array.isArray(committed.parents) ||
      committed.parents.length !== 1 || committed.parents[0] !== expectedHeadSha ||
      committed.treeSha !== tree.sha)
      return unknown("commit_parentage_unknown");
    return result("persisted", "fast_forward_confirmed",
      { newHeadSha: created.sha, revision: journal.revision, ref: branchRef });
  } catch (e) {
    if (stage === "update" && looksLikeConflict(e))
      return result("conflict", "non_fast_forward_ref_update");
    return unknown(stage + "_failure");
  }
}
