import { useState } from "react";
import { PRIORITIES, totalTaskCount, totalTaskCountLabel } from "../core.js";
import { TaskList } from "./TaskList.jsx";

const priorityLabels = { urgent: "Urgent", normal: "Normal", later: "Plus tard" };
const MAX_SUBJECT_TITLE = 100;

function RenameForm({ subject, commands }) {
  const [title, setTitle] = useState(subject.title);
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const trimmed = title.trim();
    if (!trimmed || trimmed.length > MAX_SUBJECT_TITLE) {
      setError("Le nom doit contenir entre 1 et 100 caractères.");
      return;
    }
    setError("");
    commands.renameSubject(subject.id, title);
  }

  return (
    <form className="subject-rename-form" onSubmit={submit}>
      <input
        className="subject-rename-input"
        type="text"
        maxLength={MAX_SUBJECT_TITLE}
        required
        value={title}
        aria-label={"Nouveau nom du projet " + subject.title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <button className="primary" type="submit">Enregistrer</button>
      <button
        className="subtle subject-rename-cancel"
        type="button"
        onClick={() => commands.cancelRename()}
      >
        Annuler
      </button>
      {error ? <p className="rename-error" role="alert">{error}</p> : null}
    </form>
  );
}

function CreateTaskForm({ subject, commands }) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");

  function submit(event) {
    event.preventDefault();
    if (!title.trim() || subject.items.length >= 500) return;
    if (commands.createItem(subject.id, title, priority)) {
      setTitle("");
      setPriority("normal");
    }
  }

  return (
    <form className="task-form" data-subject={subject.id} onSubmit={submit}>
      <input
        required
        maxLength={300}
        placeholder="Quelle est la prochaine action ?"
        aria-label={"Nouvelle étape pour " + subject.title}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <select
        aria-label="Priorité de la nouvelle étape"
        value={priority}
        onChange={(event) => setPriority(event.target.value)}
      >
        {PRIORITIES.map((entry) => (
          <option key={entry} value={entry}>{priorityLabels[entry]}</option>
        ))}
      </select>
      <button className="primary" type="submit">+ Étape</button>
    </form>
  );
}

export function ProjectDetail({ snapshot, commands }) {
  const transient = snapshot.transient || {};
  const subject = snapshot.project;
  const hideCompleted = transient.hideCompleted === true;
  const expandedParents = new Set(
    Array.isArray(transient.expandedParents)
      ? transient.expandedParents
      : (transient.expandedParents && typeof transient.expandedParents[Symbol.iterator] === "function"
        ? [...transient.expandedParents]
        : [])
  );
  const trackedItemId = transient.trackedItemId !== undefined
    ? transient.trackedItemId
    : (transient.resumeRef && transient.resumeRef.itemId) || null;

  const pending = subject.pendingCount;
  const topLevel = totalTaskCount(snapshot.items);

  return (
    <section
      className="subject detail"
      data-subject={subject.id}
      data-react-surface="project-detail"
      aria-label={subject.title}
      tabIndex={-1}
    >
      <div className="detail-nav">
        <button
          className="secondary detail-return"
          type="button"
          aria-label={"Retour à la vue d'ensemble depuis " + subject.title}
          onClick={() => commands.returnToOverview(subject.id)}
        >
          Retour à la vue d'ensemble
        </button>
      </div>
      {transient.renamingSubject === true ? (
        <RenameForm subject={subject} commands={commands} />
      ) : (
        <div className="subject-head detail-head">
          <div>
            <h2 className="detail-title" tabIndex={-1}>{subject.title}</h2>
            <p className="small">
              {pending} étape{pending > 1 ? "s" : ""} en attente
            </p>
            <p className="small subject-total">
              {subject.totalTaskCountLabel || totalTaskCountLabel(topLevel)}
            </p>
          </div>
          <div className="subject-controls">
            <button
              className="subtle subject-rename"
              type="button"
              aria-label={"Renommer le projet " + subject.title}
              onClick={() => commands.startRename()}
            >
              Renommer le projet
            </button>
          </div>
        </div>
      )}
      <div className="task-area">
        <CreateTaskForm
          subject={{ ...snapshot.project, items: snapshot.items }}
          commands={commands}
        />
        {snapshot.items.length === 0 ? (
          <p className="empty">Aucune étape. Ajoutez la prochaine action à faire.</p>
        ) : null}
        <TaskList
          subject={{ ...snapshot.project, items: snapshot.items }}
          commands={commands}
          transient={transient}
          hideCompleted={hideCompleted}
          expandedParents={expandedParents}
          editingItemId={transient.editingItemId}
          openMenuId={transient.openMenuId}
          revealItemId={transient.revealItemId}
          trackedItemId={trackedItemId}
        />
      </div>
    </section>
  );
}

export default ProjectDetail;
