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
let activeLegacyMenu: HTMLDetailsElement | null = null;

function legacyMenuSummary(menu: HTMLDetailsElement): HTMLElement | null {
  return menu.querySelector<HTMLElement>(":scope > summary");
}

function legacyMenuPopup(menu: HTMLDetailsElement): HTMLElement | null {
  return menu.querySelector<HTMLElement>(":scope > .legacy-menu-popup");
}

function legacyMenuItems(menu: HTMLDetailsElement): HTMLElement[] {
  return [...menu.querySelectorAll<HTMLElement>('[role^="menuitem"]')]
    .filter((item) => !(item instanceof HTMLButtonElement && item.disabled) && !item.hidden);
}

function siblingMenuSummaries(menu: HTMLDetailsElement): HTMLElement[] {
  const parent = menu.parentElement;
  if (!parent) return [];
  return [...parent.children]
    .filter((child): child is HTMLDetailsElement => child instanceof HTMLDetailsElement && child.classList.contains("legacy-menu"))
    .map((sibling) => legacyMenuSummary(sibling))
    .filter((summary): summary is HTMLElement => summary !== null);
}

function positionLegacyMenu(menu: HTMLDetailsElement): void {
  if (!menu.open) return;
  const summary = legacyMenuSummary(menu);
  const popup = legacyMenuPopup(menu);
  if (!summary || !popup) return;
  const margin = 8;
  const trigger = summary.getBoundingClientRect();
  const popupBox = popup.getBoundingClientRect();
  const requestedAnchorX = Number(menu.dataset.legacyMenuAnchorX);
  const requestedAnchorY = Number(menu.dataset.legacyMenuAnchorY);
  delete menu.dataset.legacyMenuAnchorX;
  delete menu.dataset.legacyMenuAnchorY;
  const hasPointerAnchor = Number.isFinite(requestedAnchorX) && Number.isFinite(requestedAnchorY);
  const anchorTop = Math.max(margin, Math.min(hasPointerAnchor ? requestedAnchorY : trigger.top, window.innerHeight - margin));
  const anchorBottom = Math.max(margin, Math.min(hasPointerAnchor ? requestedAnchorY : trigger.bottom, window.innerHeight - margin));
  const availableBelow = Math.max(0, window.innerHeight - anchorBottom - margin);
  const availableAbove = Math.max(0, anchorTop - margin);
  const placeAbove = availableBelow < Math.min(240, popup.scrollHeight) && availableAbove > availableBelow;
  const availableHeight = Math.max(96, placeAbove ? availableAbove : availableBelow);
  const renderedHeight = Math.min(popup.scrollHeight, availableHeight);
  const top = placeAbove
    ? Math.max(margin, anchorTop - renderedHeight)
    : Math.max(margin, Math.min(anchorBottom, window.innerHeight - margin - renderedHeight));
  const anchorLeft = hasPointerAnchor ? requestedAnchorX : trigger.left;
  const anchorRight = hasPointerAnchor ? requestedAnchorX : trigger.right;
  const preferredLeft = menu.classList.contains("legacy-menu-right") ? anchorRight - popupBox.width : anchorLeft;
  const left = Math.max(margin, Math.min(preferredLeft, window.innerWidth - popupBox.width - margin));
  popup.style.right = "auto";
  popup.style.top = `${Math.round(top)}px`;
  popup.style.left = `${Math.round(left)}px`;
  popup.style.maxHeight = `${Math.floor(availableHeight)}px`;
}

function closeLegacyMenus(except: HTMLDetailsElement | null = null): void {
  for (const menu of legacyMenus) {
    if (menu !== except) {
      menu.open = false;
      legacyMenuSummary(menu)?.setAttribute("aria-expanded", "false");
    }
  }
  activeLegacyMenu = except?.open ? except : null;
}

function openLegacyMenu(menu: HTMLDetailsElement, focus: "first" | "last" | "none" = "none"): void {
  closeLegacyMenus(menu);
  menu.open = true;
  activeLegacyMenu = menu;
  legacyMenuSummary(menu)?.setAttribute("aria-expanded", "true");
  positionLegacyMenu(menu);
  if (focus !== "none") {
    queueMicrotask(() => {
      const items = legacyMenuItems(menu);
      (focus === "first" ? items[0] : items.at(-1))?.focus();
    });
  }
}

function moveBetweenLegacyMenus(menu: HTMLDetailsElement, offset: number): void {
  const summaries = siblingMenuSummaries(menu);
  const current = legacyMenuSummary(menu);
  const index = current ? summaries.indexOf(current) : -1;
  if (index < 0 || summaries.length === 0) return;
  const target = summaries[(index + offset + summaries.length) % summaries.length];
  if (!target) return;
  const targetMenu = target.closest<HTMLDetailsElement>("details.legacy-menu");
  if (!targetMenu) return;
  openLegacyMenu(targetMenu, "first");
  target.focus();
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
  const target = event.target instanceof Element ? event.target : null;
  const containingMenu = target?.closest<HTMLDetailsElement>("details.legacy-menu") ?? null;
  const selectedItem = target?.closest<HTMLElement>(".legacy-menu-popup [role^='menuitem']") ?? null;
  const opensSubmenu = selectedItem?.getAttribute("aria-haspopup") === "menu";
  const reportsUnavailable = selectedItem?.getAttribute("aria-disabled") === "true";
  if (!containingMenu || (selectedItem && !opensSubmenu && !reportsUnavailable)) closeLegacyMenus();
  else closeLegacyMenus(containingMenu);
});
for (const menu of legacyMenus) {
  const summary = legacyMenuSummary(menu);
  summary?.setAttribute("aria-expanded", String(menu.open));
  menu.addEventListener("toggle", () => {
    summary?.setAttribute("aria-expanded", String(menu.open));
    if (menu.open) {
      closeLegacyMenus(menu);
      activeLegacyMenu = menu;
      positionLegacyMenu(menu);
    } else if (activeLegacyMenu === menu) activeLegacyMenu = null;
  });
  menu.addEventListener("keydown", (event) => {
    const items = legacyMenuItems(menu);
    const itemIndex = event.target instanceof HTMLElement ? items.indexOf(event.target) : -1;
    if (event.target === summary) {
      if (event.key === "Escape") {
        event.preventDefault();
        menu.open = false;
        summary?.focus();
      } else if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openLegacyMenu(menu, event.key === "ArrowUp" ? "last" : "first");
      } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        moveBetweenLegacyMenus(menu, event.key === "ArrowRight" ? 1 : -1);
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        const summaries = siblingMenuSummaries(menu);
        (event.key === "Home" ? summaries[0] : summaries.at(-1))?.focus();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      menu.open = false;
      summary?.focus();
      return;
    }
    if (event.key === "Tab") {
      menu.open = false;
      return;
    }
    if (itemIndex >= 0 && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const nextIndex = event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : (itemIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[nextIndex]?.focus();
    } else if (itemIndex >= 0 && (event.key === "ArrowRight" || event.key === "ArrowLeft")) {
      event.preventDefault();
      moveBetweenLegacyMenus(menu, event.key === "ArrowRight" ? 1 : -1);
    }
  });
}
window.addEventListener("resize", () => { if (activeLegacyMenu) positionLegacyMenu(activeLegacyMenu); });
document.addEventListener("scroll", () => { if (activeLegacyMenu) positionLegacyMenu(activeLegacyMenu); }, true);
for (const button of document.querySelectorAll<HTMLElement>("[data-menu-message]")) {
  button.addEventListener("click", () => {
    requiredElement("#main-menu-status").textContent = button.dataset.menuMessage ?? "";
  });
}

openMainMenu();
