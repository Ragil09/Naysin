import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import { prisma } from "@/backend/db";

const SECRET_KEY = process.env.AUTH_SECRET || "fallback_naysin_dev_secret_key_32_characters_minimum";
const encodedKey = new TextEncoder().encode(SECRET_KEY);
// Cookie name changed once to invalidate sessions created before username-based login.
export const SESSION_COOKIE = "naysin_username_session";

export interface SessionPayload {
  userId: string;
  name: string;
  username: string;
  role: Role;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload, version: 2 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(encodedKey);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    if (payload.version !== 2 || typeof payload.userId !== "string" || typeof payload.username !== "string") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  // Check active status and current role on every request; old JWT claims cannot elevate access.
  const account = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, username: true, role: true, isActive: true } });
  if (!account?.isActive || !account.username) return null;
  return { userId: account.id, name: account.name, username: account.username, role: account.role };
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    // Browser-session cookie. Restarting dev server does not close the browser session.
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  cookieStore.delete("naysin_session");
}
