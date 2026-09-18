import { Editor } from "@/components/editor";
import { Sidebar } from "@/components/sidebar";

export default function HomePage() {
  return (
    <main className="flex h-dvh w-full overflow-hidden">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <Editor />
      </div>
    </main>
  );
}
