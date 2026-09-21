"use client";

import { LibraryBig, Workflow } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { NapkinMark } from "@/components/napkin-mark";
import { SettingsMenu } from "@/components/settings-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SidebarSection } from "@/lib/shell-layout";
import { cn } from "@/lib/utils";

// Nothing here takes the panel as an argument: the rail is the same rail whether the panel is
// beside it or not, which is the whole of Acceptance 1.
export function SidebarRail({
  section,
  onSelect,
}: {
  section: SidebarSection;
  onSelect: (section: SidebarSection) => void;
}) {
  const t = useTranslations("sidebar");

  return (
    <div
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-sidebar-border py-3"
      data-testid="sidebar-rail"
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
      >
        <NapkinMark className="size-4" />
      </span>

      <div
        className="flex flex-col items-center gap-1"
        role="group"
        aria-label={t("sections")}
        data-testid="rail-sections"
      >
        <RailSection
          label={t("diagrams")}
          testId="rail-diagrams"
          icon={<Workflow aria-hidden />}
          current={section === "diagrams"}
          onClick={() => onSelect("diagrams")}
        />
        <RailSection
          label={t("libraries")}
          testId="rail-libraries"
          icon={<LibraryBig aria-hidden />}
          current={section === "libraries"}
          onClick={() => onSelect("libraries")}
        />
      </div>

      <div className="flex-1" />

      <SettingsMenu />
    </div>
  );
}

function RailSection({
  label,
  testId,
  icon,
  current,
  onClick,
}: {
  label: string;
  testId: string;
  icon: ReactNode;
  current: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("sidebar");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-current={current ? "page" : undefined}
          data-testid={testId}
          className={cn(
            "mt-1 text-muted-foreground",
            current && "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <span>{label}</span>
        <span className="text-background/70">{t("shortcut")}</span>
      </TooltipContent>
    </Tooltip>
  );
}
