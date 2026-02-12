import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Authentication required", errorCode: "AUTH_REQUIRED" },
        { status: 401 }
      );
    }

    requirePermission(session, "APPOINTMENT_VIEW");

    const { id: departmentId } = await params;

    console.log("[Department Doctors] Fetching doctors for department:", departmentId);

    // Verify department exists in tenant
    const department = await prisma.department.findFirst({
      where: {
        id: departmentId,
        tenantId: session.tenantId,
        status: "ACTIVE",
        isDeleted: false,
      },
    });

    if (!department) {
      return NextResponse.json(
        { success: false, message: "Department not found" },
        { status: 404 }
      );
    }

    // Get doctors assigned to this department
    const userDepartments = await prisma.userDepartment.findMany({
      where: {
        tenantId: session.tenantId,
        departmentId,
        isActive: true,
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            isActive: true,
          },
        },
      },
    });

    const doctors = userDepartments
      .filter((ud) => ud.user.isActive)
      .map((ud) => ({
        id: ud.user.id,
        userId: ud.user.id,
        fullName: ud.user.fullName,
        email: ud.user.email,
      }));

    console.log(
      "[Department Doctors] Found",
      doctors.length,
      "doctors for department",
      departmentId
    );

    return NextResponse.json({
      success: true,
      data: {
        departmentId,
        departmentName: department.name,
        doctors,
      },
    });
  } catch (error) {
    console.error("[Department Doctors] Error:", error);

    if (error instanceof Error && error.message.includes("Permission denied")) {
      return NextResponse.json(
        { success: false, message: "Permission denied", errorCode: "PERMISSION_DENIED" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { success: false, message: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
