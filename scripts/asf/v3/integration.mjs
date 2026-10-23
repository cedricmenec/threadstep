/**
 * ASF-V3-005: source-level integration of #69, #70 and #71.
 *
 * No exported runtime entrypoint, GitHub credentials, dispatch, OpenRouter or
 * automatic authorization. This composes only concrete reviewed V3 contracts.
 * A future privileged runner adapter MUST be separately approved.
 */
import { createV3WaveReadPort, loadV3TrustedSnapshot } from "./trusted-snapshot.mjs";
import { assertV3Manifest, reconstructV3Journal, advanceV3 } from "./lifecycle.mjs";
import { observeV3RunProvenance } from "./provenance.mjs";
import { commitV3JournalCAS } from "./git-cas.mjs";
import { canonicalize } from "../waves/hash.mjs";

/**
 * Wire REAL source modules, never caller supplied mock validators.
 *
 * The gitPort remains injected and unprivileged in this PR. Production wiring
 * must own and pin the repository, GitHub App identity, and the global paid
 * mutex before a child can be allowed to invoke an external model.
 */
export function createIntegratedV3Ports({ githubReadClient, gitPort, repository }) {
  if (!githubReadClient || typeof githubReadClient.get !== "function" ||
      !gitPort || ["getRef", "getCommit", "createTree", "createCommit", "updateRef"]
        .some(name => typeof gitPort[name] !== "function")) {
    throw new TypeError("V3 integration requires complete trusted port interfaces");
  }
  const reader = createV3WaveReadPort(githubReadClient, repository);
  const validators = Object.freeze({
    verifyManifest(manifest) {
      assertV3Manifest(manifest);
      return manifest.repository === repository;
    },
    replayJournal: reconstructV3Journal
  });
  return Object.freeze({
    async loadSnapshot(waveId) {
      return loadV3TrustedSnapshot(reader, waveId, validators);
    },
    verifyRun(input) {
      // The caller must also prove that reservation comes from the journal.
      // transaction-bridge.mjs requires ACK/claim and exact run identity.
      if (!input || input.authorization?.repository !== repository ||
          input.reservation?.repository !== repository)
        return Promise.resolve(Object.freeze({
          ok: false, status: "rejected", code: "foreign_repository"
        }));
      return observeV3RunProvenance(githubReadClient, input);
    },
    transition: advanceV3,
    replayJournal: reconstructV3Journal,
    commitJournal({ waveId, expectedHeadSha, journal }) {
      // Reject caller-supplied validators; pin validation to the trusted
      // manifest that we READ AGAIN from the exact expected HEAD.
      return commitAfterPinnedRead(waveId, expectedHeadSha, journal);
    }
  });

  async function commitAfterPinnedRead(waveId, expectedHeadSha, journal) {
    const snapshot = await loadV3TrustedSnapshot(reader, waveId, validators);
    if (!snapshot.ok) return { ok: false, status: "uncertain",
      code: "trusted_snapshot_unavailable" };
    if (snapshot.headSha !== expectedHeadSha) return { ok: false,
      status: "conflict", code: "pinned_head_diverged" };
    // Real event replay authenticates journal structure, not a model claim.
    const validateJournal = candidate => {
      try {
        return canonicalize(reconstructV3Journal(snapshot.manifest, candidate)) ===
          canonicalize(candidate) && candidate.revision === snapshot.journal.revision + 1 &&
          canonicalize(candidate.events.slice(0, -1)) ===
          canonicalize(snapshot.journal.events);
      } catch { return false; }
    };
    if (!validateJournal(journal)) return { ok: false,
      status: "rejected", code: "invalid_real_v3_journal" };
    return commitV3JournalCAS(gitPort, {
      waveId, expectedHeadSha, journal, validateJournal
    });
  }
}
