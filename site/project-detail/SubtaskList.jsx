export function substepListId(itemId) {
  return "substeps-" + encodeURIComponent(String(itemId));
}

export function SubtaskList({ parentId, children, renderItem }) {
  if (!Array.isArray(children) || children.length === 0) return null;
  return (
    <ul className="tasks children" id={substepListId(parentId)}>
      {children.map((child) => renderItem(child))}
    </ul>
  );
}

export default SubtaskList;
