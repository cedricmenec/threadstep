import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  AUTH_STATUS,
  AUTH_MESSAGE_KINDS,
  AUTH_SEEN_KEY,
  authMessage,
  signInMethods,
  deriveAuthState,
  canStartAuthentication,
  canAccessBusiness,
  isCredentialExpired,
  classifyAuthFailure,
  classifyPermissionFailure,
  interactionViewModel,
  hasAuthenticatedBefore,
  rememberAuthentication,
  createAuthController
} from "../site/authentication.js";
import { STORAGE_KEY } from "../site/core.js";
import { cloudConfigureOptions } from "../site/dexie-foundation.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const pkg = JSON.parse(read("package.json"));

const PAST = "2020-01-01T00:00:00.000Z";
const FUTURE = "2999-01-01T00:00:00.000Z";
const NOW = Date.parse("2026-10-17T12:00:00.000Z");

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial).map(([key, value]) => [key, String(value)]));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    keys: () => [...map.keys()],
    snapshot: () => Object.fromEntries(map)
  };
}

function signedOutUser() {
  return { userId: "", isLoggedIn: false, license: { status: "ok" } };
}

function authenticatedUser(overrides = {}) {
  return {
    userId: "user-1",
    isLoggedIn: true,
    license: { status: "ok" },
    accessTokenExpiration: new Date(FUTURE),
    refreshTokenExpiration: new Date(FUTURE),
    ...overrides
  };
}

function fakeAdapter({ reject = null } = {}) {
  const loginCalls = [];
  const userListeners = [];
  const interactionListeners = [];
  const adapter = {
    login(options) {
      loginCalls.push({ ...options });
      return reject ? Promise.reject(reject) : Promise.resolve({ type: "tokens" });
    },
    subscribeUser(listener) { userListeners.push(listener); },
    subscribeInteraction(listener) { interactionListeners.push(listener); }
  };
  return { adapter, loginCalls, userListeners, interactionListeners };
}

function fakeBusinessStore(records) {
  const data = structuredClone(records);
  return {
    data,
    snapshot: () => structuredClone(data),
    commit() { return Promise.resolve({ status: "recorded", operations: [] }); }
  };
}

function otpPayload(overrides = {}) {
  return {
    type: "otp",
    title: "Enter OTP",
    alerts: [{
      type: "info",
      messageCode: "OTP_SENT",
      message: "A One-Time password has been sent to {email}",
      messageParams: { email: "alice@example.test" }
    }],
    fields: { otp: { type: "otp", label: "OTP", placeholder: "Paste OTP here" } },
    onSubmit: () => {},
    onCancel: () => {},
    ...overrides
  };
}

test("1.1 signInMethods offers only the native email OTP method", () => {
  const methods = signInMethods();
  assert.equal(methods.length, 1);
  assert.deepEqual(methods.map((method) => method.id), ["email-otp"]);
  assert.equal(methods[0].grantType, "otp");
  assert.equal(methods[0].type, "email-otp");
});

test("1.1 authMessage is fixed French, secret-free and covers every kind", () => {
  const kinds = [
    AUTH_MESSAGE_KINDS.SIGN_IN,
    AUTH_MESSAGE_KINDS.INVALID_CODE,
    AUTH_MESSAGE_KINDS.EXPIRED_CODE,
    AUTH_MESSAGE_KINDS.SESSION_EXPIRED,
    AUTH_MESSAGE_KINDS.OFFLINE_FIRST,
    AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL,
    AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL,
    AUTH_MESSAGE_KINDS.GENERIC
  ];
  for (const kind of kinds) {
    const message = authMessage(kind);
    assert.equal(typeof message, "string");
    assert.ok(message.length > 10, kind);
    assert.doesNotMatch(message, /\b\d{6,8}\b/);
    assert.doesNotMatch(message, /token|secret|cl[ée]|Bearer/i);
    assert.doesNotMatch(message, /messageCode|provider/i);
  }
  assert.equal(authMessage("unknown-kind"), authMessage(AUTH_MESSAGE_KINDS.GENERIC));
});

test("1.2 deriveAuthState authenticates a valid native session", () => {
  const state = deriveAuthState(authenticatedUser(), { online: true, hadSession: false, now: NOW });
  assert.equal(state.status, AUTH_STATUS.AUTHENTICATED);
  assert.equal(canAccessBusiness(state), true);
  assert.equal(canStartAuthentication(state, true), false);
});

test("1.2 an expired credential or license becomes expired", () => {
  const expiredRefresh = deriveAuthState(
    authenticatedUser({ refreshTokenExpiration: new Date(PAST) }),
    { online: true, now: NOW }
  );
  assert.equal(expiredRefresh.status, AUTH_STATUS.EXPIRED);
  assert.equal(expiredRefresh.message, authMessage(AUTH_MESSAGE_KINDS.SESSION_EXPIRED));
  assert.equal(isCredentialExpired(authenticatedUser({ refreshTokenExpiration: new Date(PAST) }), NOW), true);

  const expiredLicense = deriveAuthState(
    authenticatedUser({ license: { status: "expired" } }),
    { online: true, now: NOW }
  );
  assert.equal(expiredLicense.status, AUTH_STATUS.EXPIRED);
});

test("1.2 no session offline is offline-required and never authenticated", () => {
  const state = deriveAuthState(signedOutUser(), { online: false, hadSession: false, now: NOW });
  assert.equal(state.status, AUTH_STATUS.OFFLINE_REQUIRED);
  assert.equal(canAccessBusiness(state), false);
  assert.equal(canStartAuthentication(state, false), false);
  assert.equal(canStartAuthentication(state, true), false);
});

test("1.2 every non-authenticated state refuses business access", () => {
  const states = [
    deriveAuthState({ isLoading: true }, { online: true, now: NOW }),
    deriveAuthState(signedOutUser(), { online: true, hadSession: false, now: NOW }),
    deriveAuthState(signedOutUser(), { online: true, hadSession: true, now: NOW }),
    deriveAuthState(signedOutUser(), { online: false, now: NOW }),
    deriveAuthState(null, { online: true, refusal: { kind: AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL }, now: NOW })
  ];
  for (const state of states) assert.equal(canAccessBusiness(state), false, state.status);
});

test("1.2 a valid session is reused offline", () => {
  const state = deriveAuthState(authenticatedUser(), { online: false, hadSession: true, now: NOW });
  assert.equal(state.status, AUTH_STATUS.AUTHENTICATED);
  assert.equal(canAccessBusiness(state), true);
});

test("1.3 classifyAuthFailure maps native error shapes without raw payloads", () => {
  const invalid = classifyAuthFailure({ name: "OAuthError", messageCode: "INVALID_OTP", message: "raw 123456 token" });
  assert.equal(invalid, AUTH_MESSAGE_KINDS.INVALID_CODE);

  const expired = classifyAuthFailure({ name: "OAuthError", code: "expired_code", message: "raw provider body" });
  assert.equal(expired, AUTH_MESSAGE_KINDS.EXPIRED_CODE);

  const network = classifyAuthFailure({ name: "OAuthError", code: "network_error" });
  assert.equal(network, AUTH_MESSAGE_KINDS.NETWORK);
  assert.equal(classifyAuthFailure(new TypeError("Failed to fetch")), AUTH_MESSAGE_KINDS.NETWORK);

  const policy = classifyAuthFailure({ name: "PolicyRejectionError", code: "insufficient_permissions" });
  assert.equal(policy, AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL);

  const http403 = classifyAuthFailure({ name: "HttpError", httpStatus: 403 });
  assert.equal(http403, AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL);

  const origin = classifyAuthFailure({ name: "PolicyRejectionError", code: "invalid_origin" });
  assert.equal(origin, AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL);

  assert.equal(classifyAuthFailure({ name: "OAuthError", code: "provider_error", message: "leak me" }), AUTH_MESSAGE_KINDS.GENERIC);
  assert.equal(authMessage(invalid).includes("raw"), false);
});

test("1.3 classifyPermissionFailure only returns native refusals", () => {
  assert.equal(classifyPermissionFailure({ name: "PolicyRejectionError" }), AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL);
  assert.equal(classifyPermissionFailure({ status: 403 }), AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL);
  assert.equal(classifyPermissionFailure({ code: "origin_not_allowed" }), AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL);
  assert.equal(classifyPermissionFailure(new Error("boom")), null);
  assert.equal(classifyPermissionFailure(null), null);
});

test("1.4 interactionViewModel maps email fields and safe alerts", () => {
  let submitted = null;
  const model = interactionViewModel({
    type: "email",
    title: "Enter email address",
    alerts: [{ type: "error", messageCode: "INVALID_EMAIL", message: "raw provider text" }],
    fields: { email: { type: "email", placeholder: "you@somedomain.com" } },
    onSubmit: (value) => { submitted = value; }
  });
  assert.equal(model.kind, "email");
  assert.equal(model.field.name, "email");
  assert.equal(model.field.type, "email");
  assert.equal(model.alerts.length, 1);
  assert.equal(model.alerts[0].message, "Saisissez une adresse email valide.");
  assert.doesNotMatch(model.alerts[0].message, /raw provider/);
  assert.equal(model.submit({ email: "  alice@example.test  " }), true);
  assert.deepEqual(submitted, { email: "alice@example.test" });
  assert.equal(model.submit({ email: "second@example.test" }), false);
});

test("1.4 interactionViewModel maps OTP fields and invokes callbacks once", () => {
  let submits = 0;
  let cancels = 0;
  const model = interactionViewModel(otpPayload({
    onSubmit: () => { submits += 1; },
    onCancel: () => { cancels += 1; }
  }));
  assert.equal(model.kind, "otp");
  assert.equal(model.field.name, "otp");
  assert.equal(model.alerts[0].message, "Un code à usage unique a été envoyé à alice@example.test.");
  assert.equal(model.submitLabel, "Valider le code");
  assert.equal(model.submit({ otp: "12345678" }), true);
  assert.equal(model.submit({ otp: "87654321" }), false);
  assert.equal(submits, 1);
  assert.equal(model.cancel(), false);
  assert.equal(cancels, 0);

  const second = interactionViewModel(otpPayload({ onCancel: () => { cancels += 1; } }));
  assert.equal(second.cancel(), true);
  assert.equal(second.cancel(), false);
  assert.equal(cancels, 1);
});

test("1.4 interactionViewModel never exposes alternative providers", () => {
  const model = interactionViewModel({
    type: "generic",
    title: "Sign in",
    options: [{ name: "provider", value: "github", displayName: "Continue with GitHub" }],
    fields: {},
    onSubmit: () => {},
    onCancel: () => {}
  });
  assert.equal(model.kind, "unsupported");
  assert.deepEqual(model.providerOptions, []);
  assert.equal(model.cancelLabel, null);
});

test("1.5 package check covers the authentication module", () => {
  assert.match(pkg.scripts.check, /node --check site\/authentication\.js/);
  const result = spawnSync(process.execPath, ["--check", "site/authentication.js"], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});

test("2.1 app.js uses the forced native OTP grant and native subscriptions", () => {
  const app = read("site/app.js");
  assert.match(app, /db\.cloud\.login\(\{\s*\.\.\.options,\s*grant_type:\s*"otp"\s*\}\)/);
  assert.match(app, /db\.cloud\.currentUser\.subscribe/);
  assert.match(app, /db\.cloud\.userInteraction\.subscribe/);
  assert.match(read("site/dexie-foundation.js"), /requireAuth: true, customLoginGui: true/);
  assert.doesNotMatch(app, /fetchTokens/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /type:\s*"password"|password/i);
  assert.doesNotMatch(app, /oauth|social|passkey/i);
  assert.doesNotMatch(app, /grant_type:\s*"(?!otp")/);
});

test("2.2 the sign-in surface declares only email, OTP, resend and live regions", () => {
  const html = read("site/index.html");
  assert.match(html, /id="auth-panel"/);
  assert.match(html, /id="auth-email"[^>]*type="email"/);
  assert.match(html, /id="auth-otp"[^>]*type="text"/);
  assert.match(html, /id="auth-resend"/);
  assert.match(html, /id="auth-local-data"/);
  assert.match(html, /id="auth-export-legacy"[^>]*type="button"[^>]*hidden/);
  assert.match(read("site/app.js"), /authLegacyExportEl\.addEventListener\("click", exportLegacyBackup\)/);
  assert.match(read("site/app.js"), /renderLocalRecovery\(\)/);
  assert.match(read("site/app.js"), /Demande de code en cours auprès de Dexie Cloud/);
  assert.match(html, /id="auth-error"[^>]*role="alert"/);
  assert.match(html, /id="auth-status"[^>]*role="status"[^>]*aria-live="polite"|id="auth-status"[^>]*aria-live="polite"[^>]*role="status"/);
  assert.doesNotMatch(html, /type="password"/i);
  assert.doesNotMatch(html, /<button[^>]*>(?:[^<]*(?:OAuth|social|passkey))/i);
  assert.doesNotMatch(html, /Aucun compte/i);
  assert.doesNotMatch(html, /aucun serveur/i);
  assert.match(html, /id="dashboard"/);
  assert.match(html, /id="business-tools"/);
  const css = read("site/styles.css");
  assert.match(css, /\.auth-panel/);
  assert.match(css, /\.auth-error/);
});

test("2.3 the authenticated gate protects loads, writes, subscriptions and migration", () => {
  const app = read("site/app.js");
  assert.ok((app.match(/if \(!businessAllowed\(\)\) return;/g) || []).length >= 4);
  assert.match(app, /function businessAllowed\(\)/);
  assert.match(app, /if \(canAccessBusiness\(authState\)\) \{[\s\S]*?startBusiness\(\)/);
  assert.match(app, /function startBusiness\(\) \{[\s\S]*?load\(\);[\s\S]*?offerHistoricalMigration\(\);/);
  assert.match(app, /requiresAuthentication\(\)/);
  assert.equal(cloudConfigureOptions("https://demo.dexie.cloud").requireAuth, true);
});

test("2.4 a valid session is reused without a native login call", () => {
  const storage = fakeStorage();
  const fake = fakeAdapter();
  const states = [];
  const controller = createAuthController({
    adapter: fake.adapter,
    storage,
    getOnline: () => true,
    onStateChange: (state) => states.push(state),
    now: () => NOW
  });
  controller.applyUser(authenticatedUser());
  assert.equal(controller.snapshot().status, AUTH_STATUS.AUTHENTICATED);
  assert.equal(fake.loginCalls.length, 0);
  assert.equal(hasAuthenticatedBefore(storage), true);
  assert.equal(storage.getItem(AUTH_SEEN_KEY), "1");

  const reloaded = createAuthController({ adapter: fake.adapter, storage, getOnline: () => true, now: () => NOW });
  reloaded.applyUser(authenticatedUser());
  assert.equal(reloaded.snapshot().status, AUTH_STATUS.AUTHENTICATED);
  assert.equal(fake.loginCalls.length, 0);
  assert.ok(states.every((state) => state.status === AUTH_STATUS.AUTHENTICATED));
});

test("2.4 loading is not signed-out and no login is started", () => {
  const fake = fakeAdapter();
  const controller = createAuthController({ adapter: fake.adapter, storage: fakeStorage(), getOnline: () => true, now: () => NOW });
  controller.applyUser({ ...signedOutUser(), isLoading: true });
  assert.equal(controller.snapshot().status, AUTH_STATUS.LOADING);
  assert.equal(fake.loginCalls.length, 0);
  controller.applyUser(authenticatedUser());
  assert.equal(controller.snapshot().status, AUTH_STATUS.AUTHENTICATED);
  assert.equal(fake.loginCalls.length, 0);
});

test("2.4 an expired session shows reauthentication without deleting data", () => {
  const document = { version: 1, subjects: [{ id: "s1", title: "Sujet", items: [] }] };
  const storage = fakeStorage({ [AUTH_SEEN_KEY]: "1", [STORAGE_KEY]: JSON.stringify(document) });
  const store = fakeBusinessStore({ subjects: [{ id: "s1" }], items: [{ id: "i1" }] });
  const before = store.snapshot();
  const fake = fakeAdapter();
  const controller = createAuthController({ adapter: fake.adapter, storage, getOnline: () => true, now: () => NOW });
  controller.applyUser(signedOutUser());
  assert.equal(controller.snapshot().status, AUTH_STATUS.EXPIRED);
  assert.equal(controller.snapshot().message, authMessage(AUTH_MESSAGE_KINDS.SESSION_EXPIRED));
  assert.equal(controller.canAccessBusiness(), false);
  assert.equal(fake.loginCalls.length, 0);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), document);
  assert.deepEqual(store.snapshot(), before);
});

test("2.5 an invalid OTP keeps sign-in open, resend uses the same email and keeps data", () => {
  const store = fakeBusinessStore({ subjects: [{ id: "s1" }], items: [{ id: "i1", title: "Action" }] });
  const before = store.snapshot();
  const fake = fakeAdapter();
  const controller = createAuthController({ adapter: fake.adapter, storage: fakeStorage(), getOnline: () => true, now: () => NOW });
  controller.applyUser(signedOutUser());

  const first = controller.startSignIn("alice@example.test");
  assert.deepEqual(fake.loginCalls[0], { grant_type: "otp", email: "alice@example.test" });
  return first.then(() => {
    const model = controller.handleInteraction(otpPayload({
      alerts: [{
        type: "error",
        messageCode: "INVALID_OTP",
        message: "400 Invalid OTP 12345678",
        messageParams: {}
      }]
    }));
    assert.equal(model.kind, "otp");
    assert.equal(model.alerts[0].message, authMessage(AUTH_MESSAGE_KINDS.INVALID_CODE));
    assert.equal(controller.snapshot().status, AUTH_STATUS.SIGNED_OUT);
    assert.equal(controller.canAccessBusiness(), false);

    return controller.resend().then(() => {
      assert.equal(fake.loginCalls.length, 2);
      assert.deepEqual(fake.loginCalls[1], { grant_type: "otp", email: "alice@example.test" });

      controller.applyUser(authenticatedUser());
      assert.equal(controller.snapshot().status, AUTH_STATUS.AUTHENTICATED);
      assert.deepEqual(store.snapshot(), before);
    });
  });
});

test("2.5 an expired code is classified and retry can authenticate", async () => {
  const fake = fakeAdapter({ reject: { name: "OAuthError", code: "expired_code", message: "expired 12345678" } });
  const controller = createAuthController({ adapter: fake.adapter, storage: fakeStorage(), getOnline: () => true, now: () => NOW });
  controller.applyUser(signedOutUser());
  const outcome = await controller.startSignIn("alice@example.test");
  assert.equal(outcome.started, false);
  assert.equal(outcome.reason, AUTH_MESSAGE_KINDS.EXPIRED_CODE);
  assert.equal(outcome.state.status, AUTH_STATUS.SIGNED_OUT);
  assert.equal(outcome.state.message, authMessage(AUTH_MESSAGE_KINDS.EXPIRED_CODE));
  assert.equal(controller.canAccessBusiness(), false);

  const retryAdapter = fakeAdapter();
  const retry = createAuthController({ adapter: retryAdapter.adapter, storage: fakeStorage(), getOnline: () => true, now: () => NOW });
  retry.applyUser(signedOutUser());
  await retry.startSignIn("alice@example.test");
  retry.applyUser(authenticatedUser());
  assert.equal(retry.snapshot().status, AUTH_STATUS.AUTHENTICATED);
});

test("2.1 the controller forwards email and OTP submissions once to native callbacks", () => {
  const emails = [];
  const codes = [];
  const fake = fakeAdapter();
  const controller = createAuthController({ adapter: fake.adapter, storage: fakeStorage(), getOnline: () => true, now: () => NOW });
  controller.applyUser(signedOutUser());

  controller.handleInteraction({
    type: "email",
    fields: { email: {} },
    alerts: [],
    onSubmit: (value) => emails.push(value),
    onCancel: () => {}
  });
  assert.equal(controller.submitInteraction({ email: "alice@example.test" }), true);
  assert.equal(controller.submitInteraction({ email: "second@example.test" }), false);
  assert.deepEqual(emails, [{ email: "alice@example.test" }]);

  controller.handleInteraction(otpPayload({ onSubmit: (value) => codes.push(value) }));
  assert.equal(controller.submitInteraction({ otp: "12345678" }), true);
  assert.equal(controller.submitInteraction({ otp: "87654321" }), false);
  assert.deepEqual(codes, [{ otp: "12345678" }]);
  assert.equal(fake.loginCalls.length, 0);
});

test("2.6 offline first use starts no OTP exchange and grants no access", async () => {
  const fake = fakeAdapter();
  const controller = createAuthController({ adapter: fake.adapter, storage: fakeStorage(), getOnline: () => false, now: () => NOW });
  controller.applyUser(signedOutUser());
  assert.equal(controller.snapshot().status, AUTH_STATUS.OFFLINE_REQUIRED);
  assert.equal(controller.snapshot().message, authMessage(AUTH_MESSAGE_KINDS.OFFLINE_FIRST));
  const outcome = await controller.startSignIn("alice@example.test");
  assert.equal(outcome.started, false);
  assert.equal(outcome.reason, AUTH_STATUS.OFFLINE_REQUIRED);
  assert.equal(fake.loginCalls.length, 0);
  assert.equal(controller.canAccessBusiness(), false);
});

test("3.1 authentication and business sources never assign owner or realm", () => {
  for (const file of ["site/authentication.js", "site/app.js", "site/persistence.js", "site/migration.js"]) {
    const source = read(file);
    assert.doesNotMatch(source, /\.owner\s*=/, file);
    assert.doesNotMatch(source, /realmId\s*[:=]/, file);
    assert.doesNotMatch(source, /grant_access|allowAll|bypassAuth|disableAuth/i, file);
  }
});

test("3.2 a permission refusal is shown without retry or data deletion", async () => {
  const store = fakeBusinessStore({ subjects: [{ id: "s1" }], items: [{ id: "i1" }] });
  const before = store.snapshot();
  const fake = fakeAdapter({ reject: { name: "PolicyRejectionError", code: "insufficient_permissions", message: "raw policy body" } });
  const controller = createAuthController({ adapter: fake.adapter, storage: fakeStorage(), getOnline: () => true, now: () => NOW });
  controller.applyUser(signedOutUser());
  const outcome = await controller.startSignIn("alice@example.test");
  assert.equal(outcome.reason, AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL);
  assert.equal(controller.snapshot().status, AUTH_STATUS.REFUSED);
  assert.equal(controller.snapshot().message, authMessage(AUTH_MESSAGE_KINDS.PERMISSION_REFUSAL));
  assert.doesNotMatch(controller.snapshot().message, /raw policy/);
  assert.equal(controller.canAccessBusiness(), false);
  assert.equal(fake.loginCalls.length, 1);
  assert.ok(fake.loginCalls.every((call) => call.grant_type === "otp"));
  const blockedRetry = await controller.startSignIn("bob@example.test");
  assert.equal(blockedRetry.started, false);
  assert.equal(fake.loginCalls.length, 1);
  assert.deepEqual(store.snapshot(), before);
});

test("3.3 an origin refusal leaves the user unauthenticated and preserves records", async () => {
  const document = { version: 1, subjects: [] };
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify(document) });
  const store = fakeBusinessStore({ subjects: [{ id: "s1" }], items: [{ id: "i1" }] });
  const before = store.snapshot();
  const fake = fakeAdapter({ reject: { name: "PolicyRejectionError", code: "invalid_origin", message: "raw origin body" } });
  const controller = createAuthController({ adapter: fake.adapter, storage, getOnline: () => true, now: () => NOW });
  controller.applyUser(signedOutUser());
  const outcome = await controller.startSignIn("alice@example.test");
  assert.equal(outcome.reason, AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL);
  assert.equal(controller.snapshot().status, AUTH_STATUS.REFUSED);
  assert.equal(controller.snapshot().message, authMessage(AUTH_MESSAGE_KINDS.ORIGIN_REFUSAL));
  assert.equal(controller.canAccessBusiness(), false);
  assert.deepEqual(JSON.parse(storage.getItem(STORAGE_KEY)), document);
  assert.deepEqual(store.snapshot(), before);
});

test("4.1 documentation describes the OTP journey, gate and operator allowlist", () => {
  const guide = read("docs/product/developer-guide.md");
  assert.match(guide, /Authentification OTP email native \(TS-027\)/);
  assert.match(guide, /requireAuth: true/);
  assert.match(guide, /threadstep\.auth\.seen\.v1/);
  assert.match(guide, /db\.cloud\.login/);
  assert.match(guide, /hors ligne/i);
  assert.match(guide, /origine/i);
  assert.match(guide, /Procédure\s+opérateur hors build/);

  const mvp = read("docs/product/mvp.md");
  assert.match(mvp, /Authentification OTP email native \(TS-027\), intégrée/);
  assert.match(mvp, /grant_type: "otp"/);

  const currentDocs = guide + mvp;
  assert.doesNotMatch(currentDocs, /Aucun compte et aucun serveur/i);
  assert.doesNotMatch(currentDocs, /https:\/\/[a-z0-9-]+\.dexie\.cloud/i);

  const backlog = spawnSync(process.execPath, ["scripts/asf/backlog-cli.mjs", "check"], { cwd: root, encoding: "utf8" });
  assert.equal(backlog.status, 0, backlog.stderr || backlog.stdout);
});

test("4.2 delivered sources and docs stay secret-free and backend-free", () => {
  const files = [
    "site/authentication.js",
    "site/app.js",
    "site/index.html",
    "site/core.js",
    "site/dexie-foundation.js",
    "site/persistence.js",
    "site/migration.js",
    "docs/product/developer-guide.md",
    "docs/product/mvp.md"
  ];
  const docs = ["docs/product/developer-guide.md", "docs/product/mvp.md"];
  const codeFiles = files.filter((file) => !docs.includes(file));
  const secretPatterns = [
    /\bsk-[A-Za-z0-9]{16,}/,
    /Bearer\s+[A-Za-z0-9._-]{16,}/,
    /https:\/\/[a-z0-9-]+\.dexie\.cloud/i,
    /["']AIza[0-9A-Za-z_-]{20,}["']/
  ];
  const forbiddenAuthPath = [
    /dexie-cloud\.key/i,
    /dexie-cloud\.json/i,
    /fetchTokens/
  ];
  for (const file of files) {
    const source = read(file);
    for (const pattern of secretPatterns) {
      assert.doesNotMatch(source, pattern, file + " matched " + pattern);
    }
    if (codeFiles.includes(file)) {
      for (const pattern of forbiddenAuthPath) {
        assert.doesNotMatch(source, pattern, file + " matched " + pattern);
      }
    }
  }
  const auth = read("site/authentication.js");
  assert.doesNotMatch(auth, /\bconsole\./);
  assert.doesNotMatch(auth, /\bfetch\s*\(/);
  assert.doesNotMatch(auth, /XMLHttpRequest/);
  assert.doesNotMatch(auth, /innerHTML/);
  assert.doesNotMatch(auth, /sessionStorage/);
  assert.doesNotMatch(auth, /https?:\/\//);
  assert.doesNotMatch(auth, /(?:accessToken|refreshToken)\s*[:=]/);
  assert.ok(existsSync(resolve(root, "site/vendor/dexie-cloud.mjs")));
});

test("4.2 no OTP value is logged or rendered by the authentication surface", () => {
  const app = read("site/app.js");
  assert.doesNotMatch(app, /console\.(?:log|info|warn|error)/);
  assert.doesNotMatch(app, /authOtpEl\.value\s*\+|notify\([^)]*otp/i);
  const auth = read("site/authentication.js");
  const exposed = [authMessage(AUTH_MESSAGE_KINDS.SIGN_IN), authMessage(AUTH_MESSAGE_KINDS.INVALID_CODE)];
  for (const message of exposed) assert.doesNotMatch(message, /\b\d{6,8}\b/);
});
