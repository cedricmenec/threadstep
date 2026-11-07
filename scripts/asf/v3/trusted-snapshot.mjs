/**
 * ASF-V3-004: pinned, READ-ONLY wave snapshot.
 *
 * This module uses the existing read-only GitHub client, with no GitHub App
 * write token, dispatch or paid calls. It does not authorize spending.
 * The trusted replay/manifest validators are injected until #69 is merged.
 */
import { canonicalize, contentSha256 } from "../waves/hash.mjs";
import { findSecretPaths } from "../waves/secrets.mjs";

const HEX40 = /^[a-f0-9]{40}$/;
const WAVE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const REPO = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
const MAX_FILE_BYTES = 512 * 1024;
const result = (status, code, detail = {}) =>
  Object.freeze({ ok: status === "verified_snapshot", status, code, ...detail });
const uncertain = code => result("uncertain", code);
const rejected = code => result("rejected", code);
function freezeDeep(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freezeDeep);
    Object.freeze(value);
  }
  return value;
}
function decodeFile(data, path) {
  if (!data || data.type !== "file" || data.path !== path ||
    data.encoding !== "base64" || typeof data.content !== "string" ||
    !Number.isSafeInteger(data.size) || data.size < 0 ||
    data.size > MAX_FILE_BYTES) throw new Error("invalid_contents_metadata");
  const encoded = data.content.replace(/\s/g, "");
  if (!encoded || encoded.length > Math.ceil(MAX_FILE_BYTES * 4 / 3) + 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    throw new Error("invalid_base64");
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length !== data.size || bytes.length > MAX_FILE_BYTES)
    throw new Error("invalid_bytes");
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  // Disallow decoded strings with non-JSON prefixes, replaced UTF-8 or BOM.
  if (!/^\s*\{/.test(decoded)) throw new Error("not_json_document");
  const parsed = JSON.parse(decoded);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new Error("not_json_object");
  return parsed;
}

/** Only these two files and the exact operational branch may be read. */
export function createV3WaveReadPort(client, repository) {
  if (!client || typeof client.get !== "function" || !REPO.test(repository ?? ""))
    throw new TypeError("trusted read-only client and repository required");
  const prefix = "repos/" + repository;
  return Object.freeze({
    repository,
    async getRef(waveId) {
      if (!WAVE.test(waveId ?? "")) throw new Error("unsafe_wave_id");
      const response = await client.get(prefix + "/git/ref/heads/asf/waves/" + waveId);
      if (!response?.ok || !HEX40.test(response.data?.object?.sha ?? "") ||
        response.data.ref !== "refs/heads/asf/waves/" + waveId ||
        response.data.object.type !== "commit") throw new Error("unavailable_ref");
      return response.data.object.sha;
    },
    async getFileAtCommit(sha, path) {
      if (!HEX40.test(sha ?? "") || !["manifest.json", "journal.json"].includes(path))
        throw new Error("untrusted_file_request");
      const response = await client.get(prefix + "/contents/" + path + "?ref=" + sha);
      if (!response?.ok) throw new Error("unavailable_contents");
      return decodeFile(response.data, path);
    }
  });
}

/**
 * Load manifest and journal FROM THE SAME commit SHA, then replay the entire
 * journal against the validated manifest before returning. The validators
 * MUST be trusted implementations; a stub returning true is NOT production-safe.
 */
export async function loadV3TrustedSnapshot(port, waveId, validators) {
  if (!WAVE.test(waveId ?? "") || !port || !validators ||
    typeof port.getRef !== "function" ||
    typeof port.getFileAtCommit !== "function" ||
    typeof validators.verifyManifest !== "function" ||
    typeof validators.replayJournal !== "function") return rejected("invalid_reader_or_validator");
  let headSha, manifest, journal;
  try {
    headSha = await port.getRef(waveId);
    if (!HEX40.test(headSha ?? "")) return uncertain("invalid_branch_tip");
    manifest = await port.getFileAtCommit(headSha, "manifest.json");
    journal = await port.getFileAtCommit(headSha, "journal.json");
  } catch { return uncertain("github_snapshot_unavailable"); }
  try {
    if (findSecretPaths(manifest).length || findSecretPaths(journal).length)
      return rejected("secret_in_wave_snapshot");
    if (validators.verifyManifest(manifest) !== true ||
      manifest.schemaVersion !== 2 || manifest.waveId !== waveId)
      return rejected("invalid_v3_manifest");
    if (journal.schemaVersion !== 2 || journal.waveId !== waveId ||
      journal.manifestHash !== contentSha256(manifest))
      return rejected("manifest_journal_mismatch");
    const replayed = validators.replayJournal(manifest, journal);
    if (!replayed || canonicalize(replayed) !== canonicalize(journal))
      return rejected("journal_replay_mismatch");
    return result("verified_snapshot", "pinned_revision_verified", {
      headSha, manifest: freezeDeep(structuredClone(manifest)),
      journal: freezeDeep(structuredClone(journal))
    });
  } catch { return rejected("invalid_replay_or_manifest"); }
}
