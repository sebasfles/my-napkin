"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { openDiagramId } from "@/lib/diagrams";
import { shortcutFor } from "@/lib/shortcuts";
import { tabAt, tabBeside } from "@/lib/tabs";
import { toggleCollapsed } from "@/lib/use-sidebar-collapsed";
import { useTabs } from "@/lib/use-tabs";

export function Shortcuts() {
  const router = useRouter();
  const { tabs, close } = useTabs();

  const goTo = useCallback(
    (id: string | null) => router.push(id === null ? "/" : `/d/${id}`),
    [router],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const shortcut = shortcutFor(event);
      if (shortcut === null) return;

      event.preventDefault();
      event.stopPropagation();

      if (shortcut.kind === "toggleSidebar") {
        toggleCollapsed();
        return;
      }

      const { command } = shortcut;
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

  return null;
}
