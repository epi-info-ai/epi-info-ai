function requiredElement<T extends Element = HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required application shell element is missing: ${selector}`);
  return element;
}

function openModule(name: string): void {
  requiredElement<HTMLElement>("#main-menu").hidden = true;
  requiredElement<HTMLElement>(".app-shell").hidden = false;
  for (const view of document.querySelectorAll<HTMLElement>("[data-module-view]")) {
    view.hidden = view.dataset.moduleView !== name;
  }
  for (const button of document.querySelectorAll<HTMLElement>("[data-module]")) {
    const active = button.dataset.module === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}

function openMainMenu(): void {
  requiredElement<HTMLElement>("#main-menu").hidden = false;
  requiredElement<HTMLElement>(".app-shell").hidden = true;
}

const legacyMenus = [...document.querySelectorAll<HTMLDetailsElement>("details.legacy-menu")];

function closeLegacyMenus(except: HTMLDetailsElement | null = null): void {
  for (const menu of legacyMenus) {
    if (menu !== except) menu.open = false;
  }
}

for (const button of document.querySelectorAll<HTMLElement>("[data-open-module], [data-module]")) {
  button.addEventListener("click", () => {
    closeLegacyMenus();
    openModule(button.dataset.openModule ?? button.dataset.module ?? "");
  });
}

requiredElement("#main-menu-button").addEventListener("click", openMainMenu);
requiredElement("#file-exit").addEventListener("click", () => {
  closeLegacyMenus();
  openMainMenu();
  requiredElement("#main-menu-status").textContent = "Browser applications remain open until you close their tab.";
});

const statusBarButton = requiredElement<HTMLElement>("#view-status-bar");
statusBarButton.addEventListener("click", () => {
  const statusBar = requiredElement<HTMLElement>("#main-menu-status");
  const visible = statusBar.hidden;
  statusBar.hidden = !visible;
  statusBarButton.setAttribute("aria-checked", String(visible));
  statusBarButton.textContent = `${visible ? "\u2713 " : ""}Status Bar`;
  closeLegacyMenus();
});

document.addEventListener("click", (event) => {
  const target = event.target instanceof Node ? event.target : null;
  const containingMenu = legacyMenus.find((menu) => target !== null && menu.contains(target)) ?? null;
  closeLegacyMenus(containingMenu);
});
for (const menu of legacyMenus) {
  menu.addEventListener("toggle", () => {
    if (menu.open) closeLegacyMenus(menu);
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    menu.open = false;
    const summary = menu.querySelector<HTMLElement>("summary");
    summary?.focus();
  });
}
for (const button of document.querySelectorAll<HTMLElement>("[data-menu-message]")) {
  button.addEventListener("click", () => {
    requiredElement("#main-menu-status").textContent = button.dataset.menuMessage ?? "";
  });
}

openMainMenu();
