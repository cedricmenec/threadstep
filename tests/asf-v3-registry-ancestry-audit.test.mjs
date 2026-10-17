import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createAdmissionRegistry, advanceAdmissionRegistry,
  ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import { v3AdmissionPermitSigningPayload } from "../scripts/asf/v3/signed-global-admission.mjs";
import {
  auditV3AnchoredGlobalRegistry, v3PublicKeyFingerprint
} from "../scripts/asf/v3/registry-ancestry-audit.mjs";

const REPO = "cedricmenec/threadstep";
const BASE = "repos/" + REPO;
const sha = c => c.repeat(40);
const SOURCE = sha("1"), ROOT = sha("2"), HEAD = sha("3");
const treeRoot = sha("4"), treeChild = sha("5");
const c = () => ({
  waveId: "wave-root-010", manifestHash: "a".repeat(64),
  ownerRunId: "45001", originSha: SOURCE
});
function fixture({ admitted = true, changedRef = false,
  missingWitness = false, forgedUnsigned = false,
  maliciousRoot = false, extraCommit = false } = {}) {
  const keys = generateKeyPairSync("ed25519");
  const claim = c();
  const p = {
    version: 1, purpose: "asf-v3-admit-one-wave",
    repository: REPO, registryRef: ADMISSION_REGISTRY_REF, ...claim
  };
  const permit = {
    payload: p,
    signature: sign(null, v3AdmissionPermitSigningPayload(p), keys.privateKey)
      .toString("base64")
  };
  const registry = createAdmissionRegistry();
  const admittedRegistry = advanceAdmissionRegistry(registry,
    {type:"ADMIT", claim}, 0);
  const registryRoot = maliciousRoot ? admittedRegistry : registry;
  const registryHead = forgedUnsigned ? registry :
    admittedRegistry;
  const docs = new Map([
    [ROOT, { "registry.json": registryRoot }],
    [HEAD, { "registry.json": registryHead,
      ...(missingWitness ? {} : {
        "admission-evidence/wave-root-010.json": permit
      }) }]
  ]);
  const commits = new Map([
    [ROOT, { sha:ROOT, tree:{sha:treeRoot}, parents:[{sha:SOURCE}] }],
    [HEAD, { sha:HEAD, tree:{sha:treeChild}, parents:[{sha:ROOT}] }]
  ]);
  if(extraCommit) {
    commits.set(sha("6"), {sha:sha("6"),tree:{sha:treeChild},
      parents:[{sha:HEAD}]});
    docs.set(sha("6"), {...docs.get(HEAD)});
  }
  const realHead = extraCommit ? sha("6") : admitted ? HEAD : ROOT;
  const calls = [];
  const get = async path => {
    calls.push(path);
    if(path===BASE+"/git/ref/heads/asf/control/active-wave-v3") {
      return {ok:true,data:{
        ref:ADMISSION_REGISTRY_REF,
        object:{type:"commit", sha:changedRef && calls.length > 4 ? ROOT : realHead}
      }};
    }
    if(path.startsWith(BASE+"/git/commits/")) {
      const id=path.slice((BASE+"/git/commits/").length);
      if(!commits.has(id)) return {ok:false};
      return {ok:true,data:commits.get(id)};
    }
    if(path.startsWith(BASE+"/contents/")) {
      const part=path.slice((BASE+"/contents/").length);
      const at=part.lastIndexOf("?ref=");
      if(at<0) return {ok:false};
      const file=part.slice(0,at),rev=part.slice(at+5);
      const value=docs.get(rev)?.[file];
      if(!value)return {ok:false};
      const buffer=Buffer.from(JSON.stringify(value),"utf8");
      return {ok:true,data:{type:"file",path:file,
        encoding:"base64",size:buffer.length,content:buffer.toString("base64")}};
    }
    return {ok:false};
  };
  const trustedAnchor = {
    version:1,repository:REPO,ref:ADMISSION_REGISTRY_REF,
    genesisSha:ROOT,sourceSha:SOURCE,
    checkpointSha:ROOT,checkpointRegistryHash:contentSha256(registry),
    verificationKeyFingerprint:v3PublicKeyFingerprint(keys.publicKey)
  };
  const audit = (opts={}) => auditV3AnchoredGlobalRegistry({
    readClient:{get},verificationKey:keys.publicKey,
    trustedAnchor,...opts
  });
  return {audit,keys,docs,commits,calls,trustedAnchor,
    admittedRegistry,initialRegistry:registry,realHead};
}
function noRights(out) {
  assert.equal(out.authorized,false);
  assert.equal(out.canSign,false);
  assert.equal(out.canDispatch,false);
  assert.equal(out.canSpend,false);
  assert.equal(Object.hasOwn(out,"permit"),false);
}

test("pinned genesis registry remains read-only consistency, never owner authorization",async()=>{
  const s=fixture({admitted:false});
  const r=await s.audit();
  assert.equal(r.status,"consistent_untrusted_anchor",JSON.stringify(r));
  assert.equal(r.evidence.headSha,ROOT);
  assert.equal(r.evidence.registryRevision,0);
  noRights(r);
  assert.ok(s.calls.every(x=>x.startsWith(BASE+"/")));
  assert.equal(s.calls.some(x=>x.includes("PATCH")),false);
});
test("one signed direct child of pinned genesis is accepted as NON-authorizing evidence",async()=>{
  const s=fixture();
  const result=await s.audit();
  assert.equal(result.status,"consistent_untrusted_anchor",JSON.stringify(result));
  assert.equal(result.evidence.headSha,HEAD);
  assert.equal(result.evidence.checkpointSha,ROOT);
  assert.equal(result.evidence.registryRevision,1);
  assert.equal(result.evidence.registryHash,contentSha256(s.admittedRegistry));
  noRights(result);
  const anchored = await s.audit({trustedAnchor:{
    ...s.trustedAnchor,checkpointSha:HEAD,
    checkpointRegistryHash:contentSha256(s.admittedRegistry)
  }});
  assert.equal(anchored.status,"consistent_untrusted_anchor");
});
test("rollback from a previously checkpointed admission to genesis is rejected",async()=>{
  const s=fixture({admitted:false});
  const r=await s.audit({trustedAnchor:{
    ...s.trustedAnchor,checkpointSha:HEAD,
    checkpointRegistryHash:contentSha256(s.admittedRegistry)
  }});
  assert.equal(r.status,"rejected");
  assert.equal(r.reason,"current_ref_rolled_back_before_checkpoint");
  noRights(r);
});
test("checkpoint SHA mismatch or wrong state hash cannot be mistaken for anchoring",async()=>{
  const s=fixture();
  for(const patch of [
    {checkpointSha:sha("a")},
    {checkpointRegistryHash:"0".repeat(64)},
    {sourceSha:sha("b")},
    {genesisSha:sha("c")},
    {ref:"refs/heads/main"},
    {repository:"attacker/repo"},
    {verificationKeyFingerprint:"f".repeat(64)},
    {version:2},
    {arbitraryPermission:"write"}
  ]){
    const output=await s.audit({trustedAnchor:{...s.trustedAnchor,...patch}});
    assert.notEqual(output.status,"consistent_untrusted_anchor",JSON.stringify(patch));
    noRights(output);
  }
});
test("genesis parent is independently checked, no grafting another main commit",async()=>{
  const s=fixture();
  s.commits.get(ROOT).parents=[{sha:sha("7")}];
  const r=await s.audit();
  assert.equal(r.reason,"genesis_parent_source_diverged");
});
test("an extra descendant Git commit is refused, even with identical signed registry files",async()=>{
  const s=fixture({extraCommit:true});
  const r=await s.audit();
  assert.equal(r.reason,"global_history_not_single_signed_admit");
  noRights(r);
});
test("structural replay of forged genesis ADMIT is rejected: only empty genesis may be pinned",async()=>{
  const s=fixture({maliciousRoot:true});
  const r=await s.audit();
  assert.equal(r.reason,"genesis_must_be_empty");
});
test("missing signed witness means no authenticated snapshot, before commit lineage checks",async()=>{
  const s=fixture({missingWitness:true});
  const r=await s.audit();
  assert.notEqual(r.status,"consistent_untrusted_anchor");
  noRights(r);
});
test("lost/ref-changed readback must never grant a stable anchored result",async()=>{
  const s=fixture({changedRef:true});
  const r=await s.audit();
  assert.equal(r.status,"uncertain");
  assert.equal(r.reason,"global_ref_changed_during_audit");
});
test("key pinning rejects a second key, private key, and malformed fingerprints",async()=>{
  const s=fixture();
  assert.match(v3PublicKeyFingerprint(s.keys.publicKey),/^[a-f0-9]{64}$/);
  assert.equal(v3PublicKeyFingerprint(s.keys.privateKey),null);
  assert.equal(v3PublicKeyFingerprint("not public pem"),null);
  for(const key of [generateKeyPairSync("ed25519").publicKey,
    s.keys.privateKey,null]){
    const r=await s.audit({verificationKey:key});
    assert.equal(r.status,"rejected");
    assert.equal(r.reason,"missing_or_untrusted_anchor_contract");
  }
});
test("even attacker self-signed evidence plus attacker-supplied anchor is NOT authorization",async()=>{
  const s=fixture();
  const result=await s.audit();
  assert.equal(result.status,"consistent_untrusted_anchor");
  noRights(result);
  // Injection cannot be detected by comparing the supplied values alone.
  // Deployment MUST source anchor and verificationKey independently.
});
test("no injected GitHub client or a transport error fails closed",async()=>{
  const s=fixture();
  const noClient=await s.audit({readClient:null});
  assert.equal(noClient.status,"uncertain");
  const failed=await s.audit({readClient:{get:async()=>{
    throw Object.assign(Error("ghp_"+"X".repeat(36)),{status:503});
  }}});
  assert.equal(failed.status,"uncertain");
  assert.doesNotMatch(JSON.stringify(failed),/ghp_/);
  noRights(failed);
});
