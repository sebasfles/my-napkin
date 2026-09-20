export const loginPath = "/login";
export const loginApiPath = "/api/login";

const publicPrefixes = ["/_next/", "/static/"];
const publicPaths = new Set([loginPath, loginApiPath, "/favicon.ico"]);
const rootFile = /^\/[^/]+\.[^/]+$/;

export function isPublicPath(pathname: string): boolean {
  if (publicPaths.has(pathname)) return true;
  if (publicPrefixes.some((prefix) => pathname.startsWith(prefix))) return true;

  return rootFile.test(pathname);
}

export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }

  return false;
}

export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  if (hasControlCharacter(value)) return "/";

  return value;
}
