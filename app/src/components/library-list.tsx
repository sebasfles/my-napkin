"use client";

import { LibraryBig, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/workspace-provider";
import type { Library } from "@/lib/diagrams";
import { defaultLibraryName, librariesOf } from "@/lib/libraries";
import { cn } from "@/lib/utils";

export function LibraryList({ activeId }: { activeId: string | null }) {
  const t = useTranslations("library");
  const router = useRouter();
  const { items, loading, failed, reload, createLibrary } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const libraries = librariesOf(items);

  async function onCreate() {
    setCreating(true);
    setActionFailed(false);

    try {
      const created = await createLibrary(defaultLibraryName(libraries.map((one) => one.name)));
      router.push(`/d/${created.id}`);
    } catch {
      setActionFailed(true);
    }

    setCreating(false);
  }

  return (
    <section data-testid="library-section">
      <div className="flex items-center justify-between gap-2 py-2 pl-2">
        <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {t("title")}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("new")}
          data-testid="library-new"
          disabled={loading || creating}
          onClick={onCreate}
        >
          <Plus aria-hidden />
        </Button>
      </div>

      {loading ? (
        <ul className="space-y-1" aria-hidden data-testid="library-list-loading">
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
      ) : libraries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-sidebar-border p-3 text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="space-y-0.5" data-testid="library-list">
          {libraries.map((library) => (
            <li key={library.id}>
              <LibraryRow library={library} active={library.id === activeId} />
            </li>
          ))}
        </ul>
      )}

      {actionFailed ? (
        <p className="mt-3 px-2 text-xs text-destructive" role="status">
          {t("actionFailed")}
        </p>
      ) : null}
    </section>
  );
}

function LibraryRow({ library, active }: { library: Library; active: boolean }) {
  const t = useTranslations("library");

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-lg px-2 transition-colors hover:bg-sidebar-accent",
        active && "bg-sidebar-accent text-sidebar-accent-foreground",
      )}
      data-testid="library-item"
      data-active={active}
      data-items={library.itemCount ?? 0}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute top-2 bottom-2 -left-1 w-0.5 rounded-full bg-primary"
        />
      ) : null}

      <LibraryBig aria-hidden className="size-4 shrink-0 text-muted-foreground" />

      <Link
        href={`/d/${library.id}`}
        className="min-w-0 flex-1 rounded-md py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span
          data-testid="library-item-name"
          className={cn("block truncate text-sm", active && "font-medium")}
        >
          {library.name}
        </span>
        <span className="block text-xs text-muted-foreground" data-testid="library-item-count">
          {t("itemCount", { count: library.itemCount ?? 0 })}
        </span>
      </Link>
    </div>
  );
}
