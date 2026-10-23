#!/usr/bin/env node
/**
 * ASF-V3-042: read-only eligibility probe for a DEDICATED GitHub ruleset lab.
 *
 * Reads repository metadata and complete ruleset collection only. It cannot
 * inspect Controller/Executor installation permissions, issue App tokens,
 * create rulesets or refs, or authorize paid operations.
 */
import {pathToFileURL} from "node:url";
import {createGithubClient} from "../github/client.mjs";

const OWNER="cedricmenec",PAGE_SIZE=100,MAX_PAGES=3;
const CANDIDATE=/^cedricmenec\/[A-Za-z0-9][A-Za-z0-9._-]{0,98}$/;
const base=repo=>"repos/"+repo;
const deny=(status,reason,repository=null,extra={})=>Object.freeze({
 status,reason,repository,authorized:false,canCreate:false,canWrite:false,
 canModifyRulesets:false,canUseAppToken:false,canDispatch:false,
 canSpend:false,canRetry:false,actualAppPermissionsProven:false,
 realAppDenyTestsCompleted:false,...extra
});
function valid(repo){
 return typeof repo==="string"&&CANDIDATE.test(repo)&&
  repo!=="cedricmenec/threadstep"&&!repo.endsWith(".git")&&
  !repo.endsWith(".")&&!repo.includes("..");
}
/**
 * Generic, deliberately restricted GET-only transport. GH_TOKEN may contain
 * a read-only credential for private metadata: it is never logged or returned.
 */
export function createV3LabReadOnlyClient({
 repository,token="",fetchImpl=fetch
}={}){
 if(!valid(repository)||typeof token!=="string"||token.length>2048||
    typeof fetchImpl!=="function")
  throw Error("invalid_lab_read_client_configuration");
 const root=base(repository);
 const allowed=path=>path===root||
  new RegExp("^"+root.replaceAll("/","\\/")+
    "\\/rulesets\\?per_page=100&page=[1-3]$").test(path);
 return createGithubClient({timeoutMs:10000,transport:async(path,{timeoutMs})=>{
  if(!allowed(path))throw Object.assign(Error("lab_get_path_denied"),
    {code:"invalid_path"});
  const headers={"accept":"application/vnd.github+json",
   "x-github-api-version":"2022-11-28"};
  if(token)headers.authorization="Bearer "+token;
  const response=await fetchImpl("https://api.github.com/"+path,{
   method:"GET",redirect:"error",headers,signal:AbortSignal.timeout(timeoutMs)
  });
  if(!response||!response.ok)throw Object.assign(Error("lab_read_failed"),
    {status:response?.status??null});
  return response.json();
 }});
}
/**
 * Candidate means only that the rulesets endpoint can be read. Never equate
 * API readability, a public repository or a GitHub App ID with G2/G3 PASS.
 */
export async function auditV3LabEligibility({repository,readClient}={}){
 if(!valid(repository))
  return deny("rejected","dedicated_owner_lab_repository_required");
 if(typeof readClient?.get!=="function")
  return deny("uncertain","read_only_client_required",repository);
 const root=base(repository);
 let meta;
 try{meta=await readClient.get(root);}
 catch{return deny("uncertain","repository_metadata_unavailable",repository);}
 if(meta?.ok!==true||meta.data?.full_name?.toLowerCase()!==
    repository.toLowerCase()||
    !["private","public"].includes(meta.data?.visibility)||
    typeof meta.data?.archived!=="boolean")
  return deny("uncertain","repository_identity_or_metadata_unverified",repository);
 if(meta.data.archived)
  return deny("blocked","archived_repository_not_eligible",repository);
 const visibility=meta.data.visibility;
 const ids=new Set();
 for(let page=1;page<=MAX_PAGES;page++){
  let result;
  try{
   result=await readClient.get(root+
    "/rulesets?per_page="+PAGE_SIZE+"&page="+page);
  }catch{return deny("uncertain","rulesets_read_failed",repository);}
  if(result?.ok!==true){
   const status=result?.error?.status;
   return deny(status===403||status===401?"blocked":"uncertain",
    status===403||status===401?"rulesets_endpoint_forbidden_scope_or_plan":
     "rulesets_endpoint_not_verified",repository,{httpStatus:status??null,
      visibility});
  }
  if(!Array.isArray(result.data)||result.data.length>PAGE_SIZE)
   return deny("uncertain","rulesets_invalid_response",repository);
  for(const item of result.data){
   if(!Number.isSafeInteger(item?.id)||item.id<=0||ids.has(item.id))
    return deny("uncertain","rulesets_duplicate_or_invalid",repository);
   ids.add(item.id);
  }
  if(result.data.length<PAGE_SIZE){
   return deny("candidate_only","rulesets_api_readable_not_lab_approved",
    repository,{visibility,rulesetCount:ids.size,
     hasRulesets:ids.size>0,rulesetsEnumerationComplete:true,
     separateControllerExecutorAppsVerified:false});
  }
 }
 return deny("uncertain","rulesets_pagination_limit",repository);
}
export async function main(args=process.argv.slice(2),env=process.env,
 fetchImpl=fetch){
 if(args.length!==1||!valid(args[0])){
  process.stderr.write("ASF V3 lab audit: expected dedicated cedricmenec/<repo>, not threadstep\n");
  return 1;
 }
 const client=createV3LabReadOnlyClient({
  repository:args[0],token:env.GH_TOKEN??"",fetchImpl
 });
 const result=await auditV3LabEligibility({repository:args[0],readClient:client});
 process.stdout.write(JSON.stringify(result)+"\n");
 // A 0 exit code means READ API OBSERVABLE, never G2/G3 authorization.
 return result.status==="candidate_only"?0:1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().then(code=>{process.exitCode=code;},()=>{
  process.stderr.write("ASF V3 lab audit: failed closed\n");
  process.exitCode=1;
 });
}
