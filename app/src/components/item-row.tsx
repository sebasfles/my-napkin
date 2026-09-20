"use client";

import {
  ChevronRight,
  Folder as FolderIcon,
  FolderInput,
  Info,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useNow, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isLocked, isPinned, type Diagram, type Folder } from "@/lib/diagrams";
import { saveIndicator, type SaveStatus } from "@/lib/save-state";
import { cn } from "@/lib/utils";

const rowClass =
  "group relative flex items-center gap-1 rounded-lg pr-1 pl-2 transition-colors hover:bg-sidebar-accent";

export function DiagramRow({
  diagram,
  active,
  status,
  onFix,
  onRename,
  onTogglePin,
  onToggleLock,
  onMove,
  onInfo,
  onDelete,
}: {
  diagram: Diagram;
  active: boolean;
  status: SaveStatus | null;
  onFix: () => void;
  onRename: () => void;
  onTogglePin: () => void;
  onToggleLock: () => void;
  onMove: () => void;
  onInfo: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("sidebar");
  const locked = isLocked(diagram);
  const pinned = isPinned(diagram);

  return (
    <div
      className={cn(rowClass, active && "bg-sidebar-accent text-sidebar-accent-foreground")}
      data-testid="diagram-item"
      data-active={active}
      data-locked={locked}
      data-pinned={pinned}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute top-2 bottom-2 -left-1 w-0.5 rounded-full bg-primary"
        />
      ) : null}

      <Link
        href={`/d/${diagram.id}`}
        onDoubleClick={onFix}
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

      {pinned ? <Glyph label={t("pinnedGlyph")} testId="diagram-pinned" icon={<Pin />} /> : null}
      {locked ? <Glyph label={t("lockedGlyph")} testId="diagram-locked" icon={<Lock />} /> : null}

      <RowMenu label={t("menu", { name: diagram.name })}>
        <DropdownMenuItem data-testid="menu-rename" onSelect={onRename}>
          <Pencil aria-hidden />
          {t("rename")}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="menu-pin" onSelect={onTogglePin}>
          {pinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
          {pinned ? t("unpin") : t("pin")}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="menu-move" onSelect={onMove}>
          <FolderInput aria-hidden />
          {t("move")}
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
      </RowMenu>
    </div>
  );
}

export function FolderRow({
  folder,
  onOpen,
  onRename,
  onMove,
  onDelete,
}: {
  folder: Folder;
  onOpen: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("sidebar");

  return (
    <div className={rowClass} data-testid="folder-item">
      <button
        type="button"
        data-testid="folder-open"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <FolderIcon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-sm">{folder.name}</span>
        <ChevronRight
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </button>

      <RowMenu label={t("menu", { name: folder.name })}>
        <DropdownMenuItem data-testid="menu-rename" onSelect={onRename}>
          <Pencil aria-hidden />
          {t("rename")}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid="menu-move" onSelect={onMove}>
          <FolderInput aria-hidden />
          {t("move")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" data-testid="menu-delete" onSelect={onDelete}>
          <Trash2 aria-hidden />
          {t("delete")}
        </DropdownMenuItem>
      </RowMenu>
    </div>
  );
}

function RowMenu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          data-testid="item-menu"
          className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Glyph({ label, testId, icon }: { label: string; testId: string; icon: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="img"
          className="shrink-0 text-muted-foreground [&>svg]:size-3.5"
          data-testid={testId}
          aria-label={label}
        >
          {icon}
        </span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
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
