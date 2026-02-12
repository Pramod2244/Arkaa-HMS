import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SALT_ROUNDS = 12;
const COOKIE_NAME = "hms_session";
const SUPER_ADMIN_COOKIE = "hms_superadmin_session";

export type SessionPayload = {
  userId: string;
  email: string;
  username: string;
  fullName: string;
  tenantId: string | null;
  tenantCode: string | null;
  tenantName: string | null;
  isSuperAdmin: boolean;
  permissions: string[];
  departmentIds: string[]; // User's assigned departments
  exp: number;
  iat: number;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set and at least 32 characters");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSuperAdminToken(payload: Omit<SessionPayload, "exp" | "iat">): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT({ ...payload, isSuperAdmin: true })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function createTenantToken(payload: Omit<SessionPayload, "exp" | "iat">): Promise<string> {
  const secret = getJwtSecret();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const tenantToken = cookieStore.get(COOKIE_NAME)?.value;
  const superToken = cookieStore.get(SUPER_ADMIN_COOKIE)?.value;
  const token = superToken ?? tenantToken;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Get session from a NextRequest object
 * Used in API routes where cookies() is not available directly
 */
export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const tenantToken = request.cookies.get(COOKIE_NAME)?.value;
  const superToken = request.cookies.get(SUPER_ADMIN_COOKIE)?.value;
  const token = superToken ?? tenantToken;
  if (!token) return null;
  return verifyToken(token);
}

export function getCookieNames() {
  return { COOKIE_NAME, SUPER_ADMIN_COOKIE };
}
