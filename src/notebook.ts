import { clear, el } from "./dom";
import { store } from "./store";
import { renderMarkdown, toggleTaskCheckbox } from "./markdown";
import { createDataMenu } from "./datamenu";
import type { View } from "./planner";
import type { Note } from "./types";

/**
 * Notetaker: a flat list of standalone titled notes whose body is Markdown.
 * Three internal modes — the list, a rendered read view (with clickable task
 * checkboxes), and a raw-Markdown editor. Distinct from the date-scoped
 * day/week/month notes in the planner/mood views.
 */
export function createNotebook(): View {
  let mode: "list" | "read" | "edit" = "list";
  let currentId: string | null = null;

  const root = el("section", { class: "notebook" });

  function go(next: "list" | "read" | "edit", id: string | null = currentId): void {
    mode = next;
    currentId = id;
    render();
  }

  function dateLabel(ms: number): string {
    const d = new Date(ms);
    return `${d.getDate()} ${d.toLocaleString("en", { month: "short" })} ${d.getFullYear()}`;
  }

  // First non-empty line, with the common Markdown markers stripped, for the
  // list snippet.
  function snippet(body: string): string {
    const line = body.split("\n").find((l) => l.trim() !== "") ?? "";
    return line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^\s*[-*]\s+\[[ xX]\]\s+/, "")
      .replace(/^\s*[-*]\s+/, "")
      .replace(/^>\s?/, "")
      .replace(/[*`]/g, "")
      .slice(0, 90);
  }

  function noteRow(n: Note): HTMLElement {
    const title = n.title.trim() || "Untitled";
    const snip = snippet(n.body);
    return el("li", { class: "nb-item", onClick: () => go("read", n.id) }, [
      el("span", { class: "nb-item-title" }, [title]),
      el("span", { class: snip ? "nb-item-snippet" : "nb-item-snippet empty" }, [
        snip || "No additional text",
      ]),
      el("span", { class: "nb-item-date" }, [dateLabel(n.updatedAt)]),
    ]);
  }

  function renderList(): void {
    const notes = store.allNotes();
    root.append(
      el("div", { class: "nb-head" }, [
        el("span", { class: "nb-count" }, [
          notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"}` : "",
        ]),
        el("button", { class: "nb-new", onClick: () => go("edit", store.addNote().id) }, [
          "+ New note",
        ]),
      ]),
    );
    if (notes.length === 0) {
      root.append(el("p", { class: "hint" }, ["No notes yet — create one to get started."]));
    } else {
      root.append(el("ul", { class: "nb-list" }, notes.map(noteRow)));
    }
    // Export/Import lives only on the notetaker's main (list) page.
    root.append(createDataMenu());
  }

  function renderRead(n: Note): void {
    const body = el("div", { class: "md" });
    body.innerHTML = n.body.trim()
      ? renderMarkdown(n.body)
      : `<p class="hint">This note is empty. Tap Edit to add content.</p>`;
    // Clicking a task checkbox flips the underlying Markdown and re-renders.
    body.addEventListener("click", (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement && t.classList.contains("md-check")) {
        store.updateNote(n.id, { body: toggleTaskCheckbox(n.body, Number(t.dataset.check)) });
        render();
      }
    });

    root.append(
      el("div", { class: "nb-edit-head" }, [
        el("button", { class: "nb-back", onClick: () => go("list", null) }, ["‹ All notes"]),
        el("button", { class: "nb-edit-btn", onClick: () => go("edit", n.id) }, ["Edit"]),
      ]),
      el("h2", { class: "nb-read-title" }, [n.title.trim() || "Untitled"]),
      body,
    );
  }

  function renderEdit(n: Note): void {
    const titleInput = el("input", {
      type: "text",
      class: "nb-title",
      placeholder: "Title",
      value: n.title,
    }) as HTMLInputElement;
    titleInput.addEventListener("input", () => store.updateNote(n.id, { title: titleInput.value }));

    const bodyArea = el("textarea", {
      class: "nb-body",
      placeholder: "Write in Markdown…  **bold**  *italic*  - bullet  - [ ] task  # heading",
    }) as HTMLTextAreaElement;
    bodyArea.value = n.body;
    bodyArea.addEventListener("input", () => store.updateNote(n.id, { body: bodyArea.value }));

    // Leaving the editor: discard a note that's still completely empty so the
    // list doesn't fill with blanks; otherwise show the rendered read view.
    const done = () => {
      const fresh = store.getNote(n.id);
      if (fresh && !fresh.title.trim() && !fresh.body.trim()) {
        store.deleteNote(n.id);
        go("list", null);
      } else {
        go("read", n.id);
      }
    };

    root.append(
      el("div", { class: "nb-edit-head" }, [
        el("button", {
          class: "nb-del",
          title: "Delete note",
          onClick: () => {
            if (window.confirm("Delete this note? This can't be undone.")) {
              store.deleteNote(n.id);
              go("list", null);
            }
          },
        }, ["Delete"]),
        el("button", { class: "nb-edit-btn", onClick: done }, ["Save"]),
      ]),
      titleInput,
      bodyArea,
    );
  }

  function render(): void {
    clear(root);
    if (mode === "list") {
      renderList();
      return;
    }
    const n = currentId ? store.getNote(currentId) : undefined;
    if (!n) {
      go("list", null);
      return;
    }
    if (mode === "read") renderRead(n);
    else renderEdit(n);
  }

  // Re-render on external store changes (e.g. a data import replacing notes).
  const unsubscribe = store.subscribe(render);
  render();

  return { el: root, destroy: unsubscribe };
}
