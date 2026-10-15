import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const agent = readFileSync(new URL('../.github/workflows/agent-openspec.yml', import.meta.url), 'utf8');
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const cfg = readFileSync(new URL('../openspec/config.yaml', import.meta.url), 'utf8');

test('OpenSpec pilot needs explicit manual phase and task', () => {
  assert.match(agent, /workflow_dispatch:/);
  assert.match(agent, /task_id:/);
  assert.match(agent, /- plan\n/);
  assert.match(agent, /- apply\n/);
  assert.doesNotMatch(agent, /^  push:/m);
  assert.doesNotMatch(agent, /^  pull_request:/m);
  assert.match(agent, /if: github.actor == github.repository_owner/);
});

test('Plan is isolated and apply checks task completion and tests', () => {
  assert.match(agent, /Plan changed a forbidden path/);
  assert.match(agent, /Apply changed a protected path/);
  assert.match(agent, /Unchecked tasks remain; refusing archive/);
  assert.match(agent, /Apply rewrote a reviewed OpenSpec artifact/);
  assert.match(agent, /npm run check/);
  assert.match(agent, /openspec archive "\$CHANGE_ID" --yes/);
  assert.match(agent, /gh pr create --draft/);
  assert.doesNotMatch(agent, /gh pr merge|gh api.*merge/);
});

test('OpenSpec version and independent validation stay pinned', () => {
  assert.match(cfg, /^schema: spec-driven/m);
  assert.match(agent, /@fission-ai\/openspec@1\.14\.1/);
  assert.match(ci, /@fission-ai\/openspec@1\.14\.1/);
  assert.match(ci, /openspec validate --all --strict --no-interactive/);
  assert.match(ci, /openspec validate --archived --strict --no-interactive/);
});


test('OPSX command files are initialized explicitly before paid phases', () => {
  assert.match(agent, /openspec init --tools opencode,agents/);
  assert.match(agent, /test -s \.opencode\/skills\/openspec-sync-specs\/SKILL\.md/);
  assert.match(agent, /test -s \.opencode\/commands\/opsx-sync\.md/);
  assert.match(agent, /test -s \.agents\/skills\/openspec-sync-specs\/SKILL\.md/);
  assert.match(agent, /opencode run .*--command opsx-sync "\$CHANGE_ID"/);
  assert.doesNotMatch(agent, /prompt="Perform \/opsx:sync/);
});

test('Semantic sync verifies content-level scope before archive', () => {
  assert.match(agent, /node scripts\/sync-guard\.mjs snapshot/);
  assert.match(agent, /node scripts\/sync-guard\.mjs verify/);
  assert.match(agent, /openspec archive "\$CHANGE_ID" --yes --skip-specs/);
});
