import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { inspectV3PaidPreflight, inspectV3WorkflowRuntimeContext }
 from "../scripts/asf/v3/workflow-runtime-preflight.mjs";
import { V3_CHILD_WORKFLOW, V3_CONTROLLER_WORKFLOW }
 from "../scripts/asf/v3/lifecycle.mjs";

const REPO = "cedricmenec/threadstep";
const context = mode => ({
 repository: REPO, runId: "50001", runAttempt: 1,
 sha: "a".repeat(40), ref: "refs/heads/main",
 actor: mode==="controller" ? "cedricmenec" : "threadstep-software-factory[bot]",
 eventName: "workflow_dispatch",
 workflowRef: REPO + "/.github/workflows/" + (mode==="controller" ?
   "backlog-orchestrator-v3.yml" : "agent-openspec-v3.yml") + "@refs/heads/main"
});
const withoutRights = d => {
 for(const field of ["authorized","canSign","canDispatch","canClaim","canSpend","canRetry"])
   assert.equal(d[field],false);
};
test("controller workflow context is only a context, never payment authorization",async()=>{
 const d=inspectV3WorkflowRuntimeContext({mode:"controller",context:context("controller")});
 assert.equal(d.status,"context_only");
 withoutRights(d);
 const paid=await inspectV3PaidPreflight({mode:"controller",context:context("controller")});
 assert.equal(paid.status,"disabled");
 withoutRights(paid);
});
test("bot child workflow context cannot claim or pay before pinned owner root",async()=>{
 const d=inspectV3WorkflowRuntimeContext({mode:"child",context:context("child")});
 assert.equal(d.status,"context_only");
 withoutRights(d);
 const paid=await inspectV3PaidPreflight({mode:"child",context:context("child")});
 assert.equal(paid.status,"disabled");
 withoutRights(paid);
});
test("spoofed actor, runAttempt, SHA, ref and wrong workflow path are rejected",()=>{
 for(const mode of ["controller","child"]){
  const original=context(mode);
  for(const patch of [
   {actor:"attacker"},{runAttempt:2},{sha:"bad"},
   {ref:"refs/heads/pull/123"},{workflowRef:REPO+"/.github/workflows/agent-openspec.yml@refs/heads/main"},
   {eventName:"repository_dispatch"},{repository:"attacker/repo"},
   {runId:"0"}, {runId:"50001",sha:"F".repeat(40)}
  ]){
   const out=inspectV3WorkflowRuntimeContext({mode,context:{...original,...patch}});
   assert.equal(out.status,"rejected",JSON.stringify({mode,patch}));
   withoutRights(out);
  }
 }
});
test("only dedicated V3 child path is accepted; never the legacy owner-only V1 child",()=>{
 assert.equal(V3_CHILD_WORKFLOW,".github/workflows/agent-openspec-v3.yml@refs/heads/main");
 assert.equal(V3_CONTROLLER_WORKFLOW,".github/workflows/backlog-orchestrator-v3.yml@refs/heads/main");
});
test("new workflow files cannot request OpenRouter or Git write scope",()=>{
 for(const name of ["backlog-orchestrator-v3.yml","agent-openspec-v3.yml"]){
  const source=readFileSync(new URL("../.github/workflows/"+name,import.meta.url),"utf8");
  assert.match(source,/workflow_dispatch:/);
  assert.match(source,/contents: read/);
  assert.match(source,/actions: read/);
  assert.match(source,/persist-credentials: false/);
  assert.match(source,/workflow-runtime-preflight\.mjs/);
  assert.doesNotMatch(source,/OPENROUTER_API_KEY|api\.openrouter|contents:\s*write|actions:\s*write|secrets\.|curl\s|gh\sapi/i);
  assert.doesNotMatch(source,/agent-openspec\.yml/);
 }
});
