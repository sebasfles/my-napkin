"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { resolveTheme } from "@/lib/theme";
import { useHydrated } from "@/lib/use-hydrated";

export function ThemeToggle() {
  const t = useTranslations("themeToggle");
  const { theme, systemTheme, setTheme } = useTheme();
  const hydrated = useHydrated();

  const current = hydrated ? resolveTheme(theme, systemTheme) : "light";
  const next = current === "dark" ? "light" : "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={next === "dark" ? t("toDark") : t("toLight")}
      data-testid="theme-toggle"
      onClick={() => setTheme(next)}
    >
      {current === "dark" ? <Moon aria-hidden /> : <Sun aria-hidden />}
    </Button>
  );
}
