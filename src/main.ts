import "./styles.css";
import { el } from "./dom";
import { createPlanner, type View } from "./planner";
import { createMood } from "./mood";
import { createNotebook } from "./notebook";
import { applySavedTheme, createThemeToggle } from "./theme";
import { createAccountButton } from "./account";

type TabId = "planner" | "mood" | "notes";

const TABS: { id: TabId; label: string; create: () => View }[] = [
  { id: "planner", label: "Planner", create: createPlanner },
  { id: "mood", label: "Mood", create: createMood },
  { id: "notes", label: "Notes", create: createNotebook },
];

function readTab(): TabId {
  const h = location.hash.replace("#", "");
  return (TABS.some((t) => t.id === h) ? h : "planner") as TabId;
}

applySavedTheme();

const app = document.getElementById("app")!;

// The header shows the active feature's name, not the app name.
const title = el("h1", { class: "brand" }, [""]);
const tabbar = el("nav", { class: "tabbar" });
const main = el("main", { class: "content" });
const header = el("header", { class: "appbar" }, [
  title,
  el("div", { class: "appbar-right" }, [tabbar, createAccountButton(), createThemeToggle()]),
]);
app.append(header, main);

let current: View | null = null;

function mount(id: TabId): void {
  current?.destroy();
  main.replaceChildren();
  const tab = TABS.find((t) => t.id === id)!;
  title.textContent = tab.label;
  current = tab.create();
  main.append(current.el);

  for (const btn of tabbar.querySelectorAll("button")) {
    btn.classList.toggle("active", btn.dataset.tab === id);
  }
}

for (const tab of TABS) {
  tabbar.append(
    el("button", {
      class: "tab",
      "data-tab": tab.id,
      onClick: () => {
        location.hash = tab.id;
      },
    }, [tab.label]),
  );
}

window.addEventListener("hashchange", () => mount(readTab()));
mount(readTab());
