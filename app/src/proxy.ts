import { NextResponse, type NextRequest } from "next/server";
import { sessionSecret } from "@/lib/env";
import { isApiPath, isPublicPath, loginPath } from "@/lib/gate";
import { readSessionToken, sessionCookieName } from "@/lib/session";

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const token = request.cookies.get(sessionCookieName)?.value;
  const session = await readSessionToken(token, sessionSecret());
  if (session) return NextResponse.next();

  if (isApiPath(pathname)) {
    return NextResponse.json({ code: "unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = "";
  url.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(url);
}
