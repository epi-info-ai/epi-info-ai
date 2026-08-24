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

for (const button of document.querySelectorAll("[data-open-module], [data-module]")) {
  button.addEventListener("click", () => openModule(button.dataset.openModule || button.dataset.module));
}

document.querySelector("#main-menu-button").addEventListener("click", openMainMenu);
for (const button of document.querySelectorAll("[data-menu-message]")) {
  button.addEventListener("click", () => {
    document.querySelector("#main-menu-status").textContent = button.dataset.menuMessage;
  });
}

openMainMenu();

