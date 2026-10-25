import { AppShell } from "./AppShell.jsx";

function initialState(overrides) {
  return {
    open: false,
    route: null,
    onToggle: null,
    onNavigate: null,
    ...(overrides || {})
  };
}

export function createAppShellSurface({
  container,
  createRoot,
  flushSync,
  initialState: overrides = {}
}) {
  if (!container) {
    throw new TypeError("app shell surface requires a container");
  }
  if (typeof createRoot !== "function") {
    throw new TypeError("app shell surface requires createRoot");
  }
  if (typeof flushSync !== "function") {
    throw new TypeError("app shell surface requires flushSync");
  }
  const root = createRoot(container);
  let state = initialState(overrides);
  let mounted = true;

  function render() {
    flushSync(() => {
      root.render(<AppShell
        open={state.open}
        route={state.route}
        onToggle={state.onToggle}
        onNavigate={state.onNavigate}
      />);
    });
  }

  render();

  return Object.freeze({
    update(next) {
      if (!mounted) return false;
      state = { ...state, ...(next || {}) };
      render();
      return true;
    },
    unmount() {
      if (!mounted) return false;
      mounted = false;
      flushSync(() => {
        root.unmount();
      });
      return true;
    },
    focusMenuButton() {
      if (!mounted) return false;
      const button = container.querySelector("#nav-menu-button");
      if (!button || typeof button.focus !== "function") return false;
      button.focus();
      return true;
    }
  });
}

export default createAppShellSurface;
