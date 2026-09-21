import type { Locale } from "@/i18n/locales";

const langCodes: Record<Locale, string> = {
  es: "es-ES",
  en: "en",
};

export function editorLangCode(locale: Locale): string {
  return langCodes[locale];
}

// `painted` is the same reference as `shown` only once the editor has been handed that scene and
// drawn it; until then it holds the previous canvas or the reset's empty one, and a report from
// there would be saved over the scene the canvas was opened on.
export function canSaveCanvas<Canvas>(
  shown: Canvas | null,
  painted: Canvas | null,
  locked: boolean,
): boolean {
  return shown !== null && painted === shown && !locked;
}
