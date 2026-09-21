"use client";

import { Plus, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { LibraryRow } from "@/components/item-row";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/workspace-provider";
import { isDiagram, type Diagram } from "@/lib/diagrams";
import {
  defaultLibraryName,
  librariesOf,
  libraryFileExtension,
  linksLibrary,
  nextLibraryIds,
} from "@/lib/libraries";
import { exportLibrary, importLibraryFile } from "@/lib/library-io";

export function LibraryList({
  activeId,
  onRename,
  onDelete,
}: {
  activeId: string | null;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useTranslations("library");
  const router = useRouter();
  const { items, loading, failed, reload, createLibrary, markSaved, setLibraryIds } =
    useWorkspace();
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);

  const libraries = librariesOf(items);
  const names = libraries.map((library) => library.name);
  const open = items.find((item) => item.id === activeId) ?? null;
  const diagram: Diagram | null = open !== null && isDiagram(open) ? open : null;

  async function attempt(action: () => Promise<void>) {
    setBusy(true);
    setActionFailed(false);

    try {
      await action();
    } catch {
      setActionFailed(true);
    }

    setBusy(false);
  }

  function onCreate() {
    void attempt(async () => {
      const created = await createLibrary(defaultLibraryName(names));
      router.push(`/d/${created.id}`);
    });
  }

  function onImport(file: File) {
    void attempt(async () => {
      const imported = await importLibraryFile(file, names, {
        create: createLibrary,
        saved: markSaved,
      });

      router.push(`/d/${imported.id}`);
    });
  }

  return (
    <section data-testid="library-section">
      <div className="flex items-center justify-between gap-2 py-2 pl-2">
        <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {t("title")}
        </h2>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("import")}
            data-testid="library-import"
            disabled={loading || busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("new")}
            data-testid="library-new"
            disabled={loading || busy}
            onClick={onCreate}
          >
            <Plus aria-hidden />
          </Button>
        </div>
      </div>

      <input
        ref={fileInput}
        type="file"
        accept={libraryFileExtension}
        className="hidden"
        data-testid="library-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onImport(file);
        }}
      />

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
              <LibraryRow
                library={library}
                active={library.id === activeId}
                linked={diagram !== null && linksLibrary(diagram, library.id)}
                linkable={diagram !== null}
                onRename={() => onRename(library.id)}
                onDelete={() => onDelete(library.id)}
                onExport={() => void attempt(() => exportLibrary(library))}
                onToggleLink={() => {
                  if (diagram === null) return;

                  void attempt(() =>
                    setLibraryIds(
                      diagram.id,
                      nextLibraryIds(
                        diagram,
                        libraries,
                        library.id,
                        !linksLibrary(diagram, library.id),
                      ),
                    ),
                  );
                }}
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
    </section>
  );
}
