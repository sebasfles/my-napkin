"use client";

import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { libraryFrames, type LibraryFrame } from "@/lib/library-items";
import type { Scene, SceneAppState } from "@/lib/scene";

export interface LibraryCanvasHint {
  empty: boolean;
  frames: LibraryFrame[];
  appState: SceneAppState;
}

export function libraryCanvasHint(scene: Scene): LibraryCanvasHint {
  return {
    empty: scene.elements.length === 0,
    frames: libraryFrames(scene.elements).filter((frame) => frame.holdsImage),
    appState: scene.appState,
  };
}

export function sameHint(a: LibraryCanvasHint, b: LibraryCanvasHint): boolean {
  return (
    a.empty === b.empty &&
    a.appState.zoom?.value === b.appState.zoom?.value &&
    a.appState.scrollX === b.appState.scrollX &&
    a.appState.scrollY === b.appState.scrollY &&
    a.frames.length === b.frames.length &&
    a.frames.every((frame, at) => {
      const other = b.frames[at];
      return frame.id === other.id && frame.x === other.x && frame.y === other.y;
    })
  );
}

export function LibraryHints({ hint }: { hint: LibraryCanvasHint }) {
  const { empty, frames, appState } = hint;
  const t = useTranslations("library");
  const zoom = appState.zoom?.value ?? 1;
  const scrollX = appState.scrollX ?? 0;
  const scrollY = appState.scrollY ?? 0;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-live="polite">
      {empty ? (
        <div className="flex h-full items-center justify-center">
          <p
            className="max-w-xs rounded-lg border border-dashed border-border bg-background/80 px-4 py-3 text-center text-sm text-muted-foreground"
            data-testid="empty-library-canvas"
          >
            {t("emptyCanvas")}
          </p>
        </div>
      ) : null}

      {frames.map((frame) => (
        <span
          key={frame.id}
          data-testid="library-image-hint"
          className="absolute flex max-w-56 items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs text-muted-foreground shadow-sm"
          style={{
            left: `${(frame.x + scrollX) * zoom}px`,
            top: `${(frame.y + scrollY) * zoom}px`,
            transform: "translateY(-100%)",
          }}
        >
          <ImageOff aria-hidden className="size-3.5 shrink-0" />
          {t("imageInFrame")}
        </span>
      ))}
    </div>
  );
}
