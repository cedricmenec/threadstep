// Pure, versioned IndexedDB backup contract. No DOM, IndexedDB, network or
// framework access: the browser only supplies committed records and receives
// a portable document or a stable rejection code.
import { PRIORITIES, NOTE_MAX_LENGTH } from "./core.js";
import { sha256Hex } from "./fingerprint.js";

export const BACKUP_FORMAT = "threadstep.indexeddb-backup";
export const BACKUP_FORMAT_VERSION = 1;
export const BACKUP_MAPPING_VERSION = 2;
export const BACKUP_SCHEMA_VERSION = 3;
export const BACKUP_QUOTAS = Object.freeze({ subjects: 40, itemsPerSubject: 500 });

export const BACKUP_ERROR = Object.freeze({
  UNSUPPORTED_V1: "unsupported-v1-backup",
  UNKNOWN_FORMAT: "unknown-format",
  INVALID: "invalid-backup",
  DUPLICATE_ID: "duplicate-id",
  DANGLING_REFERENCE: "dangling-reference",
  QUOTA_EXCEEDED: "quota-exceeded",
  COUNT_MISMATCH: "count-mismatch",
  CHECKSUM_MISMATCH: "checksum-mismatch"
});

const SUBJECT_FIELDS = Object.freeze(["id", "title", "order"]);
const ITEM_FIELDS = Object.freeze([
  "id", "subjectId", "parentId", "title", "note", "priority", "done", "order"
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function validId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 100;
}

function validTitle(value, length) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= length;
}

function validOrder(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function canonicalBackupJson(value) {
  return JSON.stringify(value, (key, item) => {
    if (Array.isArray(item)) return item.map((entry) => entry);
    if (isPlainObject(item)) {
      return Object.keys(item).sort().reduce((sorted, name) => {
        sorted[name] = item[name];
        return sorted;
      }, {});
    }
    return item;
  });
}

function projectSubject(record) {
  return {
    id: record.id,
    title: record.title,
    order: record.order
  };
}

function projectItem(record) {
  const item = {
    id: record.id,
    subjectId: record.subjectId,
    parentId: record.parentId === undefined ? null : record.parentId,
    title: record.title,
    priority: record.priority,
    done: record.done === true,
    order: record.order
  };
  if (Object.prototype.hasOwnProperty.call(record, "note") && typeof record.note === "string") {
    item.note = record.note;
  }
  return item;
}

// Deterministic, allowlisted projection. Extra native Cloud metadata is never
// copied into a backup and array order is stabilised by identifier.
export function canonicalBackupRecords(records) {
  const source = isPlainObject(records) ? records : {};
  const subjects = (Array.isArray(source.subjects) ? source.subjects : [])
    .filter(isPlainObject)
    .map(projectSubject)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  const items = (Array.isArray(source.items) ? source.items : [])
    .filter(isPlainObject)
    .map(projectItem)
    .sort((left, right) => String(left.id).localeCompare(String(right.id)));
  return { subjects, items };
}

export function computeBackupChecksum(records) {
  return sha256Hex(canonicalBackupJson(canonicalBackupRecords(records)));
}

function failure(code, message, details = {}) {
  return { ok: false, status: "rejected", code, message, ...details };
}

// Structural validation shared by the serializer and the parser. It never
// repairs or rewrites the source; any anomaly is reported with a stable code.
export function validateBackupRecords(records) {
  if (!isPlainObject(records) || !Array.isArray(records.subjects) || !Array.isArray(records.items)) {
    return failure(BACKUP_ERROR.INVALID, "La sauvegarde ne contient pas les listes de sujets et d'étapes attendues.");
  }
  if (records.subjects.length > BACKUP_QUOTAS.subjects) {
    return failure(BACKUP_ERROR.QUOTA_EXCEEDED, "La sauvegarde dépasse la limite de sujets ThreadStep.");
  }
  const subjectIds = new Set();
  for (const subject of records.subjects) {
    if (!isPlainObject(subject)) {
      return failure(BACKUP_ERROR.INVALID, "Un sujet de la sauvegarde est invalide.");
    }
    for (const field of SUBJECT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(subject, field)) {
        return failure(BACKUP_ERROR.INVALID, "Un champ obligatoire de sujet est absent.");
      }
    }
    if (!validId(subject.id) || !validTitle(subject.title, 100) || !validOrder(subject.order)) {
      return failure(BACKUP_ERROR.INVALID, "Un sujet de la sauvegarde est invalide.");
    }
    if (subjectIds.has(subject.id)) {
      return failure(BACKUP_ERROR.DUPLICATE_ID, "Deux sujets partagent le même identifiant.", { id: subject.id });
    }
    subjectIds.add(subject.id);
  }
  const itemIds = new Set();
  const itemById = new Map();
  const itemsBySubject = new Map();
  for (const item of records.items) {
    if (!isPlainObject(item)) {
      return failure(BACKUP_ERROR.INVALID, "Une étape de la sauvegarde est invalide.");
    }
    for (const field of ITEM_FIELDS) {
      if (field === "note") continue;
      if (!Object.prototype.hasOwnProperty.call(item, field)) {
        return failure(BACKUP_ERROR.INVALID, "Un champ obligatoire d'étape est absent.");
      }
    }
    if (!validId(item.id) || !validTitle(item.title, 300) ||
        !PRIORITIES.includes(item.priority) || typeof item.done !== "boolean" ||
        !validOrder(item.order) ||
        !(item.parentId === null || validId(item.parentId)) ||
        !validId(item.subjectId)) {
      return failure(BACKUP_ERROR.INVALID, "Une étape de la sauvegarde est invalide.");
    }
    if (Object.prototype.hasOwnProperty.call(item, "note") &&
        (typeof item.note !== "string" || item.note.length > NOTE_MAX_LENGTH)) {
      return failure(BACKUP_ERROR.INVALID, "La note d'une étape est invalide.");
    }
    if (itemIds.has(item.id)) {
      return failure(BACKUP_ERROR.DUPLICATE_ID, "Deux étapes partagent le même identifiant.", { id: item.id });
    }
    itemIds.add(item.id);
    itemById.set(item.id, item);
    if (!itemsBySubject.has(item.subjectId)) itemsBySubject.set(item.subjectId, 0);
    itemsBySubject.set(item.subjectId, itemsBySubject.get(item.subjectId) + 1);
  }
  for (const item of records.items) {
    if (!subjectIds.has(item.subjectId)) {
      return failure(BACKUP_ERROR.DANGLING_REFERENCE, "Une étape référence un sujet absent.", { id: item.id });
    }
    if (item.parentId !== null) {
      const parent = itemById.get(item.parentId);
      if (!parent || parent.subjectId !== item.subjectId || parent.id === item.id ||
          (parent.parentId !== null && parent.parentId !== undefined)) {
        return failure(BACKUP_ERROR.DANGLING_REFERENCE, "Une étape référence un parent absent ou incohérent.", { id: item.id });
      }
    }
  }
  for (const count of itemsBySubject.values()) {
    if (count > BACKUP_QUOTAS.itemsPerSubject) {
      return failure(BACKUP_ERROR.QUOTA_EXCEEDED, "Un sujet dépasse la limite d'étapes ThreadStep.");
    }
  }
  return { ok: true, status: "valid", code: "backup-valid", records: canonicalBackupRecords(records) };
}

function validProvenance(provenance) {
  return isPlainObject(provenance) &&
    provenance.source === "indexeddb" &&
    provenance.idsCanonical === true &&
    Number.isInteger(provenance.mappingVersion) &&
    Number.isInteger(provenance.schemaVersion) &&
    !Object.prototype.hasOwnProperty.call(provenance, "title") &&
    !Object.prototype.hasOwnProperty.call(provenance, "note") &&
    !Object.prototype.hasOwnProperty.call(provenance, "account") &&
    !Object.prototype.hasOwnProperty.call(provenance, "email") &&
    !Object.prototype.hasOwnProperty.call(provenance, "token");
}

export function serializeIndexedDbBackup(records, options = {}) {
  const validation = validateBackupRecords(records);
  if (!validation.ok) return validation;
  const normalized = validation.records;
  const counts = { subjects: normalized.subjects.length, items: normalized.items.length };
  const checksum = computeBackupChecksum(normalized);
  const schemaVersion = Number.isInteger(options.schemaVersion)
    ? options.schemaVersion
    : BACKUP_SCHEMA_VERSION;
  const document = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    provenance: {
      source: "indexeddb",
      idsCanonical: true,
      mappingVersion: BACKUP_MAPPING_VERSION,
      schemaVersion
    },
    counts,
    records: normalized,
    checksum
  };
  return {
    ok: true,
    status: "ready",
    code: "backup-valid",
    document,
    records: normalized,
    counts,
    checksum
  };
}

export function parseIndexedDbBackup(source) {
  let document = source;
  if (typeof source === "string") {
    try {
      document = JSON.parse(source);
    } catch {
      return failure(BACKUP_ERROR.INVALID, "Le fichier de sauvegarde est illisible.");
    }
  }
  if (!isPlainObject(document)) {
    return failure(BACKUP_ERROR.INVALID, "Le fichier de sauvegarde est invalide.");
  }
  if (document.version === 1) {
    return failure(
      BACKUP_ERROR.UNSUPPORTED_V1,
      "Ce fichier utilise l'ancien format V1, qui n'est plus pris en charge. Importez une sauvegarde au format threadstep.indexeddb-backup."
    );
  }
  if (document.format !== BACKUP_FORMAT) {
    return failure(
      BACKUP_ERROR.UNKNOWN_FORMAT,
      "Ce fichier n'est pas une sauvegarde ThreadStep au format IndexedDB attendu (" + BACKUP_FORMAT + ")."
    );
  }
  if (document.formatVersion !== BACKUP_FORMAT_VERSION) {
    return failure(
      BACKUP_ERROR.UNKNOWN_FORMAT,
      "Cette version du format de sauvegarde n'est pas prise en charge."
    );
  }
  if (!validProvenance(document.provenance)) {
    return failure(BACKUP_ERROR.INVALID, "La provenance de la sauvegarde est absente ou incohérente.");
  }
  if (!isPlainObject(document.records)) {
    return failure(BACKUP_ERROR.INVALID, "La sauvegarde ne contient pas ses enregistrements.");
  }
  const validation = validateBackupRecords(document.records);
  if (!validation.ok) return validation;
  const counts = validation.records.subjects.length;
  const itemCount = validation.records.items.length;
  if (!isPlainObject(document.counts) ||
      document.counts.subjects !== counts || document.counts.items !== itemCount) {
    return failure(BACKUP_ERROR.COUNT_MISMATCH, "Les compteurs de la sauvegarde ne correspondent pas à son contenu.");
  }
  if (typeof document.checksum !== "string" ||
      document.checksum !== computeBackupChecksum(validation.records)) {
    return failure(BACKUP_ERROR.CHECKSUM_MISMATCH, "L'empreinte de la sauvegarde ne correspond pas à son contenu.");
  }
  return {
    ok: true,
    status: "ready",
    code: "backup-valid",
    document,
    records: validation.records,
    counts: { subjects: counts, items: itemCount },
    checksum: document.checksum,
    provenance: document.provenance
  };
}

// Pure transition/refusal messages shared by the UI and the tests. They never
// offer a conversion, a prefix guess or an automatic write.
export function transitionNotice() {
  return {
    code: "v1-backup-transition",
    title: "Ancien format V1 retiré",
    message: "Les fichiers JSON V1, même récemment produits depuis IndexedDB, ne sont plus acceptés. " +
      "Générez et vérifiez une sauvegarde au format " + BACKUP_FORMAT + " avant de nettoyer les anciennes clés. " +
      "Aucune donnée n'est supprimée ni envoyée au Cloud par cet avertissement.",
    invitesModernBackup: true,
    deletesData: false
  };
}

export function unsupportedV1Refusal(code = BACKUP_ERROR.UNSUPPORTED_V1) {
  return {
    code,
    title: "Format V1 non pris en charge",
    message: code === BACKUP_ERROR.UNSUPPORTED_V1
      ? "Ce fichier utilise l'ancien format V1. Il n'est plus accepté et aucune conversion n'est tentée. " +
        "Utilisez une sauvegarde au format " + BACKUP_FORMAT + "."
      : "Le format de ce fichier n'est pas reconnu. Utilisez une sauvegarde au format " + BACKUP_FORMAT + ".",
    conversionPath: null,
    writes: false
  };
}

export function backupPlanFingerprint(records, target) {
  return sha256Hex(canonicalBackupJson({
    source: computeBackupChecksum(records),
    target: canonicalBackupRecords(target)
  }));
}
