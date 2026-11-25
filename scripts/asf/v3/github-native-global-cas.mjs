/**
 * ASF V3 — GitHub-native global ADMIT writer with fast-forward Git Data CAS.
 *
 * No Ed25519, no external root, no run dispatch and no paid API.
 * This is an UNCONNECTED integration port, not an owner authentication layer:
 * ownerContext MUST be captured by the trusted owner-only runner, while the
 * writeTransport MUST be scoped to the global ref and never agent-accessible.
 *
 * A successful Git write is NOT permission to spend. No paid retries.
 */
import { replayAdmissionRegistry, advanceAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "./global-admission.mjs";
import { observeV3GithubNativeControl } from "./github-native-control.mjs";
import { contentSha256 } from "../waves/hash.mjs";

const BASE = "repos/cedricmenec/threadstep";
const REF_GET = BASE + "/git/ref/heads/asf/control/active-wave-v3";
const REF_PATCH = BASE + "/git/refs/heads/asf/control/active-wave-v3";
const REGISTRY = BASE + "/contents/registry.json?ref=";
const SHA = /^[a-f0-9]{40}$/;
const MAX_BYTES = 512 * 1024;
const response = (status, code, info={})=>Object.freeze({
 status, code, authorized:false, canDispatch:false, canSpend:false,
 canRetry:false, ...info
});
const reject = code=>response("rejected",code);
const uncertain = code=>response("uncertain",code);
const conflict = code=>response("conflict",code);

function decodePinnedFile(data) {
 if (data?.type!=="file" || data.path!=="registry.json" ||
   data.encoding!=="base64" || !Number.isSafeInteger(data.size) ||
   data.size<2 || data.size>MAX_BYTES || typeof data.content!=="string")
   throw new Error("registry_invalid");
 const raw=data.content.replace(/\s/g,"");
 if (raw.length>Math.ceil(MAX_BYTES*4/3)+4 ||
   !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw))
   throw new Error("registry_encoding");
 const buf=Buffer.from(raw,"base64");
 if(buf.length!==data.size ||buf.toString("base64")!==raw)
   throw new Error("registry_encoding");
 return replayAdmissionRegistry(JSON.parse(
  new TextDecoder("utf-8",{fatal:true}).decode(buf)));
}
/**
 * All Git writes constrained to three exact REST endpoints. The GitHub App
 * token and global ref protection must be reviewed outside this prototype.
 */
export async function attemptV3GithubNativeAdmission({
 manifest, ownerContext, readClient, writeTransport
}={}) {
 if(typeof readClient?.get!=="function" ||
    typeof writeTransport!=="function")
   return reject("trusted_adapters_missing");
 const observed=await observeV3GithubNativeControl({
  manifest,ownerContext,readClient
 });
 if(observed.status!=="consistent_not_authorized")
   return response(observed.status,"native_owner_control_not_verified");

 const head=observed.evidence.headSha;
 let registry;
 try{
  const file=await readClient.get(REGISTRY+head);
  if(!file?.ok) return uncertain("registry_pinned_read_failed");
  registry=decodePinnedFile(file.data);
 }catch{return reject("registry_pinned_replay_invalid");}
 if(contentSha256(registry)!==observed.evidence.registryHash ||
    registry.revision!==observed.evidence.registryRevision)
   return conflict("global_snapshot_changed");
 let next;
 try{
  next=advanceAdmissionRegistry(registry,{
   type:"ADMIT",claim:{
    waveId:manifest.waveId,manifestHash:observed.evidence.manifestHash,
    ownerRunId:manifest.authorization.runId,
    originSha:manifest.backlogCommit
   }
  },registry.revision);
 }catch{return reject("global_wave_admission_blocked");}
 const data=JSON.stringify(next,null,2)+"\n";
 if(Buffer.byteLength(data,"utf8")>MAX_BYTES)
   return reject("global_registry_size_limit");

 let stage="prewrite";
 const send=async(method,path,body)=>{
  const r=await writeTransport({method,path,body:structuredClone(body)});
  if(!r ||typeof r!=="object"||Array.isArray(r))
   throw new Error("git_response_invalid");
  return r;
 };
 try{
  const before=await readClient.get(REF_GET);
  if(!before?.ok ||before.data?.ref!==ADMISSION_REGISTRY_REF ||
      before.data?.object?.type!=="commit" ||before.data.object.sha!==head)
    return conflict("global_ref_changed_before_commit");
  const parent=await readClient.get(BASE+"/git/commits/"+head);
  if(!parent?.ok ||parent.data?.sha!==head ||
      !SHA.test(parent.data.tree?.sha??""))
    return uncertain("global_parent_commit_unavailable");
  stage="tree";
  const tree=await send("POST",BASE+"/git/trees",{
   base_tree:parent.data.tree.sha,tree:[{
    path:"registry.json",mode:"100644",type:"blob",content:data
   }]
  });
  if(!SHA.test(tree.sha??""))return uncertain("global_tree_unconfirmed");
  stage="commit";
  const commit=await send("POST",BASE+"/git/commits",{
   message:"chore(asf): V3 GitHub-native global admission revision "+next.revision,
   tree:tree.sha,parents:[head]
  });
  if(!SHA.test(commit.sha??"")||commit.tree?.sha!==tree.sha ||
     !Array.isArray(commit.parents)||commit.parents.length!==1 ||
     commit.parents[0]?.sha!==head)
    return uncertain("global_commit_unconfirmed");
  stage="patch";
  const patch=await send("PATCH",REF_PATCH,{
   sha:commit.sha,force:false
  });
  if(patch.ref!==ADMISSION_REGISTRY_REF ||
     patch.object?.sha!==commit.sha ||
     patch.object?.type!=="commit")
    return uncertain("global_patch_unconfirmed");
  stage="readback";
  const check=await readClient.get(REF_GET);
  if(!check?.ok ||check.data?.ref!==ADMISSION_REGISTRY_REF ||
     check.data.object?.sha!==commit.sha)
    return uncertain("global_ref_readback_unconfirmed");
  const saved=await readClient.get(REGISTRY+commit.sha);
  if(!saved?.ok ||
     contentSha256(decodePinnedFile(saved.data))!==contentSha256(next))
    return uncertain("global_registry_readback_unconfirmed");
  return response("persisted","native_global_admit_persisted_no_paid_authority",{
   waveId:manifest.waveId,headSha:commit.sha,revision:next.revision
  });
 }catch{
  // A lost response after POST/PATCH may mean the write happened. Never retry.
  return uncertain("global_git_response_uncertain_at_"+stage);
 }
}
