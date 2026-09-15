import { getServerSecret } from "../../config/server";

const SESSION_COOKIE = "shagoon_admin_session";
const SESSION_DURATION_SECONDS = 8 * 60 * 60;

type AuthEnvironmentName = "ADMIN_PIN" | "SESSION_SECRET";

export class AuthConfigurationError extends Error {
  constructor(name: AuthEnvironmentName) {
    super(`Missing required server environment variable: ${name}`);
    this.name = "AuthConfigurationError";
  }
}

function getRequiredSecret(
  name: AuthEnvironmentName,
): string {
  try {
    return getServerSecret(name);
  } catch {
    throw new AuthConfigurationError(name);
  }
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string, sessionSecret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value),
  );

  return bytesToHex(new Uint8Array(signature));
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let index = 0; index < left.length; index++) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return difference === 0;
}

export async function verifyAdminPin(
  pin: string,
): Promise<boolean> {
  return constantTimeEqual(pin, getRequiredSecret("ADMIN_PIN"));
}

export async function createSessionToken(): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
  const payload = String(expiresAt);
  const signature = await sign(
    payload,
    getRequiredSecret("SESSION_SECRET"),
  );

  return `${payload}.${signature}`;
}

export async function isValidSessionToken(
  token?: string,
): Promise<boolean> {
  if (!token) return false;

  const [expiresAtText, providedSignature, ...extraParts] = token.split(".");
  if (!expiresAtText || !providedSignature || extraParts.length > 0) return false;

  const expiresAt = Number(expiresAtText);
  if (!Number.isInteger(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expectedSignature = await sign(
    expiresAtText,
    getRequiredSecret("SESSION_SECRET"),
  );
  return constantTimeEqual(providedSignature, expectedSignature);
}

export const adminSessionCookie = {
  name: SESSION_COOKIE,
  maxAge: SESSION_DURATION_SECONDS,
  options: {
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "strict" as const,
    path: "/",
  },
};
