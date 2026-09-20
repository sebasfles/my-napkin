import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { EditorSurface } from "@/components/editor-surface";
import { PageTitle } from "@/components/page-title";
import { Shortcuts } from "@/components/shortcuts";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { sidebarCollapsedCookie } from "@/lib/sidebar-cookie";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const collapsed = (await cookies()).get(sidebarCollapsedCookie)?.value === "true";

  return (
    <WorkspaceProvider>
      <PageTitle />
      <Shortcuts />
      <main className="flex h-dvh w-full overflow-hidden">
        <Sidebar collapsed={collapsed} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar />
          <div className="min-h-0 flex-1">
            <EditorSurface>{children}</EditorSurface>
          </div>
        </div>
      </main>
    </WorkspaceProvider>
  );
}
