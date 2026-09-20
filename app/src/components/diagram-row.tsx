"use client";

import { Info, Lock, LockOpen, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isLocked, type Diagram } from "@/lib/diagrams";
import { saveIndicator, type SaveStatus } from "@/lib/save-state";
import { cn } from "@/lib/utils";

export function DiagramRow({
  diagram,
  active,
  status,
  onRename,
  onToggleLock,
  onInfo,
  onDelete,
}: {
  diagram: Diagram;
  active: boolean;
  status: SaveStatus | null;
  onRename: () => void;
  onToggleLock: () => void;
  onInfo: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("sidebar");
  const locked = isLocked(diagram);

  return (
    <div
      className={cn(
        "group relative flex items-center gap-1 rounded-lg pr-1 pl-2 transition-colors",
        "hover:bg-sidebar-accent",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
      data-testid="diagram-item"
      data-active={active}
      data-locked={locked}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute top-2 bottom-2 -left-1 w-0.5 rounded-full bg-primary"
        />
      ) : null}

      <Link
        href={`/d/${diagram.id}`}
        className="min-w-0 flex-1 rounded-md py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className={cn("block truncate text-sm", active && "font-medium")}>
          {diagram.name}
        </span>
        {status ? (
          <SaveStatusLine status={status} />
        ) : (
          <UpdatedAtLine updatedAt={diagram.updatedAt} />
        )}
      </Link>

      {locked ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="img"
              className="shrink-0 text-muted-foreground"
              data-testid="diagram-locked"
              aria-label={t("lockedGlyph")}
            >
              <Lock aria-hidden className="size-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{t("lockedGlyph")}</TooltipContent>
        </Tooltip>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("menu", { name: diagram.name })}
            data-testid="diagram-menu"
            className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem data-testid="menu-rename" onSelect={onRename}>
            <Pencil aria-hidden />
            {t("rename")}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="menu-lock" onSelect={onToggleLock}>
            {locked ? <LockOpen aria-hidden /> : <Lock aria-hidden />}
            {locked ? t("unlock") : t("lock")}
          </DropdownMenuItem>
          <DropdownMenuItem data-testid="menu-info" onSelect={onInfo}>
            <Info aria-hidden />
            {t("info")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" data-testid="menu-delete" onSelect={onDelete}>
            <Trash2 aria-hidden />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function SaveStatusLine({ status }: { status: SaveStatus }) {
  const t = useTranslations("editor");
  const indicator = saveIndicator(status);
  const message = { saved: t("saved"), saving: t("saving"), failed: t("saveFailed") }[indicator];

  return (
    <span
      className={cn(
        "block truncate font-mono text-xs",
        indicator === "failed" ? "text-destructive" : "text-muted-foreground",
      )}
      data-testid="save-indicator"
      data-status={indicator}
      aria-live="polite"
    >
      {message}
    </span>
  );
}

function UpdatedAtLine({ updatedAt }: { updatedAt: string }) {
  const format = useFormatter();
  const now = useNow();

  return (
    <span className="block truncate font-mono text-xs text-muted-foreground">
      {format.relativeTime(new Date(updatedAt), now)}
    </span>
  );
}
