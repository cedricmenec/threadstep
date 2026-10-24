import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const guide = read("docs/product/developer-guide.md");
const architecture = read("docs/architecture.md");
const pkg = JSON.parse(read("package.json"));

test("TS-058 documentation lists the integration files and exact dependencies", () => {
  for (const file of [
    "site/react-boundary.js",
    "site/react-adapter.js",
    "tests/fixtures/ts-058/synthetic-project-detail.jsx",
    "tests/helpers/ts-058-react-harness.mjs",
    "tests/ts-058-react-toolchain.test.mjs",
    "tests/ts-058-react-boundary.test.mjs",
    "tests/ts-058-react-adapter.test.mjs",
    "tests/ts-058-react-integration.test.mjs",
    "tests/ts-058-react-docs.test.mjs"
  ]) {
    assert.ok(existsSync(resolve(root, file)), file);
    assert.ok(guide.includes(file), file + " must be documented");
  }
  assert.match(guide, /react@19\.3\.1/);
  assert.match(guide, /react-dom@19\.3\.1/);
  assert.match(guide, /jsdom@30\.1\.3/);
  assert.equal(pkg.dependencies.react, "19.3.1");
  assert.equal(pkg.dependencies["react-dom"], "19.3.1");
  assert.equal(pkg.devDependencies.jsdom, "30.1.3");
});

test("TS-058 documentation describes JSX, CSP, mount contract and invalidation", () => {
  assert.match(guide, /esbuild: \{ jsx: "automatic" \}/);
  assert.match(guide, /sans\s+Babel/);
  assert.match(guide, /sans\s+CDN/);
  assert.match(guide, /script-src 'self'/);
  assert.match(guide, /unsafe-inline/);
  assert.match(guide, /unsafe-eval/);
  assert.match(guide, /\/threadstep\//);
  assert.match(guide, /propriété DOM unique/);
  assert.match(guide, /canWriteVanilla/);
  assert.match(guide, /unmount/);
  assert.match(guide, /route/i);
  assert.match(guide, /identité\/espace autorisé/);
  assert.match(guide, /chargement bloquant/);
  assert.match(guide, /instantané détaché et figé/);
  assert.match(guide, /transient/);
  assert.match(guide, /commandes nommées/);
  assert.match(guide, /Diagnostic d'un conteneur vide ou remplacé/);
});

test("TS-058 documentation records the measured delta and the TS-059 activation scope", () => {
  const report = read("docs/product/react-project-detail-pilot.md");
  assert.match(guide, /687 844 octets/);
  assert.match(guide, /690 229 octets/);
  assert.match(guide, /\+2 385 octets/);
  assert.match(guide, /309 560 à 311 945 octets/);
  assert.match(guide, /TS-059/);
  assert.match(guide, /surface React du détail/);
  assert.match(report, /936 456 octets/);
  assert.match(report, /GO/);
});

test("TS-058 documentation separates automated proof from manual limits and rollback", () => {
  assert.match(guide, /jsdom/);
  assert.match(guide, /pas un rendu navigateur réel/);
  assert.match(guide, /focus/);
  assert.match(guide, /tactile/);
  assert.match(guide, /lecteur d'écran/);
  assert.match(guide, /Chrome Android/);
  assert.match(guide, /recette\s+reste\s+manuelle/);
  assert.match(guide, /Retour arrière/);
  assert.match(guide, /Aucune\s+préférence\s+persistée/);
  assert.match(guide, /aucune route\s+publique/i);
  assert.match(guide, /workflow/);
  assert.match(guide, /ASF-WF-004/);
  assert.match(architecture, /TS-058/);
  assert.match(architecture, /react-boundary\.js/);
  assert.match(architecture, /react-adapter\.js/);
  assert.match(architecture, /TS-059/);
  assert.match(architecture, /project-detail/);
});

test("TS-058 documentation checks the protected files were not modified", () => {
  const protectedPaths = [
    ".github/workflows",
    "AGENTS.md",
    "opencode.json",
    "backlog/tasks/TS-058.md",
    "openspec/specs"
  ];
  const output = execFileSync("git", ["status", "--porcelain", "--", ...protectedPaths], {
    cwd: root,
    encoding: "utf8"
  }).trim();
  assert.equal(output, "", "protected paths must stay untouched:\n" + output);
});
