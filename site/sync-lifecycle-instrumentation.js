// Bounded, in-memory lifecycle instrumentation for the shareable sync report.
// It records only normalized states, counters and timestamps: never messages,
// emails, OTP codes, tokens, identities or stacks, and never writes to storage.
export const LIFECYCLE_DB_OPEN = Object.freeze({
  NOT_STARTED: "not-started",
  PENDING: "pending",
  RESOLVED: "resolved",
  FAILED: "failed"
});

export const LIFECYCLE_OTP = Object.freeze({
  NOT_REQUESTED: "not-requested",
  REQUESTED: "requested",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  CANCELLED: "cancelled"
});

export const LIFECYCLE_OBSERVABLES = Object.freeze([
  "currentUser",
  "syncState",
  "persistedSyncState"
]);

export const MAX_LIFECYCLE_AGE_SECONDS = 7 * 24 * 60 * 60;

const DB_STATES = new Set(Object.values(LIFECYCLE_DB_OPEN));
const OTP_STATES = new Set(Object.values(LIFECYCLE_OTP));
const OBSERVABLE_NAMES = new Set(LIFECYCLE_OBSERVABLES);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeNow(clock, fallback) {
  try {
    const value = clock();
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function ageSeconds(from, now) {
  if (!Number.isFinite(from) || !Number.isFinite(now)) return null;
  const difference = Math.max(0, now - from);
  return Math.min(MAX_LIFECYCLE_AGE_SECONDS, Math.round(difference / 1000));
}

export function formatBoundedAge(value) {
  if (!Number.isFinite(value) || value < 0) return "non disponible";
  const seconds = Math.min(MAX_LIFECYCLE_AGE_SECONDS, Math.round(value));
  if (seconds >= MAX_LIFECYCLE_AGE_SECONDS) return "≥ 7 jours";
  if (seconds < 60) return seconds + " s";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes + " min";
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours + " h";
  return Math.round(hours / 24) + " j";
}

function emptyObservable() {
  return {
    emissions: 0,
    initialEmissionAt: null,
    lastChangeAt: null
  };
}

export function createSyncLifecycleInstrumentation(options = {}) {
  const settings = isPlainObject(options) ? options : {};
  const clock = typeof settings.now === "function" ? settings.now : Date.now;
  const origin = safeNow(clock, 0);

  let dbOpenState = LIFECYCLE_DB_OPEN.NOT_STARTED;
  let dbOpenStartedAt = null;
  let dbOpenChangedAt = null;
  const observables = Object.fromEntries(LIFECYCLE_OBSERVABLES.map((name) => [name, emptyObservable()]));
  let otpState = LIFECYCLE_OTP.NOT_REQUESTED;
  let otpRequestedAt = null;
  let otpChangedAt = null;

  // Every recorder is wrapped: instrumentation can never reject, block or
  // delay the native bootstrap, authentication or synchronization path.
  function record(action) {
    try {
      const now = safeNow(clock, origin);
      action(now);
      return true;
    } catch {
      return false;
    }
  }

  function dbOpenStarted() {
    return record((now) => {
      if (dbOpenState === LIFECYCLE_DB_OPEN.PENDING) return;
      dbOpenState = LIFECYCLE_DB_OPEN.PENDING;
      dbOpenStartedAt = now;
      dbOpenChangedAt = now;
    });
  }

  function dbOpenResolved() {
    return record((now) => {
      dbOpenState = LIFECYCLE_DB_OPEN.RESOLVED;
      dbOpenChangedAt = now;
    });
  }

  function dbOpenFailed() {
    return record((now) => {
      dbOpenState = LIFECYCLE_DB_OPEN.FAILED;
      dbOpenChangedAt = now;
    });
  }

  function observeObservable(name) {
    if (!OBSERVABLE_NAMES.has(name)) return false;
    return record((now) => {
      const entry = observables[name];
      entry.emissions += 1;
      if (entry.initialEmissionAt === null) entry.initialEmissionAt = now;
      entry.lastChangeAt = now;
    });
  }

  function observeInitial(name) {
    if (!OBSERVABLE_NAMES.has(name)) return false;
    return record((now) => {
      const entry = observables[name];
      if (entry.initialEmissionAt === null) entry.initialEmissionAt = now;
    });
  }

  function otpRequested() {
    return record((now) => {
      otpState = LIFECYCLE_OTP.REQUESTED;
      otpRequestedAt = now;
      otpChangedAt = now;
    });
  }

  function otpSucceeded() {
    return record((now) => {
      if (otpState === LIFECYCLE_OTP.NOT_REQUESTED) otpRequestedAt = now;
      otpState = LIFECYCLE_OTP.SUCCEEDED;
      otpChangedAt = now;
    });
  }

  function otpFailed() {
    return record((now) => {
      if (otpState === LIFECYCLE_OTP.NOT_REQUESTED) otpRequestedAt = now;
      otpState = LIFECYCLE_OTP.FAILED;
      otpChangedAt = now;
    });
  }

  function otpCancelled() {
    return record((now) => {
      otpState = LIFECYCLE_OTP.CANCELLED;
      otpChangedAt = now;
    });
  }

  function snapshot(at) {
    const now = Number.isFinite(at) ? at : safeNow(clock, origin);
    return {
      dbOpen: {
        state: DB_STATES.has(dbOpenState) ? dbOpenState : LIFECYCLE_DB_OPEN.NOT_STARTED,
        startedAgeSeconds: ageSeconds(dbOpenStartedAt, now),
        lastAgeSeconds: ageSeconds(dbOpenChangedAt, now)
      },
      observables: Object.fromEntries(LIFECYCLE_OBSERVABLES.map((name) => {
        const entry = observables[name];
        return [name, {
          emissions: entry.emissions,
          initialEmissionAgeSeconds: ageSeconds(entry.initialEmissionAt, now),
          lastChangeAgeSeconds: ageSeconds(entry.lastChangeAt, now)
        }];
      })),
      otp: {
        state: OTP_STATES.has(otpState) ? otpState : LIFECYCLE_OTP.NOT_REQUESTED,
        requestedAgeSeconds: ageSeconds(otpRequestedAt, now),
        lastAgeSeconds: ageSeconds(otpChangedAt, now)
      }
    };
  }

  return {
    dbOpenStarted,
    dbOpenResolved,
    dbOpenFailed,
    observeObservable,
    observeInitial,
    otpRequested,
    otpSucceeded,
    otpFailed,
    otpCancelled,
    snapshot
  };
}
