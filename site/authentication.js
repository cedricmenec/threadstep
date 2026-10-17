export const AUTH_STATUS = Object.freeze({
  LOADING: "loading",
  AUTHENTICATED: "authenticated",
  SIGNED_OUT: "signed-out",
  EXPIRED: "expired",
  OFFLINE_REQUIRED: "offline-required",
  REFUSED: "refused"
});

export const AUTH_MESSAGE_KINDS = Object.freeze({
  SIGN_IN: "sign-in",
  INVALID_CODE: "invalid-code",
  EXPIRED_CODE: "expired-code",
  SESSION_EXPIRED: "session-expired",
  OFFLINE_FIRST: "offline-first",
  ORIGIN_REFUSAL: "origin-refusal",
  PERMISSION_REFUSAL: "permission-refusal",
  NETWORK: "network",
  GENERIC: "generic"
});

export const AUTH_SEEN_KEY = "threadstep.auth.seen.v1";

const MESSAGES = Object.freeze({
  [AUTH_MESSAGE_KINDS.SIGN_IN]:
    "Connectez-vous avec votre adresse email pour recevoir un code à usage unique.",
  [AUTH_MESSAGE_KINDS.INVALID_CODE]:
    "Ce code est invalide. Vérifiez le code reçu ou demandez-en un nouveau.",
  [AUTH_MESSAGE_KINDS.EXPIRED_CODE]:
    "Ce code a expiré. Demandez un nouveau code pour vous connecter.",
  [AUTH_MESSAGE_KINDS.SESSION_EXPIRED]:
    "Votre session a expiré. Connectez-vous à nouveau ; vos données locales restent intactes.",
  [AUTH_MESSAGE_KINDS.OFFLINE_FIRST]:
    "La première connexion nécessite une connexion Internet.",
  [AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL]:
    "Cette origine n'est pas autorisée par Dexie Cloud. Aucun accès n'a été accordé.",
  [AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL]:
    "Accès refusé par les permissions Dexie Cloud. Aucun accès n'a été accordé.",
  [AUTH_MESSAGE_KINDS.NETWORK]:
    "Dexie Cloud est injoignable. Vérifiez votre connexion ; vos données locales restent intactes.",
  [AUTH_MESSAGE_KINDS.GENERIC]:
    "La connexion a échoué. Réessayez ; vos données locales restent intactes."
});

const SIGN_IN_METHODS = Object.freeze([
  Object.freeze({
    id: "email-otp",
    type: "email-otp",
    grantType: "otp",
    label: "Recevoir un code par email"
  })
]);

const ORIGIN_CODES = new Set([
  "invalid_origin",
  "origin_not_allowed",
  "unauthorized_origin",
  "untrusted_origin",
  "origin_mismatch"
]);

const PERMISSION_CODES = new Set([
  "access_denied",
  "forbidden",
  "permission_denied",
  "insufficient_permissions"
]);

export function signInMethods() {
  return SIGN_IN_METHODS;
}

export function authMessage(kind) {
  return Object.prototype.hasOwnProperty.call(MESSAGES, kind)
    ? MESSAGES[kind]
    : MESSAGES[AUTH_MESSAGE_KINDS.GENERIC];
}

function toTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function licenseIsExpired(user) {
  const license = user && user.license;
  if (!license || typeof license !== "object") return false;
  return typeof license.status === "string"
    && license.status.length > 0
    && license.status !== "ok";
}

export function isCredentialExpired(user, now) {
  if (!user || typeof user !== "object") return false;
  if (licenseIsExpired(user)) return true;
  const refresh = toTimestamp(user.refreshTokenExpiration);
  const access = toTimestamp(user.accessTokenExpiration);
  const deadline = refresh === null ? access : refresh;
  return deadline !== null && deadline <= now;
}

function isAuthenticated(user, now) {
  return !!user
    && user.isLoggedIn === true
    && !isCredentialExpired(user, now);
}

export function deriveAuthState(user, options = {}) {
  const settings = options && typeof options === "object" ? options : {};
  const online = settings.online !== false;
  const hadSession = settings.hadSession === true;
  const now = toTimestamp(settings.now);
  const clock = now === null ? Date.now() : now;
  const refusal = settings.refusal && typeof settings.refusal === "object"
    ? settings.refusal
    : null;

  if (refusal) {
    const kind = refusal.kind === AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL
      ? AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL
      : AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL;
    return { status: AUTH_STATUS.REFUSED, kind, message: authMessage(kind) };
  }
  if (user && typeof user === "object" && user.isLoading === true) {
    return {
      status: AUTH_STATUS.LOADING,
      kind: AUTH_MESSAGE_KINDS.SIGN_IN,
      message: "Vérification de la session en cours…"
    };
  }
  if (isAuthenticated(user, clock)) {
    return { status: AUTH_STATUS.AUTHENTICATED, kind: null, message: "" };
  }
  if (hadSession || isCredentialExpired(user, clock)) {
    return {
      status: AUTH_STATUS.EXPIRED,
      kind: AUTH_MESSAGE_KINDS.SESSION_EXPIRED,
      message: authMessage(AUTH_MESSAGE_KINDS.SESSION_EXPIRED)
    };
  }
  if (!online) {
    return {
      status: AUTH_STATUS.OFFLINE_REQUIRED,
      kind: AUTH_MESSAGE_KINDS.OFFLINE_FIRST,
      message: authMessage(AUTH_MESSAGE_KINDS.OFFLINE_FIRST)
    };
  }
  return {
    status: AUTH_STATUS.SIGNED_OUT,
    kind: AUTH_MESSAGE_KINDS.SIGN_IN,
    message: authMessage(AUTH_MESSAGE_KINDS.SIGN_IN)
  };
}

export function canStartAuthentication(state, online) {
  const status = typeof state === "string" ? state : state && state.status;
  if (online === false) return false;
  return status === AUTH_STATUS.SIGNED_OUT || status === AUTH_STATUS.EXPIRED;
}

export function canAccessBusiness(state) {
  const status = typeof state === "string" ? state : state && state.status;
  return status === AUTH_STATUS.AUTHENTICATED;
}

export function classifyPermissionFailure(error) {
  if (!error || typeof error !== "object") return null;
  const code = typeof error.code === "string" ? error.code.toLowerCase() : "";
  if (ORIGIN_CODES.has(code) || /origin/.test(code)) {
    return AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL;
  }
  if (PERMISSION_CODES.has(code)) {
    return AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL;
  }
  if (error.name === "PolicyRejectionError") {
    return AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL;
  }
  if (error.httpStatus === 403 || error.status === 403) {
    return AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL;
  }
  return null;
}

export function classifyAuthFailure(error) {
  if (!error || typeof error !== "object") return AUTH_MESSAGE_KINDS.GENERIC;
  if (error.name === "AbortError") return "cancelled";
  const permission = classifyPermissionFailure(error);
  if (permission) return permission;
  const code = typeof error.code === "string" ? error.code : "";
  const messageCode = typeof error.messageCode === "string" ? error.messageCode : "";
  if (code === "expired_code" || messageCode === "EXPIRED_OTP") {
    return AUTH_MESSAGE_KINDS.EXPIRED_CODE;
  }
  if (messageCode === "INVALID_OTP" || code === "invalid_otp") {
    return AUTH_MESSAGE_KINDS.INVALID_CODE;
  }
  if (code === "network_error" || error.name === "TypeError") {
    return AUTH_MESSAGE_KINDS.NETWORK;
  }
  return AUTH_MESSAGE_KINDS.GENERIC;
}

function alertMessage(alert) {
  if (!alert || typeof alert !== "object") return authMessage(AUTH_MESSAGE_KINDS.GENERIC);
  switch (alert.messageCode) {
    case "OTP_SENT": {
      const email = alert.messageParams && typeof alert.messageParams.email === "string"
        ? alert.messageParams.email
        : "";
      return email
        ? "Un code à usage unique a été envoyé à " + email + "."
        : "Un code à usage unique a été envoyé par email.";
    }
    case "INVALID_OTP":
      return authMessage(AUTH_MESSAGE_KINDS.INVALID_CODE);
    case "INVALID_EMAIL":
      return "Saisissez une adresse email valide.";
    default:
      return alert.type === "error"
        ? authMessage(AUTH_MESSAGE_KINDS.GENERIC)
        : "Information du service de connexion.";
  }
}

function interactionTitle(kind) {
  if (kind === "email") return "Connexion par email";
  if (kind === "otp") return "Saisissez le code reçu";
  if (kind === "alert") return "Information de connexion";
  return "Connexion";
}

function normalizeFieldValue(value, name) {
  if (value && typeof value === "object") {
    const raw = value[name];
    return typeof raw === "string" ? raw.trim() : "";
  }
  return typeof value === "string" ? value.trim() : "";
}

export function interactionViewModel(payload) {
  if (!payload || typeof payload !== "object") return null;
  const fields = payload.fields && typeof payload.fields === "object" ? payload.fields : {};
  const alerts = (Array.isArray(payload.alerts) ? payload.alerts : []).map((alert) => ({
    type: alert && typeof alert.type === "string" ? alert.type : "info",
    message: alertMessage(alert)
  }));

  let kind = "unsupported";
  let field = null;
  if (payload.type === "email" || fields.email) {
    kind = "email";
    const email = fields.email && typeof fields.email === "object" ? fields.email : {};
    field = {
      name: "email",
      type: "email",
      label: "Adresse email",
      placeholder: typeof email.placeholder === "string" && email.placeholder
        ? email.placeholder
        : "vous@exemple.fr"
    };
  } else if (payload.type === "otp" || fields.otp) {
    kind = "otp";
    const otp = fields.otp && typeof fields.otp === "object" ? fields.otp : {};
    field = {
      name: "otp",
      type: "text",
      label: typeof otp.label === "string" && otp.label ? otp.label : "Code reçu par email",
      placeholder: typeof otp.placeholder === "string" && otp.placeholder ? otp.placeholder : "Code à 8 chiffres"
    };
  } else if (payload.type === "message-alert" || alerts.length > 0) {
    kind = "alert";
  }

  let settled = false;
  const submit = (value) => {
    if (settled || typeof payload.onSubmit !== "function") return false;
    settled = true;
    if (kind === "email" || kind === "otp") {
      const name = kind === "email" ? "email" : "otp";
      payload.onSubmit({ [name]: normalizeFieldValue(value, name) });
    } else {
      payload.onSubmit({});
    }
    return true;
  };
  const cancel = () => {
    if (settled) return false;
    settled = true;
    if (typeof payload.onCancel !== "function") return false;
    payload.onCancel();
    return true;
  };

  return Object.freeze({
    kind,
    title: interactionTitle(kind),
    submitLabel: kind === "alert" ? "OK" : kind === "otp" ? "Valider le code" : "Recevoir un code",
    cancelLabel: kind === "alert" || kind === "unsupported" ? null : "Annuler",
    alerts: Object.freeze(alerts),
    field: field ? Object.freeze(field) : null,
    providerOptions: Object.freeze([]),
    submit,
    cancel
  });
}

export function hasAuthenticatedBefore(storage) {
  if (!storage || typeof storage.getItem !== "function") return false;
  try {
    return storage.getItem(AUTH_SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export function rememberAuthentication(storage) {
  if (!storage || typeof storage.setItem !== "function") return false;
  try {
    storage.setItem(AUTH_SEEN_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

function failureState(kind) {
  return {
    status: kind === AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL || kind === AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL
      ? AUTH_STATUS.REFUSED
      : AUTH_STATUS.SIGNED_OUT,
    kind,
    message: authMessage(kind)
  };
}

export function createAuthController(options = {}) {
  const settings = options && typeof options === "object" ? options : {};
  const adapter = settings.adapter;
  if (!adapter || typeof adapter.login !== "function") {
    throw new TypeError("Un adaptateur d'authentification est requis.");
  }
  const storage = settings.storage;
  const getOnline = typeof settings.getOnline === "function" ? settings.getOnline : () => true;
  const clock = typeof settings.now === "function" ? settings.now : () => Date.now();
  const notifyState = typeof settings.onStateChange === "function" ? settings.onStateChange : () => {};
  const notifyInteraction = typeof settings.onInteraction === "function" ? settings.onInteraction : () => {};

  let hadSession = hasAuthenticatedBefore(storage);
  let lastUser = null;
  let refusal = null;
  let lastEmail = "";
  let interaction = null;
  let lastState = null;

  function publish() {
    const state = deriveAuthState(lastUser, {
      online: getOnline() !== false,
      hadSession,
      refusal,
      now: clock()
    });
    if (state.status === AUTH_STATUS.AUTHENTICATED) {
      refusal = null;
      if (!hadSession) {
        hadSession = true;
        rememberAuthentication(storage);
      }
    }
    lastState = state;
    notifyState(state);
    return state;
  }

  function applyUser(user) {
    lastUser = user && typeof user === "object" ? user : null;
    if (lastUser && lastUser.isLoggedIn === true) refusal = null;
    return publish();
  }

  function applyFailure(error) {
    const kind = classifyAuthFailure(error);
    if (kind === "cancelled") {
      interaction = null;
      notifyInteraction(null);
      const state = deriveAuthState(lastUser, {
        online: getOnline() !== false,
        hadSession,
        now: clock()
      });
      lastState = state;
      notifyState(state);
      return state;
    }
    if (kind === AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL || kind === AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL) {
      refusal = { kind, message: authMessage(kind) };
      return publish();
    }
    const base = deriveAuthState(lastUser, {
      online: getOnline() !== false,
      hadSession,
      now: clock()
    });
    const status = base.status === AUTH_STATUS.AUTHENTICATED ? AUTH_STATUS.SIGNED_OUT : base.status;
    const state = { ...failureState(kind), status };
    lastState = state;
    notifyState(state);
    return state;
  }

  function startSignIn(email) {
    refusal = null;
    if (!lastState) publish();
    if (lastState && lastState.status === AUTH_STATUS.AUTHENTICATED) {
      return Promise.resolve({ started: false, reason: AUTH_STATUS.AUTHENTICATED, state: lastState });
    }
    if (!canStartAuthentication(lastState, getOnline() !== false)) {
      const state = publish();
      return Promise.resolve({ started: false, reason: state.status, state });
    }
    const normalized = typeof email === "string" ? email.trim() : "";
    if (normalized) lastEmail = normalized;
    const request = { grant_type: "otp" };
    if (lastEmail) request.email = lastEmail;
    let pending;
    try {
      pending = Promise.resolve(adapter.login(request));
    } catch (error) {
      pending = Promise.reject(error);
    }
    return pending.then(
      (value) => {
        const state = publish();
        return { started: true, state, value };
      },
      (error) => ({ started: false, reason: classifyAuthFailure(error), state: applyFailure(error) })
    );
  }

  function resend(email) {
    return startSignIn(typeof email === "string" && email.trim() ? email : lastEmail);
  }

  function handleInteraction(payload) {
    const viewModel = interactionViewModel(payload);
    if (!viewModel) return null;
    interaction = viewModel;
    notifyInteraction(viewModel);
    return viewModel;
  }

  function submitInteraction(value) {
    if (!interaction) return false;
    const current = interaction;
    const submitted = current.submit(value);
    if (!submitted) return false;
    if (current.kind === "email" && value && typeof value === "object" && typeof value.email === "string") {
      lastEmail = value.email.trim();
    }
    if (current.kind === "email" || current.kind === "alert") {
      interaction = null;
      notifyInteraction(null);
    }
    return true;
  }

  function cancelInteraction() {
    if (!interaction) return false;
    const current = interaction;
    interaction = null;
    notifyInteraction(null);
    return current.cancel();
  }

  function refresh() {
    return publish();
  }

  return {
    applyUser,
    startSignIn,
    resend,
    handleInteraction,
    submitInteraction,
    cancelInteraction,
    refresh,
    canAccessBusiness: () => canAccessBusiness(lastState),
    snapshot: () => lastState,
    currentInteraction: () => interaction,
    lastEmail: () => lastEmail,
    hadSession: () => hadSession
  };
}
