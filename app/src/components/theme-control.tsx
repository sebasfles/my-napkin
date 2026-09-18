"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { themeChoice, themeChoices, type ThemeChoice } from "@/lib/theme";
import { useHydrated } from "@/lib/use-hydrated";

const icons: Record<ThemeChoice, typeof Monitor> = { system: Monitor, light: Sun, dark: Moon };

const optionClassName =
  "text-muted-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary data-[state=on]:hover:text-primary-foreground";

export function ThemeControl() {
  const t = useTranslations("themeControl");
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <ToggleGroup
      type="single"
      variant="outline"
      spacing={0}
      value={hydrated ? themeChoice(theme) : ""}
      onValueChange={(choice) => {
        if (choice) setTheme(choice);
      }}
      aria-label={t("label")}
      data-testid="theme-control"
    >
      {themeChoices.map((choice) => {
        const Icon = icons[choice];
        return (
          <ToggleGroupItem
            key={choice}
            value={choice}
            aria-label={t(choice)}
            className={optionClassName}
          >
            <Icon aria-hidden />
          </ToggleGroupItem>
        );
      })}
    </ToggleGroup>
  );
}
