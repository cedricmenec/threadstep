/**
 * ASF-V3-006: narrow REST Git Data port for asf/waves/<waveId>.
 *
 * NOT CONNECTED TO GITHUB ACTIONS. No CLI, credentials, network or auto-retry.
 * The caller must inject a reviewed, credential-scoped HTTP transport.
 *
 * Compatible with the port required by ASF-V3-003 (#70):
 *   getRef(ref), getCommit(sha), createTree(args), createCommit(args),
 *   updateRef({ref,sha,force:false}).
 *
 * CRITICAL: this adapter is a Git mutation mechanism, not an authorization
 * gate. Never expose it to a model or give it a write token before a separate
 * owner-approved workflow/permissions review. Commit SHA fast-forward protects
 * against sibling writes; only a trusted actor policy protects branch genesis.
 */
import { findSecretPaths } from "../waves/secrets.mjs";

export const ASF_V3_REPOSITORY = "cedricmenec/threadstep";
const SHA = /^[a-f0-9]{40}$/;
const WAVE = /^[a-z0-9][a-z0-9._-]{2,63}$/;
const MAX_JOURNAL_BYTES = 512 * 1024;

function reject(code, status = null) {
  const cause = new Error("ASF V3 Git Data: " + code);
  cause.code = code;
  if (Number.isInteger(status) && status >= 400 && status <= 599) cause.status = status;
  return cause;
}
function requireValue(ok, code) {
  if (!ok) throw reject(code);
}
function errorFrom(cause) {
  if (cause && (cause.code === "git_api_response_invalid" ||
    cause.code === "git_contract_violation" ||
    cause.code === "git_secret_blocked" ||
    cause.code === "git_payload_too_large")) return cause;
  return reject("git_transport_unavailable",
    Number.isInteger(cause?.status) ? cause.status : null);
}
function hexSha(value) { return typeof value === "string" && SHA.test(value); }
function isPlain(x) { return x !== null && typeof x === "object" &&
  !Array.isArray(x); }

/**
 * Keep repository hard-pinned in this implementation. The caller may configure
 * a WAVE id but cannot switch repository, branch family, or file path.
 *
 * transport({ method, path, body }) -> parsed JSON response, or throw an error
 * with optional HTTP status. No mutable URL/header/token input is accepted.
 */
export function createAsfV3GitDataPort({ waveId, transport } = {}) {
  requireValue(WAVE.test(waveId ?? ""), "git_contract_violation");
  requireValue(typeof transport === "function", "git_contract_violation");

  const fullRef = "refs/heads/asf/waves/" + waveId;
  const prefix = "repos/" + ASF_V3_REPOSITORY;

  async function send(method, path, body) {
    try {
      const response = await transport(Object.freeze({
        method, path, ...(body === undefined ? {} : { body: structuredClone(body) })
      }));
      if (!isPlain(response)) throw reject("git_api_response_invalid");
      return response;
    } catch (cause) {
      throw errorFrom(cause);
    }
  }

  return Object.freeze({
    /**
     * GET /git/ref/{ref}; GitHub returns {ref,object:{type:"commit",sha}}.
     */
    async getRef(ref) {
      requireValue(ref === fullRef, "git_contract_violation");
      const data = await send("GET", prefix + "/git/ref/heads/asf/waves/" + waveId);
      if (data.ref !== fullRef || data.object?.type !== "commit" ||
        !hexSha(data.object?.sha)) throw reject("git_api_response_invalid");
      return Object.freeze({ sha: data.object.sha });
    },

    /**
     * GET /git/commits/{sha}; normalize tree and parent objects.
     */
    async getCommit(sha) {
      requireValue(hexSha(sha), "git_contract_violation");
      const data = await send("GET", prefix + "/git/commits/" + sha);
      if (data.sha !== sha || !hexSha(data.tree?.sha) ||
        !Array.isArray(data.parents) ||
        data.parents.some(x => !hexSha(x?.sha)))
        throw reject("git_api_response_invalid");
      return Object.freeze({
        sha: data.sha,
        treeSha: data.tree.sha,
        parents: Object.freeze(data.parents.map(x => x.sha))
      });
    },

    /**
     * POST /git/trees, preserving every other file through base_tree.
     * Only journal.json may be modified, with a UTF-8 JSON payload.
     */
    async createTree({ baseTreeSha, files } = {}) {
      requireValue(hexSha(baseTreeSha) && Array.isArray(files) &&
        files.length === 1, "git_contract_violation");
      const file = files[0];
      requireValue(isPlain(file) && Object.keys(file).sort().join(",") ===
        "content,mode,path,type" &&
        file.path === "journal.json" && file.mode === "100644" &&
        file.type === "blob" && typeof file.content === "string",
        "git_contract_violation");
      const n = Buffer.byteLength(file.content, "utf8");
      requireValue(n > 0 && n <= MAX_JOURNAL_BYTES, "git_payload_too_large");
      let payload;
      try { payload = JSON.parse(file.content); }
      catch { throw reject("git_contract_violation"); }
      requireValue(isPlain(payload) && payload.schemaVersion === 2 &&
        WAVE.test(payload.waveId ?? "") && payload.waveId === waveId &&
        Number.isSafeInteger(payload.revision) && payload.revision >= 1,
        "git_contract_violation");
      requireValue(findSecretPaths(payload).length === 0, "git_secret_blocked");
      const response = await send("POST", prefix + "/git/trees", {
        base_tree: baseTreeSha,
        tree: [{ path: "journal.json", mode: "100644", type: "blob",
          content: file.content }]
      });
      if (!hexSha(response.sha)) throw reject("git_api_response_invalid");
      return Object.freeze({ sha: response.sha });
    },

    /**
     * POST /git/commits. Enforce exactly one parent = pinned expected head.
     * It remains a detached object until the conditional ref update.
     */
    async createCommit({ treeSha, parents, message } = {}) {
      requireValue(hexSha(treeSha) && Array.isArray(parents) &&
        parents.length === 1 && hexSha(parents[0]) &&
        typeof message === "string" &&
        /^chore\(asf\): V3 journal checkpoint revision [1-9]\d{0,9}$/.test(message),
        "git_contract_violation");
      const data = await send("POST", prefix + "/git/commits", {
        message, tree: treeSha, parents: [...parents]
      });
      if (!hexSha(data.sha) || data.tree?.sha !== treeSha ||
        !Array.isArray(data.parents) || data.parents.length !== 1 ||
        data.parents[0]?.sha !== parents[0])
        throw reject("git_api_response_invalid");
      return Object.freeze({ sha: data.sha });
    },

    /**
     * PATCH /git/refs/{ref}, ALWAYS force:false. GitHub guarantees
     * fast-forward-only semantics, not an explicit expected_sha lease.
     * With createCommit(parent=expectedHead), a sibling commit cannot FF.
     */
    async updateRef({ ref, sha, force } = {}) {
      requireValue(ref === fullRef && hexSha(sha) && force === false,
        "git_contract_violation");
      const data = await send("PATCH", prefix + "/git/refs/heads/asf/waves/" + waveId, {
        sha, force: false
      });
      if (data.ref !== fullRef || data.object?.type !== "commit" ||
        data.object?.sha !== sha)
        throw reject("git_api_response_invalid");
      return Object.freeze({ sha });
    }
  });
}
