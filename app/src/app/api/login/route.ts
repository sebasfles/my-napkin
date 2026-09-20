import { NextResponse, type NextRequest } from "next/server";
import { appPassword, sessionSecret } from "@/lib/env";
import {
  createSessionToken,
  matchesPassword,
  sessionCookieName,
  sessionCookieOptions,
  sessionMaxAgeSeconds,
} from "@/lib/session";

const failureDelayMs = 500;

async function readPassword(request: NextRequest): Promise<string | null> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return null;
  }

  if (typeof body !== "object" || body === null) return null;
  const { password } = body as Record<string, unknown>;

  return typeof password === "string" ? password : null;
}

export async function POST(request: NextRequest) {
  const expected = appPassword();
  const secret = sessionSecret();
  const password = await readPassword(request);

  if (password === null || !(await matchesPassword(password, expected))) {
    await new Promise((resolve) => setTimeout(resolve, failureDelayMs));
    return NextResponse.json({ code: "invalid_password" }, { status: 401 });
  }

  const response = NextResponse.json({ code: "ok" });
  response.cookies.set(sessionCookieName, await createSessionToken(secret), {
    ...sessionCookieOptions(),
    maxAge: sessionMaxAgeSeconds,
  });

  return response;
}
