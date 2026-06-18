import { clear, el } from "./dom";
import { store } from "./store";
import { moodOf, nextMood } from "./moods";
import { noteEditor } from "./notes";
import { dayKey, dayLabel, isSameDay, monthKey, monthName, today } from "./dates";
import type { View } from "./planner";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function createMood(): View {
  const now = today();
  let year = now.getFullYear();
  let month = now.getMonth();
  let mode: "year" | "month" = "year";
  let selected = dayKey(now); // day whose note shows in month view

  const root = el("section", { class: "mood" });
  const header = el("div", { class: "mood-header" });
  const body = el("div", { class: "mood-body" });
  root.append(header, body);

  /** Default the note's selected day when the displayed month changes. */
  function defaultSelected(): string {
    if (year === now.getFullYear() && month === now.getMonth()) return dayKey(now);
    return dayKey(new Date(year, month, 1));
  }

  function zoomTo(m: number): void {
    mode = "month";
    month = m;
    selected = defaultSelected();
    render();
  }

  // A single day box. `big` = the larger month-view cell; both cycle mood on
  // click and show the date number.
  function dayBox(d: Date, big: boolean): HTMLElement {
    const key = dayKey(d);
    const mood = moodOf(store.mood(key));
    const cls = [
      big ? "mood-cell" : "mood-box",
      mood ? "filled" : "",
      isSameDay(d, now) ? "is-today" : "",
      big && key === selected ? "selected" : "",
    ].filter(Boolean).join(" ");

    const box = el("button", {
      class: cls,
      title: `${key}${mood ? ` · ${mood.label}` : ""} — click to cycle`,
      "aria-label": `${key}${mood ? `, ${mood.label}` : ""}`,
      onClick: () => {
        // Clicking cycles the mood; in month view it also focuses the day's note.
        if (big) selected = key;
        store.setMood(key, nextMood(store.mood(key)));
        if (big) render(); // selection changed — refresh the note panel
      },
    }, [el("span", { class: "mood-num" }, [String(d.getDate())])]);

    if (mood) box.style.backgroundColor = mood.color;
    return box;
  }

  function monthBlock(m: number): HTMLElement {
    const first = new Date(year, m, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, m + 1, 0).getDate();

    const grid = el("div", { class: "mood-days" });
    for (let i = 0; i < lead; i++) grid.append(el("span", { class: "mood-box blank" }));
    for (let day = 1; day <= days; day++) grid.append(dayBox(new Date(year, m, day), false));

    const name = el("button", {
      class: "mood-month-name",
      title: "Zoom into this month",
      onClick: () => zoomTo(m),
    }, [monthName(m)]);

    return el("div", { class: "mood-month" }, [name, grid]);
  }

  function renderYear(): void {
    const grid = el("div", { class: "mood-grid" });
    for (let m = 0; m < 12; m++) grid.append(monthBlock(m));
    body.append(grid);
  }

  function renderMonth(): void {
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(year, month + 1, 0).getDate();

    const dows = el("div", { class: "mood-mz-dows" }, DOW.map((w) => el("span", { class: "mood-mz-dow" }, [w])));
    const grid = el("div", { class: "mood-mz-grid" });
    for (let i = 0; i < lead; i++) grid.append(el("span", { class: "mood-cell blank" }));
    for (let day = 1; day <= days; day++) grid.append(dayBox(new Date(year, month, day), true));

    body.append(
      el("div", { class: "mood-month-zoom" }, [dows, grid]),
      noteEditor("day", selected, dayLabel(new Date(year, month, Number(selected.split("-")[2])))),
      noteEditor("month", monthKey(first), "Month"),
    );
  }

  function render(): void {
    clear(header);
    clear(body);

    const toggle = el("div", { class: "subtabs" }, [
      el("button", {
        class: mode === "year" ? "subtab active" : "subtab",
        onClick: () => { mode = "year"; render(); },
      }, ["Year"]),
      el("button", {
        class: mode === "month" ? "subtab active" : "subtab",
        onClick: () => { mode = "month"; selected = defaultSelected(); render(); },
      }, ["Month"]),
    ]);

    const nav = el("div", { class: "nav" });
    if (mode === "year") {
      nav.append(
        el("button", { class: "nav-btn", title: "Previous year", onClick: () => { year--; render(); } }, ["‹"]),
        el("button", { class: "nav-btn today", onClick: () => { year = now.getFullYear(); render(); } }, ["This year"]),
        el("button", { class: "nav-btn", title: "Next year", onClick: () => { year++; render(); } }, ["›"]),
        el("span", { class: "nav-label" }, [String(year)]),
      );
    } else {
      const stepMonth = (dir: number) => {
        const d = new Date(year, month + dir, 1);
        year = d.getFullYear();
        month = d.getMonth();
        selected = defaultSelected();
        render();
      };
      nav.append(
        el("button", { class: "nav-btn", title: "Previous month", onClick: () => stepMonth(-1) }, ["‹"]),
        el("button", { class: "nav-btn today", onClick: () => { year = now.getFullYear(); month = now.getMonth(); selected = defaultSelected(); render(); } }, ["This month"]),
        el("button", { class: "nav-btn", title: "Next month", onClick: () => stepMonth(1) }, ["›"]),
        el("span", { class: "nav-label" }, [`${monthName(month)} ${year}`]),
      );
    }

    const hint = el("p", { class: "hint" }, [
      mode === "year"
        ? "Click a day to cycle its mood; click a month name to zoom in."
        : "Click a day to cycle its mood and open its note below.",
    ]);

    header.append(toggle, nav, hint);
    if (mode === "year") renderYear();
    else renderMonth();
  }

  const unsubscribe = store.subscribe(render);
  render();

  return { el: root, destroy: unsubscribe };
}
