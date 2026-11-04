import test from "node:test";
import assert from "node:assert/strict";
import {inspectAsfV3PrStackReconciliation,
  ASF_V3_CANONICAL_STACK,ASF_V3_ALTERNATE_STACK}
  from "../scripts/asf/v3/pr-stack-reconciliation.mjs";
const SHA="a".repeat(40);
const specs={
  109:["feat/asf-v3-023-child-ack-readonly","feat/asf-v3-022-terminal-git-cas",["scripts/asf/v3/child-ack-readiness.mjs"]],
  111:["feat/asf-v3-024-child-ack-claim-wave-cas","feat/asf-v3-023-child-ack-readonly",["scripts/asf/v3/github-native-child-wave-cas.mjs","docs/factory/tasks/ASF-V3-024.md"]],
  112:["feat/asf-v3-025-shared-paid-mutex-readiness","feat/asf-v3-024-child-ack-claim-wave-cas",["scripts/asf/v3/github-native-paid-mutex-readiness.mjs","docs/factory/tasks/ASF-V3-025.md"]],
  113:["feat/asf-v3-026-wave-ruleset-preflight","feat/asf-v3-025-shared-paid-mutex-readiness",["scripts/asf/v3/github-native-wave-ruleset.mjs"]],
  120:["docs/asf-v3-027-mutex-concurrency-qualification","feat/asf-v3-026-wave-ruleset-preflight",["docs/factory/tasks/ASF-V3-027.md"]],
  122:["test/asf-v3-028-isolated-paid-mutex-lab","docs/asf-v3-027-mutex-concurrency-qualification",["tests/asf-v3-mutex-lab-templates.test.mjs"]],
  116:["feat/asf-v3-024-ack-child-wave-cas","feat/asf-v3-023-child-ack-readonly",["scripts/asf/v3/child-ack-cas.mjs","docs/factory/tasks/ASF-V3-024.md"]],
  117:["feat/asf-v3-025-child-claim-cas","feat/asf-v3-024-ack-child-wave-cas",["scripts/asf/v3/child-claim-cas.mjs","docs/factory/tasks/ASF-V3-025.md"]]
};
const inventory=()=>Object.fromEntries(Object.entries(specs).map(([id,v])=>[id,{
 number:Number(id),head:v[0],base:v[1],headSha:SHA,
 state:"open",draft:true,paths:[...v[2]]
}]));
const noRights=r=>{
 for(const k of ["authorized","canMerge","canWrite","canActivate","canSpend","canRetry"])
  assert.equal(r[k],false,k);
};
test("two known stacks reconcile only as plan, never as merge permission",()=>{
 const r=inspectAsfV3PrStackReconciliation(inventory());
 assert.equal(r.status,"reconciliation_plan_observed_not_authorized");
 assert.deepEqual(r.evidence.canonicalPrs,[109,111,112,113,120,122]);
 assert.deepEqual(r.evidence.alternatePrs,[109,116,117]);
 assert.deepEqual(r.evidence.duplicateTaskPaths,[
  "docs/factory/tasks/ASF-V3-024.md","docs/factory/tasks/ASF-V3-025.md"]);
 assert.equal(r.evidence.alternateWritersCoveredByWaveRuleset,false);
 assert.equal(r.evidence.permissionsAndLiveCasVerified,false);
 assert.deepEqual(ASF_V3_CANONICAL_STACK,[109,111,112,113,120,122]);
 assert.deepEqual(ASF_V3_ALTERNATE_STACK,[109,116,117]);
 noRights(r);
});
test("changed base, renamed port, undrafted PR or unpinned SHA is not accepted",()=>{
 const tests=[
  [117,{base:"main"}],
  [113,{paths:["docs/factory/tasks/ASF-V3-026.md"]}],
  [116,{draft:false}],
  [122,{headSha:"invalid"}],
  [109,{state:"closed"}],
  [112,{head:"other"}]
 ];
 for(const [id,changed] of tests){
  const x=inventory();
  x[id]={...x[id],...changed};
  const r=inspectAsfV3PrStackReconciliation(x);
  assert.notEqual(r.status,"reconciliation_plan_observed_not_authorized");
  noRights(r);
 }
});
test("missing, injected and malformed PR inventory remains fail closed",()=>{
 for(const data of [undefined,null,{},[],{...inventory(),999:{}}]){
  const r=inspectAsfV3PrStackReconciliation(data);
  assert.notEqual(r.status,"reconciliation_plan_observed_not_authorized");
  noRights(r);
 }
 const duplicate=inventory();
 duplicate[117].paths.push(duplicate[117].paths[0]);
 const r=inspectAsfV3PrStackReconciliation(duplicate);
 assert.equal(r.status,"rejected");
 noRights(r);
});
