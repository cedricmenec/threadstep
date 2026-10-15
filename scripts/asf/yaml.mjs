#!/usr/bin/env node
/**
 * Minimal, strict YAML frontmatter reader for Backlog V2 task files.
 *
 * It deliberately supports only the subset used by the versioned contract:
 *   - a closed `---` fenced block at the very start of the file;
 *   - top-level `key: scalar` mappings;
 *   - one level of nested mappings (used by archive `delivery` metadata);
 *   - block sequences of scalars (`- value`) and the empty collections `[]` / `{}`.
 *
 * Duplicate keys, tabs, unclosed blocks, unknown YAML constructs and malformed
 * quoting are rejected with a line number. There is no dependency on a YAML
 * library, no network use and no silent coercion of wrong node kinds.
 */

export class FrontmatterError extends Error {
  constructor(message, line) {
    super(line ? message + " (line " + line + ")" : message);
    this.name = "FrontmatterError";
    if (line) this.line = line;
  }
}

const KEY_PATTERN = /^[A-Za-z0-9_]+$/;

export function extractFrontmatter(text) {
  if (typeof text !== "string") throw new FrontmatterError("Frontmatter source must be text");
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] !== "---") return null;
  let end = -1;
  for (let index = 1; index < lines.length; index++) {
    if (lines[index] === "---") { end = index; break; }
  }
  if (end === -1) throw new FrontmatterError("Unclosed YAML frontmatter block", 1);

  const block = [];
  for (let index = 1; index < end; index++) {
    const raw = lines[index];
    if (raw.includes("\t")) throw new FrontmatterError("Tabs are not allowed", index + 1);
    const content = raw.replace(/[ ]+$/, "");
    const trimmed = content.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = content.length - content.trimStart().length;
    block.push({ indent, text: content.slice(indent), line: index + 1 });
  }

  const [fields, consumed] = parseMapping(block, 0, 0);
  if (consumed !== block.length) {
    throw new FrontmatterError("Inconsistent indentation", block[consumed].line);
  }
  return { fields, body: lines.slice(end + 1).join("\n") };
}

function parseMapping(lines, start, indent) {
  const result = {};
  const seen = new Set();
  let index = start;
  while (index < lines.length) {
    const entry = lines[index];
    if (entry.indent < indent) break;
    if (entry.indent > indent) throw new FrontmatterError("Unexpected indentation", entry.line);
    const { key, value } = splitKeyValue(entry.text, entry.line);
    if (seen.has(key)) throw new FrontmatterError('Duplicate key "' + key + '"', entry.line);
    seen.add(key);
    if (value !== "") {
      result[key] = parseScalar(value, entry.line);
      index++;
      continue;
    }
    const next = lines[index + 1];
    if (!next || next.indent <= indent) {
      result[key] = null;
      index++;
      continue;
    }
    if (next.text === "-" || next.text.startsWith("- ")) {
      const [sequence, nextIndex] = parseSequence(lines, index + 1, next.indent);
      result[key] = sequence;
      index = nextIndex;
    } else {
      const [mapping, nextIndex] = parseMapping(lines, index + 1, next.indent);
      result[key] = mapping;
      index = nextIndex;
    }
  }
  return [result, index];
}

function parseSequence(lines, start, indent) {
  const items = [];
  let index = start;
  while (index < lines.length && lines[index].indent === indent &&
    (lines[index].text === "-" || lines[index].text.startsWith("- "))) {
    const item = lines[index].text === "-" ? "" : lines[index].text.slice(2).trim();
    if (!item) throw new FrontmatterError("Empty sequence item", lines[index].line);
    if (item.startsWith("-") || item.startsWith("[") || item.startsWith("{")) {
      throw new FrontmatterError("Nested sequence items are not supported", lines[index].line);
    }
    items.push(parseScalar(item, lines[index].line));
    index++;
  }
  if (index < lines.length && lines[index].indent > indent) {
    throw new FrontmatterError("Unexpected indentation in sequence", lines[index].line);
  }
  return [items, index];
}

function splitKeyValue(text, line) {
  const separator = text.indexOf(":");
  if (separator <= 0) throw new FrontmatterError("Expected a key: value pair", line);
  const key = text.slice(0, separator).trim();
  if (!KEY_PATTERN.test(key)) throw new FrontmatterError('Invalid key "' + key + '"', line);
  return { key, value: text.slice(separator + 1).trim() };
}

function parseScalar(value, line) {
  if (value === "[]") return [];
  if (value === "{}") return {};
  if (value.startsWith("[") || value.startsWith("{") || value.startsWith("&") ||
    value.startsWith("*") || value === "|" || value === ">") {
    throw new FrontmatterError("Unsupported YAML syntax", line);
  }
  if (value.startsWith('"') || value.startsWith("'")) {
    const quote = value[0];
    if (value.length < 2 || !value.endsWith(quote)) {
      throw new FrontmatterError("Unterminated quoted scalar", line);
    }
    return value.slice(1, -1);
  }
  return value;
}
