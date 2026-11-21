import { Button } from "../ui/Button.jsx";
import { CreateTaskForm } from "../project-detail/CreateTaskForm.jsx";
import { overviewPreview } from "../core.js";
import { OverviewTaskList } from "./OverviewTaskList.jsx";

export function ProjectCard({ project, commands, transient, dragSession }) {
  const pending = project.pendingCount;
  const preview = overviewPreview(project.items, transient.hideCompleted === true);
  const isEmpty = project.items.length === 0;
  const titleId = "overview-project-" + encodeURIComponent(String(project.id));
  return (
    <section
      className="subject overview-project-card"
      data-react-surface="overview-card"
      data-subject={project.id}
      aria-labelledby={titleId}
      tabIndex={-1}
    >
      <div className="subject-head">
        <div className="overview-project-heading">
          <div className="overview-project-title-line">
            <span className="overview-project-marker" aria-hidden="true" />
            <h3 id={titleId}>{project.title}</h3>
          </div>
          <ul className="project-metrics" aria-label={"Résumé de " + project.title}>
            <li>{pending} étape{pending > 1 ? "s" : ""} en attente</li>
            <li>{project.totalTaskCountLabel}</li>
            <li>{project.urgencyLabel}</li>
            <li>{project.progressLabel}</li>
          </ul>
        </div>
        <details className="subject-actions">
          <summary aria-label={"Actions du projet " + project.title}>
            <span aria-hidden="true">⋮</span>
          </summary>
          <div className="subject-actions-panel" aria-label={"Commandes du projet " + project.title}>
            <Button
              variant="subtle"
              className="subject-move"
              type="button"
              data-subject={project.id}
              data-direction="up"
              disabled={!project.canMoveUp}
              aria-label={"Monter le projet " + project.title}
              onClick={() => commands.moveProject(project.id, "up")}
            >
              Monter le projet
            </Button>
            <Button
              variant="subtle"
              className="subject-move"
              type="button"
              data-subject={project.id}
              data-direction="down"
              disabled={!project.canMoveDown}
              aria-label={"Descendre le projet " + project.title}
              onClick={() => commands.moveProject(project.id, "down")}
            >
              Descendre le projet
            </Button>
            <Button
              variant="danger"
              type="button"
              aria-label={"Supprimer le projet " + project.title}
              onClick={() => commands.removeProject(project.id)}
            >
              Supprimer le projet
            </Button>
          </div>
        </details>
      </div>
      <div className="task-area">
        {isEmpty ? (
          <p className="empty overview-project-empty">Aucune tâche dans ce projet.</p>
        ) : null}
        {!isEmpty && preview.shown.length === 0 ? (
          <p className="filtered-empty overview-project-filtered-empty">
            Toutes les tâches de ce projet sont masquées par le filtre actuel.
          </p>
        ) : null}
        <OverviewTaskList
          project={project}
          commands={commands}
          transient={transient}
          editingItemId={transient.editingItemId}
          openMenuId={transient.openMenuId}
          revealItemId={transient.revealItemId}
          trackedItemId={transient.trackedItemId}
          dragSession={dragSession}
        />
      </div>
      <div className="overview-project-footer">
        <CreateTaskForm subject={project} commands={commands} />
        <Button
          variant="primary"
          className="subject-open"
          type="button"
          data-subject={project.id}
          aria-label={"Ouvrir le projet " + project.title}
          onClick={() => commands.openProject(project.id)}
        >
          Ouvrir le projet
        </Button>
      </div>
    </section>
  );
}

export default ProjectCard;
