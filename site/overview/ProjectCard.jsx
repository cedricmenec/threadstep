import { Button } from "../ui/Button.jsx";
import { CreateTaskForm } from "../project-detail/CreateTaskForm.jsx";
import { OverviewTaskList } from "./OverviewTaskList.jsx";

export function ProjectCard({ project, commands, transient, dragSession }) {
  const pending = project.pendingCount;
  return (
    <section
      className="subject"
      data-react-surface="overview-card"
      data-subject={project.id}
      aria-label={project.title}
      tabIndex={-1}
    >
      <div className="subject-head">
        <div>
          <h3>{project.title}</h3>
          <p className="small">
            {pending} étape{pending > 1 ? "s" : ""} en attente
          </p>
          <p className="small subject-total">{project.totalTaskCountLabel}</p>
          <p className="small subject-urgency">{project.urgencyLabel}</p>
          <p className="small subject-progress">{project.progressLabel}</p>
        </div>
        <div className="subject-controls">
          <Button
            variant="secondary"
            className="subject-open"
            type="button"
            data-subject={project.id}
            aria-label={"Ouvrir le projet " + project.title}
            onClick={() => commands.openProject(project.id)}
          >
            Ouvrir le projet
          </Button>
          <Button
            variant="subtle"
            className="subject-move"
            type="button"
            data-subject={project.id}
            data-direction="up"
            disabled={!project.canMoveUp}
            aria-label={"Monter le sujet " + project.title}
            onClick={() => commands.moveProject(project.id, "up")}
          >
            ↑
          </Button>
          <Button
            variant="subtle"
            className="subject-move"
            type="button"
            data-subject={project.id}
            data-direction="down"
            disabled={!project.canMoveDown}
            aria-label={"Descendre le sujet " + project.title}
            onClick={() => commands.moveProject(project.id, "down")}
          >
            ↓
          </Button>
          <Button
            variant="danger"
            type="button"
            aria-label={"Supprimer le sujet " + project.title}
            onClick={() => commands.removeProject(project.id)}
          >
            Supprimer
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
      <dl className="project-stitch-metadata" aria-label="Informations du projet">
        <div><dt>Description</dt><dd>Non renseignée</dd></div>
        <div><dt>Catégorie</dt><dd>Non renseignée</dd></div>
        <div><dt>Code</dt><dd>Non renseigné</dd></div>
        <div><dt>Couverture</dt><dd>Non disponible</dd></div>
      </dl>
      <div className="task-area">
        <CreateTaskForm subject={project} commands={commands} />
        {project.items.length === 0 ? (
          <p className="empty">Aucune étape. Ajoutez la prochaine action à faire.</p>
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
    </section>
  );
}

export default ProjectCard;
