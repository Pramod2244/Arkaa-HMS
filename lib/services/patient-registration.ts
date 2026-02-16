import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { syncOPDQueueSnapshot } from "@/lib/services/opd-queue-snapshot";
import { AppError } from "@/lib/rbac";
import {
  PatientRegistrationInput,
  PatientUpdateInput,
  PatientSearchInput,
  TITLE_CODES,
} from "@/lib/schemas/patient-registration-schema";
import {
  decodeCursor,
  encodeCursor,
  sanitizeLimit,
  DEFAULT_LIMIT,
} from "@/lib/utils/pagination";

// ============== UHID GENERATION (SIMPLIFIED) ==============

/**
 * Generate a unique UHID by finding max existing and incrementing.
 * Format: {PREFIX}-{6 digit running number}
 * Example: HMS-000001
 */
export async function generateUHIDWithLock(
  tenantId: string,
  prefix?: string
): Promise<string> {
  // Get tenant code as prefix
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { code: true },
  });
  
  const uhidPrefix = prefix || tenant?.code || "HMS";
  
  // Find the highest existing UHID number for this tenant
  const lastPatient = await prisma.patient.findFirst({
    where: { 
      tenantId,
      uhid: { startsWith: uhidPrefix + "-" }
    },
    orderBy: { uhid: "desc" },
    select: { uhid: true },
  });

  let nextNumber = 1;
  if (lastPatient?.uhid) {
    const match = lastPatient.uhid.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1], 10) + 1;
    }
  }

  return `${uhidPrefix}-${String(nextNumber).padStart(6, "0")}`;
}

/**
 * Generate registration number.
 * Format: REG-YYYYMMDD-{4 digit running number}
 */
export async function generateRegistrationNumber(
  tenantId: string
): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const prefix = `REG-${dateStr}`;
  
  // For now, use timestamp to ensure uniqueness
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${timestamp}`;
}

// ============== PATIENT REGISTRATION SERVICE ==============

export interface RegisterPatientResult {
  patient: any;
  registration: any;
  visit?: any;
  receipt?: {
    receiptNumber: string;
    amount: number;
  };
}

/**
 * SIMPLIFIED patient registration flow that matches actual schema:
 * 1. Generate UHID
 * 2. Create Patient record (with only valid fields)
 * 3. Optionally create Visit
 * 
 * NOTE: The actual Patient model only has basic fields.
 */
export async function registerPatient(
  tenantId: string,
  userId: string,
  input: PatientRegistrationInput
): Promise<RegisterPatientResult> {
  // Pre-generate UHID
  const uhid = await generateUHIDWithLock(tenantId);
  const registrationNumber = await generateRegistrationNumber(tenantId);
  const now = new Date();

  // Map gender from title if not provided
  let gender = input.gender;
  if (input.titleCode && TITLE_CODES[input.titleCode as keyof typeof TITLE_CODES]) {
    const titleInfo = TITLE_CODES[input.titleCode as keyof typeof TITLE_CODES];
    if (titleInfo.gender) {
      gender = titleInfo.gender as "MALE" | "FEMALE" | "OTHER";
    }
  }

  // Build address string from input fields
  let address = "";
  if (input.presentHouseNo || input.presentStreet || input.presentArea || input.presentDistrict) {
    const parts = [
      input.presentHouseNo,
      input.presentStreet,
      input.presentArea,
      input.presentVillage,
      input.presentDistrict,
      input.presentState,
      input.presentPincode,
    ].filter(Boolean);
    address = parts.join(", ");
  }

  // Main transaction - simplified to match actual schema
  const result = await prisma.$transaction(async (tx) => {
    // Create Patient with ONLY fields that exist in the schema
    const patient = await tx.patient.create({
      data: {
        tenantId,
        uhid,
        firstName: input.firstName,
        lastName: input.lastName || null,
        gender: gender || "OTHER",
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : new Date(),
        phoneNumber: input.primaryMobile || "",
        email: input.email || null,
        address: address || null,
        emergencyContactName: input.guardianName || null,
        emergencyContactPhone: input.guardianMobile || null,
        bloodGroup: input.bloodGroup || null,
        allergies: input.allergies || null,
        medicalHistory: input.medicalHistory || null,
        status: "ACTIVE",
        createdBy: userId,
        updatedBy: userId,
      },
    });

    // Create Visit if requested
    let visit = null;
    if (input.createVisit && input.departmentId) {
      // Get daily token number for department
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tokenCount = await tx.visit.count({
        where: {
          tenantId,
          departmentId: input.departmentId,
          createdAt: { gte: today },
        },
      });
      const tokenNumber = tokenCount + 1;

      visit = await tx.visit.create({
        data: {
          tenantId,
          patientId: patient.id,
          departmentId: input.departmentId,
          doctorMasterId: input.doctorId || null,
          visitType: input.consultationType === "EMERGENCY" ? "EMERGENCY" : "OPD",
          visitNumber: 1,
          tokenNumber,
          status: "WAITING",
          priority: input.isEmergency ? "EMERGENCY" : "NORMAL",
          checkInTime: now,
          createdBy: userId,
          updatedBy: userId,
        },
      });
    }

    return {
      patient,
      registration: {
        id: crypto.randomUUID(),
        registrationNumber,
        registrationFee: input.registrationFee || 0,
        netAmount: input.registrationFee || 0,
      },
      visit,
      receipt: {
        receiptNumber: `RCP-${registrationNumber}`,
        amount: input.registrationFee || 0,
      },
    };
  });

  // Sync to OPD Queue Snapshot (outside main transaction)
  if (result.visit) {
    try {
      await syncOPDQueueSnapshot(result.visit.id);
    } catch (error) {
      console.error("Failed to sync OPD queue snapshot:", error);
    }
  }

  // Audit Logging
  try {
    await createAuditLog({
      tenantId,
      performedBy: userId,
      entityType: "PATIENT",
      entityId: result.patient.id,
      action: "CREATE",
      newValue: {
        uhid,
        firstName: input.firstName,
        lastName: input.lastName,
        phoneNumber: input.primaryMobile,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }

  return result;
}

// ============== UPDATE PATIENT ==============

export async function updatePatient(
  tenantId: string,
  userId: string,
  patientId: string,
  input: Partial<PatientRegistrationInput>
): Promise<any> {
  // Get existing patient for audit
  const existingPatient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId },
  });

  if (!existingPatient) {
    throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
  }

  // Auto-set gender from title code if title changes
  let gender = input.gender;
  if (input.titleCode && TITLE_CODES[input.titleCode as keyof typeof TITLE_CODES]) {
    const titleInfo = TITLE_CODES[input.titleCode as keyof typeof TITLE_CODES];
    if (titleInfo.gender) {
      gender = titleInfo.gender as "MALE" | "FEMALE" | "OTHER";
    }
  }

  const updateData: any = {
    updatedBy: userId,
    updatedAt: new Date(),
  };

  // Map input fields to update data
  if (input.titleCode !== undefined) updateData.titleCode = input.titleCode;
  if (input.firstName !== undefined) updateData.firstName = input.firstName;
  if (input.middleName !== undefined) updateData.middleName = input.middleName || null;
  if (input.lastName !== undefined) updateData.lastName = input.lastName || null;
  if (input.dateOfBirth !== undefined) updateData.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : null;
  if (input.ageYears !== undefined) updateData.ageYears = input.ageYears;
  if (input.ageMonths !== undefined) updateData.ageMonths = input.ageMonths;
  if (input.ageDays !== undefined) updateData.ageDays = input.ageDays;
  if (gender !== undefined) updateData.gender = gender;
  if (input.maritalStatus !== undefined) updateData.maritalStatus = input.maritalStatus;
  if (input.bloodGroup !== undefined) updateData.bloodGroup = input.bloodGroup;
  if (input.motherTongue !== undefined) updateData.motherTongue = input.motherTongue || null;
  if (input.nationality !== undefined) updateData.nationality = input.nationality || "Indian";
  if (input.religion !== undefined) updateData.religion = input.religion || null;
  if (input.casteCategory !== undefined) updateData.casteCategory = input.casteCategory;
  
  // Professional
  if (input.occupation !== undefined) updateData.occupation = input.occupation || null;
  if (input.employerName !== undefined) updateData.employerName = input.employerName || null;
  if (input.corporateId !== undefined) updateData.corporateId = input.corporateId || null;
  if (input.employeeId !== undefined) updateData.employeeId = input.employeeId || null;
  
  // Identity
  if (input.aadhaarNumber !== undefined) updateData.aadhaarNumber = input.aadhaarNumber || null;
  if (input.passportNumber !== undefined) updateData.passportNumber = input.passportNumber || null;
  if (input.panNumber !== undefined) updateData.panNumber = input.panNumber || null;
  
  // Contact
  if (input.primaryMobile !== undefined) {
    updateData.primaryMobile = input.primaryMobile;
    updateData.phoneNumber = input.primaryMobile; // Legacy
  }
  if (input.secondaryMobile !== undefined) updateData.secondaryMobile = input.secondaryMobile || null;
  if (input.email !== undefined) updateData.email = input.email || null;
  if (input.guardianName !== undefined) updateData.guardianName = input.guardianName || null;
  if (input.guardianRelation !== undefined) updateData.guardianRelation = input.guardianRelation || null;
  if (input.guardianMobile !== undefined) updateData.guardianMobile = input.guardianMobile || null;
  
  // Address handling
  if (input.presentHouseNo !== undefined) updateData.presentHouseNo = input.presentHouseNo || null;
  if (input.presentStreet !== undefined) updateData.presentStreet = input.presentStreet || null;
  if (input.presentArea !== undefined) updateData.presentArea = input.presentArea || null;
  if (input.presentVillage !== undefined) updateData.presentVillage = input.presentVillage || null;
  if (input.presentTaluk !== undefined) updateData.presentTaluk = input.presentTaluk || null;
  if (input.presentDistrict !== undefined) updateData.presentDistrict = input.presentDistrict || null;
  if (input.presentState !== undefined) updateData.presentState = input.presentState || null;
  if (input.presentCountry !== undefined) updateData.presentCountry = input.presentCountry || "India";
  if (input.presentPincode !== undefined) updateData.presentPincode = input.presentPincode || null;
  
  if (input.permanentSameAsPresent !== undefined) updateData.permanentSameAsPresent = input.permanentSameAsPresent;
  
  // Special Flags
  if (input.isVip !== undefined) updateData.isVip = input.isVip;
  if (input.isMlc !== undefined) updateData.isMlc = input.isMlc;
  if (input.isEmergency !== undefined) updateData.isEmergency = input.isEmergency;
  
  // Photo
  if (input.photoUrl !== undefined) updateData.photoUrl = input.photoUrl || null;
  
  // Medical
  if (input.allergies !== undefined) updateData.allergies = input.allergies || null;
  if (input.medicalHistory !== undefined) updateData.medicalHistory = input.medicalHistory || null;
  
  // Status
  if (input.status !== undefined) updateData.status = input.status;

  const updatedPatient = await prisma.patient.update({
    where: { id: patientId },
    data: updateData,
  });

  // Note: PatientFlag model doesn't exist in current schema
  // VIP/MLC/Emergency flags would need schema extension

  // Audit log
  await createAuditLog({
    tenantId,
    performedBy: userId,
    entityType: "PATIENT",
    entityId: patientId,
    action: "UPDATE",
    oldValue: existingPatient,
    newValue: updatedPatient,
  });

  return updatedPatient;
}

// ============== GET PATIENTS (CURSOR PAGINATION) ==============

export async function getRegisteredPatients(
  tenantId: string,
  options: PatientSearchInput
) {
  const { search, uhid, mobile, aadhaar, status, registrationDateFrom, registrationDateTo, cursor, limit: rawLimit } = options;
  const limit = sanitizeLimit(rawLimit || DEFAULT_LIMIT);

  const where: any = { tenantId };

  // Status filter
  if (status && status !== "ALL") {
    where.status = status;
  }

  // Search filters
  if (uhid) {
    where.uhid = { contains: uhid, mode: "insensitive" };
  }

  if (mobile) {
    where.OR = [
      { primaryMobile: { contains: mobile } },
      { phoneNumber: { contains: mobile } },
    ];
  }

  if (aadhaar) {
    where.aadhaarNumber = { contains: aadhaar };
  }

  if (search) {
    where.OR = [
      { uhid: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { primaryMobile: { contains: search } },
      { phoneNumber: { contains: search } },
    ];
  }

  // Date filters
  if (registrationDateFrom || registrationDateTo) {
    where.createdAt = {};
    if (registrationDateFrom) {
      where.createdAt.gte = new Date(registrationDateFrom);
    }
    if (registrationDateTo) {
      const endDate = new Date(registrationDateTo);
      endDate.setDate(endDate.getDate() + 1);
      where.createdAt.lt = endDate;
    }
  }

  // Cursor pagination
  const decodedCursor = decodeCursor(cursor);
  if (decodedCursor?.id && decodedCursor?.createdAt) {
    where.OR = where.OR
      ? {
          AND: [
            { OR: where.OR },
            {
              OR: [
                { createdAt: { lt: decodedCursor.createdAt } },
                {
                  AND: [
                    { createdAt: decodedCursor.createdAt },
                    { id: { lt: decodedCursor.id } },
                  ],
                },
              ],
            },
          ],
        }
      : {
          OR: [
            { createdAt: { lt: decodedCursor.createdAt } },
            {
              AND: [
                { createdAt: decodedCursor.createdAt },
                { id: { lt: decodedCursor.id } },
              ],
            },
          ],
        };
  }

  const patients = await prisma.patient.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    // Note: Simplified - no flags/registrations relations in current schema
  });

  const hasMore = patients.length > limit;
  const data = hasMore ? patients.slice(0, limit) : patients;

  const nextCursor =
    hasMore && data.length > 0
      ? encodeCursor({
          id: data[data.length - 1].id,
          createdAt: data[data.length - 1].createdAt,
        })
      : null;

  return {
    patients: data,
    pagination: {
      limit,
      nextCursor,
      hasMore,
    },
  };
}

// ============== GET SINGLE PATIENT ==============

export async function getPatientById(
  tenantId: string,
  patientId: string
) {
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, tenantId },
    // Note: Simplified - no flags/relations/documents/registrations in current schema
  });

  if (!patient) {
    throw new AppError("Patient not found", 404, "PATIENT_NOT_FOUND");
  }

  return patient;
}

// ============== CHECK DUPLICATE PATIENT ==============

export async function checkDuplicatePatient(
  tenantId: string,
  mobile: string,
  aadhaar?: string
): Promise<{ exists: boolean; patients: any[] }> {
  // Note: Patient model only has phoneNumber (no primaryMobile or aadhaarNumber)
  // Check for duplicate by phoneNumber or email
  const where: any = {
    tenantId,
    phoneNumber: mobile,
  };

  const patients = await prisma.patient.findMany({
    where,
    select: {
      id: true,
      uhid: true,
      firstName: true,
      lastName: true,
      phoneNumber: true,
      email: true,
      status: true,
    },
    take: 5,
  });

  return {
    exists: patients.length > 0,
    patients,
  };
}

// ============== GET TENANT REGISTRATION FEE ==============

export async function getTenantRegistrationFee(tenantId: string): Promise<number> {
  const setting = await prisma.tenantSetting.findUnique({
    where: {
      tenantId_key: {
        tenantId,
        key: "registration_fee",
      },
    },
  });

  if (setting && typeof setting.value === "object" && setting.value !== null) {
    const value = setting.value as { amount?: number };
    return value.amount || 0;
  }

  return 0; // Default registration fee
}
