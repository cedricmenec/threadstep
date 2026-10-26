import { Button } from "../ui/Button.jsx";
import { ProjectCard } from "./ProjectCard.jsx";

export function OverviewEmptyState({ empty, commands }) {
  if (empty.kind === "filtered") {
    return (
      <div className="empty filtered-empty">
        <p className="filtered-empty-text">{empty.message}</p>
        <Button
          variant="secondary"
          className="overview-filter-reset"
          type="button"
          onClick={() => commands.resetFilter()}
        >
          {empty.resetLabel || "Tous les projets"}
        </Button>
      </div>
    );
  }
  return <p className="empty">{empty.message}</p>;
}

export function OverviewCards({ snapshot, commands }) {
  if (!snapshot.empty) {
    return snapshot.projects.map((project) => (
      <ProjectCard
        key={project.id}
        project={project}
        commands={commands}
        transient={snapshot.transient}
      />
    ));
  }
  return <OverviewEmptyState empty={snapshot.empty} commands={commands} />;
}

export default OverviewCards;
