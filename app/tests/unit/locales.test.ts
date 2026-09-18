import { describe, expect, it } from "vitest";
import { localeFromAcceptLanguage, resolveLocale } from "@/i18n/locales";

describe("localeFromAcceptLanguage", () => {
  it("maps a regional Spanish tag to es", () => {
    expect(localeFromAcceptLanguage("es-AR")).toBe("es");
  });

  it("falls back to en for an unsupported language", () => {
    expect(localeFromAcceptLanguage("fr")).toBe("en");
  });

  it("falls back to en when the header is absent", () => {
    expect(localeFromAcceptLanguage(null)).toBe("en");
  });

  it("honours quality order over listing order", () => {
    expect(localeFromAcceptLanguage("fr;q=0.9,es-MX;q=1.0")).toBe("es");
    expect(localeFromAcceptLanguage("es;q=0.2,en;q=0.8")).toBe("en");
  });

  it("skips unsupported languages before an supported one", () => {
    expect(localeFromAcceptLanguage("de-DE,fr-FR,es-ES")).toBe("es");
  });
});

describe("resolveLocale", () => {
  it("prefers a valid cookie over the header", () => {
    expect(resolveLocale("es", "en-US")).toBe("es");
    expect(resolveLocale("en", "es-AR")).toBe("en");
  });

  it("ignores a cookie that is not a supported locale", () => {
    expect(resolveLocale("pt", "es-AR")).toBe("es");
    expect(resolveLocale("", "es-AR")).toBe("es");
  });
});
