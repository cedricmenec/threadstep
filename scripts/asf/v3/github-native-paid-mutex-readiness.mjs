/**
 * ASF V3-025 — read-only shared V1/V3 paid mutex policy evidence.
 *
 * GitHub Actions concurrency groups are repository-wide. V3's FUTURE paid
 * job must use the SAME job-scoped literal group as all three V1 paid jobs.
 * A V3 controller / preflight must never take the paid-job group itself.
 *
 * This is an intentionally narrow, conservative YAML shape check, NOT a YAML
 * parser or an authorizer. CI actionlint remains mandatory. The owner runner
 * must independently pin both the source SHA and its checked-out YAML.
 * No dispatch, App token, OpenRouter secret, paid workflow or write happens.
 */
export const ASF_V3_SHARED_PAID_MUTEX="threadstep-paid-development-v1";
export const ASF_V3_PAID_JOB_NAME="paid-development";
const BASE="repos/cedricmenec/threadstep",MAIN=BASE+"/git/ref/heads/main";
const SHA=/^[a-f0-9]{40}$/,MAX=256*1024;
const names=Object.freeze([
 ".github/workflows/agent-openspec.yml",
 ".github/workflows/agent-asf.yml",
 ".github/workflows/agent.yml"
]);
const outcome=(status,reason,evidence=null)=>Object.freeze({
 status,reason,authorized:false,canStartPaid:false,canPay:false,
 canWrite:false,canDispatch:false,canSpend:false,canRetry:false,
 evidence:evidence===null?null:Object.freeze(evidence)
});
const deny=x=>outcome("rejected",x),unknown=x=>outcome("uncertain",x);
const getSha=r=>r?.ok===true&&r.data?.ref==="refs/heads/main"&&
 r.data.object?.type==="commit"&&SHA.test(r.data.object.sha??"")?
 r.data.object.sha:null;
function content(r,path){
 const d=r?.data;
 if(r?.ok!==true||d?.type!=="file"||d.path!==path||
    d.encoding!=="base64"||typeof d.content!=="string"||
    !Number.isSafeInteger(d.size)||d.size<1||d.size>MAX)
  throw Error("workflow_file_unavailable");
 const enc=d.content.replace(/\s/g,"");
 if(enc.length>Math.ceil(MAX*4/3)+4||
  !/^(?:[a-zA-Z0-9+/]{4})*(?:[a-zA-Z0-9+/]{2}==|[a-zA-Z0-9+/]{3}=)?$/.test(enc))
  throw Error("invalid_workflow_encoding");
 const buf=Buffer.from(enc,"base64");
 if(buf.length!==d.size||buf.toString("base64")!==enc)
  throw Error("invalid_workflow_bytes");
 return new TextDecoder("utf-8",{fatal:true}).decode(buf);
}
/** Conservative indent-bound job extractor for audited repository YAML. */
function jobBlock(yaml,jobId){
 if(typeof yaml!=="string"||Buffer.byteLength(yaml)>MAX||
    !/^[a-z][a-z0-9_-]{1,60}$/.test(jobId)||
    /\t|\r/.test(yaml))
  return null;
 const lines=yaml.split("\n");
 const root=lines.flatMap((l,i)=>/^jobs:\s*$/.test(l)?[i]:[]);
 if(root.length!==1)return null;
 const jobs=[];
 for(let i=root[0]+1;i<lines.length;i++){
  const line=lines[i];
  if(line&&!line.startsWith(" ")&&!line.startsWith("#"))break;
  const m=/^  ([a-z][a-z0-9_-]*):(?:\s*#.*)?$/.exec(line);
  if(m)jobs.push({id:m[1],start:i});
 }
 if(jobs.some((x,i)=>jobs.findIndex(y=>y.id===x.id)!==i))
  return null;
 const j=jobs.find(x=>x.id===jobId);
 if(!j)return null;
 const following=jobs.find(x=>x.start>j.start);
 return lines.slice(j.start,following?following.start:lines.length);
}
function paidJobLock(yaml,jobId){
 const body=jobBlock(yaml,jobId);
 if(!body)return false;
 const c=body.flatMap((line,i)=>/^    concurrency:\s*$/.test(line)?[i]:[]);
 if(c.length!==1)return false;
 let sub=[];
 for(let i=c[0]+1;i<body.length;i++){
  if(/^    \S/.test(body[i])||/^  \S/.test(body[i]))break;
  sub.push(body[i]);
 }
 const effective=sub.filter(l=>/^\s*\S/.test(l)&&!/^\s*#/.test(l));
 return effective.length===2&&
   effective.includes("      group: "+ASF_V3_SHARED_PAID_MUTEX)&&
   effective.includes("      cancel-in-progress: false");
}
/**
 * Returns policy structure only; caller-supplied text cannot authorize spend.
 * The V3 child-preflight must NOT lock the paid group, since doing so could
 * block V1 while awaiting an ACK or a controller continuation.
 */
export function inspectV3SharedPaidMutexLayout({v1,v3}={}){
 if(!v1||typeof v1!=="object"||Array.isArray(v1)||
   !names.every(p=>typeof v1[p]==="string")||
   typeof v3!=="string")
  return deny("mutex_workflow_sources_missing");
 for(const path of names){
  // OpenSpec's paid job is named staged-development; the other two use
  // develop. Compare the actual charged job, not a guessed common label.
  const jobId=path.endsWith("/agent-openspec.yml")?
    "staged-development":"develop";
  if(!paidJobLock(v1[path],jobId))
   return deny("v1_paid_job_lock_mismatched_or_missing");
 }
 if(jobBlock(v3,"child-preflight")===null)
  return deny("v3_child_preflight_missing");
 if(paidJobLock(v3,"child-preflight")||
   (jobBlock(v3,"child-preflight")||[])
     .some(line=>line.includes(ASF_V3_SHARED_PAID_MUTEX)))
  return deny("v3_nonpaid_preflight_holds_paid_lock");
 const paid=jobBlock(v3,ASF_V3_PAID_JOB_NAME);
 if(paid!==null){
  if(!paidJobLock(v3,ASF_V3_PAID_JOB_NAME))
   return deny("v3_paid_job_does_not_share_v1_mutex");
  // This is a source contract only; the real paid job is not deployed.
  return outcome("source_layout_observed_not_authorized",
   "protected_owner_review_and_full_paid_preflight_still_required",{
    group:ASF_V3_SHARED_PAID_MUTEX,v1PaidJobs:3,
    v3PaidJobDeclared:true
   });
 }
 return outcome("v1_lock_confirmed_v3_paid_job_absent",
  "no_v3_paid_job_may_start",{
   group:ASF_V3_SHARED_PAID_MUTEX,v1PaidJobs:3,
   v3PaidJobDeclared:false
  });
}
/**
 * Compare source at a PINNED protected main commit; any main movement,
 * truncated/malformed GitHub contents response, or altered V1 mutex denies.
 */
export async function observeV3GithubSharedPaidMutex({
 readClient,expectedMainSha,v3Workflow
}={}){
 if(!SHA.test(expectedMainSha??"")||typeof v3Workflow!=="string")
  return deny("invalid_mutex_observation_input");
 if(typeof readClient?.get!=="function")
  return unknown("mutex_github_reader_missing");
 let first;
 try{first=await readClient.get(MAIN);}
 catch{return unknown("main_ref_unavailable_for_mutex");}
 if(getSha(first)!==expectedMainSha)
  return unknown("main_sha_not_pinned_for_mutex");
 const v1={};
 try{
  for(const p of names)
   v1[p]=content(await readClient.get(BASE+"/contents/"+p+
    "?ref="+expectedMainSha),p);
 }catch{return unknown("pinned_v1_workflow_file_unavailable");}
 const layout=inspectV3SharedPaidMutexLayout({v1,v3:v3Workflow});
 if(layout.status==="rejected")return layout;
 let after;
 try{after=await readClient.get(MAIN);}
 catch{return unknown("main_ref_readback_unavailable_for_mutex");}
 if(getSha(after)!==expectedMainSha)
  return unknown("main_moved_during_mutex_verification");
 return outcome(layout.status,layout.reason,{
  ...layout.evidence,observedMainSha:expectedMainSha,
  sourcePaths:Object.freeze([...names])
 });
}
