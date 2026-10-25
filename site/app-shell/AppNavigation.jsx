import { NAV_MENU_ENTRIES } from "../core.js";

export function AppNavigation({ onNavigate }) {
  return (
    <nav className="nav-menu" aria-label="Navigation principale">
      {NAV_MENU_ENTRIES.map((entry) => (
        <a
          key={entry.fragment}
          href={entry.fragment}
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
