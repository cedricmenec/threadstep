/**
 * Pure ownership boundary for a single bounded React surface.
 *
 * This module intentionally imports neither React nor Dexie. It only records
 * which renderer owns a container so the vanilla renderer can refuse to
 * replace descendants while a React root is active. Mounting is the caller's
 * responsibility; unmount callbacks stay synchronous so they can be invoked
 * from an explicit navigation or identity transition.
 */

function normalizedPart(value) {
  return typeof value === "string" ? value : "";
}

export function reactBoundaryKey({ view, subjectId = "", identity = null } = {}) {
  if (typeof view !== "string" || view.length === 0) {
    throw new TypeError("reactBoundaryKey requires a non-empty view");
  }
  return [view, normalizedPart(subjectId), normalizedPart(identity)].join("|");
}

export function createReactBoundary() {
  let active = null;
  let generation = 0;
  let lastInvalidation = null;

  const owner = () => active
    ? Object.freeze({
      key: active.key,
      container: active.container,
      generation: active.generation
    })
    : null;

  const owns = (container) => Boolean(active && active.container === container);

  const canWriteVanilla = (container) => !owns(container);

  function mount({ key, container, unmount } = {}) {
    if (typeof key !== "string" || key.length === 0) {
      throw new TypeError("react boundary mount requires a non-empty key");
    }
    if (!container || (typeof container !== "object" && typeof container !== "function")) {
      throw new TypeError("react boundary mount requires a container");
    }
    if (typeof unmount !== "function") {
      throw new TypeError("react boundary mount requires an unmount callback");
    }
    if (active) {
      if (active.key === key && active.container === container) {
        return Object.freeze({
          status: "reused",
          owner: owner(),
          release: active.release,
          invalidate: active.invalidate
        });
      }
      return Object.freeze({
        status: "refused",
        owner: owner(),
        reason: "boundary-busy"
      });
    }

    generation += 1;
    const mountedGeneration = generation;
    let released = false;
    const record = {
      key,
      container,
      unmount,
      generation: mountedGeneration,
      release: null,
      invalidate: null
    };

    const release = (reason = "release") => {
      if (released || !active || active.generation !== mountedGeneration) return false;
      released = true;
      const callback = active.unmount;
      active = null;
      callback({ reason: typeof reason === "string" ? reason : "release", invalidated: false });
      return true;
    };

    const invalidate = (reason = "invalidate") => {
      if (released || !active || active.generation !== mountedGeneration) return false;
      released = true;
      const normalizedReason = typeof reason === "string" && reason.length > 0
        ? reason
        : "invalidate";
      const callback = active.unmount;
      active = null;
      lastInvalidation = Object.freeze({
        reason: normalizedReason,
        generation: mountedGeneration
      });
      callback({ reason: normalizedReason, invalidated: true });
      return true;
    };

    record.release = release;
    record.invalidate = invalidate;
    active = record;

    return Object.freeze({
      status: "mounted",
      owner: owner(),
      release,
      invalidate
    });
  }

  function unmount(reason = "unmount") {
    return active ? active.release(reason) : false;
  }

  function invalidate(reason = "invalidate") {
    return active ? active.invalidate(reason) : false;
  }

  const lastInvalidationInfo = () => lastInvalidation;
  const activeCount = () => (active ? 1 : 0);

  return Object.freeze({
    mount,
    owner,
    owns,
    canWriteVanilla,
    unmount,
    invalidate,
    lastInvalidation: lastInvalidationInfo,
    activeCount
  });
}
