import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSuperAdminToken, getCookieNames } from "@/lib/auth";

type SuperAdminRow = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  passwordHash: string;
};

async function findSuperAdminUser(username: string): Promise<SuperAdminRow | null> {
  const un = username.toLowerCase();
  if (prisma.user && typeof prisma.user.findFirst === "function") {
    const user = await prisma.user.findFirst({
      where: { username: un, tenantId: null, isSuperAdmin: true, isActive: true },
    });
    return user as SuperAdminRow | null;
  }
  const rows = await prisma.$queryRaw<SuperAdminRow[]>`
    SELECT id, email, username, "fullName", "passwordHash"
    FROM "User"
    WHERE username = ${un}
      AND "tenantId" IS NULL
      AND "isSuperAdmin" = true
      AND "isActive" = true
    LIMIT 1
  `;
  return rows[0] ?? null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const username = (body.username ?? "").toString().trim();
    const password = body.password ?? "";

    if (!username || !password) {
      return Response.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    const user = await findSuperAdminUser(username);

    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const token = await createSuperAdminToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      tenantId: null,
      tenantCode: null,
      tenantName: null,
      isSuperAdmin: true,
      permissions: [], // super admin has all
      departmentIds: [], // super admin has no tenant departments
    });

    const { SUPER_ADMIN_COOKIE } = getCookieNames();
    const cookieStore = await cookies();
    cookieStore.set(SUPER_ADMIN_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

    return Response.json({
      success: true,
      redirect: "/superadmin/dashboard",
    });
  } catch (e) {
    console.error("Super admin login:", e);
    return Response.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
