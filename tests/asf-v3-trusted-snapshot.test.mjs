import test from "node:test";
import assert from "node:assert/strict";
import { createGithubClient } from "../scripts/asf/github/client.mjs";
import { contentSha256 } from "../scripts/asf/waves/hash.mjs";
import { createV3WaveReadPort, loadV3TrustedSnapshot } from "../scripts/asf/v3/trusted-snapshot.mjs";

const SHA = "a".repeat(40);
const REPO = "cedricmenec/threadstep";
const WAVE = "wave-123";
const manifest = () => ({
  schemaVersion: 2, waveId: WAVE, repository: REPO,
  backlogCommit: "b".repeat(40), limits: { maxTaskStarts: 10 }
});
const journal = (m = manifest()) => ({
  schemaVersion: 2, waveId: WAVE, manifestHash: contentSha256(m),
  revision: 1, status: "CHILD_ACKNOWLEDGED", reserved: 1,
  events: [{ seq: 1, type: "ACK_CHILD" }]
});
function mock(options = {}) {
  const m = options.manifest ?? manifest(), j = options.journal ?? journal(m);
  const calls = [];
  const client = createGithubClient({ transport: async path => {
    calls.push(path);
    if (options.failRef && path.includes("/git/ref/")) throw new Error("offline");
    if (options.failContents && path.includes("/contents/")) throw new Error("offline");
    if (path.endsWith("/git/ref/heads/asf/waves/" + WAVE)) {
      return { ref: "refs/heads/asf/waves/" + WAVE,
        object: { type: "commit", sha: options.headSha ?? SHA } };
    }
    const match = path.match(/\/contents\/(manifest|journal)\.json\?ref=([a-f0-9]{40})$/);
    if (!match) throw new Error("unrecognized path");
    const value = match[1] === "manifest" ? m : j;
    const bytes = Buffer.from(JSON.stringify(value), "utf8");
    return { type: "file", path: match[1] + ".json",
      size: options.badSize ? bytes.length + 1 : bytes.length,
      encoding: options.badEncoding ? "none" : "base64",
      content: bytes.toString("base64") };
  } });
  return { port: createV3WaveReadPort(client, REPO), calls };
}
const validators = {
  verifyManifest: m => m?.schemaVersion === 2 && m?.waveId === WAVE &&
    m.limits.maxTaskStarts === 10,
  replayJournal: (m, j) => j
};

test("read-only GitHub port fetches both wave documents by ONE immutable commit SHA", async () => {
  const { port, calls } = mock();
  const loaded = await loadV3TrustedSnapshot(port, WAVE, validators);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.headSha, SHA);
  assert.equal(loaded.journal.manifestHash, contentSha256(loaded.manifest));
  assert.deepEqual(calls, [
    "repos/" + REPO + "/git/ref/heads/asf/waves/" + WAVE,
    "repos/" + REPO + "/contents/manifest.json?ref=" + SHA,
    "repos/" + REPO + "/contents/journal.json?ref=" + SHA
  ]);
  assert.ok(Object.isFrozen(loaded.manifest) && Object.isFrozen(loaded.journal));
  assert.ok(Object.isFrozen(loaded.journal.events));
});

test("branch path and file path are a closed allowlist, no arbitrary endpoint", async () => {
  const { port } = mock();
  await assert.rejects(() => port.getRef("../secrets"));
  await assert.rejects(() => port.getFileAtCommit(SHA, ".github/workflows/ci.yml"));
  await assert.rejects(() => port.getFileAtCommit(SHA, "../journal.json"));
  await assert.rejects(() => port.getFileAtCommit("not-a-sha", "manifest.json"));
  assert.equal((await loadV3TrustedSnapshot(port, "../main", validators)).code,
    "invalid_reader_or_validator");
});

test("missing GitHub response and invalid Git ref fail closed", async () => {
  for (const opts of [{ failRef: true }, { failContents: true },
    { headSha: "e".repeat(40).slice(0, 39) }]) {
    const { port } = mock(opts);
    const res = await loadV3TrustedSnapshot(port, WAVE, validators);
    assert.equal(res.ok, false);
    assert.equal(res.status, "uncertain");
  }
});

test("malformed Contents metadata is never decoded as trusted bytes", async () => {
  for (const opts of [{ badSize: true }, { badEncoding: true }]) {
    const res = await loadV3TrustedSnapshot(mock(opts).port, WAVE, validators);
    assert.equal(res.status, "uncertain");
  }
});

test("manifest-journal mismatch, replay divergence and invalid policies are denied", async () => {
  const m = manifest();
  const mismatch = await loadV3TrustedSnapshot(mock({
    journal: { ...journal(m), manifestHash: "f".repeat(64) }
  }).port, WAVE, validators);
  assert.equal(mismatch.code, "manifest_journal_mismatch");
  const replay = await loadV3TrustedSnapshot(mock().port, WAVE, {
    ...validators, replayJournal: (_m, j) => ({ ...j, reserved: 99 })
  });
  assert.equal(replay.code, "journal_replay_mismatch");
  const malformed = await loadV3TrustedSnapshot(mock().port, WAVE, {
    ...validators, verifyManifest: () => false
  });
  assert.equal(malformed.code, "invalid_v3_manifest");
});

test("secret-bearing journal and oversized data are blocked before exposure", async () => {
  const j = { ...journal(), leaked: "ghp_" + "A".repeat(24) };
  const secret = await loadV3TrustedSnapshot(mock({ journal: j }).port, WAVE, validators);
  assert.equal(secret.code, "secret_in_wave_snapshot");
  const huge = await loadV3TrustedSnapshot(mock({ journal: { ...journal(),
    message: "z".repeat(550000) } }).port, WAVE, validators);
  assert.equal(huge.code, "github_snapshot_unavailable");
});

test("missing validators are NOT interpreted as permitted replay", async () => {
  const res = await loadV3TrustedSnapshot(mock().port, WAVE, {
    verifyManifest: () => true
  });
  assert.equal(res.ok, false);
  assert.equal(res.code, "invalid_reader_or_validator");
});
