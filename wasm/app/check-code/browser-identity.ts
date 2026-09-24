import { CHECK_CODE_IDENTITY_CHANGED_EVENT, readLocalOperatorIdentity, writeLocalOperatorIdentity } from "./check-code-identity.ts";

export function initializeBrowserIdentity(root: Document = document, storage: Storage = localStorage): void {
  const opener = root.querySelector<HTMLButtonElement>("#local-demo-sign-in");
  const dialog = root.querySelector<HTMLDialogElement>("#local-demo-sign-in-dialog");
  const form = root.querySelector<HTMLFormElement>("#local-demo-sign-in-form");
  const input = root.querySelector<HTMLInputElement>("#local-demo-display-name");
  const signOut = root.querySelector<HTMLButtonElement>("#local-demo-sign-out");
  const status = root.querySelector<HTMLElement>("#local-demo-sign-in-status");
  if (!opener || !dialog || !form || !input || !signOut || !status) throw new Error("Local demo identity interface is incomplete");

  const render = (): void => {
    const reading = readLocalOperatorIdentity(storage);
    const dot = root.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    opener.replaceChildren(dot, root.createTextNode(reading.identity ? ` ${reading.identity}` : " Log in"));
    opener.title = reading.identity ? "Change the local demo identity" : "Set the local demo identity";
    input.value = reading.identity ?? "";
    signOut.hidden = !reading.identity;
  };

  opener.addEventListener("click", () => {
    render();
    status.textContent = "";
    dialog.showModal();
    input.focus();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const reading = writeLocalOperatorIdentity(input.value, storage);
    render();
    status.textContent = reading.identity ? `Signed in locally as ${reading.identity}.` : "Enter a display name to use local demo sign-in.";
    if (reading.identity) dialog.close("signed-in");
  });
  signOut.addEventListener("click", () => {
    writeLocalOperatorIdentity("", storage);
    render();
    status.textContent = "Local demo identity cleared.";
  });
  root.addEventListener(CHECK_CODE_IDENTITY_CHANGED_EVENT, render);
  render();
}
