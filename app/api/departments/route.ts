import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { MasterStatus } from "@/app/generated/prisma/client";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.tenantId) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const whereClause: { tenantId: string; status?: MasterStatus; isDeleted?: boolean } = {
      tenantId: session.tenantId,
      isDeleted: false,
    };

    if (status) {
      whereClause.status = status as MasterStatus;
    }

    const departments = await prisma.department.findMany({
      where: whereClause,
      orderBy: { name: "asc" },
    });
    return Response.json({ success: true, data: departments }, { status: 200 });
  } catch (error) {
    console.error("GET /api/departments:", error);
    return Response.json(
      { success: false, error: "Failed to fetch departments" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.tenantId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const rawName = body.name;

    if (rawName == null || typeof rawName !== "string") {
      return Response.json(
        { error: "name is required" },
        { status: 400 }
      );
    }

    const name = rawName.trim();
    if (name === "") {
      return Response.json(
        { error: "name cannot be empty" },
        { status: 400 }
      );
    }

    // Generate department code from name (DEPT-UPPERCASE-NAME)
    const code = `DEPT-${name.toUpperCase().replace(/[^A-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')}`;

    const department = await prisma.department.create({
      data: { tenantId: session.tenantId, name, code },
    });
    return Response.json(department, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return Response.json(
        { error: "A department with this name already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/departments:", error);
    return Response.json(
      { error: "Failed to create department" },
      { status: 500 }
    );
  }
}
