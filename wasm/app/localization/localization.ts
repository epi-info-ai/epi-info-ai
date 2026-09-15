export const LANGUAGE_PACK_SCHEMA = "epi-info-ai-language-pack/v0.1" as const;
export const DEFAULT_LOCALE = "en-US";

export interface LanguagePack {
  schema: typeof LANGUAGE_PACK_SCHEMA;
  locale: string;
  englishName: string;
  nativeName: string;
  direction: "ltr" | "rtl";
  version: string;
  messages: Readonly<Record<string, string>>;
}

export interface LocalizationDiagnostic {
  code: "locale-fallback" | "missing-message";
  locale: string;
  messageId?: string;
}

export interface LocalizationOptions {
  initialLocale?: string;
  onDiagnostic?: (diagnostic: LocalizationDiagnostic) => void;
}

const MESSAGE_ID = /^[a-z][A-Za-z0-9]*(?:\.[a-z][A-Za-z0-9-]*)+$/;
const PLACEHOLDER = /\{([A-Za-z][A-Za-z0-9_]*)\}/g;
const MAX_MESSAGES = 10_000;
const MAX_MESSAGE_LENGTH = 8_192;

function canonicalLocale(locale: string): string {
  const normalized = Intl.getCanonicalLocales(locale.trim());
  if (normalized.length !== 1 || normalized[0] === undefined) throw new Error(`Invalid locale: ${locale}`);
  return normalized[0];
}

function placeholders(value: string): Set<string> {
  return new Set([...value.matchAll(PLACEHOLDER)].map((match) => match[1]).filter((name): name is string => name !== undefined));
}

function assertPlainRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`${label} must be a plain object`);
}

export function validateLanguagePack(value: unknown, sourceMessages?: Readonly<Record<string, string>>): LanguagePack {
  assertPlainRecord(value, "Language pack");
  if (value.schema !== LANGUAGE_PACK_SCHEMA) throw new Error(`Unsupported language-pack schema: ${String(value.schema)}`);
  const locale = canonicalLocale(String(value.locale ?? ""));
  const englishName = String(value.englishName ?? "").trim();
  const nativeName = String(value.nativeName ?? "").trim();
  const version = String(value.version ?? "").trim();
  if (!englishName || !nativeName || !version) throw new Error("Language pack names and version are required");
  if (value.direction !== "ltr" && value.direction !== "rtl") throw new Error("Language pack direction must be ltr or rtl");
  assertPlainRecord(value.messages, "Language pack messages");
  const entries = Object.entries(value.messages);
  if (entries.length > MAX_MESSAGES) throw new Error(`Language pack exceeds ${MAX_MESSAGES} messages`);

  const messages: Record<string, string> = Object.create(null) as Record<string, string>;
  for (const [id, candidate] of entries) {
    if (!MESSAGE_ID.test(id)) throw new Error(`Invalid message identifier: ${id}`);
    if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Invalid translation for ${id}`);
    }
    const source = sourceMessages?.[id];
    if (source !== undefined) {
      const expected = [...placeholders(source)].sort();
      const actual = [...placeholders(candidate)].sort();
      if (expected.join("\u0000") !== actual.join("\u0000")) throw new Error(`Placeholder mismatch for ${id}`);
    }
    messages[id] = candidate;
  }

  return Object.freeze({
    schema: LANGUAGE_PACK_SCHEMA,
    locale,
    englishName,
    nativeName,
    direction: value.direction,
    version,
    messages: Object.freeze(messages),
  });
}

const PSEUDO_CHARACTERS: Readonly<Record<string, string>> = Object.freeze({
  A: "Å", B: "Ɓ", C: "Ç", D: "Ð", E: "Ë", F: "Ƒ", G: "Ĝ", H: "Ħ", I: "Ï", J: "Ĵ", K: "Ķ", L: "Ŀ", M: "Ṁ",
  N: "Ñ", O: "Ö", P: "Þ", Q: "Q", R: "Ŕ", S: "Š", T: "Ţ", U: "Ü", V: "Ṽ", W: "Ŵ", X: "Ẍ", Y: "Ÿ", Z: "Ž",
  a: "å", b: "ƀ", c: "ç", d: "ð", e: "ë", f: "ƒ", g: "ĝ", h: "ħ", i: "ï", j: "ĵ", k: "ķ", l: "ŀ", m: "ṁ",
  n: "ñ", o: "ö", p: "þ", q: "q", r: "ŕ", s: "š", t: "ţ", u: "ü", v: "ṽ", w: "ŵ", x: "ẍ", y: "ÿ", z: "ž",
});

export function pseudolocalize(source: string): string {
  const pieces = source.split(/(\{[A-Za-z][A-Za-z0-9_]*\})/g);
  const transformed = pieces.map((piece) => {
    if (/^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(piece)) return piece;
    return [...piece].map((character) => {
      const mapped = PSEUDO_CHARACTERS[character] ?? character;
      return /[AEIOUaeiou]/.test(character) ? `${mapped}${mapped}` : mapped;
    }).join("");
  }).join("");
  return `[!! ${transformed} !!]`;
}

export function createPseudoLanguagePack(sourcePack: LanguagePack): LanguagePack {
  const messages = Object.fromEntries(Object.entries(sourcePack.messages).map(([id, message]) => [id, pseudolocalize(message)]));
  return validateLanguagePack({
    schema: LANGUAGE_PACK_SCHEMA,
    locale: "en-XA",
    englishName: "Pseudo (accented test)",
    nativeName: "[!! Þšëüðö !!]",
    direction: "ltr",
    version: sourcePack.version,
    messages,
  }, sourcePack.messages);
}

export class LocalizationRegistry {
  readonly #packs = new Map<string, LanguagePack>();
  readonly #defaultLocale: string;
  readonly #onDiagnostic: ((diagnostic: LocalizationDiagnostic) => void) | undefined;
  #locale: string;

  constructor(sourcePack: LanguagePack, options: LocalizationOptions = {}) {
    const validated = validateLanguagePack(sourcePack);
    if (validated.locale !== DEFAULT_LOCALE) throw new Error(`Source language pack must use ${DEFAULT_LOCALE}`);
    this.#defaultLocale = validated.locale;
    this.#packs.set(validated.locale, validated);
    this.#onDiagnostic = options.onDiagnostic;
    this.#locale = validated.locale;
    if (options.initialLocale) this.setLocale(options.initialLocale);
  }

  get locale(): string { return this.#locale; }
  get direction(): "ltr" | "rtl" { return this.activePack.direction; }
  get activePack(): LanguagePack { return this.#packs.get(this.resolveLocale(this.#locale)) ?? this.sourcePack; }
  get sourcePack(): LanguagePack { return this.#packs.get(this.#defaultLocale)!; }

  register(value: unknown): LanguagePack {
    const pack = validateLanguagePack(value, this.sourcePack.messages);
    if (pack.locale === this.#defaultLocale) throw new Error("The source language pack cannot be replaced");
    this.#packs.set(pack.locale, pack);
    return pack;
  }

  remove(locale: string): boolean {
    const canonical = canonicalLocale(locale);
    if (canonical === this.#defaultLocale) return false;
    const removed = this.#packs.delete(canonical);
    if (this.resolveLocale(this.#locale) === this.#defaultLocale) this.#locale = this.#defaultLocale;
    return removed;
  }

  list(): readonly LanguagePack[] {
    return [...this.#packs.values()].sort((left, right) => left.englishName.localeCompare(right.englishName, "en-US"));
  }

  setLocale(locale: string): string {
    const requested = canonicalLocale(locale);
    const resolved = this.resolveLocale(requested);
    this.#locale = resolved;
    if (resolved !== requested) this.#onDiagnostic?.({ code: "locale-fallback", locale: requested });
    return resolved;
  }

  translate(messageId: string, variables: Readonly<Record<string, string | number>> = {}): string {
    const active = this.activePack;
    const template = active.messages[messageId] ?? this.sourcePack.messages[messageId];
    if (template === undefined) {
      this.#onDiagnostic?.({ code: "missing-message", locale: active.locale, messageId });
      return messageId;
    }
    return template.replace(PLACEHOLDER, (whole, name: string) => Object.hasOwn(variables, name) ? String(variables[name]) : whole);
  }

  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.activePack.locale, options).format(value);
  }

  formatDate(value: Date | number, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.activePack.locale, options).format(value);
  }

  private resolveLocale(requested: string): string {
    if (this.#packs.has(requested)) return requested;
    const language = requested.split("-")[0];
    const related = [...this.#packs.keys()].find((candidate) => candidate === language || candidate.startsWith(`${language}-`));
    return related ?? this.#defaultLocale;
  }
}
