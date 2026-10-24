import { useEffect, useRef, useState } from "react";

const stats = {
  activeListeners: 0,
  registrations: 0,
  removals: 0
};

export function fixtureListenerStats() {
  return { ...stats };
}

export function resetFixtureListenerStats() {
  stats.activeListeners = 0;
  stats.registrations = 0;
  stats.removals = 0;
}

export function SyntheticProjectDetail({ adapter }) {
  const [snapshot, setSnapshot] = useState(() => adapter.getSnapshot());
  const [visualPreference, setVisualPreference] = useState("comfortable");
  const preferenceButton = useRef(null);

  useEffect(() => adapter.subscribe((next) => {
    setSnapshot(next);
  }), [adapter]);

  useEffect(() => {
    const node = preferenceButton.current;
    if (!node) return undefined;
    const handler = () => {
      setVisualPreference((value) => value === "comfortable" ? "compact" : "comfortable");
    };
    node.addEventListener("click", handler);
    stats.activeListeners += 1;
    stats.registrations += 1;
    return () => {
      node.removeEventListener("click", handler);
      stats.activeListeners -= 1;
      stats.removals += 1;
    };
  }, []);

  if (!snapshot) {
    return <p data-react-surface="unavailable">Projet indisponible</p>;
  }

  return (
    <section data-react-surface="project-detail" data-project={snapshot.project.id}>
      <h2>{snapshot.project.title}</h2>
      <p data-fixture="pending">{snapshot.project.pendingCount} étape(s) en attente</p>
      <ul data-fixture="items">
        {snapshot.items.map((item) => (
          <li key={item.id} data-item={item.id} data-parent={item.parentId || ""}>{item.title}</li>
        ))}
      </ul>
      <button
        ref={preferenceButton}
        type="button"
        data-fixture="preference"
        data-preference={visualPreference}
      >
        Préférence visuelle : {visualPreference}
      </button>
    </section>
  );
}

export default SyntheticProjectDetail;
