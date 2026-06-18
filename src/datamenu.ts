import { el } from "./dom";
import { store } from "./store";

/**
 * Footer with Export / Import controls. Lets the user move their data between
 * devices (e.g. PC → phone) as a JSON file — the app has no backend or sync.
 */
export function createDataMenu(): HTMLElement {
  const fileInput = el("input", {
    type: "file",
    accept: "application/json,.json",
    class: "hidden-file",
  }) as HTMLInputElement;

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ""; // allow re-importing the same filename later
    if (!file) return;
    const ok = window.confirm(
      "Replace ALL current data on this device with the imported file? This can't be undone.",
    );
    if (!ok) return;
    try {
      store.importJSON(await file.text());
    } catch {
      window.alert("Import failed — that doesn't look like a valid backup file.");
    }
  });

  const exportBtn = el("button", {
    class: "data-btn",
    onClick: () => {
      const blob = new Blob([store.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const stamp = new Date().toISOString().slice(0, 10);
      const a = el("a", { href: url, download: `todo-tracker-backup-${stamp}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    },
  }, ["Export data"]);

  const importBtn = el("button", {
    class: "data-btn",
    onClick: () => fileInput.click(),
  }, ["Import data"]);

  return el("footer", { class: "footer" }, [exportBtn, importBtn, fileInput]);
}
