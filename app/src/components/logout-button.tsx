"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";
import { loginPath } from "@/lib/gate";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function LogoutButton() {
  const t = useTranslations("sidebar");
  const router = useRouter();

  async function handleLogout() {
    try {
      await logout();
    } catch (error) {
      console.error(error);
    }

    router.replace(loginPath);
    router.refresh();
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("logout")}
          onClick={handleLogout}
        >
          <LogOut aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("logout")}</TooltipContent>
    </Tooltip>
  );
}
