import { STORAGE_KEY, RESUME_KEY, PRIORITIES, emptyDocument, newSubject, newItem, subjectRoute, parseRoute, findSubject, renameSubject, visibleItems, overviewPreview, isWithinOverviewPreview, substepView, substepToggleLabel, toggleCollapsedParent, pendingCount, totalTaskCount, totalTaskCountLabel, parseDocument, moveSubject, updateItem, setItemPriority, reorderWithinPriority, moveWithinPriority, canMoveWithinPriority, canReorderWithinPriority, nextActionSuggestion, suggestionReason, parseResumePreference, serializeResumePreference, resumeView, planRemoval, restoreRemoval, removalContainsItem, restorableTrackingRef } from "./core.js";

const subjectsEl = document.querySelector("#subjects");
const counterEl = document.querySelector("#counter");
const statusEl = document.querySelector("#status");
const subjectForm = document.querySelector("#subject-form");
const hideCompletedEl = document.querySelector("#hide-completed");
const reorderNoteEl = document.querySelector("#reorder-note");
const focusSuggestEl = document.querySelector("#focus-suggest");
const focusCardEl = document.querySelector("#focus-card");
const resumeCardEl = document.querySelector("#resume-card");
const snackbarEl = document.querySelector("#snackbar");
let documentState = emptyDocument();
let editingItemId = null;
let focusItemId = null;
let focusSubjectId = null;
let revealItemId = null;
let suggestionVisible = false;
let hideCompleted = false;
let resumeRef = null;
let documentLoaded = false;
let pendingMoveFocus = null;
let pendingCollapseFocus = null;
let pendingPriorityFocus = null;
let collapsedParents = new Set();
let dragState = null;
let route = parseRoute(location.hash);
let renamingSubject = false;
let focusDetailHeading = false;
let focusOpenSubjectId = null;
let focusRenameControl = false;

const UNDO_WINDOW_MS = 10000;
let pendingRemoval = null;
let removalTimer = null;
let removalDeadline = 0;

const priorityLabels = { urgent: "Urgent", normal: "Normal", later: "Plus tard" };
function notify(message) { statusEl.textContent = message; }
function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documentState));
    notify("Sauvegardé localement");
  } catch {
    notify("Stockage indisponible : exportez vos données.");
  }
  documentLoaded = true;
  render();
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      documentState = parseDocument(raw);
      documentLoaded = true;
      resumeRef = readResumePreference();
    }
  } catch {
    notify("Données locales illisibles. Une importation reste possible.");
  }
  render();
}
function readResumePreference() {
  try {
    return parseResumePreference(localStorage.getItem(RESUME_KEY));
  } catch {
    return null;
  }
}
function saveResumePreference(ref) {
  try {
    localStorage.setItem(RESUME_KEY, serializeResumePreference(ref));
  } catch {
    notify("Stockage indisponible : le suivi ne sera pas conservé.");
  }
}
function removeResumePreference() {
  try {
    localStorage.removeItem(RESUME_KEY);
  } catch {
    // Ignore: a missing or unavailable store leaves no orphan reference to clean.
  }
}
function reconcileResume() {
  const view = resumeView(documentState, resumeRef);
  if (view) return view;
  if (resumeRef && documentLoaded) {
    resumeRef = null;
    removeResumePreference();
  }
  return null;
}
function render() {
  subjectsEl.replaceChildren();
  if (reorderNoteEl) reorderNoteEl.hidden = !hideCompleted;
  const n = pendingCount(documentState);
  counterEl.textContent = n + (n > 1 ? " prochaines étapes" : " prochaine étape");
  const detail = route.view !== "overview";
  subjectForm.hidden = detail;
  focusSuggestEl.hidden = detail;
  if (detail) {
    focusCardEl.hidden = true;
    resumeCardEl.hidden = true;
    renderDetail();
    applyFocus();
    return;
  }
  renderSuggestion();
  renderResumeCard();
  if (!documentState.subjects.length) {
    subjectsEl.append(el("p", "empty", "Aucun sujet pour le moment. Ajoutez un premier fil de travail ci-dessus."));
    return;
  }
  for (const subject of documentState.subjects) subjectsEl.append(renderSubject(subject));
  applyFocus();
}
function navigate(hash) {
  if (location.hash === hash) {
    route = parseRoute(hash);
    render();
    return;
  }
  location.hash = hash;
}
function renderDetail() {
  if (route.view === "invalid") {
    subjectsEl.append(renderDetailFallback());
    return;
  }
  const subject = findSubject(documentState, route.subjectId);
  if (!subject) {
    subjectsEl.append(renderDetailFallback());
    return;
  }
  subjectsEl.append(renderDetailView(subject));
}
function renderDetailView(subject) {
  const card = el("section", "subject detail");
  card.dataset.subject = subject.id;
  card.setAttribute("aria-label", subject.title);
  card.tabIndex = -1;
  const nav = el("div", "detail-nav");
  const back = el("button", "secondary detail-return", "Retour à la vue d'ensemble");
  back.type = "button";
  back.setAttribute("aria-label", "Retour à la vue d'ensemble depuis " + subject.title);
  back.addEventListener("click", () => returnToOverview(subject.id));
  nav.append(back);
  card.append(nav);
  card.append(renderDetailHead(subject));
  card.append(renderTaskArea(subject));
  return card;
}
function renderDetailFallback() {
  const card = el("section", "subject detail fallback");
  card.tabIndex = -1;
  const heading = el("h2", "detail-title", "Projet introuvable");
  heading.tabIndex = -1;
  const message = el("p", "detail-message", "Ce projet n'est pas disponible. Il a peut-être été supprimé, remplacé par un import, ou n'existe pas.");
  message.setAttribute("role", "alert");
  const back = el("button", "secondary detail-return", "Retour à la vue d'ensemble");
  back.type = "button";
  back.setAttribute("aria-label", "Retour à la vue d'ensemble");
  back.addEventListener("click", () => navigate("#/"));
  card.append(heading, message, back);
  return card;
}
function renderDetailHead(subject) {
  if (renamingSubject) return renderRenameForm(subject);
  const head = el("div", "subject-head detail-head");
  const titleBox = el("div");
  const heading = el("h2", "detail-title", subject.title);
  heading.tabIndex = -1;
  titleBox.append(heading);
  const pending = subject.items.filter((item) => !item.done).length;
  titleBox.append(el("p", "small", pending + " étape" + (pending > 1 ? "s" : "") + " en attente"));
  titleBox.append(el("p", "small subject-total", totalTaskCountLabel(totalTaskCount(subject.items))));
  const controls = el("div", "subject-controls");
  const rename = el("button", "subtle subject-rename", "Renommer le projet");
  rename.type = "button";
  rename.setAttribute("aria-label", "Renommer le projet " + subject.title);
  rename.addEventListener("click", () => {
    renamingSubject = true;
    render();
  });
  controls.append(rename);
  head.append(titleBox, controls);
  return head;
}
function renderRenameForm(subject) {
  const form = el("form", "subject-rename-form");
  const input = el("input", "subject-rename-input");
  input.type = "text";
  input.maxLength = 100;
  input.required = true;
  input.value = subject.title;
  input.setAttribute("aria-label", "Nouveau nom du projet " + subject.title);
  const save = el("button", "primary", "Enregistrer");
  save.type = "submit";
  const cancel = el("button", "subtle subject-rename-cancel", "Annuler");
  cancel.type = "button";
  const error = el("p", "rename-error");
  error.hidden = true;
  error.setAttribute("role", "alert");
  form.append(input, save, cancel, error);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const trimmed = input.value.trim();
    if (!trimmed || trimmed.length > 100) {
      error.textContent = "Le nom doit contenir entre 1 et 100 caractères.";
      error.hidden = false;
      input.focus();
      return;
    }
    const next = renameSubject(documentState, subject.id, input.value);
    renamingSubject = false;
    focusRenameControl = true;
    if (next === documentState) { render(); return; }
    documentState = next;
    persist();
  });
  cancel.addEventListener("click", () => {
    renamingSubject = false;
    focusRenameControl = true;
    render();
  });
  return form;
}
function returnToOverview(subjectId) {
  renamingSubject = false;
  focusOpenSubjectId = subjectId;
  navigate("#/");
}
function openSubject(subject) {
  const target = subjectRoute(subject.id);
  if (!target) return;
  renamingSubject = false;
  focusDetailHeading = true;
  navigate(target);
}
function applyFocus() {
  if (editingItemId) {
    const input = subjectsEl.querySelector(".task-edit-title");
    if (input) { input.focus(); input.select(); return; }
  }
  if (renamingSubject) {
    const input = subjectsEl.querySelector(".subject-rename-input");
    if (input) { input.focus(); input.select(); return; }
  }
  if (focusDetailHeading) {
    focusDetailHeading = false;
    const heading = subjectsEl.querySelector(".detail-title");
    if (heading) { heading.focus(); return; }
  }
  if (focusOpenSubjectId) {
    const id = focusOpenSubjectId;
    focusOpenSubjectId = null;
    const control = [...subjectsEl.querySelectorAll(".subject-open")].find((node) => node.dataset.subject === id);
    if (control) { control.focus(); return; }
  }
  if (focusRenameControl) {
    focusRenameControl = false;
    const control = subjectsEl.querySelector(".subject-rename");
    if (control) { control.focus(); return; }
  }
  if (focusSubjectId) {
    const card = [...subjectsEl.querySelectorAll(".subject")].find((node) => node.dataset.subject === focusSubjectId);
    focusSubjectId = null;
    if (card) card.focus();
    return;
  }
  if (focusItemId) {
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === focusItemId);
    const target = card && card.querySelector(".task-edit");
    focusItemId = null;
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (pendingCollapseFocus) {
    const itemId = pendingCollapseFocus;
    pendingCollapseFocus = null;
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === itemId);
    const target = card && card.querySelector(".task-toggle");
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (pendingPriorityFocus) {
    const itemId = pendingPriorityFocus;
    pendingPriorityFocus = null;
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === itemId);
    const target = card && card.querySelector(".priority-control");
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
    return;
  }
  if (pendingMoveFocus) {
    const { itemId, direction } = pendingMoveFocus;
    pendingMoveFocus = null;
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === itemId);
    if (!card) return;
    const sameDirection = direction === "up"
      ? card.querySelector(".task-move-up")
      : direction === "down" ? card.querySelector(".task-move-down") : null;
    const target = (sameDirection && !sameDirection.disabled)
      ? sameDirection
      : card.querySelector(".task-handle") || sameDirection;
    if (target) {
      target.focus();
      if (target.scrollIntoView) target.scrollIntoView({ block: "nearest" });
    }
  }
}
function renderSuggestion() {
  focusCardEl.replaceChildren();
  if (!suggestionVisible) {
    focusCardEl.hidden = true;
    return;
  }
  focusCardEl.hidden = false;
  const suggestion = nextActionSuggestion(documentState);
  if (!suggestion) {
    focusCardEl.append(el("p", "focus-empty", "Aucune étape à faire pour le moment. Ajoutez une prochaine action pour commencer."));
    return;
  }
  focusCardEl.append(el("p", "focus-label", "Prochaine étape suggérée"));
  focusCardEl.append(el("p", "focus-title", suggestion.itemTitle));
  focusCardEl.append(el("p", "focus-meta", suggestion.subjectTitle + " · " + priorityLabels[suggestion.priority]));
  const reason = suggestionReason(suggestion.priority);
  if (reason) focusCardEl.append(el("p", "focus-reason", reason));
  const actions = el("div", "focus-actions");
  const reveal = el("button", "subtle focus-reveal", "Voir dans la liste");
  reveal.type = "button";
  reveal.addEventListener("click", () => revealSuggestion(suggestion));
  const close = el("button", "subtle focus-close", "Fermer");
  close.type = "button";
  close.addEventListener("click", hideSuggestion);
  actions.append(reveal, close);
  focusCardEl.append(actions);
}
function revealAction(subjectId, itemId) {
  revealItemId = itemId;
  focusItemId = itemId;
  const subject = findSubject(documentState, subjectId);
  if (subject && !isWithinOverviewPreview(subject.items, itemId, hideCompleted)) {
    renamingSubject = false;
    focusDetailHeading = false;
    navigate(subjectRoute(subject.id));
    return;
  }
  render();
}
function revealSuggestion(suggestion) {
  revealAction(suggestion.subjectId, suggestion.itemId);
}
function hideSuggestion() {
  suggestionVisible = false;
  revealItemId = null;
  renderSuggestion();
}
function renderResumeCard() {
  resumeCardEl.replaceChildren();
  const view = reconcileResume();
  if (!view) {
    resumeCardEl.hidden = true;
    return;
  }
  resumeCardEl.hidden = false;
  resumeCardEl.append(el("h3", "resume-label", "Je reprends ici"));
  resumeCardEl.append(el("p", "resume-title", view.itemTitle));
  resumeCardEl.append(el("p", "resume-meta", view.subjectTitle + " · " + priorityLabels[view.priority]));
  const actions = el("div", "resume-actions");
  const reveal = el("button", "subtle resume-reveal", "Voir dans la liste");
  reveal.type = "button";
  reveal.setAttribute("aria-label", "Voir dans la liste : " + view.itemTitle);
  reveal.addEventListener("click", () => revealResume(view));
  const clear = el("button", "subtle resume-clear", "Ne plus suivre");
  clear.type = "button";
  clear.setAttribute("aria-label", "Ne plus suivre : " + view.itemTitle);
  clear.addEventListener("click", clearResume);
  actions.append(reveal, clear);
  resumeCardEl.append(actions);
}
function revealResume(view) {
  revealAction(view.subjectId, view.itemId);
}
function clearResume() {
  resumeRef = null;
  removeResumePreference();
  if (pendingRemoval) pendingRemoval.trackedRef = null;
  revealItemId = null;
  render();
}
function clearRemovalTimer() {
  if (removalTimer !== null) {
    clearTimeout(removalTimer);
    removalTimer = null;
  }
}
function hideSnackbar() {
  snackbarEl.hidden = true;
  snackbarEl.replaceChildren();
}
function invalidatePendingRemoval() {
  clearRemovalTimer();
  pendingRemoval = null;
  hideSnackbar();
}
function expireRemoval() {
  removalTimer = null;
  pendingRemoval = null;
  hideSnackbar();
}
function startRemovalTimer(delay) {
  clearRemovalTimer();
  removalDeadline = Date.now() + delay;
  removalTimer = setTimeout(expireRemoval, delay);
}
function suspendRemovalTimer() {
  if (removalTimer === null) return;
  removalDeadline = Math.max(0, removalDeadline - Date.now());
  clearRemovalTimer();
}
function resumeRemovalTimer() {
  if (pendingRemoval && removalTimer === null) startRemovalTimer(removalDeadline);
}
function showSnackbar(itemTitle) {
  snackbarEl.replaceChildren();
  snackbarEl.append(el("span", "snackbar-message", "Étape retirée"));
  const undo = el("button", "snackbar-undo", "Annuler");
  undo.type = "button";
  undo.setAttribute("aria-label", "Annuler le retrait de " + itemTitle);
  undo.addEventListener("click", undoRemoval);
  snackbarEl.append(undo);
  snackbarEl.hidden = false;
}
function retirerAction(subject, item) {
  const result = planRemoval(documentState, subject.id, item.id);
  if (!result.removal) return;
  invalidatePendingRemoval();
  pendingRemoval = { subjectId: subject.id, rootItemId: item.id, removal: result.removal, trackedRef: null };
  if (resumeRef && removalContainsItem(result.removal, resumeRef.itemId)) {
    pendingRemoval.trackedRef = { subjectId: resumeRef.subjectId, itemId: resumeRef.itemId };
  }
  documentState = result.document;
  focusSubjectId = subject.id;
  persist();
  showSnackbar(item.title);
  startRemovalTimer(UNDO_WINDOW_MS);
}
function undoRemoval() {
  if (!pendingRemoval) return;
  const { removal, trackedRef } = pendingRemoval;
  const restoredDocument = restoreRemoval(documentState, removal);
  const rootId = removal.rootId;
  if (restoredDocument === documentState) {
    invalidatePendingRemoval();
    return;
  }
  documentState = restoredDocument;
  const restored = restorableTrackingRef(documentState, trackedRef);
  if (restored) {
    resumeRef = restored;
    saveResumePreference(resumeRef);
  }
  focusItemId = rootId;
  revealItemId = rootId;
  invalidatePendingRemoval();
  persist();
}
function move(subject, direction) {
  const reordered = moveSubject(documentState.subjects, subject.id, direction);
  if (reordered === documentState.subjects) return;
  documentState.subjects = reordered;
  persist();
  focusAfterMove(subject.id, direction);
}
function focusAfterMove(subjectId, direction) {
  const controls = [...subjectsEl.querySelectorAll(".subject-move")];
  const own = controls.filter((button) => button.dataset.subject === subjectId);
  const card = [...subjectsEl.querySelectorAll(".subject")].find((node) => node.dataset.subject === subjectId);
  const target = own.find((button) => button.dataset.direction === direction && !button.disabled)
    || own.find((button) => !button.disabled)
    || card;
  if (target) target.focus();
}
function renderSubject(subject) {
  const index = documentState.subjects.indexOf(subject);
  const card = el("section", "subject");
  card.setAttribute("aria-label", subject.title);
  card.dataset.subject = subject.id;
  card.tabIndex = -1;
  const head = el("div", "subject-head");
  const titleBox = el("div");
  titleBox.append(el("h3", "", subject.title));
  const pending = subject.items.filter((item) => !item.done).length;
  titleBox.append(el("p", "small", pending + " étape" + (pending > 1 ? "s" : "") + " en attente"));
  titleBox.append(el("p", "small subject-total", totalTaskCountLabel(totalTaskCount(subject.items))));
  const controls = el("div", "subject-controls");
  const open = el("button", "secondary subject-open", "Ouvrir le projet");
  open.type = "button";
  open.dataset.subject = subject.id;
  open.setAttribute("aria-label", "Ouvrir le projet " + subject.title);
  open.addEventListener("click", () => openSubject(subject));
  const up = el("button", "subtle subject-move", "↑");
  up.type = "button";
  up.dataset.subject = subject.id;
  up.dataset.direction = "up";
  up.disabled = index === 0;
  up.setAttribute("aria-label", "Monter le sujet " + subject.title);
  up.addEventListener("click", () => move(subject, "up"));
  const down = el("button", "subtle subject-move", "↓");
  down.type = "button";
  down.dataset.subject = subject.id;
  down.dataset.direction = "down";
  down.disabled = index === documentState.subjects.length - 1;
  down.setAttribute("aria-label", "Descendre le sujet " + subject.title);
  down.addEventListener("click", () => move(subject, "down"));
  const remove = el("button", "danger", "Supprimer");
  remove.type = "button";
  remove.setAttribute("aria-label", "Supprimer le sujet " + subject.title);
  remove.addEventListener("click", () => {
    if (!confirm("Supprimer ce sujet et toutes ses étapes ?")) return;
    invalidatePendingRemoval();
    documentState.subjects = documentState.subjects.filter((s) => s.id !== subject.id);
    persist();
  });
  controls.append(open, up, down, remove);
  head.append(titleBox, controls);
  card.append(head);
  card.append(renderTaskArea(subject, { preview: true }));
  return card;
}
function renderSeeMore(subject) {
  const control = el("button", "secondary overview-see-more", "Voir plus");
  control.type = "button";
  control.setAttribute("aria-label", "Voir plus de tâches pour le projet " + subject.title);
  control.addEventListener("click", () => openSubject(subject));
  return control;
}
function renderTaskArea(subject, { preview = false } = {}) {
  const area = el("div", "task-area");
  const form = el("form", "task-form");
  const input = el("input");
  input.required = true;
  input.maxLength = 300;
  input.placeholder = "Quelle est la prochaine action ?";
  input.setAttribute("aria-label", "Nouvelle étape pour " + subject.title);
  const select = el("select");
  select.setAttribute("aria-label", "Priorité de la nouvelle étape");
  for (const priority of PRIORITIES) {
    const option = el("option", "", priorityLabels[priority]);
    option.value = priority;
    if (priority === "normal") option.selected = true;
    select.append(option);
  }
  const add = el("button", "primary", "+ Étape");
  add.type = "submit";
  form.append(input, select, add);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!input.value.trim() || subject.items.length >= 500) return;
    subject.items.push(newItem(input.value, select.value, crypto.randomUUID()));
    input.value = "";
    persist();
    input.focus();
  });
  area.append(form);

  const list = el("ul", "tasks");
  const selection = preview
    ? overviewPreview(subject.items, hideCompleted)
    : { shown: visibleItems(subject.items, null, hideCompleted), hasMore: false };
  for (const item of selection.shown) list.append(renderItem(subject, item));
  if (!subject.items.length) area.append(el("p", "empty", "Aucune étape. Ajoutez la prochaine action à faire."));
  area.append(list);
  if (selection.hasMore) area.append(renderSeeMore(subject));
  return area;
}
function substepListId(itemId) {
  return "substeps-" + encodeURIComponent(String(itemId));
}
function renderItem(subject, item) {
  const li = el("li", "task" + (item.done ? " done" : "") + (revealItemId === item.id ? " reveal" : ""));
  li.dataset.item = item.id;
  const view = substepView(subject.items, item.id, hideCompleted, collapsedParents);
  if (editingItemId === item.id) {
    li.append(renderEditor(subject, item));
  } else {
    li.append(renderRow(subject, item));
    li.append(renderActions(subject, item, view));
  }
  if (view.renderChildren) {
    const list = el("ul", "tasks children");
    list.id = substepListId(item.id);
    for (const child of view.children) list.append(renderItem(subject, child));
    li.append(list);
  }
  return li;
}
function renderRow(subject, item) {
  const row = el("div", "task-row");
  const check = el("input", "task-check");
  check.type = "checkbox";
  check.checked = item.done;
  check.setAttribute("aria-label", "Terminer " + item.title);
  check.addEventListener("change", () => {
    item.done = check.checked;
    persist();
  });
  const title = el("span", "task-title", item.title);
  const control = el("select", "priority priority-" + item.priority + " priority-control");
  control.setAttribute("aria-label", "Priorité de « " + item.title + " » : " + priorityLabels[item.priority]);
  for (const priority of PRIORITIES) {
    const option = el("option", "", priorityLabels[priority]);
    option.value = priority;
    if (priority === item.priority) option.selected = true;
    control.append(option);
  }
  control.addEventListener("change", () => {
    const next = setItemPriority(documentState, subject.id, item.id, control.value);
    if (next === documentState) return;
    documentState = next;
    pendingPriorityFocus = item.id;
    persist();
    notify("Priorité mise à jour");
  });
  row.append(check, title, control);
  return row;
}
function moveItem(subject, item, direction) {
  const reordered = moveWithinPriority(subject.items, item.id, direction);
  if (reordered === subject.items) return;
  subject.items = reordered;
  pendingMoveFocus = { itemId: item.id, direction };
  persist();
  notify(direction === "up" ? "Étape montée" : "Étape descendue");
}
function renderReorderControls(subject, item) {
  const controls = el("div", "task-reorder");
  const parent = item.parentId === null
    ? null
    : subject.items.find((entry) => entry.id === item.parentId);
  const context = parent
    ? "sous-étape de « " + parent.title + " », priorité " + priorityLabels[item.priority]
    : "priorité " + priorityLabels[item.priority];
  if (!hideCompleted) {
    const handle = el("button", "task-handle", "⠿");
    handle.type = "button";
    handle.setAttribute("aria-label", "Déplacer « " + item.title + " » (" + context + ")");
    handle.setAttribute("aria-describedby", "reorder-note");
    handle.addEventListener("pointerdown", (event) => startDrag(event, subject, item, handle));
    controls.append(handle);
  }
  const up = el("button", "subtle task-move-up", "Monter");
  up.type = "button";
  up.disabled = hideCompleted || !canMoveWithinPriority(subject.items, item.id, "up");
  up.setAttribute("aria-label", "Monter « " + item.title + " » (" + context + ")");
  up.addEventListener("click", () => moveItem(subject, item, "up"));
  const down = el("button", "subtle task-move-down", "Descendre");
  down.type = "button";
  down.disabled = hideCompleted || !canMoveWithinPriority(subject.items, item.id, "down");
  down.setAttribute("aria-label", "Descendre « " + item.title + " » (" + context + ")");
  down.addEventListener("click", () => moveItem(subject, item, "down"));
  controls.append(up, down);
  return controls;
}
function startDrag(event, subject, item, handle) {
  if (hideCompleted || dragState) return;
  if (typeof event.button === "number" && event.button !== 0) return;
  dragState = {
    pointerId: event.pointerId,
    subjectId: subject.id,
    itemId: item.id,
    handle,
    candidate: null
  };
  if (typeof handle.setPointerCapture === "function" && event.pointerId !== undefined) {
    try { handle.setPointerCapture(event.pointerId); } catch { /* capture unavailable */ }
  }
  handle.classList.add("dragging-handle");
  handle.setAttribute("aria-grabbed", "true");
  const task = handle.closest(".task");
  if (task) task.classList.add("dragging");
}
function onDragMove(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  if (event.cancelable) event.preventDefault();
  updateDropIndicator(resolveDropTarget(event.clientX, event.clientY));
}
function resolveDropTarget(x, y) {
  const subject = documentState.subjects.find((entry) => entry.id === dragState.subjectId);
  if (!subject) return null;
  const stack = typeof document.elementsFromPoint === "function"
    ? document.elementsFromPoint(x, y)
    : [document.elementFromPoint(x, y)];
  for (const element of stack) {
    if (!element || typeof element.closest !== "function") continue;
    const task = element.closest(".task");
    if (!task) continue;
    const owner = task.closest(".subject");
    if (!owner || owner.dataset.subject !== dragState.subjectId) continue;
    const row = task.querySelector(".task-row") || task;
    if (typeof row.getBoundingClientRect !== "function") continue;
    const rect = row.getBoundingClientRect();
    const position = y < rect.top + rect.height / 2 ? "before" : "after";
    if (canReorderWithinPriority(subject.items, dragState.itemId, task.dataset.item, position)) {
      return { targetId: task.dataset.item, position, row: task };
    }
  }
  return null;
}
function clearDropIndicators() {
  for (const node of subjectsEl.querySelectorAll(".drop-before, .drop-after")) {
    node.classList.remove("drop-before", "drop-after");
  }
}
function updateDropIndicator(candidate) {
  clearDropIndicators();
  if (!dragState) return;
  dragState.candidate = candidate;
  if (candidate && candidate.row) {
    candidate.row.classList.add(candidate.position === "before" ? "drop-before" : "drop-after");
  }
}
function releaseDrag(state, pointerId) {
  if (typeof state.handle.releasePointerCapture === "function" && pointerId !== undefined) {
    try { state.handle.releasePointerCapture(pointerId); } catch { /* already released */ }
  }
  state.handle.classList.remove("dragging-handle");
  state.handle.removeAttribute("aria-grabbed");
  const task = state.handle.closest(".task");
  if (task) task.classList.remove("dragging");
  clearDropIndicators();
  if (dragState === state) dragState = null;
}
function onDragEnd(event) {
  if (!dragState || event.pointerId !== dragState.pointerId) return;
  const state = dragState;
  const candidate = state.candidate;
  releaseDrag(state, event.pointerId);
  if (!candidate) return;
  const subject = documentState.subjects.find((entry) => entry.id === state.subjectId);
  if (!subject) return;
  const reordered = reorderWithinPriority(subject.items, state.itemId, candidate.targetId, candidate.position);
  if (reordered === subject.items) return;
  subject.items = reordered;
  pendingMoveFocus = { itemId: state.itemId, direction: null };
  persist();
  notify("Étape déplacée");
}
function cancelDrag(event) {
  if (!dragState) return;
  const state = dragState;
  const pointerId = event && event.pointerId !== undefined ? event.pointerId : state.pointerId;
  releaseDrag(state, pointerId);
  notify("Déplacement annulé");
}
function renderSubstepToggle(item, view) {
  const label = substepToggleLabel(view.children.length, view.collapsed);
  const toggle = el("button", "subtle task-toggle", label);
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", view.collapsed ? "false" : "true");
  toggle.setAttribute("aria-label", label + " de « " + item.title + " »");
  if (view.renderChildren) toggle.setAttribute("aria-controls", substepListId(item.id));
  toggle.addEventListener("click", () => {
    collapsedParents = toggleCollapsedParent(collapsedParents, item.id);
    pendingCollapseFocus = item.id;
    render();
  });
  return toggle;
}
function renderActions(subject, item, view) {
  const actions = el("div", "task-actions");
  actions.append(renderReorderControls(subject, item));
  if (item.parentId === null && view && view.hasVisibleSubsteps) actions.append(renderSubstepToggle(item, view));
  const edit = el("button", "subtle task-edit", "Modifier");
  edit.type = "button";
  edit.setAttribute("aria-label", "Modifier " + item.title);
  edit.addEventListener("click", () => {
    editingItemId = item.id;
    focusItemId = null;
    render();
  });
  actions.append(edit);
  if (item.parentId === null) {
    const sub = el("button", "subtle", "+ Sous-étape");
    sub.type = "button";
    sub.addEventListener("click", () => {
      const title = prompt("Nom de la sous-étape :");
      if (!title || !title.trim() || title.length > 300 || subject.items.length >= 500) return;
      subject.items.push(newItem(title, "normal", crypto.randomUUID(), item.id));
      persist();
    });
    actions.append(sub);
    if (!item.done) {
      if (resumeRef && resumeRef.subjectId === subject.id && resumeRef.itemId === item.id) {
        const tracked = el("button", "subtle resume-held", "Action suivie");
        tracked.type = "button";
        tracked.disabled = true;
        tracked.setAttribute("aria-label", "Action suivie : " + item.title);
        actions.append(tracked);
      } else {
        const keep = el("button", "subtle resume-keep", "Garder le fil");
        keep.type = "button";
        keep.setAttribute("aria-label", "Garder le fil : " + item.title);
        keep.addEventListener("click", () => {
          resumeRef = { subjectId: subject.id, itemId: item.id };
          saveResumePreference(resumeRef);
          if (pendingRemoval) pendingRemoval.trackedRef = null;
          render();
        });
        actions.append(keep);
      }
    }
  }
  const remove = el("button", "subtle", "Retirer");
  remove.type = "button";
  remove.setAttribute("aria-label", "Retirer " + item.title);
  remove.addEventListener("click", () => retirerAction(subject, item));
  actions.append(remove);
  return actions;
}
function renderEditor(subject, item) {
  const form = el("form", "task-edit-form");
  const titleInput = el("input", "task-edit-title");
  titleInput.type = "text";
  titleInput.maxLength = 300;
  titleInput.required = true;
  titleInput.value = item.title;
  titleInput.setAttribute("aria-label", "Titre de l'étape " + item.title);
  const select = el("select", "task-edit-priority");
  select.setAttribute("aria-label", "Priorité de l'étape " + item.title);
  for (const priority of PRIORITIES) {
    const option = el("option", "", priorityLabels[priority]);
    option.value = priority;
    if (priority === item.priority) option.selected = true;
    select.append(option);
  }
  const save = el("button", "primary", "Enregistrer");
  save.type = "submit";
  const cancel = el("button", "subtle", "Annuler");
  cancel.type = "button";
  const error = el("p", "edit-error");
  error.hidden = true;
  error.setAttribute("role", "alert");
  form.append(titleInput, select, save, cancel, error);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const trimmed = titleInput.value.trim();
    if (!trimmed || trimmed.length > 300) {
      error.textContent = "Le titre doit contenir entre 1 et 300 caractères.";
      error.hidden = false;
      titleInput.focus();
      return;
    }
    const next = updateItem(documentState, subject.id, item.id, { title: titleInput.value, priority: select.value });
    editingItemId = null;
    focusItemId = item.id;
    if (next === documentState) { render(); return; }
    documentState = next;
    persist();
  });
  cancel.addEventListener("click", () => {
    editingItemId = null;
    focusItemId = item.id;
    render();
  });
  return form;
}
hideCompletedEl.addEventListener("change", () => {
  hideCompleted = hideCompletedEl.checked;
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !dragState) return;
  event.preventDefault();
  cancelDrag(null);
});
window.addEventListener("pointermove", (event) => {
  if (dragState) onDragMove(event);
});
window.addEventListener("pointerup", (event) => {
  if (dragState) onDragEnd(event);
});
window.addEventListener("pointercancel", (event) => {
  if (dragState) cancelDrag(event);
});
focusSuggestEl.addEventListener("click", () => {
  suggestionVisible = true;
  revealItemId = null;
  renderSuggestion();
});
subjectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const input = subjectForm.elements.namedItem("subject");
  if (!input.value.trim() || documentState.subjects.length >= 40) return;
  documentState.subjects.push(newSubject(input.value, crypto.randomUUID()));
  input.value = "";
  persist();
  input.focus();
});
document.querySelector("#export").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(documentState, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = el("a");
  link.href = url;
  link.download = "threadstep-backup.json";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  notify("Export JSON généré");
});
document.querySelector("#import").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 1024 * 1024) throw new Error("Fichier trop volumineux (maximum 1 Mo).");
    const incoming = parseDocument(await file.text());
    if (!confirm("Remplacer toutes les données locales par cet import ?")) return;
    invalidatePendingRemoval();
    collapsedParents = new Set();
    pendingCollapseFocus = null;
    documentState = incoming;
    documentLoaded = true;
    persist();
    notify("Import terminé");
  } catch (error) {
    notify("Import impossible : " + error.message);
  } finally {
    event.target.value = "";
  }
});
window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY) return;
  invalidatePendingRemoval();
  load();
});
window.addEventListener("hashchange", () => {
  route = parseRoute(location.hash);
  render();
});
snackbarEl.addEventListener("focusin", suspendRemovalTimer);
snackbarEl.addEventListener("focusout", (event) => {
  if (event.relatedTarget && snackbarEl.contains(event.relatedTarget)) return;
  resumeRemovalTimer();
});
load();
