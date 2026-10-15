import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { forbiddenPostSyncTasks } from "../scripts/check-openspec-task-phases.mjs";

test("rejects a checklist item whose post-sync step is wrapped", () => {
  const tasks = "# Tasks\n\n- [ ] 4.3 Before sync, inspect the delta; after sync, diff\n  the canonical spec against previous revision.\n";
  assert.equal(forbiddenPostSyncTasks(tasks).length, 1);
});

test("accepts an implementation task with a separate post-sync review section", () => {
  const tasks = "# Tasks\n- [ ] 4.3 Inspect the delta before the workflow gate.\n\n## Post-sync review\n- After sync, compare all other requirements and scenarios.\n";
  assert.deepEqual(forbiddenPostSyncTasks(tasks), []);
});

test("detects an already-checked impossible task and archive work", () => {
  const tasks = "# Tasks\n- [x] Do this after archiving the change.\n- [ ] Another step post-sync\n";
  assert.equal(forbiddenPostSyncTasks(tasks).length, 2);
});

test("allows ordinary implementation tasks and current TS-009 plan correction", () => {
  const tasks = "# Tasks\n- [ ] 1.1 Implement helper.\n  Run tests and compare behavior before sync.\n- [ ] 1.2 Write new tests.\n";
  assert.deepEqual(forbiddenPostSyncTasks(tasks), []);
});

test("OpenSpec workflow checks phase contract on plan and existing apply", () => {
  const workflow = readFileSync(new URL("../.github/workflows/agent-openspec.yml", import.meta.url), "utf8");
  assert.match(workflow, /node scripts\/check-openspec-task-phases\.mjs "\$change\/tasks\.md"/);
  assert.match(workflow, /node scripts\/check-openspec-task-phases\.mjs "openspec\/changes\/\$CHANGE_ID\/tasks\.md"/);
});
