"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Editor } from "@/components/editor";
import { openDiagramId } from "@/lib/diagrams";

export function EditorSurface({ children }: { children: ReactNode }) {
  const diagramId = openDiagramId(usePathname());

  return diagramId === null ? <>{children}</> : <Editor diagramId={diagramId} />;
}
