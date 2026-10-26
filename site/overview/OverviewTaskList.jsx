import { overviewPreview } from "../core.js";
import { Button } from "../ui/Button.jsx";
import { TaskItem } from "../project-detail/TaskItem.jsx";

function SeeMore({ project, commands }) {
  return (
    <Button
      variant="secondary"
      className="overview-see-more"
      type="button"
      aria-label={"Voir plus de tâches pour le projet " + project.title}
      onClick={() => commands.seeMore(project.id)}
    >
      Voir plus
    </Button>
  );
}

export function OverviewTaskList({
  project,
  commands,
  transient,
  editingItemId,
  openMenuId,
  revealItemId,
  trackedItemId
}) {
  const hideCompleted = transient.hideCompleted === true;
  const expandedParents = new Set(
    Array.isArray(transient.expandedParents) ? transient.expandedParents : []
  );
  const preview = overviewPreview(project.items, hideCompleted);
  const subject = project;
  return (
    <>
      <ul className="tasks">
        {preview.shown.map((item) => (
          <TaskItem
            key={item.id}
            subjectId={project.id}
            subject={subject}
            item={item}
            commands={commands}
            transient={transient}
            hideCompleted={hideCompleted}
            expandedParents={expandedParents}
            editingItemId={editingItemId}
            openMenuId={openMenuId}
            revealItemId={revealItemId}
            trackedItemId={trackedItemId}
          />
        ))}
      </ul>
      {preview.hasMore ? <SeeMore project={project} commands={commands} /> : null}
    </>
  );
}

export default OverviewTaskList;
