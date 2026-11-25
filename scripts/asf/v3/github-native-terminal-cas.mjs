/**
 * ASF-V3-022 — unconnected GitHub-native global terminal CAS writer.
 *
 * Offline/mocked transport only until a separate OWNER review explicitly
 * approves a privileged GitHub App runner. No executable CLI, token, secret,
 * workflow, dispatcher, payment or retry belongs to this module.
 *
 * A successful fast-forward is persistence evidence, NEVER paid authority.
 * Caller MUST NOT expose writeTransport to the child agent or model.
 */
import { observeV3GithubTerminalReadiness }
  from "./github-native-terminal-readiness.mjs";
import { replayAdmissionRegistry, advanceAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "./global-admission.mjs";
import { contentSha256 } from "../waves/hash.mjs";

const BASE="repos/cedricmenec/threadstep";
const G_GET=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const G_PATCH=BASE+"/git/refs/heads/asf/control/active-wave-v3";
const REG=BASE+"/contents/registry.json?ref=";
const SHA=/^[0-9a-f]{40}$/;
const WAVE=/^[a-z0-9][a-z0-9._-]{2,63}$/;
const MAX=512*1024;
const outcome=(status,code,details={})=>Object.freeze({
 status,code,authorized:false,canRelease:false,canQuarantine:false,
 canWrite:false,canDispatch:false,canSpend:false,canRetry:false,
 ...details
});
const rejected=code=>outcome("rejected",code);
const unknown=code=>outcome("uncertain",code);
const conflict=code=>outcome("conflict",code);
const refSha=(r,name)=>r?.ok===true&&r.data?.ref===name&&
 r.data.object?.type==="commit"&&SHA.test(r.data.object.sha??"")?
 r.data.object.sha:null;
const commitShape=(d,sha,tree,parent)=>d?.sha===sha&&
 d.tree?.sha===tree&&Array.isArray(d.parents)&&d.parents.length===1&&
 d.parents[0]?.sha===parent;
function pinnedRegistry(r){
 const d=r?.data;
 if(r?.ok!==true||d?.type!=="file"||d.path!=="registry.json"||
   d.encoding!=="base64"||!Number.isSafeInteger(d.size)||
   d.size<2||d.size>MAX||typeof d.content!=="string")
  throw Error("registry_metadata_invalid");
 const enc=d.content.replace(/\s/g,"");
 if(enc.length>Math.ceil(MAX*4/3)+4||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(enc))
  throw Error("registry_base64_invalid");
 const bytes=Buffer.from(enc,"base64");
 if(bytes.length!==d.size||bytes.toString("base64")!==enc)
  throw Error("registry_bytes_invalid");
 return replayAdmissionRegistry(JSON.parse(
  new TextDecoder("utf-8",{fatal:true}).decode(bytes)));
}
function evidenceCompatible(a,b){
 const fields=["kind","waveId","globalHeadSha","waveHeadSha",
  "globalRegistryHash","journalHash","deliveryEvidenceHash",
  "proposedRegistryHash"];
 return fields.every(key=>a[key]===b[key])&&
  contentSha256(a.proposedEvent)===contentSha256(b.proposedEvent);
}
function verifiedTerminal(r){
 return r?.status==="terminal_reconciled_not_authorized"&&
  r.authorized===false&&r.canWrite===false&&r.canSpend===false&&
  r.canRelease===false&&r.canQuarantine===false&&
  r.canRetry===false&&r.evidence;
}
/**
 * A Git Data commit has one parent (the pinned global HEAD), then exactly one
 * PATCH /git/refs/... {force:false}. Sibling commits CANNOT both fast-forward.
 *
 * This does not independently authenticate readClient/writeTransport; only a
 * future reviewed owner-only runner with the installed App ID=5361227, scoped
 * short-lived token, and tested GitHub rulesets can supply that boundary.
 */
export async function attemptV3GithubNativeTerminalCAS({
 readClient,writeTransport,waveId,kind,reason
}={}) {
 if(!WAVE.test(waveId??"")||!["RELEASE","QUARANTINE"].includes(kind))
  return rejected("invalid_terminal_request");
 if(typeof readClient?.get!=="function"||typeof writeTransport!=="function")
  return rejected("terminal_read_or_writer_port_unavailable");
 let initial;
 try {
  initial=await observeV3GithubTerminalReadiness({
   readClient,waveId,kind,reason
  });
 }catch{return unknown("initial_terminal_evidence_unavailable");}
 if(!verifiedTerminal(initial))
  return outcome(initial?.status==="rejected"?"rejected":"uncertain",
   "terminal_not_independently_reconciled");

 const first=initial.evidence, old=first.globalHeadSha;
 const waveRef="refs/heads/asf/waves/"+waveId;
 if(!SHA.test(old)||!SHA.test(first.waveHeadSha)||
   first.kind!==kind||first.waveId!==waveId||
   first.proposedEvent?.type!==kind)
  return rejected("terminal_observation_shape_invalid");
 let registry;
 try{
  registry=pinnedRegistry(await readClient.get(REG+old));
 }catch{return unknown("terminal_pinned_global_registry_unavailable");}
 if(contentSha256(registry)!==first.globalRegistryHash)
  return conflict("terminal_registry_snapshot_diverged");
 let next;
 try{
  next=advanceAdmissionRegistry(registry,first.proposedEvent,registry.revision);
 }catch{return rejected("terminal_ledger_transition_refused");}
 if(contentSha256(next)!==first.proposedRegistryHash)
  return conflict("terminal_proposed_registry_hash_diverged");
 if(next.state!==(kind==="RELEASE"?"AVAILABLE":"QUARANTINED"))
  return rejected("terminal_transition_not_final");

 // Re-run independent GitHub PR/check/Pages proofs and both pinned snapshots
 // immediately before staging. A stale earlier positive result is not enough.
 let latest;
 try{
  latest=await observeV3GithubTerminalReadiness({
   readClient,waveId,kind,reason
  });
 }catch{return unknown("terminal_evidence_second_read_unavailable");}
 if(!verifiedTerminal(latest))
  return unknown("terminal_evidence_changed_before_write");
 if(!evidenceCompatible(first,latest.evidence))
  return conflict("terminal_snapshots_or_proofs_changed");

 let parent;
 try{
  const [beforeG,beforeW,commit]=await Promise.all([
   readClient.get(G_GET),
   readClient.get(BASE+"/git/ref/heads/asf/waves/"+waveId),
   readClient.get(BASE+"/git/commits/"+old)
  ]);
  if(refSha(beforeG,ADMISSION_REGISTRY_REF)!==old||
     refSha(beforeW,waveRef)!==first.waveHeadSha)
   return conflict("terminal_ref_changed_before_git_write");
  if(commit?.ok!==true||commit.data?.sha!==old||
     !SHA.test(commit.data.tree?.sha??""))
   return unknown("terminal_parent_commit_unverified");
  parent=commit.data.tree.sha;
 }catch{return unknown("terminal_prewrite_read_unavailable");}

 const content=JSON.stringify(next,null,2)+"\n";
 if(Buffer.byteLength(content,"utf8")>MAX)
  return rejected("terminal_registry_size_limit");
 let phase="tree";
 const send=async(method,path,body)=>{
  const out=await writeTransport(Object.freeze({
   method,path,body:structuredClone(body)
  }));
  if(out===null||typeof out!=="object"||Array.isArray(out))
   throw Error("invalid_git_response");
  return out;
 };
 try{
  const tree=await send("POST",BASE+"/git/trees",{
   base_tree:parent,tree:[{
    path:"registry.json",mode:"100644",type:"blob",content
   }]
  });
  if(!SHA.test(tree.sha??""))
   return unknown("terminal_tree_unconfirmed");
  phase="commit";
  const commit=await send("POST",BASE+"/git/commits",{
   message:"chore(asf): V3 global "+kind.toLowerCase()+
    " revision "+next.revision,
   tree:tree.sha,parents:[old]
  });
  if(!SHA.test(commit.sha??"")||
     !commitShape(commit,commit.sha,tree.sha,old))
   return unknown("terminal_commit_unconfirmed");

  // GitHub receives ONE and only ONE PATCH. An error might mean it succeeded,
  // so never retry, even after a 409/422, timeout or lost network response.
  phase="patch";
  const patch=await send("PATCH",G_PATCH,{sha:commit.sha,force:false});
  if(patch.ref!==ADMISSION_REGISTRY_REF||
     patch.object?.sha!==commit.sha||
     patch.object?.type!=="commit")
   return unknown("terminal_patch_response_unconfirmed");

  phase="readback";
  const [afterG,afterW,stored,actualCommit]=await Promise.all([
   readClient.get(G_GET),
   readClient.get(BASE+"/git/ref/heads/asf/waves/"+waveId),
   readClient.get(REG+commit.sha),
   readClient.get(BASE+"/git/commits/"+commit.sha)
  ]);
  if(refSha(afterG,ADMISSION_REGISTRY_REF)!==commit.sha||
     refSha(afterW,waveRef)!==first.waveHeadSha||
     actualCommit?.ok!==true||
     !commitShape(actualCommit.data,commit.sha,tree.sha,old)||
     contentSha256(pinnedRegistry(stored))!==contentSha256(next))
   return unknown("terminal_pinned_readback_unconfirmed");
  return outcome("persisted","terminal_global_git_cas_persisted_no_paid_authority",{
   waveId,kind,revision:next.revision,
   oldGlobalSha:old,newGlobalSha:commit.sha,
   waveSha:first.waveHeadSha,
   registryHash:contentSha256(next)
  });
 }catch {
  // Detached tree/commit creation is not authority to claim terminal RELEASE;
  // PATCH might have occurred, so always stop and require manual diagnosis.
  return unknown("terminal_git_response_ambiguous_at_"+phase);
 }
}
