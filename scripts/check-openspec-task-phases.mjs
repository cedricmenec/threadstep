#!/usr/bin/env node
/**
 * An implementation checklist is gated before OpenSpec sync and archive.
 * Prevent impossible checklist items from reaching a paid apply run.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const POST_SYNC = /\b(?:after\s+(?:the\s+)?(?:semantic\s+)?(?:opsx\s+)?(?:sync|synchronization|archiv(?:e|ing))|post[-\s](?:sync|archive)|après\s+(?:la\s+)?(?:synchro(?:nisation)?|archivage))\b/i;

export function forbiddenPostSyncTasks(markdown) {
  const errors = [];
  let current = null;
  const flush = () => {
    if (current && POST_SYNC.test(current.text)) errors.push(current);
  };
  for (const [index, line] of markdown.split(/\r?\n/).entries()) {
    const match = /^\s*-\s+\[[ xX]\]\s+(.+)$/.exec(line);
    if (match) {
      flush();
      current = { line: index + 1, text: match[1] };
    } else if (/^#{1,6}\s+/.test(line) || /^\s*$/.test(line)) {
      flush();
      current = null;
    } else if (current && /^\s{2,}\S/.test(line)) {
      current.text += " " + line.trim();
    }
  }
  flush();
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const path = process.argv[2];
    if (!path) throw new Error("Usage: node scripts/check-openspec-task-phases.mjs <tasks.md>");
    const errors = forbiddenPostSyncTasks(readFileSync(path, "utf8"));
    if (errors.length) {
      for (const { line, text } of errors) {
        console.error("::error::Post-sync work appears inside a pre-sync checklist at " + path + ":" + line + ": " + text);
      }
      console.error("Move verification after OPSX sync/archive into a plain post-sync review section without checkboxes.");
      process.exitCode = 1;
    } else {
      console.log("OpenSpec implementation checklist phase contract verified");
    }
  } catch (error) {
    console.error("::error::" + error.message);
    process.exitCode = 1;
  }
}
