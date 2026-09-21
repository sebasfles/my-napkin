"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { SidebarPanel } from "@/components/sidebar-panel";
import { SidebarRail } from "@/components/sidebar-rail";
import { useWorkspace } from "@/components/workspace-provider";
import { isDiagram, openItemId, parentOf } from "@/lib/diagrams";
import { toggleSection } from "@/lib/shell-layout";
import { pathTo } from "@/lib/tree";
import { useShellLayout } from "@/lib/use-shell-layout";
import { useSidebarFolder } from "@/lib/use-sidebar-folder";

export function Sidebar({ layout: layoutOnTheServer }: { layout: string }) {
  const [layout, setLayout] = useShellLayout(layoutOnTheServer);
  useFolderFollowsTheOpenDiagram();

  return (
    <aside
      className="flex h-full shrink-0 bg-sidebar text-sidebar-foreground"
      data-testid="sidebar"
      data-collapsed={!layout.panel}
      data-section={layout.section}
    >
      <SidebarRail
        section={layout.section}
        onSelect={(section) => setLayout(toggleSection(layout, section))}
      />
      {layout.panel ? <SidebarPanel section={layout.section} /> : null}
    </aside>
  );
}

// Here rather than in the panel, which is unmounted while the rail stands alone: where the
// sidebar is, is remembered whether or not anything is showing it.
function useFolderFollowsTheOpenDiagram() {
  const { items, loading, failed } = useWorkspace();
  const pathname = usePathname();
  const [folderId, goTo] = useSidebarFolder();
  const lastOpened = useRef<string | null>(null);

  const activeId = openItemId(pathname);
  const ready = !loading && !failed;

  useEffect(() => {
    if (ready && folderId !== null && pathTo(items, folderId) === null) goTo(null);
  }, [folderId, goTo, items, ready]);

  useEffect(() => {
    if (activeId === null || activeId === lastOpened.current) return;

    const followed = lastOpened.current !== null;
    lastOpened.current = activeId;

    const opened = items.find((item) => item.id === activeId);
    if (followed && opened && isDiagram(opened)) goTo(parentOf(opened));
  }, [activeId, goTo, items]);
}
