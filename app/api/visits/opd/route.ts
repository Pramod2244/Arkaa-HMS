import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getOPDVisits, getDoctorOPDQueue, getUserDepartments } from "@/lib/services/visits";

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

    // Fetch data based on request type
    let result;
    if (doctorQueue) {
      // Doctor's OPD queue
      result = await getDoctorOPDQueue(session.tenantId, session.userId, {
        departmentIds: departmentId ? [departmentId] : userDeptIds,
        page: validPage,
        limit: validLimit,
      });
    } else {
      // Reception/Admin OPD dashboard
      result = await getOPDVisits(session.tenantId, userDeptIds, {
        page: validPage,
        limit: validLimit,
        departmentId,
        status,
      });
    }

    return Response.json({
      success: true,
      data: {
        visits: result.visits,
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
