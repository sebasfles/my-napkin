"use client";

import { CaptureUpdateAction, Sidebar } from "@excalidraw/excalidraw";
import type { LibraryItem } from "@excalidraw/excalidraw/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { ChevronRight, LibraryBig, Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AddToLibraryDialog } from "@/components/item-dialogs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/workspace-provider";
import { isDiagram, type Diagram, type Library } from "@/lib/diagrams";
import { defaultLibraryName, librariesOf, linksLibrary, nextLibraryIds } from "@/lib/libraries";
import { createLibraryItemCache } from "@/lib/library-cache";
import { libraryItemThumbnail, sceneCoords } from "@/lib/library-file";
import { appendToLibrary, readLibraryItems } from "@/lib/library-io";
import { insertedElements, newIdentity, selectionForLibrary } from "@/lib/library-items";
import { resolveTheme } from "@/lib/theme";
import { useSidebarCollapsed } from "@/lib/use-sidebar-collapsed";
import { useSidebarSection } from "@/lib/use-sidebar-section";
import { cn } from "@/lib/utils";

export const libraryPanelName = "napkin-libraries";

// One cache for the whole page, so the tab bar can move between diagrams that link the same
// library without fetching its items again.
const itemCache = createLibraryItemCache(readLibraryItems);

const dragThreshold = 4;

export function LibraryPanelTrigger() {
  const t = useTranslations("library");

  return (
    <Sidebar.Trigger
      name={libraryPanelName}
      title={t("panel")}
      className="napkin-library-trigger"
      icon={<LibraryBig aria-hidden className="size-4" />}
    />
  );
}

export function LibraryPanel({
  diagramId,
  api,
}: {
  diagramId: string;
  api: ExcalidrawImperativeAPI;
}) {
  const t = useTranslations("library");
  const { items, createLibrary, markSaved, setLibraryIds } = useWorkspace();
  const [, showSection] = useSidebarSection();
  const [, setCollapsed] = useSidebarCollapsed(false);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);

  const open = items.find((item) => item.id === diagramId) ?? null;
  const diagram: Diagram | null = open !== null && isDiagram(open) ? open : null;
  const libraries = useMemo(() => librariesOf(items), [items]);
  const linked = useMemo(
    () => (diagram === null ? [] : libraries.filter((l) => linksLibrary(diagram, l.id))),
    [diagram, libraries],
  );

  const reportFailure = useCallback(() => setFailed(true), []);
  const insert = useInsert(api, reportFailure);
  const selected = useSelection(api);

  async function add(target: Library | null, name: string) {
    const { copied, images } = selectionForLibrary(
      api.getSceneElements(),
      api.getAppState().selectedElementIds,
    );

    if (copied.length === 0) {
      api.setToast({ message: t(images > 0 ? "onlyImagesToAdd" : "nothingToAdd") });
      return;
    }

    const library = target ?? (await createLibrary(name));
    markSaved(await appendToLibrary(library, copied, null, () => crypto.randomUUID()));

    if (target === null && diagram !== null) {
      await setLibraryIds(
        diagram.id,
        nextLibraryIds(diagram, [...libraries, library], library.id, true),
      );
    }

    if (images > 0) api.setToast({ message: t("imagesSkipped") });
  }

  return (
    <>
      <Sidebar name={libraryPanelName} className="napkin-library-panel">
        <Sidebar.Header>
          <h2 className="font-heading text-sm font-semibold tracking-tight">{t("panel")}</h2>
        </Sidebar.Header>

        <div className="flex min-h-0 flex-1 flex-col" data-testid="library-panel">
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2">
            {linked.length === 0 ? (
              <p
                className="rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground"
                data-testid="library-panel-empty"
              >
                {t("panelEmpty")}
              </p>
            ) : (
              linked.map((library) => (
                <LibrarySection key={library.id} library={library} onInsert={insert} />
              ))
            )}
          </div>

          <div className="flex flex-col gap-1 border-t border-border px-3 py-2">
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              data-testid="library-panel-add"
              disabled={!selected}
              onClick={() => {
                setFailed(false);
                setAdding(true);
              }}
            >
              <Plus aria-hidden />
              {t("addSelection")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start"
              data-testid="library-panel-browse"
              onClick={() => {
                showSection("libraries");
                setCollapsed(false);
              }}
            >
              <Search aria-hidden />
              {t("browse")}
            </Button>
            {failed ? (
              <p className="px-2 text-xs text-destructive" role="status">
                {t("actionFailed")}
              </p>
            ) : null}
          </div>
        </div>
      </Sidebar>

      <AddToLibraryDialog
        libraries={linked}
        newName={defaultLibraryName(libraries.map((library) => library.name))}
        open={adding}
        onOpenChange={setAdding}
        onAdd={(target, name) => {
          setAdding(false);
          add(target, name).catch(() => setFailed(true));
        }}
      />
    </>
  );
}

function LibrarySection({
  library,
  onInsert,
}: {
  library: Library;
  onInsert: (item: LibraryItem, at: { clientX: number; clientY: number } | null) => void;
}) {
  const t = useTranslations("library");
  const [collapsed, setCollapsed] = useState(false);
  const { items, failed } = useLibraryItems(library);

  return (
    <section data-testid="panel-library" data-library={library.id}>
      <button
        type="button"
        aria-expanded={!collapsed}
        data-testid="panel-library-toggle"
        className="flex w-full items-center gap-1 rounded-md py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={() => setCollapsed((value) => !value)}
      >
        <ChevronRight
          aria-hidden
          className={cn("size-3.5 shrink-0 text-muted-foreground", !collapsed && "rotate-90")}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{library.name}</span>
        <span className="shrink-0 font-mono text-xs text-muted-foreground">
          {library.itemCount ?? 0}
        </span>
      </button>

      {collapsed ? null : failed ? (
        <p className="px-2 text-xs text-destructive" role="status">
          {t("itemsFailed")}
        </p>
      ) : items === null ? (
        <div className="grid grid-cols-3 gap-2" aria-hidden data-testid="panel-items-loading">
          {[0, 1, 2].map((cell) => (
            <Skeleton key={cell} className="aspect-square w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">{t("sectionEmpty")}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-2" data-testid="panel-items">
          {items.map((item) => (
            <li key={item.id}>
              <LibraryThumbnail item={item} onInsert={onInsert} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LibraryThumbnail({
  item,
  onInsert,
}: {
  item: LibraryItem;
  onInsert: (item: LibraryItem, at: { clientX: number; clientY: number } | null) => void;
}) {
  const t = useTranslations("library");
  const { theme, systemTheme } = useTheme();
  const dark = resolveTheme(theme, systemTheme) === "dark";
  const holder = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<SVGSVGElement | null>(null);
  // The gesture lives in a ref and only its ghost in state: a pointerup that lands in the same
  // frame as the last pointermove would otherwise read a `moved` that has not rendered yet.
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const dropped = useRef(false);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let active = true;

    libraryItemThumbnail(item.elements, dark)
      .then((svg) => {
        if (!active) return;

        svg.removeAttribute("width");
        svg.removeAttribute("height");
        svg.setAttribute("class", "size-full");
        setDrawing(svg);
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [dark, item]);

  useEffect(() => {
    if (drawing !== null) holder.current?.replaceChildren(drawing);
  }, [drawing]);

  const name = item.name ?? t("unnamedItem");

  return (
    <>
      <button
        type="button"
        aria-label={t("insert", { name })}
        title={name}
        data-testid="panel-item"
        data-item={item.id}
        className="flex aspect-square w-full touch-none items-center justify-center rounded-lg border border-border bg-card p-1.5 transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50"
        onPointerDown={(event) => {
          if (event.button !== 0) return;

          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, y: event.clientY, moved: false };
        }}
        onPointerMove={(event) => {
          const started = drag.current;
          if (started === null) return;

          const moved =
            started.moved ||
            Math.hypot(event.clientX - started.x, event.clientY - started.y) > dragThreshold;

          drag.current = { x: event.clientX, y: event.clientY, moved };
          if (moved) setGhost({ x: event.clientX, y: event.clientY });
        }}
        onPointerUp={(event) => {
          dropped.current = drag.current?.moved === true;
          drag.current = null;
          setGhost(null);
          if (!dropped.current) return;

          // The drop counts only over the drawing surface itself, not merely outside the panel:
          // a release over the napkin sidebar or the editor's own islands would otherwise insert
          // the item at a scene point that is not on screen.
          const over = document.elementFromPoint(event.clientX, event.clientY);

          if (over !== null && over.closest("canvas.excalidraw__canvas") !== null) {
            onInsert(item, { clientX: event.clientX, clientY: event.clientY });
          }
        }}
        onPointerCancel={() => {
          dropped.current = drag.current?.moved === true;
          drag.current = null;
          setGhost(null);
        }}
        onClick={() => {
          // A release that ended a drag still fires a click on the capturing element, and the
          // release already decided what that gesture meant.
          if (dropped.current) dropped.current = false;
          else onInsert(item, null);
        }}
      >
        <div ref={holder} className="pointer-events-none size-full" />
      </button>

      {ghost === null ? null : <DragGhost drawing={drawing} at={ghost} />}
    </>
  );
}

function DragGhost({
  drawing,
  at,
}: {
  drawing: SVGSVGElement | null;
  at: { x: number; y: number };
}) {
  const holder = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (drawing !== null) holder.current?.replaceChildren(drawing.cloneNode(true));
  }, [drawing]);

  return createPortal(
    <div
      aria-hidden
      ref={holder}
      className="pointer-events-none fixed z-50 size-24 opacity-70"
      style={{ left: at.x - 48, top: at.y - 48 }}
    />,
    document.body,
  );
}

function useLibraryItems(library: Library): { items: LibraryItem[] | null; failed: boolean } {
  // The library at this version: a save moves `updatedAt`, which is what tells the cache to fetch
  // the items that save derived, and what makes the items already on screen stale.
  const at = `${library.id}@${library.updatedAt}`;
  const [loaded, setLoaded] = useState<{
    at: string;
    items: LibraryItem[] | null;
    failed: boolean;
  }>({ at, items: null, failed: false });

  useEffect(() => {
    let active = true;

    itemCache
      .read(library)
      .then((items) => {
        if (active) setLoaded({ at, items, failed: false });
      })
      .catch(() => {
        if (active) setLoaded({ at, items: null, failed: true });
      });

    return () => {
      active = false;
    };
  }, [at, library]);

  return loaded.at === at ? loaded : { items: null, failed: false };
}

function useSelection(api: ExcalidrawImperativeAPI): boolean {
  const [selected, setSelected] = useState(false);

  useEffect(
    () => api.onChange((_, state) => setSelected(Object.keys(state.selectedElementIds).length > 0)),
    [api],
  );

  return selected;
}

function useInsert(api: ExcalidrawImperativeAPI, onFailed: () => void) {
  return useCallback(
    (item: LibraryItem, at: { clientX: number; clientY: number } | null) => {
      const inserting = async () => {
        const view = api.getAppState();
        const point = await sceneCoords(
          at ?? {
            clientX: view.offsetLeft + view.width / 2,
            clientY: view.offsetTop + view.height / 2,
          },
          view,
        );

        const inserted = insertedElements(
          item,
          point,
          newIdentity(() => crypto.randomUUID()),
        );

        api.updateScene({
          elements: [...api.getSceneElementsIncludingDeleted(), ...inserted],
          appState: {
            selectedElementIds: Object.fromEntries(
              inserted.map((element) => [element.id, true]),
            ) as Record<string, true>,
          },
          captureUpdate: CaptureUpdateAction.IMMEDIATELY,
        });
      };

      inserting().catch(onFailed);
    },
    [api, onFailed],
  );
}
