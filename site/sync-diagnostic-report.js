// Pure, DOM-free and I/O-free shareable sync diagnostic report.
//
// Every value is projected from the already normalized diagnostic model
// through an explicit allowlist. Raw workspace names, URLs, remote ids,
// errors, storage contents and business data can never reach the text.
import {
  BINDING_DIAGNOSTIC_STATE,
  DIAGNOSTIC_ERROR,
  REMOTE_EVIDENCE,
  REMOTE_EVIDENCE_LABELS,
  SESSION_STATE,
  buildDiagnosticView
} from "./sync-diagnostics.js";
import { formatBoundedAge } from "./sync-lifecycle-instrumentation.js";

export const REPORT_SECTION_KEYS = Object.freeze([
  "timestamps",
  "application",
  "browser",
  "workspace",
  "network",
  "session",
  "connection",
  "phase",
  "initial-pull",
  "local-writes",
  "remote-evidence",
  "binding",
  "errors",
  "bootstrap",
  "retry",
  "lifecycle",
  "incident",
  "limitations",
  "safe-checks"
]);

export const SHARE_STATUS = Object.freeze({
  IDLE: "idle",
  SUCCESS: "success",
  MANUAL: "manual"
});

export const SHARE_MESSAGES = Object.freeze({
  [SHARE_STATUS.IDLE]:
    "Le rapport est calculé uniquement lorsque vous l'affichez ou le copiez. Aucun envoi automatique.",
  [SHARE_STATUS.SUCCESS]:
    "Diagnostic copié dans le presse-papiers. Vous pouvez le coller dans votre demande d'assistance.",
  [SHARE_STATUS.MANUAL]:
    "Copie automatique indisponible ou refusée. Le rapport complet reste affiché dans un champ sélectionnable : sélectionnez-le puis copiez-le manuellement."
});

const SESSIONS = new Set(Object.values(SESSION_STATE));
const BINDINGS = new Set(Object.values(BINDING_DIAGNOSTIC_STATE));
const REMOTE_STATES = new Set(Object.values(REMOTE_EVIDENCE));
const ERROR_CATEGORIES = new Set(Object.values(DIAGNOSTIC_ERROR));
const DB_OPEN_STATES = new Set(["not-started", "pending", "resolved", "failed"]);
const OTP_STATES = new Set(["not-requested", "requested", "succeeded", "failed", "cancelled"]);
const OBSERVABLE_NAMES = Object.freeze(["currentUser", "syncState", "persistedSyncState"]);
const UNAVAILABLE = "non disponible";
const INDETERMINATE = "indéterminée";

const BINDING_REPORT_LABELS = Object.freeze({
  [BINDING_DIAGNOSTIC_STATE.BOUND]: "compte lié à cet espace",
  [BINDING_DIAGNOSTIC_STATE.UNBOUND]: "espace lié au compte courant (cache vide)",
  [BINDING_DIAGNOSTIC_STATE.UNVERIFIED]: "liaison de compte non vérifiée (cache masqué)",
  [BINDING_DIAGNOSTIC_STATE.MISMATCH]: "compte différent de la liaison : données métier masquées",
  [BINDING_DIAGNOSTIC_STATE.DESTINATION_MISMATCH]: "base distante différente de la liaison : données métier masquées",
  [BINDING_DIAGNOSTIC_STATE.UNAUTHENTICATED]: "aucune session authentifiée",
  [BINDING_DIAGNOSTIC_STATE.INDETERMINATE]: "liaison de compte indéterminée"
});

const DB_OPEN_LABELS = Object.freeze({
  "not-started": "non démarré",
  pending: "en attente",
  resolved: "résolu",
  failed: "en échec"
});

const OTP_LABELS = Object.freeze({
  "not-requested": "non demandé",
  requested: "demandé",
  succeeded: "réussi",
  failed: "échoué",
  cancelled: "annulé"
});

const REMOTE_REASON_LABELS = Object.freeze({
  "destination-missing": "destination Cloud absente",
  "read-error": "erreur de lecture distante",
  "sync-error": "erreur de synchronisation distante",
  offline: "navigateur hors ligne",
  unauthenticated: "aucune identité authentifiée observée",
  "initial-sync-pending": "synchronisation initiale non attestée",
  "session-mismatch": "session ou instance différente de la base persistée",
  indeterminate: INDETERMINATE
});

const ERROR_CATEGORY_LABELS = Object.freeze({
  [DIAGNOSTIC_ERROR.NETWORK]: "réseau",
  [DIAGNOSTIC_ERROR.OFFLINE]: "hors ligne",
  [DIAGNOSTIC_ERROR.PERMISSION]: "permission",
  [DIAGNOSTIC_ERROR.ORIGIN]: "origine",
  [DIAGNOSTIC_ERROR.SESSION]: "session",
  [DIAGNOSTIC_ERROR.SYNC]: "synchronisation",
  [DIAGNOSTIC_ERROR.STORAGE]: "stockage",
  [DIAGNOSTIC_ERROR.READ]: "lecture",
  [DIAGNOSTIC_ERROR.UNCATEGORIZED]: "non catégorisée"
});

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function timezoneOffset(date) {
  const minutes = -date.getTimezoneOffset();
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return "UTC" + sign + pad(Math.floor(absolute / 60)) + ":" + pad(absolute % 60);
}

function localTimestamp(date) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    " " + pad(date.getHours()) + ":" + pad(date.getMinutes()) + ":" + pad(date.getSeconds()) +
    " (" + timezoneOffset(date) + ")";
}

export function describeBrowserContext(userAgent) {
  const source = typeof userAgent === "string" ? userAgent : "";
  if (!source.trim()) return { family: null, version: null, label: UNAVAILABLE };
  let match = null;
  let family = null;
  if ((match = source.match(/(?:Edg|Edge)\/(\d+)/))) family = "Microsoft Edge";
  else if ((match = source.match(/SamsungBrowser\/(\d+)/))) family = "Samsung Internet";
  else if ((match = source.match(/OPR\/(\d+)/))) family = "Opera";
  else if ((match = source.match(/Firefox\/(\d+)/))) family = "Firefox";
  else if ((match = source.match(/CriOS\/(\d+)/))) family = "Chrome";
  else if ((match = source.match(/Chrome\/(\d+)/))) family = "Chrome";
  else if ((match = source.match(/Version\/(\d+).*Safari/))) family = "Safari";
  if (!family || !match) return { family: null, version: null, label: UNAVAILABLE };
  const version = String(Number(match[1]));
  return { family, version, label: family + " " + version };
}

function sanitizeBuild(value) {
  return typeof value === "string" &&
    /^\d+(\.\d+){1,3}([-+][0-9A-Za-z.-]{1,32})?$/.test(value)
    ? value
    : null;
}

function sanitizeAge(value) {
  if (Number.isFinite(value)) return formatBoundedAge(value);
  if (typeof value === "string" && /^(≥ 7 jours|\d+ (s|min|h|j))$/.test(value)) return value;
  return UNAVAILABLE;
}

function sanitizeCode(value) {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,39}$/.test(value)
    ? value
    : null;
}

function normalizeLocalBase(value) {
  if (value === true || value === "empty") return "vide observée";
  if (value === false || value === "non-empty") return "non vide observée";
  return UNAVAILABLE;
}

function sessionProjection(diagnostic, view) {
  const session = SESSIONS.has(diagnostic.session) ? diagnostic.session : SESSION_STATE.INDETERMINATE;
  const observed = {
    [SESSION_STATE.AUTHENTICATED]: "Session authentifiée observée.",
    [SESSION_STATE.LOADING]: "Session en cours de restauration : aucune identité authentifiée n'est encore attestée.",
    [SESSION_STATE.SIGNED_OUT]: "Session absente : aucune identité authentifiée n'est observée.",
    [SESSION_STATE.EXPIRED]: "Session expirée observée.",
    [SESSION_STATE.REFUSED]: "Refus natif explicitement constaté : origine ou permission refusée par le service.",
    [SESSION_STATE.INDETERMINATE]: "État de session indéterminé."
  }[session];
  const cause = {
    [SESSION_STATE.AUTHENTICATED]: "Aucune cause de blocage de session observée.",
    [SESSION_STATE.LOADING]: "Cause encore indéterminée : restauration native en cours.",
    [SESSION_STATE.SIGNED_OUT]: "Cause encore indéterminée : absence d'identité authentifiée, sans refus natif observé.",
    [SESSION_STATE.EXPIRED]: "Expiration de session constatée par les signaux natifs.",
    [SESSION_STATE.REFUSED]: "Refus natif observé ; aucune récupération automatique n'est proposée.",
    [SESSION_STATE.INDETERMINATE]: "Cause indéterminée : aucun refus natif n'a été explicitement observé."
  }[session];
  return {
    session,
    label: view.sessionLabel,
    observed,
    cause
  };
}

function remoteProjection(diagnostic, view) {
  const remote = isPlainObject(diagnostic.remoteEvidence) ? diagnostic.remoteEvidence : {};
  const state = REMOTE_STATES.has(remote.state) ? remote.state : REMOTE_EVIDENCE.UNKNOWN;
  const reason = typeof remote.reason === "string" && Object.prototype.hasOwnProperty.call(REMOTE_REASON_LABELS, remote.reason)
    ? REMOTE_REASON_LABELS[remote.reason]
    : (state === REMOTE_EVIDENCE.AVAILABLE ? "aucune raison de blocage" : INDETERMINATE);
  return {
    state,
    label: REMOTE_EVIDENCE_LABELS[state],
    reason,
    available: state === REMOTE_EVIDENCE.AVAILABLE
  };
}

function cacheProjection(diagnostic) {
  const binding = BINDINGS.has(diagnostic.binding)
    ? diagnostic.binding
    : BINDING_DIAGNOSTIC_STATE.INDETERMINATE;
  if (binding === BINDING_DIAGNOSTIC_STATE.UNVERIFIED) {
    return "cache masqué ou non vérifié";
  }
  if (binding === BINDING_DIAGNOSTIC_STATE.MISMATCH ||
    binding === BINDING_DIAGNOSTIC_STATE.DESTINATION_MISMATCH) {
    return "cache masqué (liaison incohérente)";
  }
  return "état du cache local non exposé par ce diagnostic";
}

function errorProjection(diagnostic) {
  const entries = Array.isArray(diagnostic.errors) ? diagnostic.errors : [];
  const seen = new Set();
  const values = [];
  for (const entry of entries) {
    if (!isPlainObject(entry) || !ERROR_CATEGORIES.has(entry.category)) continue;
    const code = sanitizeCode(entry.code) || "normalise";
    const key = entry.category + "/" + code;
    if (seen.has(key)) continue;
    seen.add(key);
    values.push({
      category: entry.category,
      code,
      label: ERROR_CATEGORY_LABELS[entry.category] + "/" + code
    });
  }
  return values;
}

function lifecycleProjection(value) {
  if (!isPlainObject(value)) return null;
  const dbOpen = isPlainObject(value.dbOpen) ? value.dbOpen : {};
  const otp = isPlainObject(value.otp) ? value.otp : {};
  const observables = isPlainObject(value.observables) ? value.observables : {};
  return {
    dbOpen: {
      state: DB_OPEN_STATES.has(dbOpen.state) ? dbOpen.state : null,
      startedAge: sanitizeAge(dbOpen.startedAgeSeconds),
      lastAge: sanitizeAge(dbOpen.lastAgeSeconds)
    },
    otp: {
      state: OTP_STATES.has(otp.state) ? otp.state : null,
      requestedAge: sanitizeAge(otp.requestedAgeSeconds),
      lastAge: sanitizeAge(otp.lastAgeSeconds)
    },
    observables: Object.fromEntries(OBSERVABLE_NAMES.map((name) => {
      const entry = isPlainObject(observables[name]) ? observables[name] : {};
      return [name, {
        emissions: Number.isInteger(entry.emissions) && entry.emissions >= 0 ? entry.emissions : UNAVAILABLE,
        initialAge: sanitizeAge(entry.initialEmissionAgeSeconds),
        lastAge: sanitizeAge(entry.lastChangeAgeSeconds)
      }];
    }))
  };
}

function makeEntry(entries, unavailable, key, label, value) {
  const safe = typeof value === "string" && value.length > 0 ? value : UNAVAILABLE;
  if (safe === UNAVAILABLE) unavailable.add(key);
  entries.push({ key, label, value: safe });
}

function section(key, title, entries) {
  return { key, title, entries };
}

export function buildSyncDiagnosticReport(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const diagnostic = isPlainObject(source.diagnostic) ? source.diagnostic : {};
  const now = source.now instanceof Date && Number.isFinite(source.now.getTime())
    ? source.now
    : new Date();
  const view = buildDiagnosticView(diagnostic);
  const unavailable = new Set();
  const browser = describeBrowserContext(source.userAgent);
  const build = sanitizeBuild(source.build);
  const session = sessionProjection(diagnostic, view);
  const remote = remoteProjection(diagnostic, view);
  const errors = errorProjection(diagnostic);
  const lifecycle = lifecycleProjection(source.lifecycle);
  const configured = diagnostic.configured === true;
  const binding = BINDINGS.has(diagnostic.binding)
    ? diagnostic.binding
    : BINDING_DIAGNOSTIC_STATE.INDETERMINATE;
  const localBase = normalizeLocalBase(source.localBase);

  const sections = [];

  {
    const entries = [];
    makeEntry(entries, unavailable, "horodatage-local", "Horodatage local", localTimestamp(now));
    makeEntry(entries, unavailable, "horodatage-utc", "Horodatage UTC", now.toISOString());
    sections.push(section("timestamps", "Horodatage", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "version-application", "Version/build de l'application", build);
    makeEntry(entries, unavailable, "source-version", "Source de version", build ? "valeur injectée" : UNAVAILABLE);
    sections.push(section("application", "Application", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "navigateur", "Famille et version majeure", browser.label);
    makeEntry(entries, unavailable, "contexte-non-identifiant", "Contexte navigateur", "limité à la famille et à la version majeure ; agent complet, plateforme, langue et autres champs identifiants exclus");
    sections.push(section("browser", "Navigateur", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "type-espace", "Espace actif", configured ? "Synchronisé" : "Local autonome");
    makeEntry(entries, unavailable, "base-locale", "Base locale", configured ? "base-locale-active" : "base-locale-autonome");
    makeEntry(entries, unavailable, "origine-cloud", "Origine Cloud", configured ? "masquée par défaut" : "non applicable");
    const hasRemoteId = configured && isPlainObject(diagnostic.base) &&
      typeof diagnostic.base.remoteDbId === "string" && diagnostic.base.remoteDbId.length > 0;
    makeEntry(entries, unavailable, "identifiant-distante",
      "Identifiant distant",
      configured ? (hasRemoteId ? "identifiant-distante-actif" : UNAVAILABLE) : "non applicable");
    sections.push(section("workspace", "Espace actif", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "reseau-navigateur", "Réseau déclaré par le navigateur",
      diagnostic.online === false ? "Hors ligne" : diagnostic.online === true ? "En ligne" : UNAVAILABLE);
    makeEntry(entries, unavailable, "test-reseau", "Test réseau vers Dexie Cloud", "aucun (non effectué par ce diagnostic)");
    sections.push(section("network", "Réseau", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "etat-session", "État de session", session.label);
    makeEntry(entries, unavailable, "fait-observe", "Fait observé", session.observed);
    makeEntry(entries, unavailable, "cause-session", "Cause", session.cause);
    makeEntry(entries, unavailable, "distinction-session", "Distinctions",
      "restauration en cours, session absente, session expirée et refus natif explicitement constaté sont présentés séparément");
    makeEntry(entries, unavailable, "ambiguite-libelle-historique", "Libellé historique",
      "« session absente ou refusée » ne prouve pas, à lui seul, un refus serveur : il peut seulement refléter l'absence d'identité authentifiée");
    sections.push(section("session", "Session", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "etat-connexion", "Connexion", view.connectionLabel);
    sections.push(section("connection", "Connexion", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "phase-native", "Phase native", view.phaseLabel);
    makeEntry(entries, unavailable, "phase-non-preuve", "Portée de la phase native",
      "une phase native favorable ne prouve pas à elle seule un succès distant attesté");
    sections.push(section("phase", "Phase native", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "pull-initial", "Pull initial", view.initialPullLabel);
    makeEntry(entries, unavailable, "pull-initial-attente", "Attente",
      /attente|en cours/.test(view.initialPullLabel) ? "pull initial encore en attente ou en cours" : "aucune attente de pull initial observée");
    sections.push(section("initial-pull", "Pull initial", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "ecritures-locales", "Écritures locales", view.localWritesLabel);
    sections.push(section("local-writes", "Écritures locales", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "preuve-distante", "Preuve distante", remote.label);
    makeEntry(entries, unavailable, "raison-preuve-distante", "Raison de la preuve distante", remote.reason);
    makeEntry(entries, unavailable, "absence-de-preuve", "Absence de preuve", remote.available ? "non" : "oui");
    makeEntry(entries, unavailable, "cache-local", "Cache local", cacheProjection(diagnostic));
    makeEntry(entries, unavailable, "base-locale-vide-observee", "Base locale vide observée", localBase);
    makeEntry(entries, unavailable, "base-distante-vide-attestee", "Base distante vide attestée",
      "non : ce diagnostic n'atteste pas une base distante vide et le Cloud n'est pas considéré comme vide");
    sections.push(section("remote-evidence", "Preuve distante", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "liaison-compte", "Liaison de compte", BINDING_REPORT_LABELS[binding]);
    sections.push(section("binding", "Liaison de compte", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "erreurs-normalisees", "Erreurs normalisées",
      errors.length > 0 ? errors.map((entry) => entry.label).join(" ; ") : "aucune erreur normalisée observée");
    makeEntry(entries, unavailable, "erreurs-brutes", "Messages bruts et stacks", "exclus par la liste blanche");
    sections.push(section("errors", "Erreurs normalisées", entries));
  }

  {
    const entries = [];
    const bootstrap = view.bootstrap;
    makeEntry(entries, unavailable, "cause-bootstrap", "Cause ou origine du bootstrap", bootstrap.label);
    makeEntry(entries, unavailable, "origine-bootstrap", "Origine du bootstrap", bootstrap.originLabel);
    sections.push(section("bootstrap", "Bootstrap", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "relance-disponible", "Relance du pull disponible", view.retry.allowed ? "oui" : "non");
    makeEntry(entries, unavailable, "raison-relance", "Raison du blocage ou de la relance", view.retry.reasonLabel);
    sections.push(section("retry", "Relance", entries));
  }

  {
    const entries = [];
    if (lifecycle) {
      makeEntry(entries, unavailable, "db-open-etat", "db.open()", DB_OPEN_LABELS[lifecycle.dbOpen.state] || UNAVAILABLE);
      makeEntry(entries, unavailable, "db-open-age-demarrage", "db.open() âge du démarrage", lifecycle.dbOpen.startedAge);
      makeEntry(entries, unavailable, "db-open-age-dernier", "db.open() dernier événement", lifecycle.dbOpen.lastAge);
      for (const name of OBSERVABLE_NAMES) {
        const entry = lifecycle.observables[name];
        makeEntry(entries, unavailable, name + "-emission-initiale", name + " émission initiale", entry.initialAge);
        makeEntry(entries, unavailable, name + "-dernier-changement", name + " dernier changement", entry.lastAge);
        makeEntry(entries, unavailable, name + "-emissions", name + " émissions", entry.emissions === UNAVAILABLE ? UNAVAILABLE : String(entry.emissions));
      }
      makeEntry(entries, unavailable, "otp-demande", "OTP demande", OTP_LABELS[lifecycle.otp.state] || UNAVAILABLE);
      makeEntry(entries, unavailable, "otp-age-demande", "OTP âge de la demande", lifecycle.otp.requestedAge);
      makeEntry(entries, unavailable, "otp-age-issue", "OTP dernier événement", lifecycle.otp.lastAge);
    } else {
      const keys = [
        ["db-open-etat", "db.open()"],
        ["db-open-age-demarrage", "db.open() âge du démarrage"],
        ["db-open-age-dernier", "db.open() dernier événement"],
        ["otp-demande", "OTP demande"],
        ["otp-age-demande", "OTP âge de la demande"],
        ["otp-age-issue", "OTP dernier événement"]
      ];
      for (const [key, label] of keys) makeEntry(entries, unavailable, key, label, null);
      for (const name of OBSERVABLE_NAMES) {
        makeEntry(entries, unavailable, name + "-emission-initiale", name + " émission initiale", null);
        makeEntry(entries, unavailable, name + "-dernier-changement", name + " dernier changement", null);
        makeEntry(entries, unavailable, name + "-emissions", name + " émissions", null);
      }
    }
    sections.push(section("lifecycle", "Cycle d'initialisation", entries));
  }

  {
    const entries = [];
    const incidentSession = session.session === SESSION_STATE.AUTHENTICATED
      ? "session authentifiée"
      : session.session === SESSION_STATE.LOADING
        ? "session non authentifiée en cours de restauration"
        : "session non authentifiée ou absente";
    const incidentPull = /attente|en cours/.test(view.initialPullLabel)
      ? "pull initial en attente"
      : view.initialPullLabel.toLowerCase();
    makeEntry(entries, unavailable, "incident-session-pull", "Cas observé",
      incidentSession + ", " + incidentPull + ", lecture distante " +
      (remote.available ? "attestée par les signaux natifs" : "non attestée"));
    makeEntry(entries, unavailable, "incident-cloud-vide", "Conclusion sur le Cloud",
      "le Cloud n'est pas considéré comme vide et ce diagnostic ne propose aucune action destructive, migration ou restauration");
    sections.push(section("incident", "Incident Android du 21 octobre (cas)", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "appels-reseau", "Appels réseau", "aucun");
    makeEntry(entries, unavailable, "lecture-metier", "Lecture métier", "aucune");
    makeEntry(entries, unavailable, "telemetrie", "Télémétrie", "aucune");
    makeEntry(entries, unavailable, "envoi-ia", "Envoi à un fournisseur IA", "aucun");
    makeEntry(entries, unavailable, "persistance-rapport", "Persistance du rapport", "aucune : calculé au clic, non stocké");
    makeEntry(entries, unavailable, "origine-cloud-masquee", "Origine Cloud", "masquée par défaut");
    makeEntry(entries, unavailable, "expurgation", "Expurgation",
      "liste blanche appliquée à la source ; données métier, emails, OTP, jetons, cookies, identifiants de compte, messages et traces techniques bruts, URL sensibles et contenus de stockage exclus");
    if (unavailable.size > 0) {
      makeEntry(entries, unavailable, "informations-masquees", "Informations masquées",
        "certaines dimensions sont masquées ou marquées « non disponible » ; aucune version brute n'est proposée");
    }
    sections.push(section("limitations", "Limites et expurgation", entries));
  }

  {
    const entries = [];
    makeEntry(entries, unavailable, "verification-session", "Vérification session",
      "consulter l'état de la session et de la connexion affiché sur cette page, sans action automatique");
    makeEntry(entries, unavailable, "verification-reseau", "Vérification réseau",
      "vérifier la disponibilité réseau déclarée par le navigateur");
    makeEntry(entries, unavailable, "verification-configuration", "Vérification configuration",
      "vérifier la persistance de la configuration Cloud existante sans la modifier");
    makeEntry(entries, unavailable, "verification-promesse", "Promesse de récupération",
      "aucune : ces vérifications sont non destructives et ne garantissent pas de récupération");
    sections.push(section("safe-checks", "Vérifications non destructives suggérées", entries));
  }

  const text = [
    "# Rapport de diagnostic de synchronisation ThreadStep",
    "",
    "Rapport expurgé, produit à la demande depuis les signaux normalisés du diagnostic.",
    "",
    ...sections.map((current) => [
      "## " + current.title,
      ...current.entries.map((entry) => "- `" + entry.key + "` : " + entry.value),
      ""
    ].join("\n"))
  ].join("\n").trimEnd() + "\n";

  return {
    text,
    sections,
    unavailable: Array.from(unavailable)
  };
}

export async function writeReportToClipboard(text, writeText) {
  if (typeof writeText !== "function" || typeof text !== "string" || text.length === 0) {
    return { status: SHARE_STATUS.MANUAL };
  }
  try {
    await writeText(text);
    return { status: SHARE_STATUS.SUCCESS };
  } catch {
    return { status: SHARE_STATUS.MANUAL };
  }
}

export function createDiagnosticSharingController(options = {}) {
  const settings = isPlainObject(options) ? options : {};
  const buildReport = typeof settings.buildReport === "function"
    ? settings.buildReport
    : () => ({ text: "", sections: [], unavailable: [] });
  const getWriteText = typeof settings.getWriteText === "function"
    ? settings.getWriteText
    : () => null;
  const onChange = typeof settings.onChange === "function" ? settings.onChange : () => {};
  let report = null;
  let previewOpen = false;
  let status = { kind: SHARE_STATUS.IDLE, message: SHARE_MESSAGES[SHARE_STATUS.IDLE] };

  function build() {
    const next = buildReport();
    if (next && typeof next.text === "string" && next.text.length > 0) report = next;
    return report;
  }

  function getState() {
    return {
      status: { ...status },
      previewOpen,
      hasReport: !!report,
      text: report ? report.text : null
    };
  }

  function emit() {
    try {
      onChange(getState());
    } catch {
      // Sharing feedback must never break the surrounding page.
    }
  }

  function openPreview() {
    const current = build();
    previewOpen = true;
    emit();
    return current ? current.text : "";
  }

  function closePreview() {
    previewOpen = false;
    emit();
  }

  function togglePreview() {
    if (previewOpen) closePreview();
    else openPreview();
    return getState();
  }

  function refreshPreview() {
    if (!previewOpen) return getState();
    build();
    emit();
    return getState();
  }

  async function copy() {
    const current = build();
    const text = current ? current.text : "";
    const result = await writeReportToClipboard(text, getWriteText());
    if (result.status === SHARE_STATUS.SUCCESS) {
      status = { kind: SHARE_STATUS.SUCCESS, message: SHARE_MESSAGES[SHARE_STATUS.SUCCESS] };
    } else {
      previewOpen = true;
      status = { kind: SHARE_STATUS.MANUAL, message: SHARE_MESSAGES[SHARE_STATUS.MANUAL] };
    }
    emit();
    return {
      copied: result.status === SHARE_STATUS.SUCCESS,
      manual: result.status !== SHARE_STATUS.SUCCESS,
      text,
      report: current ? { ...current } : null
    };
  }

  return {
    copy,
    openPreview,
    closePreview,
    togglePreview,
    refreshPreview,
    getState
  };
}
