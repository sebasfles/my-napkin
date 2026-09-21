"use client";

import { Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import { LocaleToggle } from "@/components/locale-toggle";
import { LogoutButton } from "@/components/logout-button";
import { ThemeControl } from "@/components/theme-control";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SettingsMenu() {
  const t = useTranslations("sidebar");
  const theme = useTranslations("themeControl");

  return (
    <Popover>
      {/* Anchored to the rail's width, not to the button: the popover has to clear the rail and
          its border, and a button narrower than the rail would open on top of both. */}
      <PopoverAnchor asChild>
        <div className="flex w-full justify-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground"
                  aria-label={t("settings")}
                  data-testid="settings-toggle"
                >
                  <Settings aria-hidden />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right">{t("settings")}</TooltipContent>
          </Tooltip>
        </div>
      </PopoverAnchor>

      <PopoverContent side="right" align="end" data-testid="settings-menu">
        <div className="flex items-center justify-between gap-3">
          <span>{theme("label")}</span>
          <ThemeControl />
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>{t("language")}</span>
          <LocaleToggle />
        </div>
        <div className="border-t border-border pt-2.5">
          <LogoutButton />
        </div>
      </PopoverContent>
    </Popover>
  );
}
