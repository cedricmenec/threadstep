import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const guard = fileURLToPath(new URL("../scripts/sync-guard.mjs", import.meta.url));

function git(dir, ...args) {
  execFileSync("git", args, { cwd: dir, stdio: "ignore" });
}

function put(dir, path, content) {
  const full = join(dir, path);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
}

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "opsx-guard-"));
  git(dir, "init", "-q");
  git(dir, "config", "user.name", "Test");
  git(dir, "config", "user.email", "test@example.invalid");
  put(dir, "site/app.js", "base");
  put(dir, "openspec/specs/capability/spec.md", "old canonical");
  put(dir, "openspec/changes/demo/tasks.md", "- [x] done");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "base");
  const snapshot = join(tmpdir(), "opsx-snapshot-" + dir.split("/").at(-1) + ".json");
  const run = mode => spawnSync(process.execPath, [guard, mode, snapshot], {
    cwd: dir, encoding: "utf8"
  });
  const cleanup = () => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(snapshot, { force: true });
  };
  return { dir, run, cleanup };
}

function withSnapshot(fn) {
  const f = fixture();
  try {
    assert.equal(f.run("snapshot").status, 0);
    fn(f);
  } finally {
    f.cleanup();
  }
}

test("permits a canonical spec change", () => withSnapshot(({ dir, run }) => {
  put(dir, "openspec/specs/capability/spec.md", "new canonical");
  assert.equal(run("verify").status, 0);
}));

test("permits a new canonical capability", () => withSnapshot(({ dir, run }) => {
  put(dir, "openspec/specs/new-capability/spec.md", "# New");
  assert.equal(run("verify").status, 0);
}));

test("rejects no-op sync", () => withSnapshot(({ run }) => {
  assert.notEqual(run("verify").status, 0);
}));

test("rejects changing tracked source already dirty before sync", () => {
  const f = fixture();
  try {
    put(f.dir, "site/app.js", "implementation in progress");
    assert.equal(f.run("snapshot").status, 0);
    put(f.dir, "site/app.js", "unwanted additional modification");
    put(f.dir, "openspec/specs/capability/spec.md", "updated");
    assert.notEqual(f.run("verify").status, 0);
  } finally { f.cleanup(); }
});

test("rejects modification of an already-untracked file", () => {
  const f = fixture();
  try {
    put(f.dir, "site/new.js", "new implementation");
    assert.equal(f.run("snapshot").status, 0);
    put(f.dir, "site/new.js", "tampered implementation");
    put(f.dir, "openspec/specs/capability/spec.md", "updated");
    assert.notEqual(f.run("verify").status, 0);
  } finally { f.cleanup(); }
});

test("rejects new files outside canonical specs", () => withSnapshot(({ dir, run }) => {
  put(dir, "site/new.js", "unexpected");
  put(dir, "openspec/specs/capability/spec.md", "updated");
  assert.notEqual(run("verify").status, 0);
}));

test("rejects deletion outside canonical specs", () => withSnapshot(({ dir, run }) => {
  rmSync(join(dir, "site/app.js"));
  put(dir, "openspec/specs/capability/spec.md", "updated");
  assert.notEqual(run("verify").status, 0);
}));

test("rejects a commit during semantic sync", () => withSnapshot(({ dir, run }) => {
  put(dir, "openspec/specs/capability/spec.md", "updated");
  git(dir, "add", ".");
  git(dir, "commit", "-qm", "unauthorized commit");
  assert.notEqual(run("verify").status, 0);
}));
