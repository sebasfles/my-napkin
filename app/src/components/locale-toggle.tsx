"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { localeCookie, type Locale } from "@/i18n/locales";

const oneYearInSeconds = 60 * 60 * 24 * 365;

export function LocaleToggle() {
  const t = useTranslations("localeToggle");
  const locale = useLocale() as Locale;
  const router = useRouter();

  const next: Locale = locale === "es" ? "en" : "es";

  function switchLocale() {
    document.cookie = `${localeCookie}=${next}; path=/; max-age=${oneYearInSeconds}; samesite=lax`;
    router.refresh();
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="font-mono text-xs"
          aria-label={t("label")}
          data-testid="locale-toggle"
          onClick={switchLocale}
        >
          {t("short")}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("label")}</TooltipContent>
    </Tooltip>
  );
}
