"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/workspace-provider";
import { isDiagram, openDiagramId, type Diagram } from "@/lib/diagrams";
import { tabAt, tabBeside, tabShortcut } from "@/lib/tabs";
import { useTabs } from "@/lib/use-tabs";
import { cn } from "@/lib/utils";

export function TabBar() {
  const t = useTranslations("tabs");
  const router = useRouter();
  const pathname = usePathname();
  const { items, loading, failed } = useWorkspace();
  const { tabs, open, fix, close, keep } = useTabs();

  const activeId = openDiagramId(pathname);
  const ready = !loading && !failed;

  const goTo = useCallback(
    (id: string | null) => router.push(id === null ? "/" : `/d/${id}`),
    [router],
  );

  useEffect(() => {
    if (activeId !== null) open(activeId);
  }, [activeId, open]);

  useEffect(() => {
    if (!ready) return;

    const next = keep(
      items.filter(isDiagram).map((diagram) => diagram.id),
      activeId,
    );
    if (next !== activeId) router.replace(next === null ? "/" : `/d/${next}`);
  }, [activeId, items, keep, ready, router]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const command = tabShortcut(event);
      if (command === null) return;

      event.preventDefault();
      event.stopPropagation();

      const active = openDiagramId(window.location.pathname);

      if (command.kind === "close") {
        if (active !== null) goTo(close(active, active));
        return;
      }

      const target =
        command.kind === "jump"
          ? tabAt(tabs, command.index)
          : tabBeside(tabs, active, command.delta);
      if (target !== null && target !== active) goTo(target);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [close, goTo, tabs]);

  if (tabs.ids.length === 0) return null;

  const openDiagrams = tabs.ids
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is Diagram => item !== undefined && isDiagram(item));

  return (
    <nav
      aria-label={t("label")}
      data-testid="tab-bar"
      className="flex h-9 shrink-0 items-stretch overflow-x-auto border-b border-sidebar-border bg-sidebar"
    >
      <ul className="flex items-stretch">
        {loading
          ? tabs.ids.map((id) => (
              <li key={id} className="flex items-center px-3">
                <Skeleton className="h-3 w-24" />
              </li>
            ))
          : openDiagrams.map((diagram) => (
              <li key={diagram.id}>
                <Tab
                  diagram={diagram}
                  active={diagram.id === activeId}
                  preview={diagram.id === tabs.previewId}
                  onFix={() => fix(diagram.id)}
                  onClose={() => {
                    const next = close(diagram.id, activeId);
                    if (next !== activeId) goTo(next);
                  }}
                />
              </li>
            ))}
      </ul>
    </nav>
  );
}

function Tab({
  diagram,
  active,
  preview,
  onFix,
  onClose,
}: {
  diagram: Diagram;
  active: boolean;
  preview: boolean;
  onFix: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("tabs");

  return (
    <div
      data-testid="tab"
      data-active={active}
      data-preview={preview}
      className={cn(
        "group relative flex h-full items-center gap-1 border-r border-sidebar-border pr-1 pl-3 transition-colors",
        active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-sidebar-accent",
      )}
    >
      {active ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}

      <Link
        href={`/d/${diagram.id}`}
        onDoubleClick={onFix}
        className="max-w-40 truncate rounded-sm py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className={cn("block truncate", preview && "italic")}>{diagram.name}</span>
      </Link>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("close", { name: diagram.name })}
        data-testid="tab-close"
        className={cn(
          "opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100",
          active && "opacity-100",
        )}
        onClick={onClose}
      >
        <X aria-hidden />
      </Button>
    </div>
  );
}
