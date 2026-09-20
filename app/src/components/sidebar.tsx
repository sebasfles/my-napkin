"use client";

import { PenLine, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { DeleteDialog, InfoDialog, RenameDialog } from "@/components/diagram-dialogs";
import { DiagramRow } from "@/components/diagram-row";
import { useDiagrams } from "@/components/diagrams-provider";
import { LocaleToggle } from "@/components/locale-toggle";
import { LogoutButton } from "@/components/logout-button";
import { ThemeControl } from "@/components/theme-control";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { isLocked } from "@/lib/diagrams";

type OpenDialog = { kind: "rename" | "info" | "delete"; id: string };

export function Sidebar() {
  const t = useTranslations("sidebar");
  const { diagrams, loading, failed, reload, create, rename, setLock, remove, saveStatus } =
    useDiagrams();
  const router = useRouter();
  const pathname = usePathname();

  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [actionFailed, setActionFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  const activeId = pathname.startsWith("/d/") ? pathname.slice("/d/".length) : null;
  const target = dialog ? (diagrams.find((item) => item.id === dialog.id) ?? null) : null;

  async function attempt(action: () => Promise<void>) {
    setActionFailed(false);
    try {
      await action();
    } catch {
      setActionFailed(true);
    }
  }

  async function onCreate() {
    setCreating(true);
    await attempt(async () => {
      const created = await create();
      router.push(`/d/${created.id}`);
    });
    setCreating(false);
  }

  return (
    <aside
      className="flex h-full w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
      data-testid="sidebar"
    >
      <div className="flex items-center gap-2 px-4 py-3.5">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
        >
          <PenLine className="size-4" />
        </span>
        <h1 className="truncate font-heading text-sm font-semibold tracking-tight">{t("title")}</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex items-center justify-between gap-2 py-2 pl-2">
          <h2
            className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
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
          <ul className="space-y-1" aria-hidden data-testid="diagram-list-loading">
            {[0, 1, 2].map((row) => (
              <li key={row} className="px-2 py-1.5">
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="mt-2 h-3 w-16" />
              </li>
            ))}
          </ul>
        ) : failed ? (
          <div className="space-y-3 rounded-lg border border-dashed border-sidebar-border p-3">
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
            <Button variant="outline" size="sm" onClick={reload}>
              {t("retry")}
            </Button>
          </div>
        ) : diagrams.length === 0 ? (
          <p className="rounded-lg border border-dashed border-sidebar-border p-3 text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="space-y-0.5" data-testid="diagram-list">
            {diagrams.map((diagram) => (
              <li key={diagram.id}>
                <DiagramRow
                  diagram={diagram}
                  active={diagram.id === activeId}
                  status={
                    diagram.id === activeId && saveStatus?.id === diagram.id
                      ? saveStatus.status
                      : null
                  }
                  onRename={() => setDialog({ kind: "rename", id: diagram.id })}
                  onInfo={() => setDialog({ kind: "info", id: diagram.id })}
                  onDelete={() => setDialog({ kind: "delete", id: diagram.id })}
                  onToggleLock={() => void attempt(() => setLock(diagram.id, !isLocked(diagram)))}
                />
              </li>
            ))}
          </ul>
        )}

        {actionFailed ? (
          <p className="mt-3 px-2 text-xs text-destructive" role="status">
            {t("actionFailed")}
          </p>
        ) : null}
      </nav>

      <div className="flex items-center gap-1 border-t border-sidebar-border px-3 py-2.5">
        <ThemeControl />
        <div className="flex-1" />
        <LocaleToggle />
        <LogoutButton />
      </div>

      {target && dialog?.kind === "rename" ? (
        <RenameDialog
          diagram={target}
          onClose={() => setDialog(null)}
          onSubmit={(name) => {
            setDialog(null);
            if (name !== target.name) void attempt(() => rename(target.id, name));
          }}
        />
      ) : null}

      {target && dialog?.kind === "info" ? (
        <InfoDialog diagram={target} onClose={() => setDialog(null)} />
      ) : null}

      {target && dialog?.kind === "delete" ? (
        <DeleteDialog
          diagram={target}
          onClose={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            void attempt(async () => {
              await remove(target.id);
              if (activeId === target.id) router.push("/");
            });
          }}
        />
      ) : null}
    </aside>
  );
}
