import { createPseudoLanguagePack, LocalizationRegistry } from "./localization.ts";
import { englishLanguagePack } from "./catalogs/en-US.ts";

const PREFERENCE_KEY = "epi-info-ai.localization-preferences.v1";

interface LocalizationPreference {
  schemaVersion: 1;
  locale: string;
}

function readPreference(storage: Storage): string | undefined {
  try {
    const parsed = JSON.parse(storage.getItem(PREFERENCE_KEY) ?? "null") as Partial<LocalizationPreference> | null;
    return parsed?.schemaVersion === 1 && typeof parsed.locale === "string" && parsed.locale.length <= 64
      ? parsed.locale
      : undefined;
  } catch {
    return undefined;
  }
}

function writePreference(storage: Storage, locale: string): void {
  const preference: LocalizationPreference = { schemaVersion: 1, locale };
  storage.setItem(PREFERENCE_KEY, JSON.stringify(preference));
}

export function initializeBrowserLocalization(
  root: Document = document,
  storage: Storage = localStorage,
): LocalizationRegistry {
  const registry = new LocalizationRegistry(englishLanguagePack);
  registry.register(createPseudoLanguagePack(englishLanguagePack));

  const dialog = root.querySelector<HTMLDialogElement>("#application-options-dialog");
  const opener = root.querySelector<HTMLButtonElement>("#tools-options");
  const select = root.querySelector<HTMLSelectElement>("#application-language");
  const applyButton = root.querySelector<HTMLButtonElement>("#application-language-apply");
  const status = root.querySelector<HTMLElement>("#application-language-status");
  if (!dialog || !opener || !select || !applyButton || !status) throw new Error("Localization Options interface is incomplete");

  select.replaceChildren(...registry.list().map((pack) => new Option(`${pack.nativeName} — ${pack.englishName}`, pack.locale)));

  const applyTranslations = (): void => {
    root.documentElement.lang = registry.locale;
    root.documentElement.dir = registry.direction;
    for (const element of root.querySelectorAll<HTMLElement>("[data-i18n]")) {
      const messageId = element.dataset.i18n;
      if (messageId) element.textContent = registry.translate(messageId);
    }
    for (const element of root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]")) {
      const messageId = element.dataset.i18nAriaLabel;
      if (messageId) element.setAttribute("aria-label", registry.translate(messageId));
    }
    select.value = registry.locale;
  };

  const preferredLocale = readPreference(storage);
  if (preferredLocale) registry.setLocale(preferredLocale);
  applyTranslations();

  opener.addEventListener("click", () => {
    opener.closest("details")?.removeAttribute("open");
    select.value = registry.locale;
    status.textContent = "";
    dialog.showModal();
    select.focus();
  });

  applyButton.addEventListener("click", () => {
    const locale = registry.setLocale(select.value);
    writePreference(storage, locale);
    applyTranslations();
    status.textContent = registry.translate("options.language.saved");
    dialog.close("apply");
  });

  return registry;
}
