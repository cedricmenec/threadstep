import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const workflowDir = new URL("../.github/workflows/", import.meta.url);

function shellBlocks(yaml) {
  const lines = yaml.split(/\r?\n/);
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const match = /^(\s*)run:\s*\|\s*$/.exec(lines[i]);
    if (!match) continue;
    const runLine = i + 1;
    const contentIndent = match[1].length + 2;
    const block = [];
    while (++i < lines.length) {
      const line = lines[i];
      if (line.trim() && (line.match(/^\s*/)?.[0].length ?? 0) < contentIndent) {
        i--;
        break;
      }
      block.push(line.trim() ? line.slice(contentIndent) : "");
    }
    blocks.push({ runLine, script: block.join("\n") + "\n" });
  }
  return blocks;
}

test("every multi-line GitHub Actions run block is valid Bash syntax", () => {
  for (const filename of readdirSync(workflowDir).filter(name => /\.ya?ml$/.test(name))) {
    const workflow = readFileSync(new URL(filename, workflowDir), "utf8");
    for (const { runLine, script } of shellBlocks(workflow)) {
      const r = spawnSync("bash", ["-n"], { input: script, encoding: "utf8" });
      assert.equal(r.status, 0, filename + ":" + runLine + " invalid Bash: " + r.stderr);
    }
  }
});

test("manual agent publishes only once and requests optional merge only once", () => {
  const yaml = readFileSync(new URL("agent.yml", workflowDir), "utf8");
  assert.equal((yaml.match(/- name: Validate and publish PR/g) ?? []).length, 1);
  assert.equal((yaml.match(/- name: Request safe GitHub auto-merge after independent CI/g) ?? []).length, 1);
  assert.match(yaml, /\|\^scripts\/\|\^docs\/factory\/\|\^backlog\/\|\^openspec\/config/);
});
