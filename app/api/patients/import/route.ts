import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { generateUHID } from "@/lib/patient-utils";
import { createAuditLog } from "@/lib/audit";

// Parse blood group from various formats
function parseBloodGroup(value: string): string | null {
  if (!value) return null;
  const normalized = value.toUpperCase().replace(/\s+/g, "");
  const map: Record<string, string> = {
    "A+": "A_POSITIVE",
    "A-": "A_NEGATIVE",
    "B+": "B_POSITIVE",
    "B-": "B_NEGATIVE",
    "AB+": "AB_POSITIVE",
    "AB-": "AB_NEGATIVE",
    "O+": "O_POSITIVE",
    "O-": "O_NEGATIVE",
    A_POSITIVE: "A_POSITIVE",
    A_NEGATIVE: "A_NEGATIVE",
    B_POSITIVE: "B_POSITIVE",
    B_NEGATIVE: "B_NEGATIVE",
    AB_POSITIVE: "AB_POSITIVE",
    AB_NEGATIVE: "AB_NEGATIVE",
    O_POSITIVE: "O_POSITIVE",
    O_NEGATIVE: "O_NEGATIVE",
  };
  return map[normalized] || null;
}

// Parse title to title code
// Parse gender
function parseGender(value: string): "MALE" | "FEMALE" | "OTHER" | null {
  if (!value) return null;
  const normalized = value.toUpperCase().trim();
  if (normalized.startsWith("M") && !normalized.includes("MS")) return "MALE";
  if (normalized.startsWith("F")) return "FEMALE";
  if (normalized === "OTHER" || normalized === "O") return "OTHER";
  return null;
}

// Parse date from various formats
function parseDate(value: string): Date | null {
  if (!value) return null;
  try {
    // Try ISO format first (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return new Date(value);
    }
    // Try DD/MM/YYYY or DD-MM-YYYY
    if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(value)) {
      const [day, month, year] = value.split(/[/-]/);
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    // Try MM/DD/YYYY
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return new Date(value);
    }
    return null;
  } catch {
    return null;
  }
}

// Parse CSV row
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    const nextChar = row[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current.trim());
  return result;
}

interface ImportResult {
  row: number;
  uhid?: string;
  status: "success" | "error";
  message: string;
  data?: Record<string, unknown>;
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
    if (!permissions.includes("PATIENT_IMPORT") && !permissions.includes("ADMIN")) {
      return NextResponse.json(
        { success: false, message: "Permission denied" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { success: false, message: "No file provided" },
        { status: 400 }
      );
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xls") && !fileName.endsWith(".xlsx")) {
      return NextResponse.json(
        { success: false, message: "Invalid file type. Please upload CSV or Excel file." },
        { status: 400 }
      );
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: "File size exceeds 5MB limit" },
        { status: 400 }
      );
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());

    if (lines.length < 2) {
      return NextResponse.json(
        { success: false, message: "File is empty or has no data rows" },
        { status: 400 }
      );
    }

    // Parse header row
    const headers = parseCSVRow(lines[0]).map((h) =>
      h.toLowerCase().replace(/\s+/g, "_").replace(/[()]/g, "")
    );

    // Map headers to expected field names
    const headerMap: Record<string, string> = {
      first_name: "firstName",
      firstname: "firstName",
      first: "firstName",
      middle_name: "middleName",
      middlename: "middleName",
      middle: "middleName",
      last_name: "lastName",
      lastname: "lastName",
      last: "lastName",
      surname: "lastName",
      date_of_birth: "dateOfBirth",
      dateofbirth: "dateOfBirth",
      dob: "dateOfBirth",
      birth_date: "dateOfBirth",
      gender: "gender",
      sex: "gender",
      blood_group: "bloodGroup",
      bloodgroup: "bloodGroup",
      blood: "bloodGroup",
      mobile: "mobile",
      phone: "mobile",
      mobile_number: "mobile",
      mobile_no: "mobile",
      contact: "mobile",
      email: "email",
      email_address: "email",
      address: "address",
      street: "address",
      city: "city",
      state: "state",
      pincode: "pincode",
      zip: "pincode",
      postal_code: "pincode",
      id_type: "idType",
      idtype: "idType",
      id_number: "idNumber",
      idnumber: "idNumber",
      title: "title",
      age_years: "ageYears",
      age: "ageYears",
      age_months: "ageMonths",
      age_days: "ageDays",
    };

    // Find column indices
    const fieldIndices: Record<string, number> = {};
    headers.forEach((header, index) => {
      const mappedField = headerMap[header];
      if (mappedField) {
        fieldIndices[mappedField] = index;
      }
    });

    // Validate required fields
    if (fieldIndices.firstName === undefined) {
      return NextResponse.json(
        { success: false, message: "Missing required column: First Name (firstName)" },
        { status: 400 }
      );
    }

    // Process data rows
    const results: ImportResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVRow(lines[i]);

      // Skip empty rows
      if (values.every((v) => !v.trim())) continue;

      const getValue = (field: string): string => {
        const index = fieldIndices[field];
        return index !== undefined ? (values[index] || "").trim() : "";
      };

      try {
        // Extract and validate fields
        const firstName = getValue("firstName");
        if (!firstName) {
          throw new Error("First name is required");
        }

        const gender = parseGender(getValue("gender"));
        if (!gender) {
          throw new Error("Invalid or missing gender. Use MALE, FEMALE, or OTHER");
        }

        const mobile = getValue("mobile");
        if (!mobile || !/^[0-9]{10,15}$/.test(mobile.replace(/[\s-]/g, ""))) {
          throw new Error("Invalid mobile number. Must be 10-15 digits");
        }

        const bloodGroup = parseBloodGroup(getValue("bloodGroup"));
        const dateOfBirth = parseDate(getValue("dateOfBirth"));
        if (!dateOfBirth) {
          throw new Error("Invalid or missing date of birth");
        }

        // Check for duplicate mobile within this tenant
        const existingPatient = await prisma.patient.findFirst({
          where: {
            tenantId: session.tenantId,
            phoneNumber: mobile.replace(/[\s-]/g, ""),
          },
        });

        if (existingPatient) {
          throw new Error(`Patient with mobile ${mobile} already exists (UHID: ${existingPatient.uhid})`);
        }

        // Generate UHID
        const uhid = await generateUHID(session.tenantId);

        // Create patient
        const patient = await prisma.patient.create({
          data: {
            tenantId: session.tenantId,
            uhid,
            firstName,
            lastName: getValue("lastName") || null,
            dateOfBirth,
            gender,
            bloodGroup: bloodGroup as "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE" | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE" | null,
            phoneNumber: mobile.replace(/[\s-]/g, ""),
            email: getValue("email") || null,
            address: [getValue("address"), getValue("city"), getValue("state"), getValue("pincode")].filter(Boolean).join(", ") || null,
            allergies: getValue("allergies") || null,
            status: "ACTIVE",
            createdBy: session.userId,
          },
        });

        // Create audit log
        await createAuditLog({
          tenantId: session.tenantId,
          performedBy: session.userId,
          entityType: "PATIENT",
          entityId: patient.id,
          action: "CREATE",
          newValue: { source: "IMPORT", uhid, firstName, mobile },
        });

        results.push({
          row: i + 1,
          uhid,
          status: "success",
          message: `Patient created successfully`,
        });
        successCount++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        results.push({
          row: i + 1,
          status: "error",
          message: errorMessage,
        });
        errorCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Import completed: ${successCount} created, ${errorCount} errors`,
      data: {
        total: results.length,
        success: successCount,
        errors: errorCount,
        details: results,
      },
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { success: false, message: "Failed to import patients" },
      { status: 500 }
    );
  }
}
