import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createOPDVisit, getUserDepartments } from "@/lib/services/visits";
import { z } from "zod";

const CreateOPDVisitSchema = z.object({
  patientId: z.string().min(1, "Patient ID required"),
  departmentId: z.string().min(1, "Department ID required"),
  doctorId: z.string().optional(),
  appointmentId: z.string().optional(),
  priority: z.enum(["EMERGENCY", "URGENT", "NORMAL", "LOW"]).default("NORMAL"),
  notes: z.string().optional(),
});

type CreateOPDVisitRequest = z.infer<typeof CreateOPDVisitSchema>;

/**
 * POST /api/visits/opd/create
 * Create OPD visit with department validation
 * 
 * Security:
 * - User must have OPD_CREATE permission
 * - Department must be in user's assigned departments
 * - Doctor (if assigned) must belong to the department
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.tenantId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    if (!session.permissions.includes("OPD_CREATE")) {
      return Response.json(
        { error: "Permission denied. OPD_CREATE required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = CreateOPDVisitSchema.parse(body);

    // Get user's departments
    const userDepts = await getUserDepartments(session.userId, session.tenantId);
    const userDeptIds = userDepts.map((d) => d.id);

    // Verify department access: user cannot create visit in department not assigned to them
    if (!userDeptIds.includes(validated.departmentId)) {
      return Response.json(
        { 
          error: "Access denied. You are not assigned to this department",
          code: "DEPT_ACCESS_DENIED"
        },
        { status: 403 }
      );
    }

    // Create OPD visit
    const visit = await createOPDVisit(
      {
        patientId: validated.patientId,
        departmentId: validated.departmentId,
        doctorId: validated.doctorId,
        appointmentId: validated.appointmentId,
        priority: validated.priority,
        notes: validated.notes,
      },
      session.tenantId,
      session.userId
    );

    return Response.json({
      success: true,
      data: visit,
      message: "OPD visit created successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      return Response.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error("Create OPD visit error:", error);
    return Response.json(
      { error: "Failed to create OPD visit" },
      { status: 500 }
    );
  }
}
