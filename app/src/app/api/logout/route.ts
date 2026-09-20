import { NextResponse, type NextRequest } from "next/server";
import { loginPath } from "@/lib/gate";
import { sessionCookieName, sessionCookieOptions } from "@/lib/session";

export function POST(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = loginPath;
  url.search = "";

  const response = NextResponse.redirect(url, 303);
  response.cookies.set(sessionCookieName, "", { ...sessionCookieOptions(), maxAge: 0 });

  return response;
}
