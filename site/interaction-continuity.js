/**
 * Pure, non-persistent helpers for preserving a user's reading position.
 * DOM reads, focus and scrolling belong to the adapter in app.js.
 */
export function selectReadingAnchor(candidates, viewportHeight) {
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) return null;
  return candidates.find(({ key, top, bottom }) =>
    typeof key === "string" && key.length > 0 &&
    Number.isFinite(top) && Number.isFinite(bottom) &&
    bottom > 0 && top < viewportHeight
  ) || null;
}

export function resolveReadingAnchor(previousCandidates, selectedKey, currentKeys) {
  const current = new Set(currentKeys);
  const index = previousCandidates.findIndex((candidate) => candidate.key === selectedKey);
  if (index === -1) return null;
  if (current.has(selectedKey)) return previousCandidates[index];
  // If a filtered/deleted task disappears, keep a neighbouring visible item.
  for (let distance = 1; distance < previousCandidates.length; distance++) {
    const after = previousCandidates[index + distance];
    if (after && current.has(after.key)) return after;
    const before = previousCandidates[index - distance];
    if (before && current.has(before.key)) return before;
  }
  return null;
}

export function readingScrollDelta(previousTop, currentTop, viewportHeight) {
  if (![previousTop, currentTop, viewportHeight].every(Number.isFinite) ||
      viewportHeight <= 0) return null;
  const difference = currentTop - previousTop;
  // A validated anchor may be thousands of pixels below the viewport after
  // replaceChildren() temporarily shrinks a long list and resets scrollY.
  // Never cap that recovery by viewport height: the browser clamps to the
  // actual available page scroll range.
  return difference;
}

export function shouldRestoreInteraction(before, after) {
  return Boolean(before && after && before.view === after.view &&
    before.subjectId === after.subjectId &&
    before.generation === after.generation && before.allowed && after.allowed);
}
