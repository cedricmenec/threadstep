import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createGithubClient } from "../scripts/asf/github/client.mjs";
import { createAdmissionRegistry, ADMISSION_REGISTRY_REF }
  from "../scripts/asf/v3/global-admission.mjs";
import {
  attemptSignedGlobalAdmission, observeGlobalAdmissionSnapshot,
  verifyV3SignedAdmissionPermit, v3AdmissionPermitSigningPayload
} from "../scripts/asf/v3/signed-global-admission.mjs";

const REPO = "cedricmenec/threadstep";
const PREFIX = "repos/" + REPO;
const R = ADMISSION_REGISTRY_REF;
const HEAD = "a".repeat(40);
const ROOT_TREE = "b".repeat(40);
const sha = n => n.toString(16).repeat(40);
const claim = (waveId = "wave-001") => ({
  waveId, manifestHash: "f".repeat(64), ownerRunId: "100", originSha: "e".repeat(40)
});
const payload = c => ({
  version: 1, purpose: "asf-v3-admit-one-wave",
  repository: REPO, registryRef: R, ...c
});
function permit(privateKey, c) {
  const p = payload(c);
  return { payload: p, signature:
    sign(null, v3AdmissionPermitSigningPayload(p), privateKey).toString("base64") };
}
const keys = () => generateKeyPairSync("ed25519");
function fakeServer({ lostPatch = false, invalidAfter = false,
  failure = "", missingRef = false } = {}) {
  const all = [];
  const trees = new Map([[ROOT_TREE, { "registry.json": createAdmissionRegistry() }]]);
  const commits = new Map([[HEAD, {
    sha: HEAD, tree: { sha: ROOT_TREE }, parents: []
  }]]);
  let head = HEAD, seq = 2;
  async function transact({method,path,body}) {
    all.push({ method, path, body: body ?? null });
    if (missingRef && method === "GET" &&
        path.includes("/git/ref/")) throw Object.assign(Error("missing"),{status:404});
    if (method === "GET" &&
        path === PREFIX + "/git/ref/heads/asf/control/active-wave-v3") {
      return { ref: R, object: { type: "commit", sha: head } };
    }
    if (method === "GET" &&
        path.startsWith(PREFIX + "/contents/registry.json?ref=")) {
      const id = path.split("ref=")[1];
      const commit = commits.get(id);
      if (!commit) throw Error("unknown commit");
      const record = trees.get(commit.tree.sha)["registry.json"];
      const bytes = Buffer.from(JSON.stringify(record), "utf8");
      return {type:"file",path:"registry.json",encoding:"base64",
        size:bytes.length,content:bytes.toString("base64")};
    }
    if (method === "GET" && path.startsWith(PREFIX + "/git/commits/")) {
      const id = path.slice((PREFIX + "/git/commits/").length);
      if (!commits.has(id)) throw Error("unknown commit");
      return commits.get(id);
    }
    if (method === "POST" && path === PREFIX + "/git/trees") {
      assert.equal(body.tree.length, 1);
      assert.deepEqual(body.tree[0],{
        path:"registry.json",mode:"100644",type:"blob",content:body.tree[0].content
      });
      const base = trees.get(body.base_tree);
      if (!base) throw Error("unknown base tree");
      const id = sha(seq++);
      trees.set(id,{...base,"registry.json":JSON.parse(body.tree[0].content)});
      return {sha:id};
    }
    if (method === "POST" && path === PREFIX + "/git/commits") {
      assert.equal(body.parents.length,1);
      assert.match(body.message,/^chore\(asf\): V3 global admission revision \d+$/);
      const id = sha(seq++);
      commits.set(id,{sha:id,tree:{sha:body.tree},
        parents:[{sha:body.parents[0]}]});
      return commits.get(id);
    }
    if (method === "PATCH" &&
        path === PREFIX + "/git/refs/heads/asf/control/active-wave-v3") {
      assert.equal(body.force, false);
      const commit = commits.get(body.sha);
      if (commit.parents.length !== 1 || commit.parents[0].sha !== head)
        throw Object.assign(Error("non-FF"), {status:422});
      head = body.sha;
      if (lostPatch) throw Object.assign(Error("response lost"), {status:503});
      if (invalidAfter) return {ref:R,object:{type:"commit",sha:HEAD}};
      return {ref:R,object:{type:"commit",sha:head}};
    }
    throw Error("unexpected HTTP call");
  }
  const reader = createGithubClient({
    transport: (path) => transact({method:"GET",path})
  });
  const writer = async x => {
    if (failure && x.method === failure)
      throw Object.assign(Error("ghp_" + "x".repeat(26)),{status:503});
    return transact(x);
  };
  return {
    readClient:reader,writeTransport:writer,
    all, get head(){return head;},
    get registry(){return trees.get(commits.get(head).tree.sha)["registry.json"];}
  };
}
const request = (server, key, waveId = "wave-001") => {
  const c = claim(waveId);
  return {claim:c,permit:permit(key.privateKey,c),
    verificationKey:key.publicKey,
    readClient:server.readClient, writeTransport:server.writeTransport};
};
test("permit verifies Ed25519 detached domain-separated signature, not a bare hash",()=>{
  const k=keys(),c=claim();
  const signed=permit(k.privateKey,c);
  assert.equal(verifyV3SignedAdmissionPermit({
    claim:c,permit:signed,verificationKey:k.publicKey
  }),true);
  assert.equal(verifyV3SignedAdmissionPermit({
    claim:c,permit:signed,verificationKey:keys().publicKey
  }),false);
  assert.equal(verifyV3SignedAdmissionPermit({
    claim:claim("wave-002"),permit:signed,verificationKey:k.publicKey
  }),false);
  assert.equal(verifyV3SignedAdmissionPermit({
    claim:c,permit:{...signed,payload:{...signed.payload,originSha:"c".repeat(40)}},
    verificationKey:k.publicKey
  }),false);
  assert.equal(verifyV3SignedAdmissionPermit({
    claim:c,permit:{...signed,signature:signed.signature.slice(0,-3)+"AAA"},
    verificationKey:k.publicKey
  }),false);
  assert.equal(verifyV3SignedAdmissionPermit({
    claim:c,permit:signed
  }),false, "no pinned public key must fail closed");
});
test("signed permit and empty genesis become one persisted global ADMIT via Git Data",async()=>{
  const s=fakeServer(),key=keys();
  const initial=await observeGlobalAdmissionSnapshot(s.readClient);
  assert.equal(initial.status,"snapshot_verified");
  assert.equal(initial.registry.state,"AVAILABLE");
  const result=await attemptSignedGlobalAdmission(request(s,key));
  assert.equal(result.status,"persisted",JSON.stringify(result));
  assert.equal(result.ok,true);
  assert.equal(result.code,"signed_global_admission_committed_not_paid");
  assert.notEqual(s.head,HEAD);
  assert.equal(result.revision,1);
  assert.equal(s.registry.state,"ACTIVE");
  assert.equal(s.registry.active.waveId,"wave-001");
  assert.equal(s.all.filter(c=>c.method==="PATCH").length,1);
  const patch=s.all.find(c=>c.method==="PATCH");
  assert.deepEqual(patch.body,{sha:s.head,force:false});
  const persisted=await observeGlobalAdmissionSnapshot(s.readClient);
  assert.equal(persisted.registry.revision,1);
});
test("a second wave is denied while the first is ACTIVE without mutating ref",async()=>{
  const s=fakeServer(),key=keys();
  assert.equal((await attemptSignedGlobalAdmission(request(s,key))).ok,true);
  const after=await attemptSignedGlobalAdmission(request(s,key,"wave-002"));
  assert.equal(after.ok,false);
  assert.equal(after.code,"wave_admission_blocked");
  assert.equal(s.all.filter(x=>x.method==="PATCH").length,1);
  assert.equal(s.registry.active.waveId,"wave-001");
});
test("two signed admissions race: a single sibling commit can fast-forward",async()=>{
  const s=fakeServer(),key=keys();
  const [a,b]=await Promise.all([
    attemptSignedGlobalAdmission(request(s,key,"wave-001")),
    attemptSignedGlobalAdmission(request(s,key,"wave-002"))
  ]);
  assert.equal([a,b].filter(x=>x.ok).length,1,JSON.stringify([a,b]));
  assert.equal([a,b].filter(x=>x.status==="conflict").length,1);
  assert.ok(["wave-001","wave-002"].includes(s.registry.active.waveId));
  assert.equal(s.registry.revision,1);
  assert.equal(s.all.filter(x=>x.method==="PATCH").length,2);
});
test("network response lost after PATCH never reattempts nor grants status persisted",async()=>{
  const s=fakeServer({lostPatch:true}),key=keys();
  const result=await attemptSignedGlobalAdmission(request(s,key));
  assert.equal(result.status,"uncertain");
  assert.equal(result.ok,false);
  assert.equal(s.registry.state,"ACTIVE","remote patch may have succeeded");
  assert.equal(s.all.filter(x=>x.method==="PATCH").length,1);
});
test("read failure or GitHub ref mismatch blocks all writes",async()=>{
  const s=fakeServer({missingRef:true});
  const result=await attemptSignedGlobalAdmission(request(s,keys()));
  assert.equal(result.status,"uncertain");
  assert.equal(s.all.filter(x=>x.method!=="GET").length,0);
});
test("invalid permit, foreign key or caller supplied repository prevents all Git I/O",async()=>{
  const s=fakeServer(),key=keys(),p=request(s,key);
  for (const changed of [
    {...p,verificationKey:keys().publicKey},
    {...p,verificationKey:null},
    {...p,permit:{...p.permit,signature:"no"}},
    {...p,claim:{...p.claim,repository:"attacker/repo"}},
    {...p,permit:{...p.permit,payload:{...p.permit.payload,registryRef:"refs/heads/main"}}}
  ]){
    const result=await attemptSignedGlobalAdmission(changed);
    assert.equal(result.status,"rejected");
  }
  assert.equal(s.all.length,0);
});
test("writer error is uncertain; network error strings (credentials) are not returned",async()=>{
  const s=fakeServer({failure:"POST"});
  const r=await attemptSignedGlobalAdmission(request(s,keys()));
  assert.equal(r.status,"uncertain");
  assert.doesNotMatch(JSON.stringify(r),/ghp_/);
  assert.equal(s.all.filter(x=>x.method==="PATCH").length,0);
});
test("invalid PATCH reply is uncertain and never retried",async()=>{
  const s=fakeServer({invalidAfter:true});
  const r=await attemptSignedGlobalAdmission(request(s,keys()));
  assert.equal(r.status,"uncertain");
  assert.equal(s.all.filter(x=>x.method==="PATCH").length,1);
  assert.equal(s.registry.revision,1);
});
test("registry CAS does not expose RELEASE, bootstrap or paid start operations",async()=>{
  const s=fakeServer(),key=keys();
  const req=request(s,key);
  assert.equal(req.permit.payload.registryRef,R);
  assert.equal((await attemptSignedGlobalAdmission(req)).ok,true);
  assert.equal(s.registry.state,"ACTIVE");
  assert.equal(s.all.some(x=>x.path.includes("asf/waves/")),false);
  assert.equal(s.all.some(x=>x.path.includes("workflow_dispatch")),false);
});
