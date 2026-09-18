"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useTranslations("sidebar");

  return (
    <form action="/api/logout" method="post" className="contents">
      <Button type="submit" variant="ghost" size="icon" aria-label={t("logout")}>
        <LogOut aria-hidden />
      </Button>
    </form>
  );
}
