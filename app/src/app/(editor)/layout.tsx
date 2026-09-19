import type { ReactNode } from "react";
import { DiagramsProvider } from "@/components/diagrams-provider";
import { Sidebar } from "@/components/sidebar";

export default function EditorLayout({ children }: { children: ReactNode }) {
  return (
    <DiagramsProvider>
      <main className="flex h-dvh w-full overflow-hidden">
        <Sidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </main>
    </DiagramsProvider>
  );
}
