import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const report = readFileSync(
  new URL("../docs/product/react-overview-ts-064-acceptance.md", import.meta.url),
  "utf8"
);
const overviewGuide = readFileSync(
  new URL("../docs/product/react-overview-cards.md", import.meta.url),
  "utf8"
);

test("TS-064 owner GO is traceable to a delivered commit and a reported device scope", () => {
  assert.match(report, /Date de déclaration : 26 octobre 2026/);
  assert.match(report, /e1e39f8b273ad85f97951163ae64394360031f4a/);
  assert.match(report, /pull\/214/);
  assert.match(report, /GO fonctionnel déclaré/);
  assert.match(report, /desktop réel/);
  assert.match(report, /Android réel/);
  assert.match(overviewGuide, /react-overview-ts-064-acceptance\.md/);
});

test("TS-064 attestation separates human declaration from unproven scenarios", () => {
  assert.match(report, /PASS \(déclaré\)/);
  assert.match(report, /PASS \(observation console rapportée\)/);
  assert.match(report, /NOT_RUN \(non attesté/);
  assert.match(report, /aucun résultat distinct/);
  assert.match(report, /ne prétend pas/);
  assert.match(report, /TS-065/);
  assert.doesNotMatch(report, /(?:lecteur d'écran|synchronisation multi-appareils) (?:réussi|validé)/i);
});
