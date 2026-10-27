import { useEffect, useState } from "react";
import { OverviewCards } from "./OverviewCards.jsx";
import { useOverviewDrag } from "./use-overview-drag.js";

export function OverviewSurface({ adapter }) {
  const [snapshot, setSnapshot] = useState(() => adapter.getSnapshot());
  const dragSession = useOverviewDrag({
    commands: adapter.commands,
    projects: snapshot ? snapshot.projects : [],
    hideCompleted: snapshot ? snapshot.transient.hideCompleted === true : false
  });
  const { cancel: cancelDragSession } = dragSession;

  useEffect(() => adapter.subscribe((next) => setSnapshot(next)), [adapter]);
  useEffect(() => {
    if (!snapshot) cancelDragSession();
  }, [snapshot, cancelDragSession]);

  if (!snapshot) return null;
  return (
    <OverviewCards
      snapshot={snapshot}
      commands={adapter.commands}
      dragSession={dragSession}
    />
  );
}

export function createOverviewSurface({
  adapter,
  container,
  createRoot,
  flushSync
}) {
  if (typeof createRoot !== "function") {
    throw new TypeError("overview surface requires createRoot");
  }
  if (typeof flushSync !== "function") {
    throw new TypeError("overview surface requires flushSync");
  }
  const root = createRoot(container);
  let mounted = true;

  flushSync(() => {
    root.render(<OverviewSurface adapter={adapter} />);
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

export default OverviewSurface;
