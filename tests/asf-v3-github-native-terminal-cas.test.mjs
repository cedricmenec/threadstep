import test from "node:test";
import assert from "node:assert/strict";
import { attemptV3GithubNativeTerminalCAS }
 from "../scripts/asf/v3/github-native-terminal-cas.mjs";
import { createV3Manifest,createV3Journal,advanceV3 }
 from "../scripts/asf/v3/lifecycle.mjs";
import { createAdmissionRegistry,advanceAdmissionRegistry,
 ADMISSION_REGISTRY_REF } from "../scripts/asf/v3/global-admission.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const S=c=>c.repeat(40);
const OLD=S("1"),WAVE_SHA=S("2"),PARENT_TREE=S("3"),
 STAGED_TREE=S("4"),NEW=S("5"),ORIGIN=S("a"),RACED=S("f");
const WAVE_ID="wave-terminal-cas-v3-022";
const G_GET=BASE+"/git/ref/heads/asf/control/active-wave-v3";
const G_PATCH=BASE+"/git/refs/heads/asf/control/active-wave-v3";
const W_GET=BASE+"/git/ref/heads/asf/waves/"+WAVE_ID;
const WAVE_POLICY="refs/heads/asf/waves/*";
function rule(id,ref,types,bypass=[]){
 return {id,source:REPO,target:"branch",enforcement:"active",
  conditions:{ref_name:{include:[ref],exclude:[]}},
  bypass_actors:bypass,
  rules:types.map(type=>type==="required_status_checks"?
   {type,parameters:{required_status_checks:[{context:"check"}]}}:{type})
 };
}
function fixture({
 kind="RELEASE",lostPatch=false,racingPatch=false,
 wrongApp=false,invalidRegistry=false,badJournal=false,
 lostTree=false,wrongCommitParent=false,malformedNext=false,
 spoofPatch=false,moveBeforeWrite=false,waveMovesAfterPatch=false,
 doublePatchResult=false,failRegistryReadback=false,
 missingWaveRuleset=false,badWaveWriter=false
}={}) {
 const manifest=createV3Manifest({
  waveId:WAVE_ID,repository:REPO,backlogCommit:ORIGIN,
  model:"openrouter/deepseek/deepseek-v4.1-flash",
  autoMerge:false,maxTaskStarts:2,
  candidateTasks:[{id:"TS-001",sha256:"e".repeat(64)}],
  authorization:{runId:"80309",actor:"cedricmenec",
   workflowRef:REPO+"/.github/workflows/backlog-orchestrator-v3.yml@refs/heads/main",
   sourceSha:ORIGIN}
 });
 const original=createV3Journal(manifest);
 const journal=kind==="QUARANTINE"?
  advanceV3(manifest,original,{
   type:"STOP_UNCERTAIN",reason:"unconfirmed_dispatch"
  },0):
  advanceV3(manifest,original,{type:"COMPLETE_NO_WORK"},0);
 const registry=advanceAdmissionRegistry(createAdmissionRegistry(),{
  type:"ADMIT",claim:{
   waveId:WAVE_ID,manifestHash:contentSha256(manifest),
   ownerRunId:"80309",originSha:ORIGIN
  }
 },0);
 const state={
  head:OLD,waveHead:WAVE_SHA,files:new Map([[OLD,
   invalidRegistry?{...registry,revision:88}:registry]]),
  next:null,mutationStage:null,patches:0,writeCalls:[],
  reads:[],commitCreated:false
 };
 const file=(path,value)=>{
  const b=Buffer.from(JSON.stringify(value));
  return {ok:true,data:{type:"file",path,encoding:"base64",
   size:b.length,content:b.toString("base64")}};
 };
 const get=async path=>{
  state.reads.push(path);
  if(path===BASE+"/rulesets")return {ok:true,data:[{id:1},{id:2},{id:3},
   ...(missingWaveRuleset?[]:[{id:4},{id:5}])]};
  if(path===BASE+"/rulesets/1")return {ok:true,data:rule(1,
   "refs/heads/main",["pull_request","required_status_checks",
     "deletion","non_fast_forward"])};
  if(path===BASE+"/rulesets/2")return {ok:true,data:rule(2,
   ADMISSION_REGISTRY_REF,["creation","update"],[{
    actor_type:"Integration",actor_id:wrongApp?5321746:5361227,
    bypass_mode:"always"
   }])};
  if(path===BASE+"/rulesets/3")return {ok:true,data:rule(3,
   ADMISSION_REGISTRY_REF,["deletion","non_fast_forward"])};
  if(path===BASE+"/rulesets/4")return {ok:true,data:rule(4,
   WAVE_POLICY,["creation","update"],[{
    actor_type:"Integration",actor_id:badWaveWriter?5321746:5361227,
    bypass_mode:"always"
   }])};
  if(path===BASE+"/rulesets/5")return {ok:true,data:rule(5,
   WAVE_POLICY,["deletion","non_fast_forward"])};
  if(path===G_GET){
   const count=state.reads.filter(p=>p===G_GET).length;
   if(moveBeforeWrite&&count>=5)state.head=RACED;
   return {ok:true,data:{ref:ADMISSION_REGISTRY_REF,
    object:{type:"commit",sha:state.head}}};
  }
  if(path===W_GET)return {ok:true,data:{
   ref:"refs/heads/asf/waves/"+WAVE_ID,
   object:{type:"commit",sha:state.waveHead}
  }};
  if(path===BASE+"/contents/manifest.json?ref="+WAVE_SHA)
   return file("manifest.json",manifest);
  if(path===BASE+"/contents/journal.json?ref="+WAVE_SHA)
   return file("journal.json",badJournal?{...journal,revision:900}:journal);
  const prefix=BASE+"/contents/registry.json?ref=";
  if(path.startsWith(prefix)){
   if(failRegistryReadback&&path===prefix+NEW)
    return {ok:false,status:503};
   const data=state.files.get(path.slice(prefix.length));
   return data?file("registry.json",data):{ok:false,status:404};
  }
  if(path===BASE+"/git/commits/"+OLD)return {ok:true,data:{
   sha:OLD,tree:{sha:PARENT_TREE},parents:[{sha:ORIGIN}]
  }};
  if(path===BASE+"/git/commits/"+NEW&&state.commitCreated)
   return {ok:true,data:{
    sha:NEW,tree:{sha:STAGED_TREE},parents:[{sha:OLD}]
   }};
  return {ok:false,status:404};
 };
 const send=async({method,path,body})=>{
  state.writeCalls.push({method,path,body});
  if(method==="POST"&&path===BASE+"/git/trees"){
   assert.equal(body.base_tree,PARENT_TREE);
   assert.equal(body.tree.length,1);
   assert.deepEqual(Object.keys(body.tree[0]).sort(),
    ["content","mode","path","type"]);
   assert.equal(body.tree[0].path,"registry.json");
   assert.equal(body.tree[0].mode,"100644");
   assert.equal(body.tree[0].type,"blob");
   state.next=JSON.parse(body.tree[0].content);
   if(lostTree)throw Error("tree-response-lost");
   return {sha:STAGED_TREE};
  }
  if(method==="POST"&&path===BASE+"/git/commits"){
   assert.deepEqual(body.parents,[OLD]);
   assert.equal(body.tree,STAGED_TREE);
   state.commitCreated=true;
   state.files.set(NEW,malformedNext?
    {...state.next,revision:999}:state.next);
   return {sha:NEW,tree:{sha:STAGED_TREE},
    parents:[{sha:wrongCommitParent?RACED:OLD}]};
  }
  if(method==="PATCH"&&path===G_PATCH){
   state.patches++;
   assert.deepEqual(body,{sha:NEW,force:false});
   if(racingPatch){
    state.head=RACED;
    throw Error("409 sibling fast-forward failure");
   }
   if(!spoofPatch)state.head=NEW;
   if(waveMovesAfterPatch)state.waveHead=RACED;
   if(lostPatch)throw Error("patch-response-lost");
   if(doublePatchResult)return {ref:"refs/heads/other",
    object:{type:"commit",sha:NEW}};
   return {ref:ADMISSION_REGISTRY_REF,
    object:{type:"commit",sha:NEW}};
  }
  throw Error("unexpected_mutation_endpoint");
 };
 return {readClient:{get},writeTransport:send,waveId:WAVE_ID,
  kind,reason:kind==="QUARANTINE"?"diagnostic_owner_required":undefined,
  state,manifest,journal,registry};
}
function noAuthority(r){
 for(const k of ["authorized","canRelease","canQuarantine",
  "canWrite","canDispatch","canSpend","canRetry"])
  assert.equal(r[k],false,k);
}
const nWrites=f=>f.state.writeCalls.length;
const onlyOnePatch=f=>assert.equal(f.state.patches,1);
test("completed no-work RELEASE uses one Git fast-forward and two independent terminal checks",async()=>{
 const f=fixture();
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"persisted",JSON.stringify(r));
 assert.equal(r.kind,"RELEASE");
 assert.equal(r.revision,2);
 assert.equal(r.oldGlobalSha,OLD);
 assert.equal(r.newGlobalSha,NEW);
 assert.equal(f.state.head,NEW);
 assert.equal(f.state.next.state,"AVAILABLE");
 assert.equal(f.state.next.active,null);
 assert.equal(f.state.next.events.at(-1).type,"RELEASE");
 // Every terminal transaction performs two independent global+wave checks.
 assert.equal(f.state.reads.filter(p=>p===BASE+"/rulesets").length,4);
 assert.equal(f.state.reads.filter(p=>p===G_GET).length,6);
 onlyOnePatch(f);noAuthority(r);
});
test("STOP_UNCERTAIN allows QUARANTINE only, never RELEASING the active wave",async()=>{
 const f=fixture({kind:"QUARANTINE"});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"persisted",JSON.stringify(r));
 assert.equal(r.kind,"QUARANTINE");
 assert.equal(f.state.next.state,"QUARANTINED");
 assert.equal(f.state.next.active.waveId,WAVE_ID);
 assert.equal(f.state.next.events.at(-1).type,"QUARANTINE");
 onlyOnePatch(f);noAuthority(r);
 const wrong=fixture({kind:"QUARANTINE"});wrong.kind="RELEASE";
 const denied=await attemptV3GithubNativeTerminalCAS(wrong);
 assert.equal(denied.status,"rejected");
 assert.equal(nWrites(wrong),0);noAuthority(denied);
});
test("unprotected wave rulesets block both terminal writer kinds before Git mutation",async()=>{
 for(const options of [{missingWaveRuleset:true},{badWaveWriter:true}]){
  for(const kind of ["RELEASE","QUARANTINE"]){
   const f=fixture({...options,kind});
   const r=await attemptV3GithubNativeTerminalCAS(f);
   assert.equal(r.status,"rejected",JSON.stringify({options,kind,r}));
   assert.equal(nWrites(f),0);noAuthority(r);
  }
 }
});
test("GitHub lost PATCH response is uncertain, one PATCH, absolutely no retry",async()=>{
 const f=fixture({lostPatch:true});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"uncertain");
 assert.equal(r.code,"terminal_git_response_ambiguous_at_patch");
 assert.equal(f.state.head,NEW);
 onlyOnePatch(f);noAuthority(r);
});
test("sibling ref fast-forward competition cannot silently release",async()=>{
 const f=fixture({racingPatch:true});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"uncertain");
 assert.equal(r.code,"terminal_git_response_ambiguous_at_patch");
 assert.equal(f.state.head,RACED);
 onlyOnePatch(f);noAuthority(r);
});
test("an old global ref changed before staging means ZERO Git mutation",async()=>{
 const f=fixture({moveBeforeWrite:true});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"conflict");
 assert.equal(r.code,"terminal_ref_changed_before_git_write");
 assert.equal(nWrites(f),0);noAuthority(r);
});
test("corrupt journal/registry, wrong App ID or missing transport never reach writer",async()=>{
 for(const options of [{wrongApp:true},{invalidRegistry:true},
  {badJournal:true}]){
  const f=fixture(options);
  const r=await attemptV3GithubNativeTerminalCAS(f);
  assert.notEqual(r.status,"persisted",JSON.stringify(options));
  assert.equal(nWrites(f),0);noAuthority(r);
 }
 const f=fixture();
 const r=await attemptV3GithubNativeTerminalCAS({...f,writeTransport:null});
 assert.equal(r.status,"rejected");
 assert.equal(nWrites(f),0);noAuthority(r);
});
test("lost tree response cannot lead to commit or PATCH retries",async()=>{
 const f=fixture({lostTree:true});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"uncertain");
 assert.equal(r.code,"terminal_git_response_ambiguous_at_tree");
 assert.equal(f.state.writeCalls.filter(x=>x.method==="POST").length,1);
 assert.equal(f.state.patches,0);noAuthority(r);
});
test("commit with wrong Git parent blocks PATCH without declaring RELEASE",async()=>{
 const f=fixture({wrongCommitParent:true});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"uncertain");
 assert.equal(r.code,"terminal_commit_unconfirmed");
 assert.equal(f.state.patches,0);noAuthority(r);
});
test("fake PATCH success with unchanged ref is rejected by readback",async()=>{
 const f=fixture({spoofPatch:true});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"uncertain");
 assert.equal(r.code,"terminal_pinned_readback_unconfirmed");
 onlyOnePatch(f);noAuthority(r);
});
test("wrong PATCH response ref cannot be mistaken for a CAS success",async()=>{
 const f=fixture({doublePatchResult:true});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"uncertain");
 assert.equal(r.code,"terminal_patch_response_unconfirmed");
 onlyOnePatch(f);noAuthority(r);
});
test("wave ref moved AFTER global PATCH yields uncertain and no retry",async()=>{
 const f=fixture({waveMovesAfterPatch:true});
 const r=await attemptV3GithubNativeTerminalCAS(f);
 assert.equal(r.status,"uncertain");
 assert.equal(r.code,"terminal_pinned_readback_unconfirmed");
 onlyOnePatch(f);noAuthority(r);
});
test("corrupted or missing saved registry after PATCH is never terminal success",async()=>{
 for(const options of [{malformedNext:true},{failRegistryReadback:true}]){
  const f=fixture(options);
  const r=await attemptV3GithubNativeTerminalCAS(f);
  assert.equal(r.status,"uncertain");
  assert.ok(r.code.includes("readback")||r.code.includes("ambiguous"));
  onlyOnePatch(f);noAuthority(r);
 }
});
test("invalid request, unknown kind, unsafe wave and wrong reader fail before observation",async()=>{
 for(const patch of [
  {kind:"ADMIN_RELEASE"},{waveId:"../main"},
  {waveId:""},{readClient:null},{kind:undefined}
 ]){
  const f=fixture();
  const r=await attemptV3GithubNativeTerminalCAS({...f,...patch});
  assert.equal(r.status,"rejected");
  assert.equal(nWrites(f),0);noAuthority(r);
 }
});
