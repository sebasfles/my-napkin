import type { Locale } from "@/i18n/locales";

const langCodes: Record<Locale, string> = {
  es: "es-ES",
  en: "en",
};

export function editorLangCode(locale: Locale): string {
  return langCodes[locale];
}
