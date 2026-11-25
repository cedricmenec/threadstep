#!/usr/bin/env node
/**
 * ASF-V3-038 | G1 structural audit only. No writes or authorizations.
 *
 * This optional CLI is NOT wired to workflows, does not create GitHub App
 * tokens, read PEM keys, alter rulesets/refs, dispatch or invoke a paid model.
 * GH_TOKEN is a READ-ONLY transport credential supplied by the caller. A
 * positive result never verifies its scope or grants App/paid authority.
 *
 * Usage: GH_TOKEN=<read-only token> node .../g1-readonly-audit.mjs <main SHA40>
 */
import {pathToFileURL} from "node:url";
import {createGithubClient} from "../github/client.mjs";
import {observeAsfV3AppPermissionsReadiness}
 from "./github-app-permission-readiness.mjs";

const REPO="cedricmenec/threadstep",BASE="repos/"+REPO;
const SHA=/^[a-f0-9]{40}$/;
const READ_PATH=new RegExp("^"+BASE.replaceAll("/","\\/")+
 "(?:\\/rulesets(?:\\/[1-9][0-9]{0,17})?|"+
 "\\/git\\/ref\\/heads\\/(?:main|asf\\/control\\/active-wave-v3))$");

/** Reject every non-allowlisted target BEFORE any HTTP request. */
export function createV3G1ReadOnlyClient({token,fetchImpl=fetch}={}){
 if(typeof token!=="string"||token.length<1||token.length>2048||
    typeof fetchImpl!=="function")throw Error("g1_readonly_client_not_configured");
 return createGithubClient({timeoutMs:10000,transport:async(path,{timeoutMs})=>{
  if(!READ_PATH.test(path))throw Object.assign(Error("g1_read_path_denied"),
   {code:"invalid_path"});
  const res=await fetchImpl("https://api.github.com/"+path,{
   method:"GET",redirect:"error",signal:AbortSignal.timeout(timeoutMs),
   headers:{"accept":"application/vnd.github+json",
    "authorization":"Bearer "+token,
    "x-github-api-version":"2022-11-28"}
  });
  if(!res?.ok)throw Object.assign(Error("g1_read_unavailable"),
   {status:res?.status??null});
  return res.json();
 }});
}

/** Deliberately returns only safe diagnostics and explicit non-authority. */
export async function auditV3G1ReadOnly({readClient,expectedMainSha}={}){
 let result;
 try{
  result=await observeAsfV3AppPermissionsReadiness({
   readClient,expectedMainSha
  });
 }catch{
  result={status:"uncertain",reason:"g1_observation_exception"};
 }
 const evidence=result?.evidence;
 const output=Object.freeze({
  audit:"asf-v3-g1-read-only",repository:REPO,
  status:result.status,reason:result.reason,
  mainSha:SHA.test(expectedMainSha??"")?expectedMainSha:null,
  globalRulesetStatus:evidence?.globalRulesetStatus??null,
  waveRulesetStatus:evidence?.waveRulesetStatus??null,
  waveRulesetReason:evidence?.waveRulesetReason??null,
  globalRefState:evidence?.globalRefState??null,
  controllerAppId:5361227,executorAppId:5321746,
  structurallyObserved:result.status==="structurally_observed_not_authorized",
  actualAppPermissionsProven:false,realAppDenyTestsCompleted:false,
  authorized:false,canCreateRef:false,canWrite:false,
  canDispatch:false,canSpend:false,canRetry:false
 });
 return output;
}
export async function main(args=process.argv.slice(2),
 env=process.env,fetchImpl=fetch){
 if(args.length!==1||!SHA.test(args[0]??"")||
  typeof env.GH_TOKEN!=="string"||!env.GH_TOKEN)
 {
  process.stderr.write("ASF V3 G1: expected SHA40 and read-only GH_TOKEN required\\n");
  return 1;
 }
 try{
  const readClient=createV3G1ReadOnlyClient({token:env.GH_TOKEN,fetchImpl});
  const out=await auditV3G1ReadOnly({
   readClient,expectedMainSha:args[0]
  });
  process.stdout.write(JSON.stringify(out)+"\\n");
  // Structural success is explicitly NON-AUTHORIZING, not a GO for G2/G4.
  return out.structurallyObserved?0:1;
 }catch{
  process.stderr.write("ASF V3 G1: uncertain/read_only_observation_failed\\n");
  return 1;
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().then(n=>{process.exitCode=n;},()=>{
  process.stderr.write("ASF V3 G1: uncertain/unhandled\\n");
  process.exitCode=1;
 });
}
