import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { EditorSurface } from "@/components/editor-surface";
import { PageTitle } from "@/components/page-title";
import { Shortcuts } from "@/components/shortcuts";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { shellLayoutCookie } from "@/lib/shell-layout";

export default async function EditorLayout({ children }: { children: ReactNode }) {
  const layout = (await cookies()).get(shellLayoutCookie)?.value ?? "";

  return (
    <WorkspaceProvider>
      <PageTitle />
      <Shortcuts />
      <main className="flex h-dvh w-full overflow-hidden">
        <Sidebar layout={layout} />
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
