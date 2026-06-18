import "./styles.css";
import { el } from "./dom";
import { createPlanner, type View } from "./planner";
import { createMood } from "./mood";
import { createDataMenu } from "./datamenu";

type TabId = "planner" | "mood";

const TABS: { id: TabId; label: string; create: () => View }[] = [
  { id: "planner", label: "Planner", create: createPlanner },
  { id: "mood", label: "Mood", create: createMood },
];

function readTab(): TabId {
  const h = location.hash.replace("#", "");
  return h === "mood" ? "mood" : "planner";
}

const app = document.getElementById("app")!;

const tabbar = el("nav", { class: "tabbar" });
const main = el("main", { class: "content" });
const header = el("header", { class: "appbar" }, [
  el("h1", { class: "brand" }, ["todo · tracker"]),
  tabbar,
]);
app.append(header, main, createDataMenu());

let current: View | null = null;

function mount(id: TabId): void {
  current?.destroy();
  main.replaceChildren();
  const tab = TABS.find((t) => t.id === id)!;
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
