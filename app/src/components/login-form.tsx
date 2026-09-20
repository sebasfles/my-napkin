"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signedFetch } from "@/lib/signed-fetch";

type ErrorKey = "invalidPassword" | "unexpected";

function errorKeyFor(body: unknown): ErrorKey {
  const code =
    typeof body === "object" && body !== null ? (body as { code?: unknown }).code : undefined;

  return code === "invalid_password" ? "invalidPassword" : "unexpected";
}

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await signedFetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.replace(next);
        router.refresh();
        return;
      }

      setError(errorKeyFor(await response.json().catch(() => null)));
    } catch {
      setError("unexpected");
    }

    setPending(false);
  }

  return (
    <form className="mt-6 flex flex-col gap-4" onSubmit={submit}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          {t("passwordLabel")}
        </label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          autoFocus
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : "login-error"}
        />
        {error !== null && (
          <p id="login-error" role="alert" className="text-sm text-destructive">
            {t(error)}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {t("submit")}
      </Button>
    </form>
  );
}
