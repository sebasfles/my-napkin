"use client";

import { FolderPlus, LibraryBig, PanelLeftClose, Plus, Workflow } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FolderBreadcrumbs } from "@/components/folder-breadcrumbs";
import { DeleteDialog, InfoDialog, MoveDialog, NameDialog } from "@/components/item-dialogs";
import { DiagramRow, FolderRow } from "@/components/item-row";
import { LocaleToggle } from "@/components/locale-toggle";
import { LogoutButton } from "@/components/logout-button";
import { NapkinMark } from "@/components/napkin-mark";
import { ThemeControl } from "@/components/theme-control";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace } from "@/components/workspace-provider";
import { isDiagram, isLocked, isPinned, openDiagramId, parentOf } from "@/lib/diagrams";
import { childrenOf, currentFolder, pathTo, pinnedDiagrams } from "@/lib/tree";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { useSidebarFolder } from "@/lib/use-sidebar-folder";
import { useTabs } from "@/lib/use-tabs";
import { cn } from "@/lib/utils";

type OpenDialog = { kind: "name" | "info" | "move" | "delete"; id: string } | { kind: "newFolder" };

export function Sidebar({ collapsed: collapsedOnTheServer }: { collapsed: boolean }) {
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
  const [collapsed, setCollapsed] = useSidebarCollapsed(collapsedOnTheServer);
  const { fix } = useTabs();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const [open, setOpen] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const lastOpened = useRef<string | null>(null);

  const activeId = openDiagramId(pathname);
  const ready = !loading && !failed;
  const here = ready ? currentFolder(items, folderId) : folderId;
  const path = ready ? (pathTo(items, here) ?? []) : [];

  useEffect(() => {
    if (ready && folderId !== null && pathTo(items, folderId) === null) goTo(null);
  }, [folderId, goTo, items, ready]);

  useEffect(() => {
    if (activeId === null || activeId === lastOpened.current) return;

    const followed = lastOpened.current !== null;
    lastOpened.current = activeId;

    const opened = items.find((item) => item.id === activeId);
    if (followed && opened) goTo(parentOf(opened));
  }, [activeId, goTo, items]);

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
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        collapsed ? "w-12" : "w-72",
      )}
      data-testid="sidebar"
      data-collapsed={collapsed}
    >
      {collapsed ? (
        <SidebarRail onExpand={() => setCollapsed(false)} />
      ) : (
        <>
          <div className="flex items-center gap-2 px-3 py-3.5">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground"
            >
              <NapkinMark className="size-4" />
            </span>
            <h1 className="truncate font-heading text-sm font-semibold tracking-tight">
              {t("title")}
            </h1>
            <div className="flex-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("collapse")}
                  aria-expanded
                  data-testid="sidebar-toggle"
                  onClick={() => setCollapsed(true)}
                >
                  <PanelLeftClose aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t("collapse")}</TooltipContent>
            </Tooltip>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-3">
            {pinned.length > 0 ? (
              <section className="mb-3" data-testid="pinned-section">
                <h2 className="py-2 pl-2 text-xs font-medium tracking-wider text-muted-foreground uppercase">
                  {t("pinned")}
                </h2>
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
              <div className="flex items-center justify-between gap-2 py-2 pl-2">
                <div className="min-w-0 overflow-hidden" data-testid="diagrams-heading">
                  <FolderBreadcrumbs path={path} onNavigate={goTo} />
                </div>
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
        </>
      )}

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
    </aside>
  );
}

function SidebarRail({ onExpand }: { onExpand: () => void }) {
  const t = useTranslations("sidebar");

  return (
    <div className="flex flex-1 flex-col items-center gap-1 py-3" data-testid="sidebar-rail">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={t("expand")}
            aria-expanded={false}
            data-testid="sidebar-toggle"
            onClick={onExpand}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md bg-primary text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <NapkinMark className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{t("expand")}</TooltipContent>
      </Tooltip>

      <RailSection
        label={t("diagrams")}
        testId="rail-diagrams"
        icon={<Workflow aria-hidden />}
        current
        onClick={onExpand}
      />
      <RailSection
        label={t("libraries")}
        hint={t("comingSoon")}
        testId="rail-libraries"
        icon={<LibraryBig aria-hidden />}
      />
    </div>
  );
}

function RailSection({
  label,
  hint,
  testId,
  icon,
  current = false,
  onClick,
}: {
  label: string;
  hint?: string;
  testId: string;
  icon: ReactNode;
  current?: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-current={current ? "page" : undefined}
          aria-disabled={onClick === undefined}
          data-testid={testId}
          className={cn(
            "mt-1 text-muted-foreground",
            current && "bg-sidebar-accent text-sidebar-accent-foreground",
            "aria-disabled:cursor-default aria-disabled:opacity-50",
          )}
          onClick={onClick}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <span>{label}</span>
        {hint === undefined ? null : <span className="text-background/70">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
