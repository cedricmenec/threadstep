import { useEffect, useState } from "react";
import { ProjectDetail } from "./ProjectDetail.jsx";

export function ProjectDetailSurface({ adapter }) {
  const [snapshot, setSnapshot] = useState(() => adapter.getSnapshot());

  useEffect(() => adapter.subscribe((next) => setSnapshot(next)), [adapter]);

  if (!snapshot) return null;
  return <ProjectDetail snapshot={snapshot} commands={adapter.commands} />;
}

export function createProjectDetailSurface({
  adapter,
  container,
  createRoot,
  flushSync
}) {
  if (typeof createRoot !== "function") {
    throw new TypeError("project detail surface requires createRoot");
  }
  if (typeof flushSync !== "function") {
    throw new TypeError("project detail surface requires flushSync");
  }
  const root = createRoot(container);
  let mounted = true;

  flushSync(() => {
    root.render(<ProjectDetailSurface adapter={adapter} />);
  });

  return Object.freeze({
    update() {
      if (!mounted) return false;
      flushSync(() => {
        adapter.refresh();
      });
      return true;
    },
    unmount() {
      if (!mounted) return false;
      mounted = false;
      flushSync(() => {
        root.unmount();
      });
      return true;
    }
  });
}

export default ProjectDetailSurface;
