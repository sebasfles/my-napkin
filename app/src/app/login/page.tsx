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
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-6 text-card-foreground">
        <h1 className="text-lg font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        <LoginForm next={safeNextPath(Array.isArray(next) ? next[0] : next)} />
      </div>
    </main>
  );
}
