"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { byUpdatedAtDesc, isDiagram } from "@/lib/diagrams";
import { Button } from "@/components/ui/button";

export function HomeRedirect() {
  const t = useTranslations("editor");
  const router = useRouter();
  const { items, loading, failed, create } = useWorkspace();
  const [createFailed, setCreateFailed] = useState(false);
  const started = useRef(false);

  const open = useCallback(async () => {
    try {
      const newest = items.filter(isDiagram).sort(byUpdatedAtDesc)[0];
      const target = newest ?? (await create(null));
      router.replace(`/d/${target.id}`);
    } catch {
      setCreateFailed(true);
    }
  }, [create, items, router]);

  useEffect(() => {
    if (loading || failed || started.current) return;
    started.current = true;
    void open();
  }, [failed, loading, open]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      {createFailed ? (
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">{t("createFailed")}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateFailed(false);
              void open();
            }}
          >
            {t("retry")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
    </div>
  );
}
