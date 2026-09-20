import { PenLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "@/components/login-form";
import { safeNextPath } from "@/lib/gate";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("login");

  return (
    <main className="flex h-dvh w-full items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"
          >
            <PenLine className="size-5" />
          </span>
          <h1 className="font-heading text-xl font-semibold tracking-tight">{t("title")}</h1>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-card p-6 text-card-foreground">
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          <LoginForm next={safeNextPath(Array.isArray(next) ? next[0] : next)} />
        </div>
      </div>
    </main>
  );
}
