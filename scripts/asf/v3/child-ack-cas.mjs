/**
 * ASF V3-024 — controller-side ACK_CHILD persistence adapter (UNCONNECTED).
 *
 * No production write transport, credential, workflow hook or paid action.
 * The only possible mutation is through an injected, separately reviewed Git
 * port, scoped to refs/heads/asf/waves/<waveId> (NEVER the global registry).
 *
 * Mockable child runner/event is not authentication. A future trusted
 * controller must capture/verify native GitHub provenance and App scopes.
 */
import { observeV3GithubChildAckReadiness }
 from "./child-ack-readiness.mjs";
import { loadV3TrustedSnapshot,createV3WaveReadPort }
 from "./trusted-snapshot.mjs";
import { assertV3Manifest,reconstructV3Journal,advanceV3 }
 from "./lifecycle.mjs";
import { commitV3JournalCAS } from "./git-cas.mjs";
import { canonicalize,contentSha256 } from "../waves/hash.mjs";

const REPO="cedricmenec/threadstep";
const SHA=/^[a-f0-9]{40}$/;
const noAuthority=(status,code,details={})=>Object.freeze({
 status,code,authorized:false,canAck:false,canClaim:false,
 canWrite:false,canDispatch:false,canSpend:false,canRetry:false,
 ...details
});
const uncertain=code=>noAuthority("uncertain",code);
const rejected=code=>noAuthority("rejected",code);
const conflict=code=>noAuthority("conflict",code);
const validProof=r=>r?.status==="child_ack_candidate_not_authorized"&&
 r.authorized===false&&r.canAck===false&&r.canClaim===false&&
 r.canSpend===false&&r.canRetry===false&&r.evidence&&
 SHA.test(r.evidence.reservationSha??"")&&
 SHA.test(r.evidence.globalHeadSha??"")&&
 r.evidence.proposedAckEvent?.type==="ACK_CHILD";
const validators=Object.freeze({
 verifyManifest(m){assertV3Manifest(m);return m.repository===REPO;},
 replayJournal:reconstructV3Journal
});
const sameEvidence=(a,b)=>[
 "waveId","taskId","reservationSha","childRunId",
 "journalHash","globalHeadSha","globalRegistryHash","manifestHash"
].every(k=>a[k]===b[k])&&
 canonicalize(a.proposedAckEvent)===canonicalize(b.proposedAckEvent);
/**
 * Duplicates/stale ACKs MUST NOT be retried even when the first Git PATCH
 * might have committed but its response was lost. Return uncertain always.
 */
export async function attemptV3GithubChildAckCAS({
 runner,event,readClient,waveGitPort
}={}) {
 if(typeof readClient?.get!=="function"||!waveGitPort)
  return rejected("child_ack_ports_missing");
 let first;
 try{first=await observeV3GithubChildAckReadiness({
  runner,event,readClient
 });}catch{return uncertain("child_ack_observer_unavailable");}
 if(!validProof(first))
  return noAuthority(first?.status==="rejected"?"rejected":"uncertain",
   "child_ack_not_independently_observed");
 const a=first.evidence;
 let snapshot;
 try{
  snapshot=await loadV3TrustedSnapshot(
   createV3WaveReadPort(readClient,REPO),a.waveId,validators);
 }catch{return uncertain("child_ack_pinned_wave_unavailable");}
 if(snapshot?.status!=="verified_snapshot"||
   snapshot.headSha!==a.reservationSha||
   contentSha256(snapshot.journal)!==a.journalHash||
   contentSha256(snapshot.manifest)!==a.manifestHash)
  return conflict("child_ack_journal_or_manifest_changed");
 let advanced;
 try{
  advanced=advanceV3(snapshot.manifest,snapshot.journal,
   a.proposedAckEvent,snapshot.journal.revision);
 }catch{return rejected("child_ack_wave_transition_refused");}
 if(advanced.status!=="CHILD_ACKNOWLEDGED"||
    advanced.active?.childRunId!==a.childRunId)
  return rejected("child_ack_transition_not_bound_to_child");

 // Re-run exact GitHub run, ruleset, global admission, journal and ref
 // verification immediately before the single commit/PATCH attempt.
 let second;
 try{second=await observeV3GithubChildAckReadiness({
  runner,event,readClient
 });}catch{return uncertain("child_ack_second_observation_unavailable");}
 if(!validProof(second)||!sameEvidence(a,second.evidence))
  return conflict("child_ack_evidence_changed_before_cas");

 // commitV3JournalCAS requires a complete replay and a single-parent Git
 // fast-forward. It does not retry after any ambiguous result.
 let saved;
 try{
  saved=await commitV3JournalCAS(waveGitPort,{
   waveId:a.waveId,expectedHeadSha:a.reservationSha,
   journal:advanced,
   validateJournal:j=>{
    try{
     const replayed=reconstructV3Journal(snapshot.manifest,j);
     return canonicalize(replayed)===canonicalize(advanced);
    }catch{return false;}
   }
  });
 }catch{return uncertain("child_ack_git_cas_exception");}
 if(saved?.status!=="persisted")
  return noAuthority(saved?.status==="conflict"?"conflict":
   saved?.status==="rejected"?"rejected":"uncertain",
   "child_ack_git_cas_not_confirmed");
 if(!SHA.test(saved.newHeadSha??""))
  return uncertain("child_ack_git_cas_sha_unconfirmed");

 // Independently pinned wave contents read after CAS. A mere matching
 // branch SHA or fake ACK status is not sufficient for a claimed write.
 let after;
 try{
  after=await loadV3TrustedSnapshot(
   createV3WaveReadPort(readClient,REPO),a.waveId,validators);
 }catch{return uncertain("child_ack_git_readback_unavailable");}
 if(after?.status!=="verified_snapshot"||
  after.headSha!==saved.newHeadSha||
  contentSha256(after.manifest)!==a.manifestHash||
  contentSha256(after.journal)!==contentSha256(advanced)||
  after.journal.status!=="CHILD_ACKNOWLEDGED"||
  after.journal.active?.childRunId!==a.childRunId)
  return uncertain("child_ack_git_readback_not_verified");
 return noAuthority("persisted","child_ack_persisted_no_child_claim_or_paid_authority",{
  waveId:a.waveId,taskId:a.taskId,childRunId:a.childRunId,
  previousWaveSha:a.reservationSha,
  newWaveSha:saved.newHeadSha,
  journalHash:contentSha256(advanced)
 });
}
