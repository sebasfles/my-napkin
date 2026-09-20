"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { NapkinMark } from "@/components/napkin-mark";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/workspace-provider";
import { currentFolder } from "@/lib/tree";
import { useSidebarFolder } from "@/lib/use-sidebar-folder";

export function EmptyWorkspace() {
  const t = useTranslations("editor");
  const router = useRouter();
  const { items, loading, failed, create } = useWorkspace();
  const [folderId] = useSidebarFolder();
  const [creating, setCreating] = useState(false);
  const [createFailed, setCreateFailed] = useState(false);

  const ready = !loading && !failed;

  async function onCreate() {
    setCreating(true);
    setCreateFailed(false);

    try {
      const created = await create(ready ? currentFolder(items, folderId) : null);
      router.push(`/d/${created.id}`);
    } catch {
      setCreateFailed(true);
      setCreating(false);
    }
  }

  return (
    <div
      className="flex h-full w-full items-center justify-center p-6"
      data-testid="empty-workspace"
    >
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <NapkinMark className="size-6" />
        </span>

        <div className="space-y-1">
          <h2 className="font-heading text-base font-medium">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("emptyBody")}</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          data-testid="empty-new-diagram"
          disabled={loading || creating}
          onClick={onCreate}
        >
          <Plus aria-hidden />
          {t("newDiagram")}
        </Button>

        {createFailed ? (
          <p className="text-sm text-destructive" role="status">
            {t("createFailed")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
