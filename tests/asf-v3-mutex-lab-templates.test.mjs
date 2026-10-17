import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {inspectAsfV3MutexLabTemplates,ASF_V3_MUTEX_LAB_DIR}
  from "../scripts/asf/v3/mutex-lab-template-audit.mjs";

const files=["v1-shared.yml","v3-shared.yml","v3-control.yml"];
const baseline=()=>Object.fromEntries(files.map(file=>[
  file,readFileSync(new URL("../"+ASF_V3_MUTEX_LAB_DIR+"/"+file,import.meta.url),"utf8")
]));
const allFalse = r => {
  for(const prop of ["authorized","canPay","canWrite","canDispatch","canSpend","canRetry"])
    assert.equal(r[prop],false,prop);
};
test("isolated laboratory templates are distinct and inert",()=>{
  const t=baseline(), r=inspectAsfV3MutexLabTemplates(t);
  assert.equal(r.status,"inert_lab_templates_structurally_valid");
  assert.match(t["v1-shared.yml"],/group: threadstep-paid-development-v1/);
  assert.match(t["v3-shared.yml"],/group: threadstep-paid-development-v1/);
  assert.match(t["v3-control.yml"],/group: threadstep-v3-mutex-lab-control/);
  for(const name of files){
    assert.match(t[name],/if: \$\{\{ github\.event\.repository\.name == 'asf-v3-mutex-lab' \}\}/);
    assert.match(t[name],/permissions: \{\}/);
    assert.doesNotMatch(t[name],/uses:|secrets\.|OPENROUTER/);
  }
  allFalse(r);
});
test("tampering with lock, cancellation, job guard, trigger or time bound fails closed",()=>{
  const b=baseline();
  const attempts=[
    ["v1-shared.yml","threadstep-paid-development-v1","a-different-mutex"],
    ["v3-shared.yml","cancel-in-progress: false","cancel-in-progress: true"],
    ["v3-shared.yml","    concurrency:","concurrency:"],
    ["v1-shared.yml","asf-v3-mutex-lab","threadstep"],
    ["v3-control.yml","  workflow_dispatch:","  push:"],
    ["v1-shared.yml","permissions: {}","permissions: write-all"],
    ["v1-shared.yml","          sleep \"$HOLD_SECONDS\"","          echo unsafe"],
    ["v3-control.yml","            15|45|120) ;;","            15|45|120|9999) ;;"],
    ["v3-shared.yml","        shell: bash","        uses: evil/example@v1"],
  ];
  for(const [file,from,to] of attempts){
    assert.ok(b[file].includes(from),file+" "+from);
    const r=inspectAsfV3MutexLabTemplates({...b,[file]:b[file].replace(from,to)});
    assert.equal(r.status,"rejected",file+" "+from);
    allFalse(r);
  }
});
test("missing, unexpected, malformed templates cannot authorize any action",()=>{
  for(const t of [null,{},{"v1-shared.yml":"bad"}, {...baseline(),"surprise.yml":""}]){
    const r=inspectAsfV3MutexLabTemplates(t);
    assert.equal(r.status,"rejected");allFalse(r);
  }
});
