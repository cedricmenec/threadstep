// Trusted runner-only policy for all OpenCode calls. Never let OpenCode pick
// a metered title/image model outside the explicitly selected workflow model.
// No API key or other credential is read, written or printed by this module.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const APPROVED_OPENCODE_MODELS = Object.freeze([
  "openrouter/deepseek/deepseek-v4.1-flash",
  "openrouter/deepseek/deepseek-v4.1-flash-1017",
  "openrouter/z-ai/glm-5.3-flash"
]);

export function buildOpenCodeModelPolicy(model) {
  if (typeof model !== "string" || !APPROVED_OPENCODE_MODELS.includes(model)) {
    throw new Error("OpenCode model is not on the approved workflow allowlist");
  }
  return {
    model,
    // Title selection otherwise silently chooses a separate, possibly paid
    // image-capable OpenRouter model. Keep any other small-model request on
    // the one authorized provider/model.
    small_model: model,
    // CI runs do not need generated conversation titles. Disable the hidden
    // agent rather than merely changing which model it would bill.
    agent: { title: { disable: true } }
  };
}

export function modelPolicyEnvironmentLine(model) {
  return "OPENCODE_CONFIG_CONTENT=" + JSON.stringify(buildOpenCodeModelPolicy(model));
}

function main() {
  const output = process.env.GITHUB_ENV;
  if (!output) throw new Error("GITHUB_ENV is required on the Actions runner");
  appendFileSync(output, modelPolicyEnvironmentLine(process.env.OPENCODE_MODEL) + "\n", "utf8");
  process.stdout.write("OpenCode background title generation disabled; approved model enforced.\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write("::error::" + error.message + "\n");
    process.exitCode = 1;
  }
}
