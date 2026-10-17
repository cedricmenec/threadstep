/**
 * ASF-V3-028: conservative inert-fixture inspection, not a GitHub Actions
 * parser, live concurrency proof, or spend authorizer.
 */
export const ASF_V3_MUTEX_LAB_DIR = "docs/factory/labs/asf-v3-mutex";
const SHARED = "threadstep-paid-development-v1";
const ISOLATED = "threadstep-v3-mutex-lab-control";
const specs = Object.freeze({
  "v1-shared.yml": ["simulate-v1", SHARED],
  "v3-shared.yml": ["simulate-v3", SHARED],
  "v3-control.yml": ["simulate-control", ISOLATED]
});
const out = (status,reason) => Object.freeze({
  status,reason,authorized:false,canPay:false,canWrite:false,
  canDispatch:false,canSpend:false,canRetry:false
});
const reject = reason => out("rejected",reason);
export function inspectAsfV3MutexLabTemplates(templates) {
  if (templates===null || typeof templates!=="object" ||
      Array.isArray(templates) ||
      Object.keys(templates).sort().join("|")!==Object.keys(specs).sort().join("|"))
    return reject("template_set_mismatch");
  for (const [filename,[job,group]] of Object.entries(specs)) {
    const yaml=templates[filename];
    if(typeof yaml!=="string" || yaml.length>12000 || /\t|\r/.test(yaml))
      return reject("invalid_template_"+filename);
    if(!yaml.startsWith("name: ASF Mutex Lab ") ||
       !yaml.includes("\non:\n  workflow_dispatch:\n") ||
       !yaml.includes("\npermissions: {}\njobs:\n"))
      return reject("invalid_trigger_or_permissions_"+filename);
    if((yaml.match(/^on:/gm)||[]).length!==1 ||
       (yaml.match(/^jobs:/gm)||[]).length!==1 ||
       (yaml.match(/^  [a-z][a-z0-9-]*:/gm)||[]).length!==1)
      return reject("invalid_top_level_shape_"+filename);
    if(!yaml.includes("\n  "+job+":\n    if: ${{ github.event.repository.name == 'asf-v3-mutex-lab' }}\n"))
      return reject("isolated_repository_guard_missing_"+filename);
    if(!yaml.includes("\n    concurrency:\n      group: "+group+
        "\n      cancel-in-progress: false\n") ||
       (yaml.match(/^\s*concurrency:/gm)||[]).length!==1 ||
       (yaml.match(/^\s*group:/gm)||[]).length!==1 ||
       (yaml.match(/^\s*cancel-in-progress:/gm)||[]).length!==1)
      return reject("job_mutex_mismatch_"+filename);
    if(!yaml.includes("\n    timeout-minutes: 5\n") ||
       !yaml.includes("\n          case \"$HOLD_SECONDS\" in\n            15|45|120) ;;\n") ||
       !yaml.includes("\n          sleep \"$HOLD_SECONDS\"\n") ||
       !yaml.includes("\n      HOLD_SECONDS: ${{ inputs.hold_seconds }}\n"))
      return reject("bounded_simulation_missing_"+filename);
    if(/\b(?:push|pull_request|workflow_call|workflow_run|schedule|repository_dispatch):|\buses:|\b(?:curl|wget|gh|git|ssh)\s|secrets\.|OPENROUTER|\bwrite\b|https?:\/\//i.test(yaml))
      return reject("forbidden_execution_or_privilege_"+filename);
    if(!yaml.includes("          set -euo pipefail\n") ||
       (yaml.match(/^        run: \|$/gm)||[]).length!==1)
      return reject("invalid_script_shape_"+filename);
  }
  return out("inert_lab_templates_structurally_valid",
    "static_template_checks_only_live_execution_not_performed");
}
