import type { ReactNode } from "react";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { Sidebar } from "@/components/sidebar";

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <main className="flex h-dvh w-full overflow-hidden">
        <Sidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </main>
    </WorkspaceProvider>
  );
}
