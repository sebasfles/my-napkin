"use client";

import { FolderPlus, Plus } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { FolderBreadcrumbs } from "@/components/folder-breadcrumbs";
import { LibraryList } from "@/components/library-list";
import { DeleteDialog, InfoDialog, MoveDialog, NameDialog } from "@/components/item-dialogs";
import { DiagramRow, FolderRow } from "@/components/item-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/workspace-provider";
import { isDiagram, isLocked, isPinned, openItemId } from "@/lib/diagrams";
import type { SidebarSection } from "@/lib/shell-layout";
import { childrenOf, currentFolder, pathTo, pinnedDiagrams } from "@/lib/tree";
import { useSidebarFolder } from "@/lib/use-sidebar-folder";
import { useTabs } from "@/lib/use-tabs";

type OpenDialog = { kind: "name" | "info" | "move" | "delete"; id: string } | { kind: "newFolder" };

export function SidebarPanel({ section }: { section: SidebarSection }) {
  const t = useTranslations("sidebar");
  const {
    items,
    loading,
    failed,
    reload,
    create,
    createFolder,
    rename,
    move,
    setPinned,
    setLock,
    remove,
    saveStatus,
  } = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();

  const [folderId, goTo] = useSidebarFolder();
  const { fix } = useTabs();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [open, setOpen] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  const activeId = openItemId(pathname);
  const ready = !loading && !failed;
  const here = ready ? currentFolder(items, folderId) : folderId;
  const path = ready ? (pathTo(items, here) ?? []) : [];

  const target =
    dialog && "id" in dialog ? (items.find((item) => item.id === dialog.id) ?? null) : null;
  const contents = childrenOf(items, here);
  const pinned = pinnedDiagrams(items);

  function statusOf(id: string) {
    return id === activeId && saveStatus?.id === id ? saveStatus.status : null;
  }

  function show(kind: Exclude<OpenDialog["kind"], "newFolder">, id: string) {
    setDialog({ kind, id });
    setOpen(true);
  }

  function shows(kind: OpenDialog["kind"]) {
    if (dialog?.kind !== kind) return false;
    return open && (kind === "newFolder" || target !== null);
  }

  async function attempt(action: () => Promise<void>) {
    setActionFailed(false);
    try {
      await action();
    } catch {
      setActionFailed(true);
    }
  }

  async function onCreateDiagram() {
    setCreating(true);
    await attempt(async () => {
      const created = await create(here);
      router.push(`/d/${created.id}`);
    });
    setCreating(false);
  }

  return (
    <div
      className="flex w-72 shrink-0 flex-col border-r border-sidebar-border"
      data-testid="sidebar-panel"
    >
      <div className="flex items-center px-3 py-3.5" data-testid="panel-header">
        <h1 className="truncate font-heading text-sm leading-7 font-semibold tracking-tight">
          {t("title")}
        </h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3">
        {section === "libraries" ? (
          <LibraryList
            activeId={activeId}
            onRename={(id) => show("name", id)}
            onDelete={(id) => show("delete", id)}
          />
        ) : (
          <section data-testid="diagrams-section">
            <div className="flex items-center justify-between gap-2 py-2 pl-2">
              <h2
                className="text-xs font-medium tracking-wider text-muted-foreground uppercase"
                data-testid="diagrams-heading"
              >
                {t("diagrams")}
              </h2>
              <div className="flex shrink-0 items-center">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("newFolder")}
                  data-testid="folder-new"
                  disabled={loading}
                  onClick={() => {
                    setDialog({ kind: "newFolder" });
                    setOpen(true);
                  }}
                >
                  <FolderPlus aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("newDiagram")}
                  data-testid="diagram-new"
                  disabled={loading || creating}
                  onClick={onCreateDiagram}
                >
                  <Plus aria-hidden />
                </Button>
              </div>
            </div>

            {pinned.length > 0 ? (
              <section className="mb-3" data-testid="pinned-section">
                <h3 className="py-2 pl-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  {t("pinned")}
                </h3>
                <ul className="space-y-0.5" data-testid="pinned-list">
                  {pinned.map((diagram) => (
                    <li key={diagram.id}>
                      <DiagramRow
                        diagram={diagram}
                        active={diagram.id === activeId}
                        status={statusOf(diagram.id)}
                        onFix={() => fix(diagram.id)}
                        onRename={() => show("name", diagram.id)}
                        onTogglePin={() => void attempt(() => setPinned(diagram.id, false))}
                        onMove={() => show("move", diagram.id)}
                        onInfo={() => show("info", diagram.id)}
                        onDelete={() => show("delete", diagram.id)}
                        onToggleLock={() =>
                          void attempt(() => setLock(diagram.id, !isLocked(diagram)))
                        }
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section data-testid="folder-section">
              <div className="min-w-0 overflow-hidden py-2 pl-2" data-testid="breadcrumb-row">
                <FolderBreadcrumbs path={path} onNavigate={goTo} />
              </div>

              {loading ? (
                <ul className="space-y-1" aria-hidden data-testid="item-list-loading">
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
              ) : contents.folders.length === 0 && contents.diagrams.length === 0 ? (
                <p className="rounded-lg border border-dashed border-sidebar-border p-3 text-sm text-muted-foreground">
                  {here === null ? t("empty") : t("emptyFolder")}
                </p>
              ) : (
                <ul className="space-y-0.5" data-testid="item-list">
                  {contents.folders.map((folder) => (
                    <li key={folder.id}>
                      <FolderRow
                        folder={folder}
                        onOpen={() => goTo(folder.id)}
                        onRename={() => show("name", folder.id)}
                        onMove={() => show("move", folder.id)}
                        onDelete={() => show("delete", folder.id)}
                      />
                    </li>
                  ))}
                  {contents.diagrams.map((diagram) => (
                    <li key={diagram.id}>
                      <DiagramRow
                        diagram={diagram}
                        active={diagram.id === activeId}
                        status={statusOf(diagram.id)}
                        onFix={() => fix(diagram.id)}
                        onRename={() => show("name", diagram.id)}
                        onTogglePin={() =>
                          void attempt(() => setPinned(diagram.id, !isPinned(diagram)))
                        }
                        onMove={() => show("move", diagram.id)}
                        onInfo={() => show("info", diagram.id)}
                        onDelete={() => show("delete", diagram.id)}
                        onToggleLock={() =>
                          void attempt(() => setLock(diagram.id, !isLocked(diagram)))
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </section>
        )}

        {actionFailed ? (
          <p className="mt-3 px-2 text-xs text-destructive" role="status">
            {t("actionFailed")}
          </p>
        ) : null}
      </nav>

      <NameDialog
        item={shows("newFolder") ? null : target}
        open={shows("name") || shows("newFolder")}
        onOpenChange={setOpen}
        onSubmit={(name) => {
          setOpen(false);

          if (dialog?.kind === "newFolder") {
            void attempt(async () => {
              await createFolder(name, here);
            });
            return;
          }

          if (target && name !== target.name) void attempt(() => rename(target.id, name));
        }}
      />

      <MoveDialog
        item={target}
        items={items}
        open={shows("move")}
        onOpenChange={setOpen}
        onMove={(parentId) => {
          setOpen(false);
          if (target) void attempt(() => move(target.id, parentId));
        }}
      />

      <InfoDialog
        diagram={target && isDiagram(target) ? target : null}
        items={items}
        open={shows("info")}
        onOpenChange={setOpen}
      />

      <DeleteDialog
        item={target}
        items={items}
        open={shows("delete")}
        onOpenChange={setOpen}
        onConfirm={() => {
          setOpen(false);
          if (!target) return;

          void attempt(async () => {
            await remove(target.id);
          });
        }}
      />
    </div>
  );
}
