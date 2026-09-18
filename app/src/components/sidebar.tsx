"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { useDiagrams } from "@/components/diagrams-provider";
import { LocaleToggle } from "@/components/locale-toggle";
import { LogoutButton } from "@/components/logout-button";
import { ThemeControl } from "@/components/theme-control";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Diagram } from "@/lib/diagrams";
import { saveIndicator } from "@/lib/save-state";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const t = useTranslations("sidebar");
  const { diagrams, loading, failed, reload, create, rename, remove, saveStatus } = useDiagrams();
  const router = useRouter();
  const pathname = usePathname();

  const [renaming, setRenaming] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Diagram | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  const activeId = pathname.startsWith("/d/") ? pathname.slice("/d/".length) : null;

  async function onCreate() {
    setActionFailed(false);
    setCreating(true);
    try {
      const created = await create();
      router.push(`/d/${created.id}`);
    } catch {
      setActionFailed(true);
    } finally {
      setCreating(false);
    }
  }

  async function onRename(diagram: Diagram, name: string) {
    setRenaming(null);
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed === diagram.name) return;

    setActionFailed(false);
    try {
      await rename(diagram.id, trimmed);
    } catch {
      setActionFailed(true);
    }
  }

  async function onDelete(diagram: Diagram) {
    setPendingDelete(null);
    setActionFailed(false);
    try {
      await remove(diagram.id);
      if (activeId === diagram.id) router.push("/");
    } catch {
      setActionFailed(true);
    }
  }

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground"
      data-testid="sidebar"
    >
      <div className="border-b border-border px-4 py-3">
        <h1 className="truncate text-sm font-semibold">{t("title")}</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <div className="flex items-center justify-between gap-2 px-2">
          <h2
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            data-testid="diagrams-heading"
          >
            {t("diagrams")}
          </h2>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("newDiagram")}
            data-testid="diagram-new"
            disabled={loading || creating}
            onClick={onCreate}
          >
            <Plus aria-hidden />
          </Button>
        </div>

        {loading ? (
          <ul className="mt-2 space-y-1.5" aria-hidden data-testid="diagram-list-loading">
            {[0, 1, 2].map((row) => (
              <li key={row} className="px-2 py-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-1.5 h-3 w-16" />
              </li>
            ))}
          </ul>
        ) : failed ? (
          <div className="mt-3 space-y-2 px-2">
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              {t("retry")}
            </Button>
          </div>
        ) : (
          <ul className="mt-2 space-y-0.5" data-testid="diagram-list">
            {diagrams.map((diagram) => (
              <li key={diagram.id}>
                {renaming === diagram.id ? (
                  <RenameForm
                    diagram={diagram}
                    label={t("renameLabel")}
                    onSubmit={(name) => void onRename(diagram, name)}
                    onCancel={() => setRenaming(null)}
                  />
                ) : (
                  <DiagramRow
                    diagram={diagram}
                    active={diagram.id === activeId}
                    status={saveStatus?.id === diagram.id ? saveIndicator(saveStatus.status) : null}
                    renameLabel={t("rename")}
                    deleteLabel={t("delete")}
                    onRename={() => setRenaming(diagram.id)}
                    onDelete={() => setPendingDelete(diagram)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}

        {actionFailed ? (
          <p className="mt-3 px-2 text-xs text-muted-foreground" role="status">
            {t("actionFailed")}
          </p>
        ) : null}
      </nav>

      <div className="flex items-center gap-1 border-t border-border px-2 py-2">
        <ThemeControl />
        <LocaleToggle />
        <LogoutButton />
      </div>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent data-testid="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteBody", { name: pendingDelete?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel">{t("deleteCancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-testid="delete-confirm"
              onClick={() => {
                if (pendingDelete) void onDelete(pendingDelete);
              }}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function DiagramRow({
  diagram,
  active,
  status,
  renameLabel,
  deleteLabel,
  onRename,
  onDelete,
}: {
  diagram: Diagram;
  active: boolean;
  status: "saved" | "saving" | "failed" | null;
  renameLabel: string;
  deleteLabel: string;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-1 rounded-md pr-1 pl-2 transition-colors hover:bg-muted",
        active && "bg-muted",
      )}
      data-testid="diagram-item"
      data-active={active}
    >
      <Link
        href={`/d/${diagram.id}`}
        className="min-w-0 flex-1 py-1.5 outline-none focus-visible:underline"
      >
        <span className="block truncate text-sm">{diagram.name}</span>
        {status ? (
          <SaveStatusLine status={status} />
        ) : (
          <UpdatedAtLine updatedAt={diagram.updatedAt} />
        )}
      </Link>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={renameLabel}
        data-testid="diagram-rename"
        className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={onRename}
      >
        <Pencil aria-hidden />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={deleteLabel}
        data-testid="diagram-delete"
        className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
        onClick={onDelete}
      >
        <Trash2 aria-hidden />
      </Button>
    </div>
  );
}

function SaveStatusLine({ status }: { status: "saved" | "saving" | "failed" }) {
  const t = useTranslations("editor");
  const message = { saved: t("saved"), saving: t("saving"), failed: t("saveFailed") }[status];

  return (
    <span
      className="block truncate text-xs text-muted-foreground"
      data-testid="save-indicator"
      data-status={status}
      aria-live="polite"
    >
      {message}
    </span>
  );
}

function UpdatedAtLine({ updatedAt }: { updatedAt: string }) {
  const format = useFormatter();

  return (
    <span className="block truncate text-xs text-muted-foreground">
      {format.relativeTime(new Date(updatedAt))}
    </span>
  );
}

function RenameForm({
  diagram,
  label,
  onSubmit,
  onCancel,
}: {
  diagram: Diagram;
  label: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(diagram.name);

  return (
    <form
      className="px-1 py-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(name);
      }}
    >
      <Input
        autoFocus
        aria-label={label}
        data-testid="diagram-rename-input"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => onSubmit(name)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
      />
    </form>
  );
}
