#!/usr/bin/env node
/**
 * ASF-OPSX-02: reject non-executable OpenSpec tasks BEFORE a paid apply call.
 * These conservative static signals do not prove a whole plan is feasible.
 * No model calls, repository writes or network requests.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const POST_SYNC = /\b(?:after\s+(?:the\s+)?(?:semantic\s+)?(?:opsx\s+)?(?:sync|synchronization|archiv(?:e|ing))|post[-\s](?:sync|archive)|après\s+(?:la\s+)?(?:synchro(?:nisation)?|archivage))\b/i;
const DEFERRED_WORKFLOW = /\b(?:after|once|following|when|upon)\b.{0,90}\b(?:PR|pull request|merge(?:d)?|publish(?:ed)?|archive(?:d)?|CI|deploy(?:ment|ed)?|GitHub Pages)\b|\b(?:après|une fois|suite à)\b.{0,90}\b(?:PR|fusion|publication|archivage|archive|CI|déploiement|Pages)\b/i;
const WORKFLOW_OPERATION = /^(?:\d+(?:\.\d+)*\s+)?(?:archive|publish|push|merge|deploy|ship|submit|open\s+(?:the\s+)?PR|create\s+(?:the\s+)?PR|archiver|publier|fusionner|déployer|pousser)\b.{0,100}\b(?:change|changes|specs|PR|pull request|GitHub|main|archive|Pages|deployment|production|production|changement|spécifications|branche|fusion)?/i;
const HUMAN_EXPLICIT = /\b(?:manually|manual (?:review|acceptance|inspection|verification|testing|test|QA|validation)|human[-\s]?only|human review|hands[-\s]?on|real[-\s]?browser|actual (?:browser|phone|device)|physical (?:device|phone)|on (?:an?\s+)?(?:real|physical) (?:phone|device)|visually inspect|visual review|recette manuelle|validation humaine|revue humaine|navigateur réel|téléphone (?:réel|physique)|au clavier seul|au toucher)\b/i;
const HUMAN_VERB = /\b(?:verify|validate|confirm|check|test|inspect|review|exercise|try|observe|vérifier|valider|confirmer|contrôler|tester|parcourir|examiner|essayer|observer)\b/i;
const UI_CONTEXT = /\b(?:browser|navigateur|viewport|mobile|responsive|keyboard|clavier|touch|tactile|screen|écran|visual(?:ly)?|visuell?e?ment|visuel|rendered|affichage|focus|contrast|contraste|screen[-\s]?reader|lecteur d[’']écran|mouse|souris|drag[-\s]?and[-\s]?drop)\b/i;
const AUTOMATED_EVIDENCE = /\b(?:unit tests?|integration tests?|automated tests?|deterministic tests?|test runner|node tests?|jsdom|playwright|puppeteer|assert(?:ions?)?|static checks?|simulat(?:e|ed|ion)|mock(?:s|ed)?|tests? (?:unitaires?|automatisés?|déterministes?)|contrôles? statiques?|vérifications? automatisées?)\b/i;
const REVIEW_SECTION = /\b(?:manual acceptance|recette manuelle|validation humaine|post[-\s]?sync review|revue post[-\s]?sync|post[-\s]?archive review|contrôles? après (?:sync|archivage|fusion))\b/i;

/** Parse real checklist items (not fenced examples), including indented continuations. */
export function checklistEntries(markdown) {
  const lines = markdown.split(/\r?\n/);
  const entries = [];
  const headings = [];
  let current = null;
  let fence = null;

  const flush = () => { if (current) entries.push(current); current = null; };
  for (const [index, line] of lines.entries()) {
    const openFence = /^\s*(`{3,}|~{3,})/.exec(line);
    if (openFence) {
      if (!fence) { flush(); fence = openFence[1][0]; }
      else if (openFence[1][0] === fence) fence = null;
      continue;
    }
    if (fence) continue;
    const heading = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (heading) {
      flush();
      const level = heading[1].length;
      while (headings.length && headings.at(-1).level >= level) headings.pop();
      headings.push({ level, title: heading[2] });
      continue;
    }
    const checkbox = /^\s*-\s+\[[ xX]\]\s+(.+)$/.exec(line);
    if (checkbox) {
      flush();
      current = { line: index + 1, text: checkbox[1], reviewSection: headings.some(h => REVIEW_SECTION.test(h.title)) };
      continue;
    }
    if (current && /^\s{2,}\S/.test(line)) {
      current.text += " " + line.trim();
    } else if (!line.trim() || /^\s*[-*+]\s+/.test(line)) {
      flush();
    }
  }
  flush();
  return entries;
}

export function forbiddenPostSyncTasks(markdown) {
  return checklistEntries(markdown)
    .filter(entry => POST_SYNC.test(entry.text))
    .map(({ line, text }) => ({ line, text }));
}

/** Fail closed for recognizable, runner-impossible work, including checked entries. */
export function forbiddenImplementationTasks(markdown) {
  return checklistEntries(markdown).flatMap(({ line, text, reviewSection }) => {
    const normalized = text.replace(/^\d+(?:\.\d+)*\s+/, "");
    let reason = null;
    if (reviewSection) {
      reason = "Checkbox inside Manual acceptance or Post-sync review";
    } else if (POST_SYNC.test(normalized) || DEFERRED_WORKFLOW.test(normalized)) {
      reason = "Depends on OPSX sync, archive or a post-publication event";
    } else if (HUMAN_EXPLICIT.test(normalized)) {
      reason = "Requires manual, real-device or human acceptance";
    } else if (WORKFLOW_OPERATION.test(normalized)) {
      reason = "Requests sync/archive/publication as an apply task";
    } else if (HUMAN_VERB.test(normalized) && UI_CONTEXT.test(normalized) && !AUTOMATED_EVIDENCE.test(normalized)) {
      reason = "UI acceptance has no explicit runner-executable test";
    }
    return reason ? [{ line, text, reason }] : [];
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const path = process.argv[2];
    if (!path || process.argv.length !== 3) {
      throw new Error("Usage: node scripts/check-openspec-task-phases.mjs <tasks.md>");
    }
    const markdown = readFileSync(path, "utf8");
    const issues = forbiddenImplementationTasks(markdown);
    if (!checklistEntries(markdown).length) {
      console.error("::error file=" + path + ",line=1::Missing executable implementation checklist; refusing paid apply");
      process.exitCode = 1;
    } else if (issues.length) {
      for (const { line, text, reason } of issues) {
        console.error("::error file=" + path + ",line=" + line + "::" + reason + ": " + text.replace(/\s+/g, " "));
      }
      console.error("Move non-runner checks to plain Manual acceptance or Post-sync review sections without checkboxes, and keep automated assertions in the apply checklist. No paid apply may start.");
      process.exitCode = 1;
    } else {
      console.log("OpenSpec pre-sync checklist gate verified (" + checklistEntries(markdown).length + " executable items)");
    }
  } catch (error) {
    console.error("::error::OpenSpec checklist preflight unavailable: " + error.message);
    process.exitCode = 1;
  }
}
