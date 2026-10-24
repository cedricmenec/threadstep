import { visibleItems } from "../core.js";
import { TaskItem } from "./TaskItem.jsx";

export function TaskList({
  subject,
  commands,
  transient,
  hideCompleted,
  expandedParents,
  editingItemId,
  openMenuId,
  revealItemId,
  trackedItemId
}) {
  const items = visibleItems(subject.items, null, hideCompleted);
  if (!items.length) {
    return <ul className="tasks" />;
  }
  return (
    <ul className="tasks">
      {items.map((item) => (
        <TaskItem
          key={item.id}
          subjectId={subject.id}
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
  );
}

export default TaskList;
