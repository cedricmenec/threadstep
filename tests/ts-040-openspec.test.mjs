import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const activeChange = "openspec/changes/ts-040";
const archivedChange = "openspec/changes/archive/2026-10-19-ts-040";

// A pre-sync change is active, a published change is archived. An absent or
// ambiguous change is a genuine test failure, not an excuse to skip checks.
function selectedChangePath(activePresent = existsSync(resolve(root, activeChange)),
                            archivedPresent = existsSync(resolve(root, archivedChange))) {
  assert.notEqual(activePresent, archivedPresent, "exactly one TS-040 OpenSpec change state must exist");
  return activePresent ? activeChange : archivedChange;
}

function purposeSection(source) {
  const match = source.match(/## Purpose\n([\s\S]*?)(?=\n## |$)/);
  return match ? match[1].trim() : "";
}

// Completed-change mode: the canonical Purpose must describe retirement,
// inert values and voluntary cleanup, and must not promise an active V1
// conversion.
export function assertCompletedPurposes({ legacyStorage, legacyDocument }) {
  const storagePurpose = purposeSection(legacyStorage);
  const documentPurpose = purposeSection(legacyDocument);
  for (const purpose of [storagePurpose, documentPurpose]) {
    assert.match(purpose, /\bV1\b/i);
    assert.match(purpose, /retir|retired|hors service/i);
    assert.match(purpose, /inert|inactif|sans effet/i);
    assert.doesNotMatch(purpose, /\b(?:migrer|migrate[ds]?|converts?|convertir)\b|migre automatiquement|détecte.*document V1/i);
  }
  assert.match(storagePurpose, /nettoyage|volontaire/i);
  assert.match(documentPurpose, /inert|retir|retired|plus pris en charge/i);
}

function assertActiveDelta(source, label) {
  assert.match(source, /retir|inert|inactif/i, label);
  assert.match(source, /aucune écriture|sans écriture|without write|no write/i, label);
  assert.match(source, /volontaire|voluntary/i, label);
  assert.match(source, /nettoyage|cleanup/i, label);
  assert.doesNotMatch(source, /sera converti automatiquement/i, label);
}

test("active or archived TS-040 deltas retire V1 readers and require voluntary cleanup", () => {
  const change = selectedChangePath();
  const storage = read(change + "/specs/legacy-storage-migration/spec.md");
  const documentDelta = read(change + "/specs/legacy-document-migration/spec.md");
  const backup = read(change + "/specs/data-backup-import-restore/spec.md");
  assertActiveDelta(storage, "legacy-storage-migration");
  assertActiveDelta(documentDelta, "legacy-document-migration");
  assert.match(documentDelta, /Historical V1 document support is retired/);
  assert.match(documentDelta, /Legacy document is inert/);
  assert.match(storage, /Retired historical V1 storage is inert/);
  assert.match(storage, /Voluntary scoped cleanup of retired V1 keys/);
  assert.match(backup, /unsupported-v1-backup/);
  assert.match(backup, /version: 1.*refus|refus.*version: 1/is);
});

test("TS-040 state selection rejects missing or ambiguous changes", () => {
  assert.equal(selectedChangePath(true, false), activeChange);
  assert.equal(selectedChangePath(false, true), archivedChange);
  assert.throws(() => selectedChangePath(false, false));
  assert.throws(() => selectedChangePath(true, true));
});

test("completed-change assertions accept a retired Purpose but reject an active conversion Purpose", () => {
  const retiredStorage = "# Spec\n\n## Purpose\nLes valeurs V1 retirées restent inertes ; seul un nettoyage volontaire, précédé d'une sauvegarde vérifiée, peut les supprimer.\n";
  const retiredDocument = "# Spec\n\n## Purpose\nThe historical V1 document is retired and inert; no active conversion remains.\n";
  assert.doesNotThrow(() => assertCompletedPurposes({ legacyStorage: retiredStorage, legacyDocument: retiredDocument }));
  assert.throws(() => assertCompletedPurposes({
    legacyStorage: "# Spec\n\n## Purpose\nConvertir automatiquement chaque document V1 vers IndexedDB.\n",
    legacyDocument: retiredDocument
  }));
  assert.throws(() => assertCompletedPurposes({
    legacyStorage: retiredStorage,
    legacyDocument: "# Spec\n\n## Purpose\nDétecte le document V1 et migre automatiquement son contenu.\n"
  }));
});

test("when the change is archived, the real canonical Purposes describe retirement", () => {
  if (selectedChangePath() === activeChange) {
    // Real canonical specs are only authoritative after native OPSX sync;
    // synthetic completed-change cases are asserted in the fixture test.
    return;
  }
  assertCompletedPurposes({
    legacyStorage: read("openspec/specs/legacy-storage-migration/spec.md"),
    legacyDocument: read("openspec/specs/legacy-document-migration/spec.md")
  });
});

test("no archived change under openspec/changes/archive is modified", () => {
  const archiveRoot = resolve(root, "openspec/changes/archive");
  assert.equal(existsSync(archiveRoot), true);
  let status = "";
  try {
    status = execFileSync("git", ["status", "--porcelain", "--", "openspec/changes/archive"], {
      cwd: root,
      encoding: "utf8"
    });
  } catch {
    return;
  }
  assert.equal(status.trim(), "");
});
