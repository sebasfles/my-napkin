import { describe, expect, it } from "vitest";
import {
  createSessionToken,
  matchesPassword,
  readSessionToken,
  sessionMaxAgeSeconds,
} from "@/lib/session";

const secret = "unit-test-signing-secret";
const now = Date.UTC(2026, 8, 18, 12, 0, 0);

function tamper(token: string, payload: object): string {
  const signature = token.split(".")[1];
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encoded}.${signature}`;
}

describe("session tokens", () => {
  it("reads back the session it signed", async () => {
    const token = await createSessionToken(secret, now);

    expect(await readSessionToken(token, secret, now)).toEqual({
      issuedAt: now,
      expiresAt: now + sessionMaxAgeSeconds * 1000,
    });
  });

  it("lasts thirty days and not a moment longer", async () => {
    const token = await createSessionToken(secret, now);
    const thirtyDays = sessionMaxAgeSeconds * 1000;

    expect(await readSessionToken(token, secret, now + thirtyDays - 1000)).not.toBeNull();
    expect(await readSessionToken(token, secret, now + thirtyDays)).toBeNull();
    expect(await readSessionToken(token, secret, now + thirtyDays + 1000)).toBeNull();
  });

  it("rejects a token signed with another secret", async () => {
    const token = await createSessionToken(secret, now);

    expect(await readSessionToken(token, "another-secret", now)).toBeNull();
  });

  it("rejects a payload swapped for a longer-lived one", async () => {
    const token = await createSessionToken(secret, now);
    const forged = tamper(token, { issuedAt: now, expiresAt: now + 10 * 365 * 24 * 3600 * 1000 });

    expect(forged).not.toBe(token);
    expect(await readSessionToken(forged, secret, now)).toBeNull();
  });

  it("rejects a flipped character in the signature", async () => {
    const token = await createSessionToken(secret, now);
    const [payload, signature] = token.split(".");
    const flipped = `${signature[0] === "a" ? "b" : "a"}${signature.slice(1)}`;

    expect(await readSessionToken(`${payload}.${flipped}`, secret, now)).toBeNull();
  });

  it("rejects tokens that are not two signed parts", async () => {
    const token = await createSessionToken(secret, now);

    for (const malformed of [
      undefined,
      "",
      "x",
      token.replace(".", ""),
      `${token}.extra`,
      "..",
      "a.b",
    ]) {
      expect(await readSessionToken(malformed, secret, now), malformed).toBeNull();
    }
  });

  it("rejects a signed payload that is not a session", async () => {
    const token = await createSessionToken(secret, now);

    expect(await readSessionToken(tamper(token, { issuedAt: now }), secret, now)).toBeNull();
  });
});

describe("matchesPassword", () => {
  it("accepts only the exact password", async () => {
    expect(await matchesPassword("correct horse", "correct horse")).toBe(true);
    expect(await matchesPassword("correct hors", "correct horse")).toBe(false);
    expect(await matchesPassword("Correct horse", "correct horse")).toBe(false);
    expect(await matchesPassword("", "correct horse")).toBe(false);
    expect(await matchesPassword("correct horse ", "correct horse")).toBe(false);
  });
});
