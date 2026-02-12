import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createTenantToken, getCookieNames } from "@/lib/auth";
import { getUserPermissionCodes } from "@/lib/rbac";
import bcrypt from "bcryptjs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const tenantCode = (body.tenantCode ?? "").toString().trim().toUpperCase();
    const email = (body.email ?? body.username ?? "").toString().trim();
    const password = body.password ?? "";

    if (!tenantCode || !email || !password) {
      return Response.json(
        { error: "Tenant code, email and password are required" },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { code: tenantCode, isActive: true },
      include: { licenses: { where: { isActive: true }, orderBy: { endDate: "desc" }, take: 1 } },
    });

    if (!tenant) {
      return Response.json({ error: "Invalid tenant or tenant disabled" }, { status: 401 });
    }

    const license = tenant.licenses[0];
    if (!license || new Date(license.endDate) < new Date()) {
      return Response.json({ error: "Tenant license expired or inactive" }, { status: 403 });
    }

    const user = await prisma.user.findFirst({
      where: {
        tenantId: tenant.id,
        OR: [{ email: email.toLowerCase() }, { username: email.toLowerCase() }],
        isActive: true,
      },
      include: {
        userRoles: { include: { role: true } },
        userDepartments: {
          where: { isActive: true },
          select: { departmentId: true },
        },
      },
    });

    if (!user) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const permissions = await getUserPermissionCodes(user.id, user.tenantId!);
    const departmentIds = user.userDepartments.map((ud) => ud.departmentId);
    
    const token = await createTenantToken({
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      tenantId: user.tenantId,
      tenantCode: tenant.code,
      tenantName: tenant.name,
      isSuperAdmin: false,
      permissions,
      departmentIds,
    });

    const { COOKIE_NAME } = getCookieNames();
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return Response.json({
      success: true,
      redirect: "/dashboard",
    });
  } catch (e) {
    console.error("Tenant login:", e);
    return Response.json(
      { error: "Login failed" },
      { status: 500 }
    );
  }
}
