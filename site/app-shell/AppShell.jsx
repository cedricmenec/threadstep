import { AppHeader } from "./AppHeader.jsx";

export function AppShell({ open, route, onToggle, onNavigate }) {
  return (
    <div className="header-nav">
      <AppHeader open={open} onToggle={onToggle} onNavigate={onNavigate} />
    </div>
  );
}

export default AppShell;
