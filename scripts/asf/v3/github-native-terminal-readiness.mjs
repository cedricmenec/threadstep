/**
 * ASF-V3-015 — Read-only terminal evidence reconciliation against pinned Git.
 *
 * Never accepts an arbitrary journal, manifest or delivery hash from a caller.
 * GitHub snapshots and delivery records are read independently, replayed and
 * rechecked; no UPDATE/PATCH, no token, no release and no paid side effect.
 *
 * A positive observation remains NON-AUTHORIZING. A separate owner-reviewed
 * controller must still do independent latest-ref verification and CAS.
 */
import { observeV3GithubRulesetPolicy } from "./github-native-control.mjs";
import { observeV3GithubDelivery } from "./github-native-delivery-observer.mjs";
import { inspectV3GithubTerminalCandidate } from "./global-terminal-evidence.mjs";
import { createV3WaveReadPort, loadV3TrustedSnapshot }
  from "./trusted-snapshot.mjs";
import { assertV3Manifest, reconstructV3Journal } from "./lifecycle.mjs";
import { replayAdmissionRegistry, ADMISSION_REGISTRY_REF }
  from "./global-admission.mjs";
import { canonicalize, contentSha256 } from "../waves/hash.mjs";

const BASE="repos/cedricmenec/threadstep";
const REPO="cedricmenec/threadstep";
const SHA=/^[a-f0-9]{40}$/;
const WAVE=/^[a-z0-9][a-z0-9._-]{2,63}$/;
const MAX_BYTES=512*1024;
const G_REF=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const gate=(status,reason,evidence=null)=>Object.freeze({
  status,reason,authorized:false,canRelease:false,canQuarantine:false,
  canWrite:false,canDispatch:false,canSpend:false,canRetry:false,
  evidence:evidence===null?null:Object.freeze(evidence)
});
const deny=x=>gate("rejected",x);
const unknown=x=>gate("uncertain",x);
const pinnedRef=(r,ref)=>r?.ok===true&&r.data?.ref===ref&&
  r.data.object?.type==="commit"&&SHA.test(r.data.object.sha??"") ?
  r.data.object.sha : null;
function pinnedJSON(r,path) {
 const d=r?.data;
 if(!r?.ok||d?.type!=="file"||d.path!==path||
  d.encoding!=="base64"||typeof d.content!=="string"||
  !Number.isSafeInteger(d.size)||d.size<2||d.size>MAX_BYTES)
  throw Error("bad_file");
 const data=d.content.replace(/\s/g,"");
 if(data.length>Math.ceil(MAX_BYTES*4/3)+4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data))
  throw Error("bad_base64");
 const buf=Buffer.from(data,"base64");
 if(buf.length!==d.size||buf.toString("base64")!==data)
  throw Error("bad_bytes");
 return JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(buf));
}
const validators=Object.freeze({
 verifyManifest(manifest) {
  assertV3Manifest(manifest);
  return manifest.repository===REPO;
 },
 replayJournal:reconstructV3Journal
});
export async function observeV3GithubTerminalReadiness({
 readClient,waveId,kind,reason
}={}) {
 if(!WAVE.test(waveId??"")||!["RELEASE","QUARANTINE"].includes(kind))
  return deny("invalid_terminal_request");
 if(typeof readClient?.get!=="function")
  return unknown("github_read_client_missing");
 const rules=await observeV3GithubRulesetPolicy(readClient);
 if(rules.status!=="structurally_consistent")
  return gate(rules.status,"github_global_rules_unconfirmed");
 let global,readSnapshot;
 try {
  global=await readClient.get(G_REF);
  readSnapshot=await loadV3TrustedSnapshot(
   createV3WaveReadPort(readClient,REPO),waveId,validators);
 } catch { return unknown("terminal_git_snapshot_unavailable"); }
 const globalSha=pinnedRef(global,ADMISSION_REGISTRY_REF);
 if(!globalSha||readSnapshot.status!=="verified_snapshot")
  return unknown("terminal_git_snapshot_unavailable");
 const waveRef="refs/heads/asf/waves/"+waveId;
 let currentRegistry;
 try {
  const raw=await readClient.get(BASE+"/contents/registry.json?ref="+globalSha);
  currentRegistry=replayAdmissionRegistry(pinnedJSON(raw,"registry.json"));
 } catch { return deny("global_registry_replay_invalid"); }
 const {manifest,journal,headSha:waveSha}=readSnapshot;
 let evidenceItems=[];
 if(kind==="RELEASE") {
  const del=journal.events.filter(x=>x.type==="DELIVERED");
  if(del.length!==journal.delivered||del.length>manifest.limits.maxTaskStarts)
   return deny("delivery_event_count_invalid");
  const usedPRs=new Set();
  for(const event of del) {
   const p=event.proof;
   if(!Number.isSafeInteger(p?.prNumber)||p.prNumber<1 ||
      !SHA.test(p.headSha??"")||usedPRs.has(p.prNumber))
    return deny("delivery_events_not_unique_or_pinned");
   usedPRs.add(p.prNumber);
   let check;
   try{ check=await observeV3GithubDelivery({
     readClient,prNumber:p.prNumber,expectedHeadSha:p.headSha
    }); }
   catch{ return unknown("delivery_observer_failed"); }
   if(check.status!=="delivery_observed_not_authorized"||
      canonicalize(check.evidence?.proof)!==canonicalize(p))
    return gate(check.status==="uncertain"?"uncertain":"rejected",
      "pinned_journal_delivery_not_independently_verified");
   evidenceItems.push(check.evidence.proofHash);
  }
  if(journal.delivered>0&&evidenceItems.length===0)
   return deny("missing_delivery_evidence");
 }
 // Even COMPLETE_NO_WORK needs the full owner-bound Git replay and CAS;
 // a valid absence of PR is not sufficient by itself to RELEASE.
 const deliveryEvidenceHash=contentSha256({
  waveId,manifestHash:contentSha256(manifest),
  journalHash:contentSha256(journal),proofHashes:evidenceItems
 });
 const decision=inspectV3GithubTerminalCandidate({
  registry:currentRegistry,manifest,journal,
  globalHeadSha:globalSha,waveHeadSha:waveSha,
  kind,reason:kind==="RELEASE"?"nominal_delivery":reason,
  deliveryEvidenceHash:kind==="RELEASE"?deliveryEvidenceHash:undefined
 });
 if(decision.status!=="consistent_not_authorized")
  return deny("terminal_transition_refused");
 let globalAfter,waveAfter;
 try{
  [globalAfter,waveAfter]=await Promise.all([
   readClient.get(G_REF),
   readClient.get(BASE+"/git/ref/heads/asf/waves/"+waveId)
  ]);
 }catch{return unknown("terminal_ref_readback_unavailable");}
 if(pinnedRef(globalAfter,ADMISSION_REGISTRY_REF)!==globalSha ||
   pinnedRef(waveAfter,waveRef)!==waveSha)
  return unknown("terminal_ref_changed_during_observation");
 return gate("terminal_reconciled_not_authorized",
  "owner_scoped_terminal_writer_and_global_cas_still_required",{
   kind,waveId,globalHeadSha:globalSha,waveHeadSha:waveSha,
   globalRegistryHash:contentSha256(currentRegistry),
   journalHash:contentSha256(journal),deliveryEvidenceHash:
    kind==="RELEASE"?deliveryEvidenceHash:null,
   proposedEvent:decision.evidence.proposedEvent,
   proposedRegistryHash:decision.evidence.proposedRegistryHash
  });
}
