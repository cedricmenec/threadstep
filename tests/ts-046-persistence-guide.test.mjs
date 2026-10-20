import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => readFileSync(resolve(root, relative), "utf8");
const guidePath = "docs/product/guide-persistance-et-synchronisation.md";
const guide = read(guidePath);

const EVIDENCE_LABELS = [
  "Enregistré sur cet appareil",
  "Transfert local en attente",
  "Pull natif terminé",
  "Synchronisation native en phase",
  "Lecture métier attestée",
  "Contenu confirmé sur un autre appareil"
];

const SCENARIOS = [
  "Premier lancement local",
  "Configurer une URL sans activer",
  "Activation depuis des données locales",
  "Connexion sur un autre appareil",
  "Perte de session",
  "Changement d'espace",
  "Suspension Cloud",
  "Déconnexion",
  "Retour au local",
  "Reprise Cloud",
  "Hors ligne",
  "Écriture non transmise",
  "Cache `UNVERIFIED`",
  "Cache `MISMATCH`",
  "Récupération dans une base isolée",
  "Exporter mes données",
  "Importer et fusionner",
  "Restaurer un état antérieur",
  "Suppression des données du navigateur"
];

const MATRIX_COLUMNS = [
  "Espace actif",
  "Données consultables localement",
  "Destinataire distant éventuel",
  "Données conservées mais non affichées",
  "Danger",
  "Sauvegarde conseillée",
  "Action exacte",
  "Retour arrière"
];

const FAQ_QUESTIONS = [
  "Mes projets est vide",
  "Connecté mais projets absents",
  "Quelle est ma base active ?",
  "Pourquoi un nouveau nom IndexedDB ?",
  "Que signifie dernière synchronisation ?",
  "Que se passe-t-il si je change de téléphone ou supprime les données du navigateur ?"
];

const OFFICIAL_DEXIE_LINKS = [
  "https://dexie.org/docs/cloud/authentication",
  "https://dexie.org/docs/cloud/DexieCloudOptions",
  "https://dexie.org/docs/cloud/SyncState",
  "https://dexie.org/docs/cloud/best-practices"
];

const INBOUND_DOCUMENTS = [
  "docs/product/guide-utilisation.md",
  "docs/product/dexie-cloud-rollout.md",
  "docs/product/acceptance-checklist.md"
];

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, end);
  return source.slice(from, to);
}

function markdownLinks(source) {
  return [...source.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)]
    .map((match) => match[1]);
}

test("1.1 the guide describes the real local-first copies and six evidence levels", () => {
  assert.ok(existsSync(resolve(root, guidePath)));
  assert.match(guide, /^# ThreadStep \| Guide de la persistance et de la synchronisation/m);
  assert.match(guide, /threadstep-local/);
  assert.match(guide, /threadstep-ws-…/);
  assert.match(guide, /threadstep-recovery-…/);
  assert.match(guide, /IndexedDB/);
  assert.match(guide, /Dexie Cloud réplique vers la base locale active/);
  assert.match(guide, /Aucune réplication distante n'existe dans ce mode|Aucune \| Oui/);
  assert.match(guide, /sans URL, OTP ou réseau/);

  for (const label of EVIDENCE_LABELS) {
    assert.ok(guide.includes(label), `niveau de preuve manquant: ${label}`);
  }

  const inSync = between(guide, "### Ce que `in-sync` ne prouve pas", "## 4. Matrice des scénarios");
  assert.match(inSync, /in-sync/);
  assert.match(inSync, /ne prouve pas[^.\n]*toute la copie distante/i);
  assert.match(inSync, /ne prouve pas/i);
  assert.match(inSync, /autre appareil/i);

  assert.doesNotMatch(guide, /tout est sauvegardé dans le Cloud/i);
  assert.doesNotMatch(guide, /in-sync prouve/i);
  assert.doesNotMatch(guide, /le Cloud contient tous vos projets/i);
  assert.doesNotMatch(guide, /Dexie Cloud est interrogé directement/i);

  const sources = between(guide, "Sources internes de vérité", "Ce guide décrit l'état livré");
  for (const source of [
    "../../site/dexie-foundation.js",
    "../../site/workspace-identity.js",
    "../../site/sync-diagnostics.js",
    "../../site/app.js",
    "../../openspec/specs/local-indexeddb-persistence/spec.md",
    "../../openspec/specs/cloud-opt-in-activation/spec.md",
    "../../openspec/specs/cloud-sync-lifecycle/spec.md",
    "../../openspec/specs/workspace-identity-isolation/spec.md",
    "../../openspec/specs/data-backup-import-restore/spec.md",
    "../../openspec/specs/data-integrity-recovery/spec.md"
  ]) {
    assert.ok(sources.includes(source), `source manquante: ${source}`);
  }
});

test("1.2 the scenario matrix covers each required case, column and separated action", () => {
  const matrix = between(guide, "## 4. Matrice des scénarios", "## 5. Reconnaître l'espace");
  for (const column of MATRIX_COLUMNS) {
    assert.ok(matrix.includes(column), `colonne manquante: ${column}`);
  }
  for (const scenario of SCENARIOS) {
    assert.ok(matrix.includes(scenario), `scénario manquant: ${scenario}`);
  }

  const beforeAfter = between(guide, "### 4.5 Avant / après", "## 5. Reconnaître l'espace");
  for (const transition of [
    "Activation",
    "Changement d'espace",
    "Déconnexion",
    "Récupération isolée"
  ]) {
    assert.ok(beforeAfter.includes(transition), `transition avant/après manquante: ${transition}`);
  }

  const sensitive = between(guide, "## 6. Actions sensibles", "## 7. FAQ");
  for (const heading of [
    "### 6.1 Se déconnecter",
    "### 6.2 Suspendre Cloud",
    "### 6.3 Purger la copie locale",
    "### 6.4 Importer et fusionner un JSON",
    "### 6.5 Restaurer un état antérieur",
    "### 6.6 Supprimer les données du navigateur",
    "### 6.7 Retrouver les projets Cloud dans un nouveau cache isolé"
  ]) {
    assert.ok(sensitive.includes(heading), `action sensible non séparée: ${heading}`);
  }
  assert.match(sensitive, /Procédure commune avant une action risquée/);
  assert.match(sensitive, /annuler[^.\n]*ne doit rien supprimer/i);
});

test("1.3 the guide has the prioritized FAQ, glossary, limits and no secret", () => {
  const faq = between(guide, "## 7. FAQ de dépannage priorisée", "## 8. Limites");
  let previous = -1;
  for (const question of FAQ_QUESTIONS) {
    const position = faq.indexOf(question);
    assert.notEqual(position, -1, `question FAQ manquante: ${question}`);
    assert.ok(position > previous, `question FAQ hors ordre: ${question}`);
    previous = position;
  }

  const glossary = between(guide, "## 9. Glossaire sans jargon", "## 10. Pour aller plus loin");
  for (const term of [
    "IndexedDB",
    "Espace autonome",
    "Espace synchronisé",
    "Cache local",
    "Base distante",
    "OTP",
    "Pull",
    "Push",
    "Réplication",
    "Attestation",
    "Sauvegarde",
    "Restauration"
  ]) {
    assert.ok(glossary.includes(`**${term}**`), `terme de glossaire manquant: ${term}`);
  }

  for (const link of OFFICIAL_DEXIE_LINKS) {
    assert.ok(guide.includes(link), `lien officiel manquant: ${link}`);
  }

  assert.match(guide, /threadstep\.indexeddb-backup/);
  assert.match(guide, /fichiers? V1[^.\n]*(refus|plus accept)/i);
  assert.match(guide, /Ce n'est\s+\*\*pas\*\* une synchronisation entre appareils/i);
  assert.match(guide, /permissions[^.\n]*Dexie Cloud/i);
  assert.match(guide, /authentification initiale nécessite une connexion/i);
  assert.match(guide, /propagation vers un autre appareil n'est pas attestée/i);
  assert.doesNotMatch(guide, /(importer|restaurer)[^.\n]{0,40}V1/i);

  assert.doesNotMatch(guide, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  assert.doesNotMatch(guide, /\b\d{6}\b/);
  assert.doesNotMatch(guide, /\bBearer\b|\bsk-[A-Za-z0-9]|\bapi[_-]?key\b/i);
});

test("2.1 inbound links resolve to the guide and terminology matches current controls", () => {
  const target = resolve(root, guidePath);
  for (const documentPath of INBOUND_DOCUMENTS) {
    const document = read(documentPath);
    assert.doesNotMatch(document, /^# ThreadStep \| Guide de la persistance et de la synchronisation/m);
    const matchesGuide = markdownLinks(document).some((link) => {
      if (/^(https?:|mailto:|#)/.test(link)) return false;
      const [path] = link.split("#");
      return resolve(root, dirname(documentPath), path) === target;
    });
    assert.ok(matchesGuide, `lien entrant absent vers le guide: ${documentPath}`);

    for (const link of markdownLinks(document)) {
      if (/^(https?:|mailto:|#)/.test(link)) continue;
      const [path] = link.split("#");
      if (!path) continue;
      assert.ok(
        existsSync(resolve(root, dirname(documentPath), path)),
        `lien relatif cassé dans ${documentPath}: ${link}`
      );
    }
  }

  for (const link of markdownLinks(guide)) {
    if (/^(https?:|mailto:|#)/.test(link)) continue;
    const [path] = link.split("#");
    if (!path) continue;
    assert.ok(existsSync(resolve(root, dirname(guidePath), path)), `lien relatif cassé: ${link}`);
  }

  const html = read("site/index.html");
  const controls = [
    "Se déconnecter",
    "Suspendre Cloud",
    "Purger la copie locale",
    "Retrouver les projets Cloud dans un nouveau cache isolé",
    "Sélectionner cet espace",
    "Exporter mes données",
    "Importer et fusionner",
    "Restaurer un état antérieur"
  ];
  for (const control of controls) {
    assert.ok(html.includes(control), `contrôle absent du code: ${control}`);
    assert.ok(guide.includes(control), `contrôle absent du guide: ${control}`);
  }
  for (const section of ["Configuration", "Première activation", "Connexion", "Espaces de travail"]) {
    assert.ok(html.includes(section), `section absente du code: ${section}`);
    assert.ok(guide.includes(section), `section absente du guide: ${section}`);
  }
  assert.match(guide, /#\/parametres\/synchronisation/);
});
