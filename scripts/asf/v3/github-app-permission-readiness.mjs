/**
 * ASF-V3-030 — read-only GitHub control-plane / App permissions preflight.
 * A ruleset naming an App does NOT prove an issued token's real permissions.
 * No token creation, secrets, Git writes, workflow dispatch or API payment.
 */
import {observeV3GithubRulesetPolicy,V3_CONTROLLER_APP_ID}
 from "./github-native-control.mjs";
import {observeV3GithubWaveRulesetPolicy,ASF_V3_WAVE_REF_PATTERN}
 from "./github-native-wave-ruleset.mjs";
const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const MAIN=BASE+"/git/ref/heads/main";
const GLOBAL=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const SHA=/^[a-f0-9]{40}$/;
const no=(status,reason,evidence=null)=>Object.freeze({
 status,reason,authorized:false,canWrite:false,canCreateRef:false,
 canUseAppToken:false,canStartPaid:false,canSpend:false,canRetry:false,
 evidence:evidence===null?null:Object.freeze(evidence)
});
const unknown=reason=>no("uncertain",reason);
function shaFrom(r){
 return r?.ok===true&&r.data?.ref==="refs/heads/main"&&
   r.data.object?.type==="commit"&&SHA.test(r.data.object.sha??"")?
   r.data.object.sha:null;
}
function observeGlobalRef(r){
 if(r?.ok===false&&r.error?.status===404)
  return "absent_observed_not_authorizing_bootstrap";
 if(r?.ok===true&&r.data?.ref==="refs/heads/asf/control/active-wave-v3"&&
    r.data.object?.type==="commit"&&SHA.test(r.data.object.sha??""))
  return "present_do_not_recreate";
 return null;
}
/**
 * Collects double-pinned main SHA and two independent structural policy
 * observations; never pretends GitHub REST can prove the App token's scopes.
 * Wave rulesets missing are an explicit BLOCKER rather than a bootstrap right.
 */
export async function observeAsfV3AppPermissionsReadiness({
 readClient,expectedMainSha
}={}){
 if(!SHA.test(expectedMainSha??""))
  return no("rejected","invalid_expected_main_sha");
 if(typeof readClient?.get!=="function")
  return unknown("github_read_client_missing");
 let first;
 try{first=await readClient.get(MAIN);}
 catch{return unknown("main_ref_unavailable");}
 if(shaFrom(first)!==expectedMainSha)
  return unknown("main_sha_not_pinned");
 let globalPolicy,wavePolicy,globalRef,last;
 try {
  globalPolicy=await observeV3GithubRulesetPolicy(readClient);
  wavePolicy=await observeV3GithubWaveRulesetPolicy(readClient);
  globalRef=await readClient.get(GLOBAL);
  last=await readClient.get(MAIN);
 }catch{return unknown("read_only_policy_observation_failed");}
 if(shaFrom(last)!==expectedMainSha)
  return unknown("main_moved_during_permission_audit");
 const refState=observeGlobalRef(globalRef);
 if(refState===null)return unknown("global_ref_status_ambiguous");
 if(globalPolicy?.status!=="structurally_consistent")
  return no(globalPolicy?.status==="rejected"?"rejected":"uncertain",
    "global_rule_structure_not_verified");
 const common=Object.freeze({
  repository:REPO,mainSha:expectedMainSha,
  controllerAppId:V3_CONTROLLER_APP_ID,
  executorAppId:5321746,
  globalRefState:refState,
  globalRulesetStatus:globalPolicy.status,
  waveRulesetStatus:wavePolicy?.status??"unknown",
  wavePattern:ASF_V3_WAVE_REF_PATTERN,
  actualAppPermissionsProven:false,
  realAppDenyTestsCompleted:false,
  privateKeyUsed:false,paidCallsPerformed:false
 });
 if(wavePolicy?.status!=="wave_rule_structure_observed_not_authorized")
  return no(wavePolicy?.status==="rejected"?"blocked":"uncertain",
    "wave_rulesets_missing_or_unverified",common);
 return no("structurally_observed_not_authorized",
  "live_app_installation_token_scopes_and_negative_tests_still_required",
  common);
}
