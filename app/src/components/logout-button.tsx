"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";
import { loginPath } from "@/lib/gate";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const t = useTranslations("sidebar");
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace(loginPath);
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("logout")}
      onClick={handleLogout}
    >
      <LogOut aria-hidden />
    </Button>
  );
}
