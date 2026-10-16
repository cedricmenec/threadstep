import test from "node:test";
import assert from "node:assert/strict";

// Intentionally failing, temporary ASF-V2-011 GitHub ruleset qualification.
// This file must NEVER be merged into main. Close the PR once failure is observed.
test("ASF-V2-011: an intentionally red check must block PR merging", () => {
  assert.fail("INTENTIONAL FAILURE: disposable CI-red exercise; DO NOT MERGE");
});
