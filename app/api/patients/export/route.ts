import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date | null | undefined): string {
  if (!date) return "";
  return new Date(date).toISOString().split("T")[0];
}

// Helper to format blood group
function formatBloodGroup(bg: string | null | undefined): string {
  if (!bg) return "";
  const map: Record<string, string> = {
    A_POSITIVE: "A+",
    A_NEGATIVE: "A-",
    B_POSITIVE: "B+",
    B_NEGATIVE: "B-",
    AB_POSITIVE: "AB+",
    AB_NEGATIVE: "AB-",
    O_POSITIVE: "O+",
    O_NEGATIVE: "O-",
  };
  return map[bg] || bg;
}

// Helper to format title code
function formatTitle(code: number | null | undefined): string {
  if (!code) return "";
  const map: Record<number, string> = {
    1: "Mr.",
    2: "Mrs.",
    3: "Ms.",
    4: "Master",
    5: "Baby",
    6: "Dr.",
  };
  return map[code] || "";
}

// CSV escape helper
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.tenantId) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check permission
    const permissions = session.permissions || [];
    if (!permissions.includes("PATIENT_EXPORT") && !permissions.includes("ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Permission denied" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { format = "csv", patientIds, filters } = body;

    // Build query
    const where: Record<string, unknown> = {
      tenantId: session.tenantId,
    };

    // If specific patient IDs provided
    if (patientIds && patientIds.length > 0) {
      where.id = { in: patientIds };
    }

    // If filters provided
    if (filters) {
      if (filters.status) {
        where.status = filters.status;
      }
      if (filters.search) {
        where.OR = [
          { uhid: { contains: filters.search, mode: "insensitive" } },
          { firstName: { contains: filters.search, mode: "insensitive" } },
          { lastName: { contains: filters.search, mode: "insensitive" } },
          { phoneNumber: { contains: filters.search } },
        ];
      }
      if (filters.fromDate) {
        where.createdAt = { gte: new Date(filters.fromDate) };
      }
      if (filters.toDate) {
        where.createdAt = {
          ...((where.createdAt as object) || {}),
          lte: new Date(filters.toDate),
        };
      }
    }

    // Fetch patients
    const patients = await prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    if (format === "csv") {
      // Generate CSV
      const headers = [
        "UHID",
        "First Name",
        "Last Name",
        "Date of Birth",
        "Gender",
        "Blood Group",
        "Mobile",
        "Email",
        "Address",
        "Status",
        "Created At",
      ];

      const rows = patients.map((patient) => {
        return [
          escapeCSV(patient.uhid),
          escapeCSV(patient.firstName),
          escapeCSV(patient.lastName),
          escapeCSV(formatDate(patient.dateOfBirth)),
          escapeCSV(patient.gender),
          escapeCSV(formatBloodGroup(patient.bloodGroup)),
          escapeCSV(patient.phoneNumber),
          escapeCSV(patient.email),
          escapeCSV(patient.address),
          escapeCSV(patient.status),
          escapeCSV(formatDate(patient.createdAt)),
        ].join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="patients_export_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    } else if (format === "xlsx") {
      // For XLSX format, return JSON that will be converted to XLSX on client
      // This avoids needing xlsx library on server
      const data = patients.map((patient) => {
        return {
          UHID: patient.uhid,
          "First Name": patient.firstName,
          "Last Name": patient.lastName || "",
          "Date of Birth": formatDate(patient.dateOfBirth),
          Gender: patient.gender,
          "Blood Group": formatBloodGroup(patient.bloodGroup),
          Mobile: patient.phoneNumber || "",
          Email: patient.email || "",
          Address: patient.address || "",
          Status: patient.status,
          "Created At": formatDate(patient.createdAt),
        };
      });

      return NextResponse.json({
        success: true,
        data,
        message: `Exported ${patients.length} patients`,
      });
    }

    return NextResponse.json(
      { success: false, message: "Invalid format. Use 'csv' or 'xlsx'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to export patients" },
      { status: 500 }
    );
  }
}
