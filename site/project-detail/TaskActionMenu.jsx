import { canMoveWithinPriority, itemMenuCommands } from "../core.js";

const priorityLabels = { urgent: "Urgent", normal: "Normal", later: "Plus tard" };

function moveContext(subject, item) {
  const parent = item.parentId === null || item.parentId === undefined
    ? null
    : subject.items.find((entry) => entry.id === item.parentId);
  return parent
    ? "sous-étape de « " + parent.title + " », priorité " + priorityLabels[item.priority]
    : "priorité " + priorityLabels[item.priority];
}

export function menuAccessibleName(subject, item, command) {
  switch (command.id) {
    case "edit": return "Modifier " + item.title;
    case "remove": return "Retirer " + item.title;
    case "add-substep": return "Ajouter une sous-tâche à " + item.title;
    case "promote": return "Promouvoir en tâche principale : " + item.title;
    case "keep-track": return command.label + " : " + item.title;
    case "move-up":
    case "move-down": return command.label + " « " + item.title + " » (" + moveContext(subject, item) + ")";
    default: return command.label;
  }
}

export function menuPanelId(itemId) {
  return "task-menu-" + encodeURIComponent(String(itemId));
}

export function TaskActionMenu({
  subjectId,
  subject,
  item,
  commands,
  open,
  hideCompleted,
  tracked
}) {
  const panelId = menuPanelId(item.id);
  const menuCommands = itemMenuCommands(item, {
    tracked,
    canMoveUp: !hideCompleted && canMoveWithinPriority(subject.items, item.id, "up"),
    canMoveDown: !hideCompleted && canMoveWithinPriority(subject.items, item.id, "down")
  });
  return (
    <div className="task-menu-wrap">
      <button
        className="subtle task-menu-button"
        type="button"
        aria-label={"Actions pour " + item.title}
        aria-expanded={open ? "true" : "false"}
        aria-controls={panelId}
        onClick={() => (open ? commands.closeItemMenu(true) : commands.openItemMenu(item.id))}
      >
        ⋮
      </button>
      {open ? (
        <div
          className="task-menu"
          id={panelId}
          role="group"
          aria-label={"Actions pour " + item.title}
        >
          {menuCommands.map((command) => (
            <button
              key={command.id}
              className={"subtle task-menu-command task-menu-" + command.id}
              type="button"
              disabled={command.disabled === true}
              data-command={command.id}
              aria-label={menuAccessibleName(subject, item, command)}
              onClick={() => commands.runMenuCommand(subjectId, item.id, command.id)}
            >
              {command.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default TaskActionMenu;
