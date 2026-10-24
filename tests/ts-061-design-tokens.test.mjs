import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const tokens = read("site/styles/tokens.css");
const styles = read("site/styles.css");

function tokenValue(name) {
  const match = new RegExp("--" + name + "\\s*:\\s*([^;]+);").exec(tokens);
  assert.ok(match, "missing token --" + name);
  return match[1].trim();
}

function hexToRgb(hex) {
  const value = hex.replace("#", "");
  assert.match(value, /^[0-9a-f]{6}$/i, "unsupported colour " + hex);
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((channel) => (
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

const TEXT_TARGET = 4.5;
const NON_TEXT_TARGET = 3;

const contrastPairs = [
  { id: "body-text", foreground: tokenValue("color-text"), background: tokenValue("color-page-bg"), kind: "text", usage: "Texte principal sur fond de page" },
  { id: "control-text", foreground: tokenValue("color-text-control"), background: tokenValue("color-surface"), kind: "text", usage: "Champs et commandes sur surface" },
  { id: "muted-text", foreground: tokenValue("color-text-muted"), background: tokenValue("color-surface"), kind: "text", usage: "Texte secondaire et compteurs" },
  { id: "secondary-text", foreground: tokenValue("color-text-secondary"), background: tokenValue("color-surface"), kind: "text", usage: "Notes et descriptions" },
  { id: "action-text", foreground: tokenValue("color-action-text"), background: tokenValue("color-action"), kind: "text", usage: "Libellé du bouton primaire" },
  { id: "focus", foreground: tokenValue("color-focus"), background: tokenValue("color-surface"), kind: "non-text", usage: "Contour de focus visible" },
  { id: "priority-urgent", foreground: tokenValue("color-priority-urgent-text"), background: tokenValue("color-priority-urgent-surface"), kind: "text", usage: "Badge de priorité urgent" },
  { id: "priority-normal", foreground: tokenValue("color-priority-normal-text"), background: tokenValue("color-priority-normal-surface"), kind: "text", usage: "Badge de priorité normal" },
  { id: "priority-later", foreground: tokenValue("color-priority-later-text"), background: tokenValue("color-priority-later-surface"), kind: "text", usage: "Badge de priorité plus tard" }
];

const exceptions = new Map([
  ["muted-text", "Palette existante, texte secondaire #859087 conservé sans correction de palette."],
  ["focus", "Focus existant #a9ba69 conservé ; correction soumise à une décision produit distincte."],
  ["priority-urgent", "Paire de badge préexistante très proche de la cible, non introduite par TS-061."],
  ["priority-later", "Badge de priorité préexistant conservé sans nouvelle couleur."]
]);

test("TS-061 tokens define every required semantic category with mapped values", () => {
  for (const category of [
    "Couleur",
    "Typographie",
    "Espacement",
    "Rayons",
    "Focus",
    "Erreur",
    "État désactivé",
    "Responsive"
  ]) {
    assert.match(tokens, new RegExp("/\\*\\s*" + category), "missing category " + category);
  }

  const required = {
    "color-page-bg": "#f6f5f1",
    "color-text": "#24382f",
    "color-text-muted": "#859087",
    "color-focus": "#a9ba69",
    "color-border": "#d4dbcf",
    "color-action": "#263d31",
    "color-action-hover": "#395b47",
    "font-size-control": ".88rem",
    "font-weight-bold": "700",
    "space-control-block": "12px",
    "radius-control": "10px",
    "radius-input": "9px",
    "focus-outline-width": "3px",
    "focus-outline-offset": "2px",
    "color-error": "#ad4938",
    "color-error-surface": "#fff0ed",
    "disabled-opacity": ".35",
    "content-max-width": "1000px",
    "detail-max-width": "760px",
    "control-target-min": "44px"
  };
  for (const [name, value] of Object.entries(required)) {
    assert.equal(tokenValue(name), value, name);
  }

  assert.match(tokens, /--breakpoint-compact:\s*620px/);
  assert.match(styles, /^@import "\.\/styles\/tokens\.css";/, "tokens imported first");
  assert.ok(styles.indexOf("@import") < styles.indexOf(":root{"));
});

test("TS-061 every referenced variable is defined once and shared rules consume tokens", () => {
  const definitions = [...tokens.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((match) => match[1]);
  assert.equal(new Set(definitions).size, definitions.length, "duplicate token definition");
  const defined = new Set(definitions);

  for (const source of [tokens, styles]) {
    for (const match of source.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
      assert.ok(defined.has(match[1]), "undefined variable " + match[1]);
    }
  }

  assert.equal((styles.match(/--[a-z0-9-]+\s*:/g) || []).length, 0, "tokens must stay in one source");

  for (const declaration of [
    ".primary,.secondary,.subtle,.danger,.file-action{border-radius:var(--radius-control)",
    "button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,.file-action:focus-visible{outline:var(--focus-outline)",
    ".priority-control{min-height:var(--control-target-min);min-width:var(--control-target-min)",
    ".priority-urgent{background:var(--color-priority-urgent-surface);color:var(--color-priority-urgent-text)}",
    ".task-edit-title{flex:1;min-width:0;border:1px solid var(--color-border)",
    ".subject-rename-input{flex:1;min-width:0;min-height:var(--control-target-min)",
    ".detail{width:100%;max-width:var(--detail-max-width)",
    ".edit-error{flex-basis:100%;margin:0;color:var(--color-error)"
  ]) {
    assert.ok(styles.includes(declaration), "missing tokenized declaration: " + declaration);
  }

  assert.match(styles, /\.subject-move:disabled\{opacity:var\(--disabled-opacity\)/);
  assert.match(styles, /\.task-menu-command:disabled\{opacity:var\(--disabled-opacity\)/);
  assert.match(styles, /@media\(max-width:620px\)/);
});

test("TS-061 no remote font, icon, stylesheet or framework is introduced", () => {
  for (const source of [tokens, styles]) {
    const withoutSvgNamespace = source.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, "");
    assert.doesNotMatch(withoutSvgNamespace, /https?:\/\//, "remote URL in CSS");
    assert.doesNotMatch(source, /@import\s+url\(/i, "remote @import");
    assert.doesNotMatch(source, /@font-face|fonts\.googleapis|cdn\.|unpkg|jsdelivr/i);
    assert.doesNotMatch(source, /tailwind|@tailwind/i);
  }
  assert.doesNotMatch(tokens, /@import/);
  const pkg = JSON.parse(read("package.json"));
  assert.deepEqual(Object.keys(pkg.dependencies).sort(), ["dexie", "dexie-cloud-addon", "react", "react-dom"]);
  assert.equal(pkg.devDependencies.tailwindcss, undefined);
});

test("TS-061 contrast is measured and every below-target pair is a declared exception", () => {
  const measured = new Map();
  for (const pair of contrastPairs) {
    const ratio = contrast(pair.foreground, pair.background);
    measured.set(pair.id, ratio);
    const target = pair.kind === "text" ? TEXT_TARGET : NON_TEXT_TARGET;
    if (ratio < target) {
      assert.ok(exceptions.has(pair.id), "unregistered contrast exception: " + pair.id + " = " + ratio.toFixed(2));
      assert.ok(exceptions.get(pair.id).length > 10, "exception justification too short: " + pair.id);
    } else {
      assert.equal(exceptions.has(pair.id), false, "unnecessary exception: " + pair.id);
    }
  }

  assert.ok(measured.get("body-text") >= TEXT_TARGET);
  assert.ok(measured.get("action-text") >= TEXT_TARGET);
  assert.ok(measured.get("focus") < NON_TEXT_TARGET);
  assert.ok(measured.get("muted-text") < TEXT_TARGET);
  assert.ok(measured.get("priority-later") < TEXT_TARGET);

  const docs = read("docs/product/ui-foundation.md");
  for (const [id, ratio] of measured) {
    assert.match(docs, new RegExp(id + "[\\s\\S]{0,120}" + ratio.toFixed(2)), "documented ratio for " + id);
  }
  assert.match(docs, /exceptions? préexistantes?/i);
  assert.doesNotMatch(docs, /contraste conforme à 100|toutes les paires atteignent/i);
});

test("TS-061 structural guards keep tokenized surfaces wrapping without fixed widths", () => {
  for (const selector of [".add-subject,.task-form", ".task-edit-form", ".subject-rename-form"]) {
    const match = new RegExp(escape(selector) + "\\{([^}]*)\\}").exec(styles);
    assert.ok(match, "missing rule " + selector);
    assert.match(match[1], /min-width:0/, selector + " min-width");
    assert.match(match[1], /max-width:100%/, selector + " max-width");
  }
  for (const rule of [
    /\.task-edit-form\{[^}]*flex-wrap:wrap/,
    /\.subject-rename-form\{[^}]*flex-wrap:wrap/
  ]) {
    assert.match(styles, rule);
  }
  assert.match(styles, /@media\(max-width:620px\)\{\.shell\{padding:22px 15px\}/);
  assert.match(styles, /\.task-row\{flex-wrap:wrap\}/);
  assert.match(styles, /\.task-form\{flex-wrap:wrap\}/);
  for (const rule of [".priority-control", ".task-menu-command", ".task-edit-title", ".subject-rename-input"]) {
    const escaped = escape(rule);
    const blocks = [...styles.matchAll(new RegExp(escaped + "(?::[a-z-]+)?\\{([^}]*)\\}", "g"))];
    for (const block of blocks) {
      for (const width of block[1].matchAll(/(?:^|;)\s*width\s*:\s*(\d+)px/g)) {
        assert.ok(Number(width[1]) <= 320, rule + " fixed width " + width[1]);
      }
    }
  }
});

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
