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

/**
 * Effective authorized workspace identity for transient collapse state.
 * Missing evidence is unavailable (null), never a different identity.
 */
export function authorizedWorkspaceIdentityKey(identity) {
  if (!identity || typeof identity !== "object") return null;
  const type = identity.type === "local" || identity.type === "synchronized" || identity.type === "synced"
    ? (identity.type === "local" ? "local" : "synced")
    : null;
  if (type === "local") return "local";
  if (type !== "synced") return null;
  const databaseName = typeof identity.databaseName === "string" ? identity.databaseName.trim() : "";
  if (!databaseName) return null;
  const userDigest = typeof identity.userDigest === "string" ? identity.userDigest : "";
  return "synced:" + databaseName + ":" + userDigest;
}

/**
 * Only a different, available authorized identity resets the expansion.
 * An unavailable identity keeps the last attested key and never resets.
 */
export function shouldResetExpandedParents(previousKey, nextIdentity) {
  const nextKey = authorizedWorkspaceIdentityKey(nextIdentity);
  if (nextKey === null) return false;
  if (typeof previousKey !== "string" || previousKey.length === 0) return false;
  return previousKey !== nextKey;
}
