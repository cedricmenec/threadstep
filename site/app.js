import { STORAGE_KEY, PRIORITIES, emptyDocument, newSubject, newItem, visibleItems, pendingCount, parseDocument, moveSubject, updateItem } from "./core.js";

const subjectsEl = document.querySelector("#subjects");
const counterEl = document.querySelector("#counter");
const statusEl = document.querySelector("#status");
const subjectForm = document.querySelector("#subject-form");
const hideCompletedEl = document.querySelector("#hide-completed");
let documentState = emptyDocument();
let editingItemId = null;
let focusItemId = null;
let hideCompleted = false;

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
  render();
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) documentState = parseDocument(raw);
  } catch {
    notify("Données locales illisibles. Une importation reste possible.");
  }
  render();
}
function render() {
  subjectsEl.replaceChildren();
  const n = pendingCount(documentState);
  counterEl.textContent = n + (n > 1 ? " prochaines étapes" : " prochaine étape");
  if (!documentState.subjects.length) {
    subjectsEl.append(el("p", "empty", "Aucun sujet pour le moment. Ajoutez un premier fil de travail ci-dessus."));
    return;
  }
  for (const subject of documentState.subjects) subjectsEl.append(renderSubject(subject));
  applyFocus();
}
function applyFocus() {
  if (editingItemId) {
    const input = subjectsEl.querySelector(".task-edit-title");
    if (input) { input.focus(); input.select(); return; }
  }
  if (focusItemId) {
    const card = [...subjectsEl.querySelectorAll(".task")].find((node) => node.dataset.item === focusItemId);
    const target = card && card.querySelector(".task-edit");
    focusItemId = null;
    if (target) target.focus();
  }
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
  const controls = el("div", "subject-controls");
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
    documentState.subjects = documentState.subjects.filter((s) => s.id !== subject.id);
    persist();
  });
  controls.append(up, down, remove);
  head.append(titleBox, controls);
  card.append(head);

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
  card.append(form);

  const list = el("ul", "tasks");
  for (const item of visibleItems(subject.items, null, hideCompleted)) list.append(renderItem(subject, item));
  if (!subject.items.length) card.append(el("p", "empty", "Aucune étape. Ajoutez la prochaine action à faire."));
  card.append(list);
  return card;
}
function renderItem(subject, item) {
  const li = el("li", "task" + (item.done ? " done" : ""));
  li.dataset.item = item.id;
  if (editingItemId === item.id) {
    li.append(renderEditor(subject, item));
  } else {
    li.append(renderRow(subject, item));
    li.append(renderActions(subject, item));
  }
  const children = visibleItems(subject.items, item.id, hideCompleted);
  if (children.length) {
    const list = el("ul", "tasks children");
    for (const child of children) list.append(renderItem(subject, child));
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
  const badge = el("span", "priority priority-" + item.priority, priorityLabels[item.priority]);
  row.append(check, title, badge);
  return row;
}
function renderActions(subject, item) {
  const actions = el("div", "task-actions");
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
  }
  const remove = el("button", "subtle", "Retirer");
  remove.type = "button";
  remove.setAttribute("aria-label", "Retirer " + item.title);
  remove.addEventListener("click", () => {
    subject.items = subject.items.filter((entry) => entry.id !== item.id && entry.parentId !== item.id);
    persist();
  });
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
    documentState = incoming;
    persist();
    notify("Import terminé");
  } catch (error) {
    notify("Import impossible : " + error.message);
  } finally {
    event.target.value = "";
  }
});
window.addEventListener("storage", (event) => { if (event.key === STORAGE_KEY) load(); });
load();
