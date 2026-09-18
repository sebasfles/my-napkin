import { getTranslations } from "next-intl/server";
import { LocaleToggle } from "@/components/locale-toggle";
import { LogoutButton } from "@/components/logout-button";
import { ThemeToggle } from "@/components/theme-toggle";

export async function Sidebar() {
  const t = await getTranslations("sidebar");

  return (
    <aside
      className="flex h-full w-56 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground"
      data-testid="sidebar"
    >
      <div className="border-b border-border px-4 py-3">
        <h1 className="truncate text-sm font-semibold">{t("title")}</h1>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {t("diagrams")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground" data-testid="diagram-list-empty">
          {t("empty")}
        </p>
      </nav>

      <div className="flex items-center gap-1 border-t border-border px-2 py-2">
        <ThemeToggle />
        <LocaleToggle />
        <LogoutButton />
      </div>
    </aside>
  );
}
