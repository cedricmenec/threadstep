// Pure UI ordering helpers shared by the Cloud diagnostics and footer. The
// historical migration offer, dismissal storage and V1 messages were retired
// with the V1 runtime; this module only keeps generation-safe footer ordering.

// Monotonic in-memory sequence. Every new evaluation starts a newer generation;
// a result may render only while its captured generation is still current.
export function createGenerationGuard() {
  let current = 0;
  return {
    begin() {
      current += 1;
      return current;
    },
    invalidate() {
      current += 1;
      return current;
    },
    current() {
      return current;
    },
    isCurrent(generation) {
      return generation === current;
    }
  };
}

export function initialFooterStatus() {
  return { owner: null, message: "", generation: 0, revision: 0 };
}

// Ordinary notices and real errors take ownership; a diagnostic message cannot
// overwrite a real error. A diagnostic-owned message can only be cleared by the
// current generation.
export function reduceFooterStatus(current, event = {}) {
  const state = current && typeof current === "object" ? current : initialFooterStatus();
  const owner = typeof state.owner === "string" ? state.owner : null;
  const message = typeof state.message === "string" ? state.message : "";
  const generation = Number.isFinite(state.generation) ? state.generation : 0;
  const revision = Number.isFinite(state.revision) ? state.revision : 0;
  const eventGeneration = Number.isFinite(event.generation) ? event.generation : generation;
  switch (event.type) {
    case "notice":
      return { owner: "notice", message: typeof event.message === "string" ? event.message : "", generation, revision: revision + 1 };
    case "error":
      return { owner: "error", message: typeof event.message === "string" ? event.message : "", generation, revision: revision + 1 };
    case "migration":
      if (owner === "error") return { owner, message, generation, revision };
      if (eventGeneration < generation) return { owner, message, generation, revision };
      return {
        owner: "migration",
        message: typeof event.message === "string" ? event.message : "",
        generation: eventGeneration,
        revision: revision + 1
      };
    case "migration-clear":
      if (owner !== "migration") return { owner, message, generation, revision };
      if (eventGeneration < generation) return { owner, message, generation, revision };
      return { owner: null, message: "", generation, revision: revision + 1 };
    default:
      return { owner, message, generation, revision };
  }
}

export function footerMessage(state) {
  return state && typeof state.message === "string" ? state.message : "";
}
