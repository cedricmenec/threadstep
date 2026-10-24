import {
  PRIORITIES,
  substepToggleLabel,
  substepView
} from "../core.js";
import { SubtaskList } from "./SubtaskList.jsx";
import { TaskActionMenu } from "./TaskActionMenu.jsx";
import { TaskEditor } from "./TaskEditor.jsx";

const priorityLabels = { urgent: "Urgent", normal: "Normal", later: "Plus tard" };

export function TaskItem({
  subjectId,
  subject,
  item,
  commands,
  transient,
  hideCompleted,
  expandedParents,
  editingItemId,
  openMenuId,
  revealItemId,
  trackedItemId
}) {
  const level = item.parentId === null || item.parentId === undefined
    ? "task-parent"
    : "task-substep";
  const view = substepView(subject.items, item.id, hideCompleted, expandedParents);
  const classes = [
    "task",
    level,
    item.done ? "done" : "",
    revealItemId === item.id ? "reveal" : ""
  ].filter(Boolean).join(" ");

  const handle = hideCompleted ? null : (
    <button
      className="task-handle"
      type="button"
      aria-label={"Déplacer « " + item.title + " » (" + moveContext(subject, item) + ")"}
      aria-describedby="reorder-note"
      onPointerDown={(event) => commands.startDrag(
        subjectId,
        item.id,
        event.nativeEvent || event,
        event.currentTarget
      )}
    >
      ⠿
    </button>
  );

  const toggle = item.parentId === null || item.parentId === undefined
    ? (view.hasVisibleSubsteps ? (
      <button
        className="subtle task-toggle"
        type="button"
        aria-expanded={view.collapsed ? "false" : "true"}
        aria-label={substepToggleLabel(view.children.length, view.collapsed) + " de « " + item.title + " »"}
        aria-controls={view.renderChildren ? "substeps-" + encodeURIComponent(String(item.id)) : undefined}
        onClick={() => commands.toggleSubsteps(subjectId, item.id)}
      >
        {substepToggleLabel(view.children.length, view.collapsed)}
      </button>
    ) : null)
    : null;

  return (
    <li className={classes} data-item={item.id}>
      {editingItemId === item.id ? (
        <TaskEditor subjectId={subjectId} item={item} commands={commands} />
      ) : (
        <>
          <div className="task-row">
            <input
              className="task-check"
              type="checkbox"
              checked={item.done}
              aria-label={"Terminer " + item.title}
              onChange={(event) => commands.toggleItem(subjectId, item.id, event.target.checked)}
            />
            <span className="task-title">{item.title}</span>
            <select
              className={"priority priority-" + item.priority + " priority-control"}
              aria-label={"Priorité de « " + item.title + " » : " + priorityLabels[item.priority]}
              value={item.priority}
              onChange={(event) => commands.setPriority(subjectId, item.id, event.target.value)}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>{priorityLabels[priority]}</option>
              ))}
            </select>
          </div>
          {typeof item.note === "string" && item.note.trim().length > 0 ? (
            <p className="task-note">{item.note}</p>
          ) : null}
          <div className="task-actions">
            {handle}
            {toggle}
            <TaskActionMenu
              subjectId={subjectId}
              subject={subject}
              item={item}
              commands={commands}
              open={openMenuId === item.id}
              hideCompleted={hideCompleted}
              tracked={trackedItemId === item.id}
            />
          </div>
        </>
      )}
      {view.renderChildren ? (
        <SubtaskList
          parentId={item.id}
          children={view.children}
          renderItem={(child) => (
            <TaskItem
              key={child.id}
              subjectId={subjectId}
              subject={subject}
              item={child}
              commands={commands}
              transient={transient}
              hideCompleted={hideCompleted}
              expandedParents={expandedParents}
              editingItemId={editingItemId}
              openMenuId={openMenuId}
              revealItemId={revealItemId}
              trackedItemId={trackedItemId}
            />
          )}
        />
      ) : null}
    </li>
  );
}

export function moveContext(subject, item) {
  const parent = item.parentId === null || item.parentId === undefined
    ? null
    : subject.items.find((entry) => entry.id === item.parentId);
  return parent
    ? "sous-étape de « " + parent.title + " », priorité " + priorityLabels[item.priority]
    : "priorité " + priorityLabels[item.priority];
}

export default TaskItem;
