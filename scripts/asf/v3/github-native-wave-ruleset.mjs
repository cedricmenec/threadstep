/**
 * ASF-V3-026 — read-only control-plane rules for asf/waves/*.
 *
 * Global ref protection does NOT automatically protect wave refs. The
 * operational child journal CAS MUST be blocked until a separate pair of
 * GitHub rulesets protects all wave refs against writes from V1 executors.
 *
 * No permission, App secret, branch mutation, rule creation or paid call.
 */
import {V3_CONTROLLER_APP_ID} from "./github-native-control.mjs";
export const ASF_V3_WAVE_REF_PATTERN="refs/heads/asf/waves/*";
const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const ID=/^[1-9]\d{0,17}$/;
const gate=(status,reason,evidence=null)=>Object.freeze({
 status,reason,authorized:false,canCreate:false,canWrite:false,
 canAck:false,canClaim:false,canDispatch:false,canSpend:false,
 canRetry:false,evidence
});
const reject=code=>gate("rejected",code);
const unknown=code=>gate("uncertain",code);
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);
function base(r){
 const c=r?.conditions?.ref_name;
 return object(r)&&ID.test(String(r.id??""))&&
  r.source===REPO&&r.target==="branch"&&
  r.enforcement==="active"&&
  Array.isArray(c?.include)&&c.include.length===1&&
  c.include[0]===ASF_V3_WAVE_REF_PATTERN&&
  Array.isArray(c.exclude)&&c.exclude.length===0&&
  Array.isArray(r.rules)&&Array.isArray(r.bypass_actors);
}
const exactTypes=(rule,types)=>
 rule.rules.length===types.length&&
 new Set(rule.rules.map(x=>x.type)).size===types.length&&
 types.every(type=>rule.rules.some(x=>x.type===type));
/**
 * First writer rule bypasses creation/update ONLY for App 5361227; the
 * independent integrity rule denies EVERYONE deletion and force-push.
 * An App bypass on a combined rule also bypasses history protection.
 */
export function inspectV3GithubWaveRulesets({writer,immutable}={}){
 if(!base(writer)||!exactTypes(writer,["creation","update"]))
  return reject("wave_creation_and_updates_not_controller_only");
 if(writer.bypass_actors.length!==1||
    writer.bypass_actors[0]?.actor_type!=="Integration"||
    writer.bypass_actors[0]?.actor_id!==V3_CONTROLLER_APP_ID||
    writer.bypass_actors[0]?.bypass_mode!=="always")
  return reject("wave_writer_app_id_or_bypass_incorrect");
 if(!base(immutable)||
    immutable.id===writer.id||
    !exactTypes(immutable,["deletion","non_fast_forward"])||
    immutable.bypass_actors.length!==0)
  return reject("wave_immutable_rule_not_independently_enforced");
 return gate("wave_rule_structure_observed_not_authorized",
  "real_app_scope_and_negative_permission_tests_still_required",{
   waveRefPattern:ASF_V3_WAVE_REF_PATTERN,
   writerId:writer.id,immutableId:immutable.id,
   controllerAppId:V3_CONTROLLER_APP_ID
  });
}
/**
 * Verify full rule details, never trust the collection's superficial active
 * flags. Other repository rulesets can coexist, but exact-wave patterns must
 * not have ambiguous/duplicate matches.
 */
export async function observeV3GithubWaveRulesetPolicy(readClient){
 if(typeof readClient?.get!=="function")
  return unknown("wave_ruleset_reader_missing");
 let summary;
 try{summary=await readClient.get(BASE+"/rulesets");}
 catch{return unknown("wave_ruleset_list_unavailable");}
 // GitHub default page size is 30; a full page is NOT exhaustive.
 // Fail closed rather than silently ignoring additional wave rulesets.
 if(summary?.ok!==true||!Array.isArray(summary.data))
  return unknown("wave_ruleset_list_unavailable");
 if(summary.data.length>=30)
  return unknown("wave_ruleset_pagination_unconfirmed");
 const seen=new Set(),matching=[];
 for(const item of summary.data){
  if(!ID.test(String(item?.id??""))||seen.has(item.id))
   return reject("wave_ruleset_list_invalid");
  seen.add(item.id);
  let detail;
  try{detail=await readClient.get(BASE+"/rulesets/"+item.id);}
  catch{return unknown("wave_ruleset_details_unavailable");}
  if(detail?.ok!==true||detail.data?.id!==item.id)
   return unknown("wave_ruleset_details_unavailable");
  if(detail.data?.source===REPO&&
     detail.data?.conditions?.ref_name?.include
       ?.includes(ASF_V3_WAVE_REF_PATTERN))
   matching.push(detail.data);
 }
 if(matching.length!==2)
  return reject("wave_rulesets_missing_or_ambiguous");
 // Identify the writer by its intended creation/update capability, then
 // check the OTHER distinct rule for immutability. Do not classify the
 // writer as "immutable" merely because it erroneously also contains
 // deletion/non-FF rules: surface the exact writer-type violation instead.
 const writers=matching.filter(x=>x.rules?.some(r=>
  r.type==="creation"||r.type==="update"));
 if(writers.length!==1)
  return reject("wave_rulesets_combined_or_not_separated");
 const immutable=matching.find(x=>x.id!==writers[0].id);
 return inspectV3GithubWaveRulesets({
  writer:writers[0],immutable
 });
}
