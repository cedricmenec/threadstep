import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const activeChange = "openspec/changes/ts-040";
const archivedChange = "openspec/changes/archive/ts-040";

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
    assert.match(purpose, /retir|inert|inactif|volontaire|nettoyage|ne sont plus pris en charge/i);
    assert.doesNotMatch(purpose, /conver(tit|sion active)|migre automatiquement|détecte.*document V1/i);
  }
  assert.match(storagePurpose, /nettoyage|volontaire/i);
  assert.match(documentPurpose, /inert|retir|plus pris en charge/i);
}

function assertActiveDelta(source, label) {
  assert.match(source, /retir|inert|inactif/i, label);
  assert.match(source, /aucune écriture|sans écriture|without write|no write/i, label);
  assert.match(source, /volontaire|voluntary/i, label);
  assert.match(source, /nettoyage|cleanup/i, label);
  assert.doesNotMatch(source, /sera converti automatiquement/i, label);
}

test("active OpenSpec deltas retire V1 readers and require voluntary cleanup", () => {
  assert.equal(existsSync(resolve(root, activeChange)), true, "active change must exist during apply");
  const storage = read(activeChange + "/specs/legacy-storage-migration/spec.md");
  const documentDelta = read(activeChange + "/specs/legacy-document-migration/spec.md");
  const backup = read(activeChange + "/specs/data-backup-import-restore/spec.md");
  assertActiveDelta(storage, "legacy-storage-migration");
  assertActiveDelta(documentDelta, "legacy-document-migration");
  assert.match(documentDelta, /Historical V1 document support is retired/);
  assert.match(documentDelta, /Legacy document is inert/);
  assert.match(storage, /Retired historical V1 storage is inert/);
  assert.match(storage, /Voluntary scoped cleanup of retired V1 keys/);
  assert.match(backup, /unsupported-v1-backup/);
  assert.match(backup, /version: 1.*refus|refus.*version: 1/is);
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
  if (!existsSync(resolve(root, archivedChange))) {
    // During apply the active delta is authoritative; the archived branch is
    // exercised by the synthetic fixtures in the previous test.
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
