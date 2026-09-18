import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";

export async function LogoutButton() {
  const t = await getTranslations("sidebar");

  return (
    <form action="/api/logout" method="post" className="contents">
      <Button type="submit" variant="ghost" size="icon" aria-label={t("logout")}>
        <LogOut aria-hidden />
      </Button>
    </form>
  );
}
