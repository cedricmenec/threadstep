import { useState } from "react";
import { totalTaskCount, totalTaskCountLabel } from "../core.js";
import { Button } from "../ui/Button.jsx";
import { PriorityControl } from "../ui/PriorityControl.jsx";
import { TextField } from "../ui/TextField.jsx";
import { CreateTaskForm } from "./CreateTaskForm.jsx";
import { TaskList } from "./TaskList.jsx";
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
      <TextField
        className="subject-rename-input"
        type="text"
        maxLength={MAX_SUBJECT_TITLE}
        required
        value={title}
        ariaLabel={"Nouveau nom du projet " + subject.title}
        ariaInvalid={error !== ""}
        errorId={error ? "subject-rename-error" : undefined}
        onChange={(event) => setTitle(event.target.value)}
      />
      <Button variant="primary" type="submit">Enregistrer</Button>
      <Button
        variant="subtle"
        className="subject-rename-cancel"
        type="button"
        onClick={() => commands.cancelRename()}
      >
        Annuler
      </Button>
      {error ? <p className="rename-error" id="subject-rename-error" role="alert">{error}</p> : null}
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
        <Button
          variant="secondary"
          className="detail-return"
          type="button"
          aria-label={"Retour à la vue d'ensemble depuis " + subject.title}
          onClick={() => commands.returnToOverview(subject.id)}
        >
          Retour à la vue d'ensemble
        </Button>
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
            <Button
              variant="subtle"
              className="subject-rename"
              type="button"
              aria-label={"Renommer le projet " + subject.title}
              onClick={() => commands.startRename()}
            >
              Renommer le projet
            </Button>
            <Button
              variant="subtle"
              className="project-stitch-disabled"
              type="button"
              aria-label="Partage, indisponible"
              disabled
            >
              Partager
            </Button>
            <Button
              variant="subtle"
              className="project-stitch-disabled"
              type="button"
              aria-label="Archivage, indisponible"
              disabled
            >
              Archiver
            </Button>
          </div>
        </div>
      )}
      <dl className="project-stitch-metadata" aria-label="Informations du projet">
        <div><dt>Description</dt><dd>Non renseignée</dd></div>
        <div><dt>Catégorie</dt><dd>Non renseignée</dd></div>
        <div><dt>Code</dt><dd>Non renseigné</dd></div>
        <div><dt>Couverture</dt><dd>Non disponible</dd></div>
      </dl>
      <fieldset className="detail-search-controls" disabled>
        <legend>Recherche, filtres et tri</legend>
        <label>
          Recherche
          <input type="search" aria-label="Recherche indisponible" />
        </label>
        <label>
          Filtrer par état
          <select aria-label="Filtre par état indisponible" defaultValue="">
            <option value="">Filtre indisponible</option>
          </select>
        </label>
        <label>
          Trier par priorité
          <select aria-label="Tri par priorité indisponible" defaultValue="">
            <option value="">Tri indisponible</option>
          </select>
        </label>
      </fieldset>
      <div className="detail-stitch-layout">
        <div className="task-area detail-main">
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
        <aside className="project-stitch-panel" aria-label="Aperçu statique du projet">
          <h3>Prochaine action</h3>
          <p>Non disponible</p>
          <h3>Progression</h3>
          <p>{subject.progressLabel || "Non disponible"}</p>
          <h3>Activité</h3>
          <p>Non disponible</p>
        </aside>
      </div>
    </section>
  );
}

export default ProjectDetail;
