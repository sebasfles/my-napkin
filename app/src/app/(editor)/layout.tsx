import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { TabBar } from "@/components/tab-bar";
import { WorkspaceProvider } from "@/components/workspace-provider";

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <main className="flex h-dvh w-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TabBar />
          <div className="min-h-0 flex-1">{children}</div>
        </div>
      </main>
    </WorkspaceProvider>
  );
}
