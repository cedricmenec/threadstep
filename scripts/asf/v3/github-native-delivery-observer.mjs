/**
 * ASF-V3-014 — independent GitHub delivery observer (read-only, fail closed).
 *
 * Verifies PR merge, exact-head CI, merge-main CI and the deploy job of the
 * exact-sha Pages push workflow. Never trusts a model-supplied proof.
 * A "verified" observation is not a RELEASE or paid authorization, and
 * does not prove the deployed site is currently reachable.
 */
import { observeV3GithubRulesetPolicy } from "./github-native-control.mjs";
import { contentSha256 } from "../waves/hash.mjs";

const BASE="repos/cedricmenec/threadstep";
const REPO="cedricmenec/threadstep";
const SHA=/^[a-f0-9]{40}$/;
const response=(status,reason,evidence=null)=>Object.freeze({
 status,reason,authorized:false,canRelease:false,canQuarantine:false,
 canDispatch:false,canSpend:false,canRetry:false,
 evidence:evidence===null?null:Object.freeze(evidence)
});
const deny=c=>response("rejected",c);
const unknown=c=>response("uncertain",c);
const ok=(res)=>res?.ok===true && res.data &&
  typeof res.data==="object" && !Array.isArray(res.data);
const goodMain=(r)=>ok(r)&&r.data.ref==="refs/heads/main" &&
  r.data.object?.type==="commit" && SHA.test(r.data.object.sha??"");
const boundedList=(r,key)=>ok(r)&&
  Number.isSafeInteger(r.data.total_count)&&
  r.data.total_count>=0 && r.data.total_count<100 &&
  Array.isArray(r.data[key])&&r.data[key].length===r.data.total_count;
const successCheck=(res,sha)=>{
 if(!boundedList(res,"check_runs"))return null;
 const matches=res.data.check_runs.filter(r=>r.name==="check");
 if(matches.length!==1)return null;
 const r=matches[0];
 if(r.head_sha!==sha||r.app?.slug!=="github-actions" ||
   r.status!=="completed"||r.conclusion!=="success")return null;
 return {sha,conclusion:"success"};
};
/**
 * Input binds only a PR and exact HEAD that the pinned wave journal already
 * recorded. The caller must independently re-read and replay that journal.
 * No proof here can be handed to an active writer without that recheck.
 */
export async function observeV3GithubDelivery({
 readClient,prNumber,expectedHeadSha
}={}) {
 if(!Number.isSafeInteger(prNumber)||prNumber<1||
   !SHA.test(expectedHeadSha??""))
   return deny("invalid_pinned_pr_input");
 if(typeof readClient?.get!=="function")
   return unknown("github_reader_missing");
 const rules=await observeV3GithubRulesetPolicy(readClient);
 if(rules.status!=="structurally_consistent")
   return response(rules.status,"protected_github_rules_unverified");

 let prRes,mainRef;
 try{
  prRes=await readClient.get(BASE+"/pulls/"+prNumber);
  mainRef=await readClient.get(BASE+"/git/ref/heads/main");
 }catch{return unknown("merge_or_main_reference_unavailable");}
 if(!ok(prRes)||!goodMain(mainRef))
  return unknown("merge_or_main_reference_unavailable");
 const pr=prRes.data;
 if(pr.number!==prNumber||pr.state!=="closed"||pr.merged!==true||
   typeof pr.merged_at!=="string"||!pr.merged_at||
   pr.base?.repo?.full_name!==REPO||pr.base.ref!=="main"||
   pr.head?.repo?.full_name!==REPO||
   pr.head.sha!==expectedHeadSha||
   !SHA.test(pr.merge_commit_sha??""))
  return deny("pr_merge_identity_or_sha_mismatch");
 const mergeSha=pr.merge_commit_sha,mainSha=mainRef.data.object.sha;
 let ancestor,headChecks,mainChecks,runs;
 try{
  [ancestor,headChecks,mainChecks,runs]=await Promise.all([
   readClient.get(BASE+"/compare/"+mergeSha+"..."+mainSha),
   readClient.get(BASE+"/commits/"+expectedHeadSha+"/check-runs?per_page=100"),
   readClient.get(BASE+"/commits/"+mergeSha+"/check-runs?per_page=100"),
   readClient.get(BASE+"/actions/runs?head_sha="+mergeSha+"&per_page=100")
  ]);
 }catch{return unknown("delivery_proof_read_failed");}
 if(!ok(ancestor)||ancestor.data.base_commit?.sha!==mergeSha||
   ancestor.data.status!=="ahead"&&ancestor.data.status!=="identical"||
   !Number.isSafeInteger(ancestor.data.behind_by)||
   ancestor.data.behind_by!==0)
  return deny("merge_not_ancestor_of_current_main");
 const requiredCheck=successCheck(headChecks,expectedHeadSha);
 const mainCheck=successCheck(mainChecks,mergeSha);
 if(!requiredCheck||!mainCheck)
  return deny("independent_ci_on_exact_shas_missing");
 if(!boundedList(runs,"workflow_runs"))
  return unknown("pages_workflow_runs_incomplete");
 const pagesRuns=runs.data.workflow_runs.filter(r=>
  r.path===".github/workflows/pages.yml"&&r.event==="push"&&
  r.head_branch==="main"&&r.head_sha===mergeSha);
 if(pagesRuns.length!==1)
  return deny("pages_exact_merge_sha_run_missing_or_ambiguous");
 const run=pagesRuns[0];
 if(!Number.isSafeInteger(run.id)||run.id<1||
   run.repository?.full_name!==REPO||run.run_attempt!==1||
   run.status!=="completed"||run.conclusion!=="success")
  return deny("pages_workflow_not_successful");
 let jobs,readback;
 try{
  jobs=await readClient.get(BASE+"/actions/runs/"+run.id+"/jobs?per_page=100");
  readback=await readClient.get(BASE+"/git/ref/heads/main");
 }catch{return unknown("pages_deploy_or_main_readback_failed");}
 if(!boundedList(jobs,"jobs"))
  return unknown("pages_job_list_incomplete");
 const deploys=jobs.data.jobs.filter(j=>j.name==="deploy");
 if(deploys.length!==1||deploys[0].status!=="completed"||
   deploys[0].conclusion!=="success"||
   deploys[0].head_sha!==mergeSha)
  return deny("pages_deploy_job_unverified");
 if(!goodMain(readback)||readback.data.object.sha!==mainSha)
  return unknown("main_ref_moved_during_delivery_observation");

 const proof=Object.freeze({
  prNumber,headSha:expectedHeadSha,mergeSha,merged:true,
  branchProtected:true,requiredCheck,mainCheck,
  pages:{sha:mergeSha,conclusion:"success"}
 });
 return response("delivery_observed_not_authorized",
  "wave_journal_and_writer_must_reverify_before_global_release",{
   proof,proofHash:contentSha256(proof),pagesRunId:String(run.id),
   observedMainSha:mainSha
  });
}
