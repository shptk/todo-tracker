import { clear, el } from "./dom";
import { authState, isConfigured, signIn, signOut, subscribeAuth, type Profile } from "./auth";
import { subscribeSync, syncStatus, type SyncStatus } from "./sync";

function syncText(s: SyncStatus): string {
  switch (s) {
    case "syncing":
      return "Syncing…";
    case "synced":
      return "Synced to your Drive ✓";
    case "error":
      return "Sync error — will retry on your next change";
    case "paused":
      return "Sign in again to resume sync";
    default:
      return "Connected to your Drive";
  }
}

function avatarEl(profile: Profile, size: number): HTMLElement {
  if (profile.picture) {
    return el("img", {
      class: "avatar",
      src: profile.picture,
      alt: "",
      width: size,
      height: size,
      referrerpolicy: "no-referrer",
    });
  }
  const initial = (profile.name || profile.email || "?").trim()[0]?.toUpperCase() ?? "?";
  const e = el("span", { class: "avatar avatar-initial" }, [initial]);
  e.style.width = `${size}px`;
  e.style.height = `${size}px`;
  return e;
}

/** The login "page" — a modal overlay. */
function openModal(): void {
  const card = el("div", { class: "modal-card" });
  const overlay = el("div", { class: "modal-overlay" }, [card]);

  let unsubAuth = () => {};
  let unsubSync = () => {};
  const close = () => {
    unsubAuth();
    unsubSync();
    overlay.remove();
  };
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  function signInButton(): HTMLElement {
    const err = el("p", { class: "modal-error" });
    const btn = el("button", { class: "btn-google" }, ["Sign in with Google"]) as HTMLButtonElement;
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      err.textContent = "";
      try {
        await signIn();
      } catch (e) {
        err.textContent = (e as Error).message || "Sign-in failed.";
      } finally {
        btn.disabled = false;
      }
    });
    return el("div", { class: "btn-google-wrap" }, [btn, err]);
  }

  function render(): void {
    clear(card);
    const closeBtn = el("button", { class: "modal-close", "aria-label": "Close", onClick: close }, ["×"]);
    const s = authState();

    if (s.status === "signed-in") {
      card.append(
        closeBtn,
        el("div", { class: "acct" }, [
          avatarEl(s.profile, 56),
          el("div", { class: "acct-name" }, [s.profile.name]),
          el("div", { class: "acct-email" }, [s.profile.email]),
        ]),
        el("p", { class: "hint modal-hint" }, [
          "Your planner, moods, and notes sync to your own Google Drive. Your data stays in your Drive — it's never sent to us or stored on any server.",
        ]),
        el("p", { class: "sync-status" }, [syncText(syncStatus())]),
        el("button", { class: "btn-primary", onClick: () => void signOut() }, ["Sign out"]),
      );
      return;
    }

    card.append(
      closeBtn,
      el("h2", { class: "modal-title" }, ["Sign in"]),
      el("p", { class: "hint modal-hint" }, [
        "Sign in with Google to sync your planner, moods, and notes across devices — stored in your own Google Drive. Your data stays in your Drive; it's never sent to us or stored on any server. No account to create.",
      ]),
      isConfigured()
        ? signInButton()
        : el("p", { class: "modal-note" }, [
            "Google sign-in isn't configured yet — add your OAuth Client ID to enable it.",
          ]),
      el("button", { class: "btn-ghost", onClick: close }, ["Maybe later"]),
    );
  }

  unsubAuth = subscribeAuth(render);
  unsubSync = subscribeSync(() => {
    const n = card.querySelector(".sync-status");
    if (n) n.textContent = syncText(syncStatus());
  });
  render();
  document.body.append(overlay);
}

/** Header control: "Sign in" when signed out, avatar when signed in. */
export function createAccountButton(): HTMLElement {
  const btn = el("button", { class: "account-btn", title: "Account", onClick: openModal });
  const paint = () => {
    clear(btn);
    const s = authState();
    if (s.status === "signed-in") {
      btn.classList.add("signed-in");
      btn.append(avatarEl(s.profile, 26));
    } else {
      btn.classList.remove("signed-in");
      btn.append(el("span", { class: "account-label" }, ["Sign in"]));
    }
  };
  subscribeAuth(paint);
  paint();
  return btn;
}
