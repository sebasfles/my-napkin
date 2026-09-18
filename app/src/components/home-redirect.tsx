"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDiagrams } from "@/components/diagrams-provider";
import { Button } from "@/components/ui/button";

export function HomeRedirect() {
  const t = useTranslations("editor");
  const router = useRouter();
  const { diagrams, loading, failed, create } = useDiagrams();
  const [createFailed, setCreateFailed] = useState(false);
  const started = useRef(false);

  const open = useCallback(async () => {
    try {
      const target = diagrams[0] ?? (await create());
      router.replace(`/d/${target.id}`);
    } catch {
      setCreateFailed(true);
    }
  }, [create, diagrams, router]);

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
