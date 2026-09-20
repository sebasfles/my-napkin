export const sessionCookieName = "napkin_session";
export const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

export type Session = { issuedAt: number; expiresAt: number };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    path: "/",
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
  if (value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;

  const padded = value
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  try {
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function parseSession(json: string): Session | null {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;
  const { issuedAt, expiresAt } = value as Record<string, unknown>;
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt)) return null;

  return { issuedAt: issuedAt as number, expiresAt: expiresAt as number };
}

export async function createSessionToken(
  secret: string,
  now: number = Date.now(),
): Promise<string> {
  const session: Session = { issuedAt: now, expiresAt: now + sessionMaxAgeSeconds * 1000 };
  const payload = toBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(payload),
  );

  return `${payload}.${toBase64Url(new Uint8Array(signature))}`;
}

export async function readSessionToken(
  token: string | undefined,
  secret: string,
  now: number = Date.now(),
): Promise<Session | null> {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const signatureBytes = fromBase64Url(signature);
  const payloadBytes = fromBase64Url(payload);
  if (!signatureBytes || !payloadBytes) return null;

  const signed = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signatureBytes,
    encoder.encode(payload),
  );
  if (!signed) return null;

  const session = parseSession(decoder.decode(payloadBytes));
  if (!session) return null;

  return session.expiresAt > now ? session : null;
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a[index] ^ b[index];

  return difference === 0;
}

export async function matchesPassword(candidate: string, expected: string): Promise<boolean> {
  const [candidateDigest, expectedDigest] = await Promise.all([
    sha256(candidate),
    sha256(expected),
  ]);

  return constantTimeEqual(candidateDigest, expectedDigest);
}
