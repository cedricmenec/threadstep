/**
 * ASF-V3-014: owner bootstrap READINESS OBSERVER (no Git writer).
 *
 * Verifies independently fetched protection rules and a stable main ref.
 * HTTP 404 for the global ref is NOT proof of owner authority: even the
 * positive "absent" observation is non-authorizing, and GitHub can hide refs.
 * Only a separately approved owner-run/App writer may later attempt creation.
 */
import { observeV3GithubRulesetPolicy } from "./github-native-control.mjs";
import { replayAdmissionRegistry, createAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "./global-admission.mjs";
import { canonicalize, contentSha256 } from "../waves/hash.mjs";

const BASE = "repos/cedricmenec/threadstep";
const MAIN = BASE + "/git/ref/heads/main";
const GLOBAL = BASE + "/git/ref/heads/asf/control/active-wave-v3";
const SHA = /^[a-f0-9]{40}$/;
const MAX_SIZE = 512 * 1024;
const decision = (status, reason, evidence=null) => Object.freeze({
  status, reason, authorized:false, canCreate:false, canWrite:false,
  canDispatch:false, canSpend:false, canRetry:false,
  evidence:evidence === null ? null : Object.freeze(evidence)
});
const reject = code => decision("rejected",code);
const uncertain = code => decision("uncertain",code);
const shaRef = (res,ref) =>
  res?.ok === true && res.data?.ref === ref &&
  res.data?.object?.type === "commit" &&
  SHA.test(res.data.object.sha ?? "") ? res.data.object.sha : null;

function decodeRegistry(response) {
  const d = response?.data;
  if (!response?.ok || d?.type !== "file" || d.path !== "registry.json" ||
      d.encoding !== "base64" || typeof d.content !== "string" ||
      !Number.isSafeInteger(d.size) || d.size < 2 || d.size > MAX_SIZE)
    throw Error("invalid_registry_file");
  const encoded = d.content.replace(/\s/g,"");
  if (encoded.length > Math.ceil(MAX_SIZE * 4/3)+4 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded))
    throw Error("invalid_base64");
  const bytes=Buffer.from(encoded,"base64");
  if (bytes.length !== d.size || bytes.toString("base64") !== encoded)
    throw Error("invalid_base64_bytes");
  return replayAdmissionRegistry(JSON.parse(
    new TextDecoder("utf-8",{fatal:true}).decode(bytes)));
}
export async function observeV3GithubBootstrapReadiness({
  readClient, expectedMainSha
}={}) {
  if(typeof readClient?.get !== "function")
    return uncertain("github_read_client_missing");
  if(!SHA.test(expectedMainSha ?? ""))
    return reject("trusted_main_sha_required");

  const rules=await observeV3GithubRulesetPolicy(readClient);
  if(rules.status !== "structurally_consistent")
    return decision(rules.status, "protected_global_rules_unconfirmed");

  let initialMain, observedGlobal;
  try {
    initialMain=await readClient.get(MAIN);
    observedGlobal=await readClient.get(GLOBAL);
  } catch { return uncertain("bootstrap_reference_observation_failed"); }
  const mainSha=shaRef(initialMain,"refs/heads/main");
  if(mainSha !== expectedMainSha)
    return reject("main_source_sha_not_current_protected_head");

  let summary;
  const globalHead=shaRef(observedGlobal,ADMISSION_REGISTRY_REF);
  if(globalHead) {
    let file;
    try {
      file=await readClient.get(BASE+"/contents/registry.json?ref="+globalHead);
      summary=decodeRegistry(file);
    } catch { return reject("existing_registry_invalid_do_not_recreate"); }
  } else if(observedGlobal?.ok === false &&
      observedGlobal.status === 404) {
    // 404 can be permission masking; this observation NEVER issues CREATE.
    summary=null;
  } else {
    return uncertain("global_ref_absence_not_confirmed");
  }

  let finalMain, finalGlobal;
  try {
    finalMain=await readClient.get(MAIN);
    finalGlobal=await readClient.get(GLOBAL);
  } catch { return uncertain("bootstrap_readback_failed"); }
  if(shaRef(finalMain,"refs/heads/main")!==expectedMainSha)
    return uncertain("main_ref_moved_during_bootstrap_observation");
  if(summary===null) {
    if(finalGlobal?.ok !== false || finalGlobal.status !== 404)
      return uncertain("global_ref_changed_during_bootstrap_observation");
    return decision("absent_observed_untrusted",
      "owner_only_create_once_not_approved_or_performed",{
        mainSha:expectedMainSha,globalRef:ADMISSION_REGISTRY_REF,
        emptyRegistryHash:contentSha256(createAdmissionRegistry())
      });
  }
  if(shaRef(finalGlobal,ADMISSION_REGISTRY_REF)!==globalHead)
    return uncertain("global_ref_changed_during_bootstrap_observation");
  const pristine = canonicalize(summary)===canonicalize(createAdmissionRegistry());
  return decision(pristine?"already_initialized_untrusted":"existing_history_stop",
    pristine?"never_recreate_existing_global_ref":
      "existing_registry_must_not_be_replaced_or_reset",{
      mainSha:expectedMainSha,globalRef:ADMISSION_REGISTRY_REF,
      globalHeadSha:globalHead,revision:summary.revision,
      registryHash:contentSha256(summary)
    });
}
