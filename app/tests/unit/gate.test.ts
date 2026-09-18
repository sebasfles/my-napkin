import { describe, expect, it } from "vitest";
import { isApiPath, isPublicPath, safeNextPath } from "@/lib/gate";

describe("isPublicPath", () => {
  it("lets the login page and its route through", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/login")).toBe(true);
  });

  it("lets static assets and public files through", () => {
    expect(isPublicPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isPublicPath("/_next/image")).toBe(true);
    expect(isPublicPath("/favicon.ico")).toBe(true);
    expect(isPublicPath("/robots.txt")).toBe(true);
  });

  it("protects everything else", () => {
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/d/anything")).toBe(false);
    expect(isPublicPath("/api/diagrams")).toBe(false);
    expect(isPublicPath("/api/logout")).toBe(false);
  });

  it("never exempts a path that only starts like an allowed one", () => {
    expect(isPublicPath("/loginx")).toBe(false);
    expect(isPublicPath("/login/secret")).toBe(false);
    expect(isPublicPath("/api/loginx")).toBe(false);
    expect(isPublicPath("/api/login/secret")).toBe(false);
    expect(isPublicPath("/_nextish/thing")).toBe(false);
    expect(isPublicPath("/d/anything.png")).toBe(false);
  });
});

describe("isApiPath", () => {
  it("covers the api tree and nothing that merely starts like it", () => {
    expect(isApiPath("/api")).toBe(true);
    expect(isApiPath("/api/diagrams")).toBe(true);
    expect(isApiPath("/apiary")).toBe(false);
    expect(isApiPath("/d/api")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a same-origin path", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/d/abc123")).toBe("/d/abc123");
    expect(safeNextPath("/d/abc123?panel=open")).toBe("/d/abc123?panel=open");
  });

  it("falls back to the root when there is nothing to go back to", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath("")).toBe("/");
  });

  it("refuses to send the browser off this origin", () => {
    expect(safeNextPath("//evil.example.com")).toBe("/");
    expect(safeNextPath("//evil.example.com/steal")).toBe("/");
    expect(safeNextPath("/\\evil.example.com")).toBe("/");
    expect(safeNextPath("https://evil.example.com")).toBe("/");
    expect(safeNextPath("http://evil.example.com")).toBe("/");
    expect(safeNextPath("javascript:alert(1)")).toBe("/");
    expect(safeNextPath("d/abc123")).toBe("/");
  });

  it("refuses a path carrying control characters", () => {
    expect(safeNextPath("/d/abc\nSet-Cookie: x=1")).toBe("/");
    expect(safeNextPath("/d/abc\r\n")).toBe("/");
  });
});
