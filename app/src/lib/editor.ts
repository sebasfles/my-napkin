import type { Locale } from "@/i18n/locales";

const langCodes: Record<Locale, string> = {
  es: "es-ES",
  en: "en",
};

export function editorLangCode(locale: Locale): string {
  return langCodes[locale];
}

export function isInEditor(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-editor-region]") !== null;
}

interface LoadingEditor {
  getAppState(): { isLoading: boolean };
  onChange(
    listener: (elements: readonly unknown[], appState: { isLoading: boolean }) => void,
  ): () => void;
}

// The package hands its API out from its constructor, then initialises after mounting by replacing
// the whole scene with an empty one of its own. A scene handed over before that is wiped, so it is
// ready only once loading is over, which its first change report is the earliest sign of.
export function whenEditorReady(editor: LoadingEditor, ready: () => void): () => void {
  if (!editor.getAppState().isLoading) {
    ready();
    return () => {};
  }

  let waiting = true;
  const stop = editor.onChange((_elements, appState) => {
    if (!waiting || appState.isLoading) return;
    waiting = false;
    stop();
    ready();
  });

  return () => {
    waiting = false;
    stop();
  };
}

export interface Painted<Canvas, Instance> {
  canvas: Canvas;
  instance: Instance;
}

// A canvas is on screen only once this very editor instance was handed it and drew it; until then
// the editor holds the previous canvas, the reset's empty one or its own initial one.
export function isPainted<Canvas, Instance>(
  shown: Canvas | null,
  instance: Instance | null,
  painted: Painted<Canvas, Instance> | null,
): boolean {
  return (
    shown !== null &&
    instance !== null &&
    painted !== null &&
    painted.canvas === shown &&
    painted.instance === instance
  );
}

export function canSaveCanvas<Canvas, Instance>(
  shown: Canvas | null,
  instance: Instance | null,
  painted: Painted<Canvas, Instance> | null,
  locked: boolean,
): boolean {
  return isPainted(shown, instance, painted) && !locked;
}
