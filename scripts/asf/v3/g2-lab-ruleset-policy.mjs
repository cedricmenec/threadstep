#!/usr/bin/env node
/**
 * ASF-V3-043: fail-closed, GET-only observer of lab ruleset structure.
 * No App installation, token privileges or protected-ref write is authorized.
 */
import {pathToFileURL} from "node:url";
import {auditV3LabEligibility,createV3LabReadOnlyClient}
 from "./g2-lab-readonly-eligibility.mjs";

export const LAB_RULES=Object.freeze([
 Object.freeze({
  name:"ASF V3 LAB - Global controller writer",
  target:"refs/heads/asf/lab/control/active-wave-v3",
  types:Object.freeze(["creation","update"]),
  controllerBypass:true
 }),
 Object.freeze({
  name:"ASF V3 LAB - Global immutable history",
  target:"refs/heads/asf/lab/control/active-wave-v3",
  types:Object.freeze(["deletion","non_fast_forward"]),
  controllerBypass:false
 }),
 Object.freeze({
  name:"ASF V3 LAB - Wave controller writer",
  target:"refs/heads/asf/lab/waves/*",
  types:Object.freeze(["creation","update"]),
  controllerBypass:true
 }),
 Object.freeze({
  name:"ASF V3 LAB - Wave immutable history",
  target:"refs/heads/asf/lab/waves/*",
  types:Object.freeze(["deletion","non_fast_forward"]),
  controllerBypass:false
 })
]);
const APP_CONTROLLER=5361227;
const verdict=(status,code,repository,extra={})=>Object.freeze({
 status,code,repository,
 authorized:false,permissionsProven:false,tokenIdentityProven:false,
 realServerDenyTestsProven:false,
 canConfigure:false,canWrite:false,canDispatch:false,canSpend:false,
 canRetry:false,...extra
});
function sameMembers(actual,expected){
 return Array.isArray(actual)&&actual.length===expected.length &&
  actual.every(x=>typeof x==="string")&&
  actual.slice().sort().join("\0")===expected.slice().sort().join("\0");
}
function matchesRule(rule,contract,repository){
 if(!rule||typeof rule!=="object"||Array.isArray(rule))return false;
 if(rule.name!==contract.name||rule.target!=="branch"||
    rule.source_type!=="Repository"||rule.source!==repository||
    rule.enforcement!=="active")return false;
 const condition=rule.conditions?.ref_name;
 if(!sameMembers(condition?.include,[contract.target])||
    !sameMembers(condition?.exclude,[]))return false;
 if(!Array.isArray(rule.rules)||
  !sameMembers(rule.rules.map(x=>x?.type),contract.types))return false;
 const bypass=rule.bypass_actors;
 if(!Array.isArray(bypass))return false;
 if(!contract.controllerBypass)return bypass.length===0;
 return bypass.length===1&&bypass[0]?.actor_type==="Integration"&&
  bypass[0].actor_id===APP_CONTROLLER&&bypass[0].bypass_mode==="always";
}
/**
 * Pure structural matching. Four exactly matching active rulesets are needed,
 * and a match is still NEVER a G2/G3 security certification.
 */
export function evaluateV3LabRulesets({repository,rulesets}={}){
 if(typeof repository!=="string"||
  !/^cedricmenec\/asf-v3-[a-z0-9-]+-lab$/.test(repository))
  return verdict("rejected","invalid_dedicated_lab",null);
 if(!Array.isArray(rulesets)||!rulesets.every(x=>
  x&&typeof x==="object"&&!Array.isArray(x)&&
  Number.isSafeInteger(x.id)&&x.id>0))
  return verdict("uncertain","invalid_ruleset_evidence",repository);
 if(rulesets.length===0)
  return verdict("not_configured","lab_rulesets_absent",repository,{ruleCount:0});
 if(rulesets.length!==LAB_RULES.length||
  new Set(rulesets.map(x=>x.id)).size!==rulesets.length||
  new Set(rulesets.map(x=>x.name)).size!==rulesets.length)
  return verdict("uncertain","unexpected_ruleset_cardinality",repository,
   {ruleCount:rulesets.length});
 for(const expected of LAB_RULES){
  const actual=rulesets.find(x=>x.name===expected.name);
  if(!matchesRule(actual,expected,repository))
   return verdict("uncertain","ruleset_contract_mismatch",repository,
    {ruleName:expected.name});
 }
 return verdict("structure_observed_not_authorized",
  "four_lab_rulesets_structurally_consistent",repository,
  {ruleCount:4,controllerAppId:APP_CONTROLLER});
}
/**
 * Repeat read of the small list after the paginated eligibility check, then
 * fetch and cross-check all four exact detail URLs. Do not infer completeness
 * if snapshots disagree. This has zero mutation / paid-operation endpoints.
 */
export async function auditV3LabRulePolicy({repository,readClient}={}){
 const preflight=await auditV3LabEligibility({repository,readClient});
 if(preflight.status!=="candidate_only")
  return verdict("uncertain","preflight_not_candidate",repository,
   {preflightStatus:preflight.status,preflightReason:preflight.reason});
 if(preflight.visibility!=="public")
  return verdict("uncertain","lab_visibility_not_public",repository);
 if(preflight.rulesetCount===0)
  return verdict("not_configured","lab_rulesets_absent",repository,{ruleCount:0});
 if(preflight.rulesetCount!==4)
  return verdict("uncertain","unexpected_ruleset_cardinality",repository,
   {ruleCount:preflight.rulesetCount});
 const root="repos/"+repository;
 const collection=await readClient.get(root+"/rulesets?per_page=100&page=1");
 if(!collection?.ok||!Array.isArray(collection.data)||
  collection.data.length!==4||
  new Set(collection.data.map(x=>x?.id)).size!==4)
  return verdict("uncertain","ruleset_collection_changed",repository);
 const rules=[];
 for(const listed of collection.data){
  if(!Number.isSafeInteger(listed?.id)||listed.id<1)
   return verdict("uncertain","invalid_ruleset_id",repository);
  let detail;
  try{detail=await readClient.get(root+"/rulesets/"+listed.id);}
  catch{return verdict("uncertain","ruleset_detail_unavailable",repository);}
  if(!detail?.ok||detail.data?.id!==listed.id ||
   detail.data?.name!==listed.name)
   return verdict("uncertain","ruleset_details_changed",repository);
  rules.push(detail.data);
 }
 return evaluateV3LabRulesets({repository,rulesets:rules});
}
export async function main(args=process.argv.slice(2),env=process.env){
 if(args.length!==1||!/^cedricmenec\/asf-v3-[a-z0-9-]+-lab$/.test(args[0])){
  process.stderr.write("ASF V3 lab ruleset audit: dedicated lab name required\n");
  return 1;
 }
 const readClient=createV3LabReadOnlyClient({
  repository:args[0],token:env.GH_TOKEN??""
 });
 const result=await auditV3LabRulePolicy({repository:args[0],readClient});
 process.stdout.write(JSON.stringify(result)+"\n");
 // A valid structure is neither installation permission nor G2/G3 approval.
 return result.status==="structure_observed_not_authorized"?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().then(code=>{process.exitCode=code;},()=>{
  process.stderr.write("ASF V3 lab ruleset audit: failed closed\n");
  process.exitCode=1;
 });
}
