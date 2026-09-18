"use client";

import "@excalidraw/excalidraw/index.css";

import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import type { Locale } from "@/i18n/locales";
import { editorLangCode } from "@/lib/editor";
import { resolveTheme } from "@/lib/theme";
import { useHydrated } from "@/lib/use-hydrated";

const Canvas = dynamic(async () => (await import("@excalidraw/excalidraw")).Excalidraw, {
  ssr: false,
});

export function Editor() {
  const locale = useLocale() as Locale;
  const { theme, systemTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div className="h-full w-full" data-testid="editor">
      {hydrated ? (
        <Canvas theme={resolveTheme(theme, systemTheme)} langCode={editorLangCode(locale)} />
      ) : null}
    </div>
  );
}
