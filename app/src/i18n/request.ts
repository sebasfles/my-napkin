import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { localeCookie, resolveLocale } from "./locales";

export default getRequestConfig(async () => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const locale = resolveLocale(
    cookieStore.get(localeCookie)?.value,
    headerList.get("accept-language"),
  );

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
