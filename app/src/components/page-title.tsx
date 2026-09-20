"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { isCanvas, openItemId } from "@/lib/diagrams";
import { pageTitle } from "@/lib/page-title";

export function PageTitle() {
  const t = useTranslations("metadata");
  const pathname = usePathname();
  const { items } = useWorkspace();

  const openId = openItemId(pathname);
  const open = openId === null ? null : items.find((item) => item.id === openId);
  const name = open !== undefined && open !== null && isCanvas(open) ? open.name : null;
  const title = pageTitle(name, t("title"));

  useEffect(() => {
    document.title = title;
  }, [title]);

  return null;
}
