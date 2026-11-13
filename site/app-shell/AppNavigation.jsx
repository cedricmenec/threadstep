import { NAV_MENU_ENTRIES, navigationFragmentForRoute } from "../core.js";

export function AppNavigation({ route, onNavigate }) {
  const activeFragment = navigationFragmentForRoute(route);
  return (
    <nav className="nav-menu" aria-label="Navigation principale">
      {NAV_MENU_ENTRIES.map((entry) => (
        <a
          key={entry.fragment}
          href={entry.fragment}
          aria-current={entry.fragment === activeFragment ? "page" : undefined}
          onClick={(event) => {
            event.preventDefault();
            if (typeof onNavigate === "function") onNavigate(entry.fragment);
          }}
        >
          {entry.label}
        </a>
      ))}
    </nav>
  );
}

export default AppNavigation;
