"use client";

import { LibraryBig, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/workspace-provider";
import { isCanvas, isLibrary, openItemId, type Canvas } from "@/lib/diagrams";
import { useTabs } from "@/lib/use-tabs";
import { cn } from "@/lib/utils";

export function TabBar() {
  const t = useTranslations("tabs");
  const router = useRouter();
  const pathname = usePathname();
  const { items, loading, failed } = useWorkspace();
  const { tabs, open, fix, close, keep } = useTabs();

  const activeId = openItemId(pathname);
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
      items.filter(isCanvas).map((item) => item.id),
      activeId,
    );
    if (next !== activeId) router.replace(next === null ? "/" : `/d/${next}`);
  }, [activeId, items, keep, ready, router]);

  if (tabs.ids.length === 0) return null;

  const openCanvases = tabs.ids
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is Canvas => item !== undefined && isCanvas(item));

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
          : openCanvases.map((item) => (
              <li key={item.id}>
                <Tab
                  item={item}
                  active={item.id === activeId}
                  preview={item.id === tabs.previewId}
                  onFix={() => fix(item.id)}
                  onClose={() => {
                    const next = close(item.id, activeId);
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
  item,
  active,
  preview,
  onFix,
  onClose,
}: {
  item: Canvas;
  active: boolean;
  preview: boolean;
  onFix: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("tabs");
  const library = isLibrary(item);

  return (
    <div
      data-testid="tab"
      data-active={active}
      data-preview={preview}
      data-library={library}
      className={cn(
        "group relative flex h-full items-center gap-1 border-r border-sidebar-border pr-1 pl-3 transition-colors",
        active ? "bg-background text-foreground" : "text-muted-foreground hover:bg-sidebar-accent",
      )}
    >
      {active ? <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-primary" /> : null}

      <Link
        href={`/d/${item.id}`}
        onDoubleClick={onFix}
        className="flex max-w-40 items-center gap-1.5 rounded-sm py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        {library ? (
          <LibraryBig aria-label={t("libraryGlyph")} className="size-3.5 shrink-0" />
        ) : null}
        <span className={cn("block truncate", preview && "italic")}>{item.name}</span>
      </Link>

      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("close", { name: item.name })}
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
