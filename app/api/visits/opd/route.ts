import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserDepartments } from "@/lib/services/visits";
import { getOPDQueueFromSnapshot } from "@/lib/services/opd-queue-snapshot";

/**
 * GET /api/visits/opd?departmentId=...&status=...&page=1&limit=20&doctorQueue=false
 * 
 * Query Parameters:
 * - departmentId: Filter by specific department (optional)
 * - status: WAITING, IN_PROGRESS, COMPLETED (optional, defaults to WAITING,IN_PROGRESS)
 * - page: Page number (default 1)
 * - limit: Items per page (default 20)
 * - doctorQueue: If true, shows doctor's OPD queue (doctor-specific)
 * 
 * Security:
 * - User must have OPD_VIEW permission
 * - Returns only visits for user's assigned departments
 * - If doctorQueue=true, filters by logged-in doctor's ID
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !session.tenantId) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permission
    if (!session.permissions.includes("OPD_VIEW")) {
      return Response.json(
        { error: "Permission denied. OPD_VIEW required" },
        { status: 403 }
      );
    }

    // Get user's assigned departments
    const userDepts = await getUserDepartments(session.userId, session.tenantId);
    const userDeptIds = userDepts.map((d) => d.id);

    if (userDeptIds.length === 0) {
      return Response.json(
        {
          success: true,
          data: {
            visits: [],
            departments: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
          },
          message: "No departments assigned",
        }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const departmentId = searchParams.get("departmentId") || undefined;
    const status = (searchParams.get("status") || undefined) as
      | "WAITING"
      | "IN_PROGRESS"
      | "COMPLETED"
      | undefined;
    const doctorQueue = searchParams.get("doctorQueue") === "true";

    // Validate pagination
    const validPage = Math.max(1, page);
    const validLimit = Math.min(Math.max(1, limit), 100); // Max 100 per page

    // Security: Verify department access if filtering by department
    if (departmentId && !userDeptIds.includes(departmentId)) {
      return Response.json(
        {
          error: "Access denied. Department not assigned to you",
          code: "DEPT_ACCESS_DENIED",
        },
        { status: 403 }
      );
    }

    // Fetch data from READ MODEL (OPDQueueSnapshot)
    // This is significantly faster than querying the transactional Visit table with JOINs
    const result = await getOPDQueueFromSnapshot(session.tenantId, {
      departmentIds: departmentId ? [departmentId] : userDeptIds,
      doctorId: doctorQueue ? session.userId : undefined,
      status: status,
      page: validPage,
      limit: validLimit,
    });

    // Map snapshot items back to the structure expected by the UI
    const mappedVisits = result.items.map(item => {
      // Split patient name back into first and last if possible
      const nameParts = item.patientName.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      return {
        id: item.visitId,
        visitNumber: item.visitNumber,
        status: item.status,
        priority: item.priority,
        checkInTime: item.checkInTime.toISOString(),
        patient: {
          id: item.patientId,
          uhid: item.patientUhid,
          firstName,
          lastName,
          dateOfBirth: item.patientDob?.toISOString() || '',
          gender: item.patientGender || 'OTHER',
          phoneNumber: item.patientPhone || '',
        },
        doctor: item.doctorId ? {
          id: item.doctorId,
          fullName: item.doctorName || 'Unknown Doctor',
        } : null,
        department: {
          id: item.departmentId,
          name: item.departmentName,
        },
        appointment: item.tokenNumber ? {
          tokenNumber: item.tokenNumber,
          appointmentDate: item.checkInTime.toISOString(),
          appointmentTime: '',
        } : null,
      };
    });

    return Response.json({
      success: true,
      data: {
        visits: mappedVisits,
        departments: userDepts,
        pagination: result.pagination,
      },
      mode: doctorQueue ? "doctor_queue" : "opd_dashboard",
    });
  } catch (error) {
    console.error("Get OPD visits error:", error);
    return Response.json(
      { error: "Failed to fetch OPD visits" },
      { status: 500 }
    );
  }
}
