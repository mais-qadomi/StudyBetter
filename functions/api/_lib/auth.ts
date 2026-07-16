import { SignJWT, jwtVerify } from "jose";
import type { AuthUser } from "./db";

const COOKIE_NAME = "sb_token";

export function signToken(user: AuthUser, secret: string, rememberMe = false): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(rememberMe ? "30d" : "7d")
    .sign(key);
}

export async function verifyToken(token: string, secret: string): Promise<AuthUser | null> {
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key);
    return {
      id: payload.id as string,
      name: payload.name as string,
      email: payload.email as string,
      avatarUrl: payload.avatarUrl as string | null,
    };
  } catch {
    return null;
  }
}

export function extractToken(request: Request): string | null {
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

export function setAuthCookie(token: string, rememberMe = false): string {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

export function clearAuthCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export async function hashPasswordPBKDF2(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const hash = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt,
      iterations: 100000,
    },
    keyMaterial,
    256,
  );
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `pbkdf2:100000:${saltB64}:${hashB64}`;
}

export async function comparePasswordPBKDF2(plain: string, stored: string): Promise<boolean | null> {
  if (stored.startsWith("pbkdf2:")) {
    const [, iterations, saltB64, hashB64] = stored.split(":");
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const expectedHash = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(plain),
      { name: "PBKDF2" },
      false,
      ["deriveBits"],
    );
    const hash = await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations: parseInt(iterations),
      },
      keyMaterial,
      256,
    );
    const hashArray = new Uint8Array(hash);
    return hashArray.every((v, i) => v === expectedHash[i]);
  }
  // Not a PBKDF2 hash (likely bcrypt) — cannot verify in Workers
  return null;
}
