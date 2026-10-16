#!/usr/bin/env node
/**
 * Durable wave store with expected-SHA compare-and-swap (ASF-V2-006).
 *
 * The candidate durable medium is a dedicated operational branch
 * `asf/waves/<wave-id>` holding the manifest and commit-by-commit journal
 * entries. GitHub branch writes are not transactional, so persistence must be
 * serialized: every write states the SHA it expects to replace and fails on a
 * concurrent or divergent write. This module models that contract with an
 * in-memory store so crash windows and update conflicts can be tested without
 * network, Git or any paid call.
 *
 * The content SHA here is the canonical journal hash. A future Git adapter
 * maps the same compare-and-swap semantics onto the branch head commit SHA.
 */
import { canonicalize, contentSha256 } from "./hash.mjs";
import { applyEvent, createJournal, reconstructJournal } from "./journal.mjs";
import { validateWaveManifest } from "./manifest.mjs";

/** Re-exported for adapters that need the exact persisted content hash. */
export { contentSha256 };

/**
 * In-memory durable store. Reads return the persisted serialized journal and
 * its content SHA; commits only succeed when the caller passes the SHA it read.
 */
export function createMemoryWaveStore(records = []) {
  const store = new Map();
  for (const record of records) {
    if (!record || typeof record.waveId !== "string") continue;
    const serialized = typeof record.serialized === "string"
      ? record.serialized
      : canonicalize(record.journal);
    const parsed = JSON.parse(serialized);
    store.set(record.waveId, {
      serialized,
      sha256: contentSha256(parsed),
      revision: Number.isInteger(record.revision) ? record.revision : (parsed.revision ?? 0)
    });
  }

  return {
    read(waveId) {
      const record = store.get(waveId);
      return record ? { ...record } : null;
    },
    commit(waveId, expectedSha, journal) {
      const current = store.get(waveId);
      const actualSha = current ? current.sha256 : null;
      if (expectedSha !== actualSha) {
        return {
          ok: false, conflict: true, actualSha,
          revision: current ? current.revision : 0
        };
      }
      const serialized = canonicalize(journal);
      const sha256 = contentSha256(journal);
      const revision = (current ? current.revision : 0) + 1;
      store.set(waveId, { serialized, sha256, revision });
      return { ok: true, conflict: false, sha256, revision };
    },
    records() {
      return [...store.entries()]
        .map(([waveId, record]) => ({ waveId, ...record }))
        .sort((a, b) => (a.waveId < b.waveId ? -1 : a.waveId > b.waveId ? 1 : 0));
    },
    size() {
      return store.size;
    }
  };
}

/**
 * Load and reconstruct the journal bound to `manifest`. A missing record is an
 * empty journal (not an error); a corrupted or mismatched record fails closed.
 */
export function loadJournal(store, manifest) {
  const record = store.read(manifest.waveId);
  if (!record) {
    return { ok: true, journal: createJournal(manifest), sha256: null, revision: 0, errors: [] };
  }
  const reconstructed = reconstructJournal(manifest, record.serialized);
  if (!reconstructed.ok) {
    return { ok: false, journal: null, sha256: record.sha256, revision: record.revision, errors: reconstructed.errors };
  }
  return { ok: true, journal: reconstructed.journal, sha256: record.sha256, revision: record.revision, errors: [] };
}

/**
 * Apply one journal event and persist the result with compare-and-swap. The
 * caller never retries automatically: a conflict, a stopped wave or an
 * exhausted quota is returned verbatim so the orchestrator stops.
 */
export function commitEvent(store, manifest, event) {
  const validation = validateWaveManifest(manifest);
  if (!validation.ok) {
    return { ok: false, code: "invalid_manifest", errors: validation.errors, journal: null };
  }
  const loaded = loadJournal(store, manifest);
  if (!loaded.ok) {
    return { ok: false, code: "corrupt_journal", errors: loaded.errors, journal: null };
  }
  const applied = applyEvent(loaded.journal, event);
  if (!applied.ok) {
    return { ...applied, journal: loaded.journal };
  }
  const commit = store.commit(manifest.waveId, loaded.sha256, applied.journal);
  if (!commit.ok) {
    return {
      ok: false, code: "conflict", conflict: true,
      actualSha: commit.actualSha, errors: [], journal: loaded.journal
    };
  }
  return {
    ok: true, code: "persisted", conflict: false,
    entry: applied.entry, journal: applied.journal,
    sha256: commit.sha256, revision: commit.revision, errors: []
  };
}
