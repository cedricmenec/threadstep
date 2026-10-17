/**
 * ASF V3-024: isolated Git CAS writer for native ACK_CHILD / CLAIM_CHILD.
 * No live token, workflows, payment, or retry. Injected transports are mocks
 * until a separately approved controller App writer is independently audited.
 */
import { observeV3GithubChildAckReadiness,
 observeV3GithubChildClaimReadiness } from "./child-ack-readiness.mjs";
import { createV3WaveReadPort,loadV3TrustedSnapshot }
 from "./trusted-snapshot.mjs";
import { assertV3Manifest,reconstructV3Journal,advanceV3 }
 from "./lifecycle.mjs";
import { commitV3JournalCAS } from "./git-cas.mjs";
import { contentSha256,canonicalize } from "../waves/hash.mjs";
import { ADMISSION_REGISTRY_REF } from "./global-admission.mjs";
const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const SHA=/^[0-9a-f]{40}$/,WAVE=/^[a-z0-9][a-z0-9._-]{2,63}$/;
const no=(status,code,evidence=null)=>Object.freeze({status,code,
 authorized:false,canAck:false,canClaim:false,canWrite:false,
 canDispatch:false,canSpend:false,canRetry:false,evidence});
const validators=Object.freeze({
 verifyManifest:m=>{assertV3Manifest(m);return m.repository===REPO;},
 replayJournal:reconstructV3Journal
});
const pin=(r,ref)=>r?.ok===true&&r.data?.ref===ref&&
 r.data.object?.type==="commit"&&SHA.test(r.data.object.sha??"")?
 r.data.object.sha:null;
const validPort=p=>p&&["getRef","getCommit","createTree","createCommit",
 "updateRef"].every(k=>typeof p[k]==="function");
const observe=(phase,input)=>phase==="ACK"?
 observeV3GithubChildAckReadiness(input):
 observeV3GithubChildClaimReadiness(input);
const matching=(r,phase,runner,event)=>r?.status===
 (phase==="ACK"?"child_ack_candidate_not_authorized":
 "child_claim_candidate_not_authorized")&&r.authorized===false&&
 r.canWrite===false&&r.canSpend===false&&r.canRetry===false&&
 r.evidence?.waveId===event.inputs.wave_id&&
 r.evidence?.taskId===event.inputs.task_id&&
 r.evidence?.childRunId===runner.runId&&
 r.evidence?.reservationSha===event.inputs.reservation_sha&&
 SHA.test(r.evidence?.waveHeadSha??"")&&
 SHA.test(r.evidence?.globalHeadSha??"")&&
 r.evidence?.proposedEvent?.type===
 (phase==="ACK"?"ACK_CHILD":"CLAIM_CHILD");
const compare=(a,b)=>["waveId","taskId","reservationSha",
 "waveHeadSha","journalHash","globalHeadSha","globalRegistryHash",
 "manifestHash","childRunId"].every(k=>a[k]===b[k])&&
 canonicalize(a.proposedEvent)===canonicalize(b.proposedEvent);
export async function attemptV3GithubChildWaveCAS({
 phase,runner,event,readClient,gitPort
}={}){
 if(!["ACK","CLAIM"].includes(phase)||
   !WAVE.test(event?.inputs?.wave_id??""))
  return no("rejected","invalid_child_wave_transition");
 if(typeof readClient?.get!=="function"||!validPort(gitPort))
  return no("rejected","trusted_ports_missing");
 const waveId=event.inputs.wave_id,input={runner,event,readClient};
 let first;
 try{first=await observe(phase,input);}
 catch{return no("uncertain","initial_child_evidence_unavailable");}
 if(!matching(first,phase,runner,event))
  return no(first?.status==="rejected"?"rejected":"uncertain",
    "child_evidence_not_verified");
 const e=first.evidence;
 let snapshot;
 try{snapshot=await loadV3TrustedSnapshot(
  createV3WaveReadPort(readClient,REPO),waveId,validators);}
 catch{return no("uncertain","pinned_wave_snapshot_unavailable");}
 if(snapshot.status!=="verified_snapshot"||
    snapshot.headSha!==e.waveHeadSha||
    contentSha256(snapshot.manifest)!==e.manifestHash||
    contentSha256(snapshot.journal)!==e.journalHash)
  return no("conflict","wave_snapshot_moved");
 let next;
 try{next=advanceV3(snapshot.manifest,snapshot.journal,
    e.proposedEvent,snapshot.journal.revision);}
 catch{return no("rejected","wave_event_replay_refused");}
 if(next.status!==(phase==="ACK"?"CHILD_ACKNOWLEDGED":"EXECUTING")||
   next.active?.childRunId!==runner.runId)
  return no("rejected","wave_transition_target_invalid");
 let second;
 try{second=await observe(phase,input);}
 catch{return no("uncertain","second_child_evidence_unavailable");}
 if(!matching(second,phase,runner,event))
  return no("uncertain","child_evidence_changed_before_write");
 if(!compare(e,second.evidence))
  return no("conflict","child_evidence_diverged");
 let written;
 try{written=await commitV3JournalCAS(gitPort,{
   waveId,expectedHeadSha:e.waveHeadSha,journal:next,
   validateJournal:j=>canonicalize(
    reconstructV3Journal(snapshot.manifest,j))===canonicalize(next)
  });}
 catch{return no("uncertain","git_port_failed");}
 if(written?.status!=="persisted"||written.ok!==true||
   !SHA.test(written.newHeadSha??"")||
   written.ref!=="refs/heads/asf/waves/"+waveId||
   written.revision!==next.revision)
  return no(written?.status==="conflict"?"conflict":"uncertain",
   "wave_git_cas_not_confirmed");
 try{
  const [saved,g,main]=await Promise.all([
   loadV3TrustedSnapshot(createV3WaveReadPort(readClient,REPO),
    waveId,validators),
   readClient.get(BASE+"/git/ref/heads/asf/control/active-wave-v3"),
   readClient.get(BASE+"/git/ref/heads/main")
  ]);
  if(saved.status!=="verified_snapshot"||
     saved.headSha!==written.newHeadSha||
     contentSha256(saved.journal)!==contentSha256(next)||
     contentSha256(saved.manifest)!==e.manifestHash||
     pin(g,ADMISSION_REGISTRY_REF)!==e.globalHeadSha||
     pin(main,"refs/heads/main")!==runner.sha)
   return no("uncertain","pinned_wave_readback_unconfirmed");
 }catch{return no("uncertain","pinned_wave_readback_failed");}
 return no("persisted_simulation","child_cas_persisted_no_paid_authority",
  Object.freeze({phase,waveId,taskId:e.taskId,childRunId:runner.runId,
   previousWaveSha:e.waveHeadSha,newWaveSha:written.newHeadSha,
   journalHash:contentSha256(next),globalSha:e.globalHeadSha}));
}
