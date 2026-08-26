function openModule(name) {
  document.querySelector("#main-menu").hidden = true;
  document.querySelector(".app-shell").hidden = false;
  for (const view of document.querySelectorAll("[data-module-view]")) {
    view.hidden = view.dataset.moduleView !== name;
  }
  for (const button of document.querySelectorAll("[data-module]")) {
    const active = button.dataset.module === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  }
}

function openMainMenu() {
  document.querySelector("#main-menu").hidden = false;
  document.querySelector(".app-shell").hidden = true;
}

const legacyMenus = [...document.querySelectorAll("details.legacy-menu")];

function closeLegacyMenus(except = null) {
  for (const menu of legacyMenus) {
    if (menu !== except) menu.open = false;
  }
}

for (const button of document.querySelectorAll("[data-open-module], [data-module]")) {
  button.addEventListener("click", () => {
    closeLegacyMenus();
    openModule(button.dataset.openModule || button.dataset.module);
  });
}

document.querySelector("#main-menu-button").addEventListener("click", openMainMenu);
document.querySelector("#designer-new-project").addEventListener("click", () => {
  closeLegacyMenus();
  document.querySelector("#new-project").click();
});
document.querySelector("#designer-project-storage").addEventListener("click", () => {
  closeLegacyMenus();
  document.querySelector("#project-storage").click();
});
document.querySelector("#file-exit").addEventListener("click", () => {
  closeLegacyMenus();
  openMainMenu();
  document.querySelector("#main-menu-status").textContent = "Browser applications remain open until you close their tab.";
});
document.querySelector("#view-status-bar").addEventListener("click", (event) => {
  const statusBar = document.querySelector("#main-menu-status");
  const visible = statusBar.hidden;
  statusBar.hidden = !visible;
  event.currentTarget.setAttribute("aria-checked", String(visible));
  event.currentTarget.textContent = `${visible ? "\u2713 " : ""}Status Bar`;
  closeLegacyMenus();
});
document.addEventListener("click", (event) => {
  const containingMenu = legacyMenus.find((menu) => menu.contains(event.target));
  closeLegacyMenus(containingMenu);
});
for (const menu of legacyMenus) {
  menu.addEventListener("toggle", () => {
    if (menu.open) closeLegacyMenus(menu);
  });
  menu.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    menu.open = false;
    menu.querySelector("summary").focus();
  });
}
for (const button of document.querySelectorAll("[data-menu-message]")) {
  button.addEventListener("click", () => {
    document.querySelector("#main-menu-status").textContent = button.dataset.menuMessage;
  });
}

openMainMenu();
