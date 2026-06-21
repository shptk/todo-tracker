import { el } from "./dom";

// Light/dark theme. Default (no stored choice) follows the OS via the
// prefers-color-scheme media query; once the user toggles, an explicit
// data-theme on <html> overrides it. Persisted in localStorage.
const KEY = "todo-tracker:theme";

function stored(): "light" | "dark" | null {
  const t = localStorage.getItem(KEY);
  return t === "light" || t === "dark" ? t : null;
}

function resolved(): "light" | "dark" {
  return stored() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

/** Apply any saved theme to <html> — call once at startup before first paint. */
export function applySavedTheme(): void {
  const t = stored();
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}

export function createThemeToggle(): HTMLButtonElement {
  const btn = el("button", {
    class: "theme-toggle",
    title: "Toggle light / dark",
    "aria-label": "Toggle light or dark theme",
  }) as HTMLButtonElement;

  const paint = () => {
    btn.textContent = resolved() === "dark" ? "☀" : "☾";
  };

  btn.addEventListener("click", () => {
    const next = resolved() === "dark" ? "light" : "dark";
    localStorage.setItem(KEY, next);
    document.documentElement.dataset.theme = next;
    paint();
  });

  paint();
  return btn;
}
