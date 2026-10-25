import { AppNavigation } from "./AppNavigation.jsx";

export function AppHeader({ open, onToggle, onNavigate }) {
  const expanded = open === true;
  return (
    <>
      <button
        type="button"
        id="nav-menu-button"
        className="nav-menu-button"
        aria-expanded={expanded ? "true" : "false"}
        aria-controls="nav-menu-panel"
        onClick={() => {
          if (typeof onToggle === "function") onToggle();
        }}
      >
        <span className="nav-menu-icon" aria-hidden="true">☰</span>
        <span className="nav-menu-label">Menu</span>
      </button>
      <div id="nav-menu-panel" className="nav-menu-panel" hidden={!expanded}>
        <AppNavigation onNavigate={onNavigate} />
      </div>
    </>
  );
}

export default AppHeader;
