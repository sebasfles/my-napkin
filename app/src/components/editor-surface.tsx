"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Editor } from "@/components/editor";
import { openItemId } from "@/lib/diagrams";

export function EditorSurface({ children }: { children: ReactNode }) {
  const itemId = openItemId(usePathname());

  return itemId === null ? <>{children}</> : <Editor itemId={itemId} />;
}
