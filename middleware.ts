import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SUPER_ADMIN_COOKIE = "hms_superadmin_session";
const COOKIE_NAME = "hms_session";

const publicPaths = [
  "/login",
  "/superadmin/login",
  "/api/auth/login",
  "/api/auth/superadmin/login",
];

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

async function getPayload(token: string) {
  try {
    const secret = getJwtSecret();
    if (!secret) return null;
    const { payload } = await jwtVerify(token, secret);
    return payload as { isSuperAdmin?: boolean; userId: string; tenantId?: string | null };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (publicPaths.some((p) => pathname === p || pathname.startsWith("/api/auth/"))) {
    return NextResponse.next();
  }

  const superToken = request.cookies.get(SUPER_ADMIN_COOKIE)?.value;
  const tenantToken = request.cookies.get(COOKIE_NAME)?.value;
  const token = superToken ?? tenantToken;

  if (!token) {
    if (pathname.startsWith("/superadmin")) {
      return NextResponse.redirect(new URL("/superadmin/login", request.url));
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const payload = await getPayload(token);
  if (!payload) {
    const res = pathname.startsWith("/superadmin")
      ? NextResponse.redirect(new URL("/superadmin/login", request.url))
      : NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete(COOKIE_NAME);
    res.cookies.delete(SUPER_ADMIN_COOKIE);
    return res;
  }

  if (pathname.startsWith("/superadmin")) {
    if (!payload.isSuperAdmin) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/admin") || pathname === "/dashboard" || pathname === "/departments") {
    if (payload.isSuperAdmin) {
      return NextResponse.redirect(new URL("/superadmin/dashboard", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

// Protect all tenant and superadmin routes
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/patients/:path*',
    '/medical-masters/:path*',
    '/admin/:path*',
    '/consultation/:path*',
    '/consultations/:path*',
    '/appointments/:path*',
    '/vitals/:path*',
    '/visits/:path*',
    '/prescriptions/:path*',
    '/doctor/:path*',
    '/superadmin/:path*',
  ],
};
