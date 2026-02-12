import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session?.tenantId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (body.name !== undefined) {
      if (typeof body.name !== "string") {
        return Response.json(
          { error: "name must be a string" },
          { status: 400 }
        );
      }
      const trimmed = body.name.trim();
      if (trimmed === "") {
        return Response.json(
          { error: "name cannot be empty" },
          { status: 400 }
        );
      }
      body.name = trimmed;
    }

    if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
      return Response.json(
        { error: "isActive must be a boolean" },
        { status: 400 }
      );
    }

    const department = await prisma.department.update({
      where: { id, tenantId: session.tenantId },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });
    return Response.json(department, { status: 200 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Department not found" }, { status: 404 });
    }
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
    console.error("PUT /api/departments/[id]:", error);
    return Response.json(
      { error: "Failed to update department" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const session = await getSession();
  if (!session?.tenantId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await context.params;

    await prisma.department.delete({
      where: { id, tenantId: session.tenantId },
    });
    return new Response(null, { status: 204 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2025"
    ) {
      return Response.json({ error: "Department not found" }, { status: 404 });
    }
    console.error("DELETE /api/departments/[id]:", error);
    return Response.json(
      { error: "Failed to delete department" },
      { status: 500 }
    );
  }
}
