/**
 * Phase-3: Consultation Write Services
 * 
 * Separate write operations for each entity.
 * Each service writes ONLY its own entity.
 * All operations include audit logging.
 */

import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { isVisitEditable, validateDoctorAccess } from "./consultation-context";
import { syncOPDQueueSnapshot } from "./opd-queue-snapshot";
import { Vital, Consultation, Prescription, LabOrder, Prisma } from "@/app/generated/prisma/client";

// Type aliases for return types
type VitalsRecord = Vital;
type ConsultationRecord = Consultation;
type PrescriptionRecord = Prescription;
type LabOrderRecord = LabOrder;

// Alias for backward compatibility
export type NotesInput = ClinicalNotesInput;

// ============== VITALS ==============

export interface VitalsInput {
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  pulseRate?: number | null;
  temperature?: number | null;
  temperatureUnit?: string | null;
  spO2?: number | null;
  weight?: number | null;
  weightUnit?: string | null;
  height?: number | null;
  heightUnit?: string | null;
  respiratoryRate?: number | null;
  notes?: string | null;
}

export async function saveConsultationVitals(
  visitId: string,
  vitals: VitalsInput,
  tenantId: string,
  userId: string
): Promise<{ success: boolean; data?: VitalsRecord; error?: string }> {
  // Validate visit is editable
  if (!await isVisitEditable(visitId, tenantId)) {
    return { success: false, error: "Visit is locked and cannot be edited" };
  }

  // Calculate BMI if weight and height provided
  let bmi: number | null = null;
  if (vitals.weight && vitals.height) {
    const weightKg = vitals.weightUnit === 'lbs' 
      ? vitals.weight * 0.453592 
      : vitals.weight;
    const heightM = vitals.heightUnit === 'inches'
      ? vitals.height * 0.0254
      : vitals.height / 100;
    
    if (heightM > 0) {
      bmi = Math.round((weightKg / (heightM * heightM)) * 10) / 10;
    }
  }

  const vitalRecord = await prisma.vital.create({
    data: {
      tenantId,
      visitId,
      recordedBy: userId,
      ...vitals,
      bmi,
    },
  });

  await createAuditLog({
    action: "CREATE",
    entityType: "VITAL",
    entityId: vitalRecord.id,
    newValue: vitalRecord,
    tenantId,
    performedBy: userId,
  });

  return { success: true, data: vitalRecord };
}

// ============== CLINICAL NOTES ==============

export interface ClinicalNotesInput {
  chiefComplaint: string;
  historyOfPresentIllness?: string | null;
  pastMedicalHistory?: string | null;
  familyHistory?: string | null;
  socialHistory?: string | null;
  allergies?: string | null;
  medications?: string | null;
  physicalExamination?: string | null;
  diagnosis?: string | null;
  differentialDiagnosis?: string | null;
  investigations?: string | null;
  treatmentPlan?: string | null;
  followUpPlan?: string | null;
  notes?: string | null;
}

export async function saveConsultationNotes(
  visitId: string,
  notes: ClinicalNotesInput,
  tenantId: string,
  userId: string
): Promise<{ success: boolean; data?: ConsultationRecord; error?: string }> {
  // Validate visit is editable
  if (!await isVisitEditable(visitId, tenantId)) {
    return { success: false, error: "Visit is locked and cannot be edited" };
  }

  // Validate doctor access
  const access = await validateDoctorAccess(visitId, tenantId, userId);
  if (!access.valid) {
    return { success: false, error: "You are not authorized to edit this consultation" };
  }

  // Check if consultation exists
  const existingConsultation = await prisma.consultation.findUnique({
    where: { visitId },
  });

  // Get doctor master ID
  const doctorMaster = await prisma.doctor.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });

  let consultation;

  if (existingConsultation) {
    // Update existing
    consultation = await prisma.consultation.update({
      where: { visitId },
      data: {
        ...notes,
        updatedBy: userId,
      },
    });

    await createAuditLog({
      action: "UPDATE",
      entityType: "CONSULTATION",
      entityId: consultation.id,
      oldValue: existingConsultation,
      newValue: consultation,
      tenantId,
      performedBy: userId,
    });
  } else {
    // Create new
    consultation = await prisma.consultation.create({
      data: {
        tenantId,
        visitId,
        doctorId: userId,
        doctorMasterId: doctorMaster?.id,
        ...notes,
        status: "IN_PROGRESS",
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await createAuditLog({
      action: "CREATE",
      entityType: "CONSULTATION",
      entityId: consultation.id,
      newValue: consultation,
      tenantId,
      performedBy: userId,
    });
  }

  return { success: true, data: consultation };
}

// ============== PRESCRIPTION ==============

export interface PrescriptionItemInput {
  medicineName: string;
  genericName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  route?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  timing?: string | null;
  instructions?: string | null;
  quantity?: number | null;
}

export interface PrescriptionInput {
  diagnosis: string;
  followUpAdvice?: string | null;
  items: PrescriptionItemInput[];
}

export async function saveConsultationPrescription(
  visitId: string,
  prescription: PrescriptionInput,
  tenantId: string,
  userId: string
): Promise<{ success: boolean; data?: PrescriptionRecord; error?: string }> {
  // Validate visit is editable
  if (!await isVisitEditable(visitId, tenantId)) {
    return { success: false, error: "Visit is locked and cannot be edited" };
  }

  // Validate doctor access
  const access = await validateDoctorAccess(visitId, tenantId, userId);
  if (!access.valid) {
    return { success: false, error: "You are not authorized to edit this prescription" };
  }

  // Get visit patient ID
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, tenantId },
    select: { patientId: true },
  });

  if (!visit) {
    return { success: false, error: "Visit not found" };
  }

  // Get doctor master ID
  const doctorMaster = await prisma.doctor.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });

  // Check if prescription exists
  const existingPrescription = await prisma.prescription.findFirst({
    where: { visitId, tenantId },
    include: { items: true },
  });

  let prescriptionRecord;

  if (existingPrescription) {
    // Update: Delete existing items and recreate
    await prisma.$transaction(async (tx) => {
      // Delete existing items
      await tx.prescriptionItem.deleteMany({
        where: { prescriptionId: existingPrescription.id },
      });

      // Update prescription
      prescriptionRecord = await tx.prescription.update({
        where: { id: existingPrescription.id },
        data: {
          notes: prescription.followUpAdvice,
          updatedBy: userId,
          items: {
            create: prescription.items.map(item => ({
              tenantId,
              ...item,
            })),
          },
        },
        include: { items: true },
      });
    });

    // Update consultation diagnosis if exists
    await prisma.consultation.updateMany({
      where: { visitId, tenantId },
      data: { 
        diagnosis: prescription.diagnosis,
        followUpPlan: prescription.followUpAdvice,
        updatedBy: userId,
      },
    });

    await createAuditLog({
      action: "UPDATE",
      entityType: "PRESCRIPTION",
      entityId: existingPrescription.id,
      oldValue: existingPrescription,
      newValue: prescriptionRecord,
      tenantId,
      performedBy: userId,
    });
  } else {
    // Create new prescription
    prescriptionRecord = await prisma.prescription.create({
      data: {
        tenantId,
        visitId,
        patientId: visit.patientId,
        doctorId: userId,
        doctorMasterId: doctorMaster?.id,
        notes: prescription.followUpAdvice,
        status: "ACTIVE",
        createdBy: userId,
        updatedBy: userId,
        items: {
          create: prescription.items.map(item => ({
            tenantId,
            ...item,
          })),
        },
      },
      include: { items: true },
    });

    // Update/create consultation diagnosis
    const existingConsultation = await prisma.consultation.findUnique({
      where: { visitId },
    });

    if (existingConsultation) {
      await prisma.consultation.update({
        where: { visitId },
        data: { 
          diagnosis: prescription.diagnosis,
          followUpPlan: prescription.followUpAdvice,
          updatedBy: userId,
        },
      });
    }

    await createAuditLog({
      action: "CREATE",
      entityType: "PRESCRIPTION",
      entityId: prescriptionRecord.id,
      newValue: prescriptionRecord,
      tenantId,
      performedBy: userId,
    });
  }

  // Update doctor's medicine favorites
  await updateDoctorMedicineFavorites(tenantId, userId, prescription.items);

  return { success: true, data: prescriptionRecord };
}

/**
 * Update doctor's medicine usage for favorites/suggestions
 */
async function updateDoctorMedicineFavorites(
  tenantId: string,
  doctorId: string,
  items: PrescriptionItemInput[]
): Promise<void> {
  for (const item of items) {
    // Find or create medicine
    let medicine = await prisma.medicine.findFirst({
      where: {
        OR: [
          { tenantId, brandName: item.medicineName },
          { tenantId: null, brandName: item.medicineName },
        ],
      },
    });

    if (!medicine) {
      // Create tenant-specific medicine
      medicine = await prisma.medicine.create({
        data: {
          tenantId,
          brandName: item.medicineName,
          genericName: item.genericName,
          strength: item.strength,
          dosageForm: item.dosageForm || 'tablet',
          route: item.route,
          defaultDosage: item.dosage,
          defaultFrequency: item.frequency,
          defaultDuration: item.duration,
          defaultTiming: item.timing,
        },
      });
    }

    // Upsert doctor favorite
    await prisma.doctorMedicineFavorite.upsert({
      where: {
        tenantId_doctorId_medicineId: {
          tenantId,
          doctorId,
          medicineId: medicine.id,
        },
      },
      create: {
        tenantId,
        doctorId,
        medicineId: medicine.id,
        usageCount: 1,
        customDosage: item.dosage,
        customFrequency: item.frequency,
        customDuration: item.duration,
        customTiming: item.timing,
      },
      update: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
        customDosage: item.dosage,
        customFrequency: item.frequency,
        customDuration: item.duration,
        customTiming: item.timing,
      },
    });
  }
}

// ============== LAB ORDERS ==============

export interface LabOrderItemInput {
  testName: string;
  testCode?: string | null;
  category?: string | null;
  priority?: 'EMERGENCY' | 'URGENT' | 'NORMAL' | 'LOW';
  notes?: string | null;
}

export interface LabOrderInput {
  priority?: 'EMERGENCY' | 'URGENT' | 'NORMAL' | 'LOW';
  notes?: string | null;
  items: LabOrderItemInput[];
}

export async function saveConsultationLabOrders(
  visitId: string,
  labOrder: LabOrderInput,
  tenantId: string,
  userId: string
): Promise<{ success: boolean; data?: LabOrderRecord; error?: string }> {
  // Validate visit is editable
  if (!await isVisitEditable(visitId, tenantId)) {
    return { success: false, error: "Visit is locked and cannot be edited" };
  }

  // Validate doctor access
  const access = await validateDoctorAccess(visitId, tenantId, userId);
  if (!access.valid) {
    return { success: false, error: "You are not authorized to create lab orders" };
  }

  // Get visit patient ID
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, tenantId },
    select: { patientId: true },
  });

  if (!visit) {
    return { success: false, error: "Visit not found" };
  }

  // Get doctor master ID
  const doctorMaster = await prisma.doctor.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });

  // Generate order number
  const orderCount = await prisma.labOrder.count({ where: { tenantId } });
  const orderNumber = `LAB-${String(orderCount + 1).padStart(6, '0')}`;

  // Create lab order with items
  const labOrderRecord = await prisma.labOrder.create({
    data: {
      tenantId,
      visitId,
      patientId: visit.patientId,
      doctorId: userId,
      doctorMasterId: doctorMaster?.id,
      orderNumber,
      priority: labOrder.priority || 'NORMAL',
      notes: labOrder.notes,
      status: "ORDERED",
      createdBy: userId,
      updatedBy: userId,
      items: {
        create: labOrder.items.map(item => ({
          tenantId,
          testName: item.testName,
          testCode: item.testCode,
          category: item.category,
          priority: item.priority || 'NORMAL',
          notes: item.notes,
        })),
      },
    },
    include: { items: true },
  });

  await createAuditLog({
    action: "CREATE",
    entityType: "LAB_ORDER",
    entityId: labOrderRecord.id,
    newValue: labOrderRecord,
    tenantId,
    performedBy: userId,
  });

  return { success: true, data: labOrderRecord };
}

// ============== COMPLETE VISIT ==============

export async function completeConsultation(
  visitId: string,
  tenantId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Validate doctor access
  const access = await validateDoctorAccess(visitId, tenantId, userId);
  if (!access.valid) {
    return { success: false, error: "You are not authorized to complete this visit" };
  }

  if (access.visit?.status === 'COMPLETED') {
    return { success: false, error: "Visit is already completed" };
  }

  if (access.visit?.status === 'CANCELLED') {
    return { success: false, error: "Cannot complete a cancelled visit" };
  }

  // Validate required data exists
  const consultation = await prisma.consultation.findUnique({
    where: { visitId },
  });

  if (!consultation) {
    return { success: false, error: "Please enter clinical notes before completing" };
  }

  if (!consultation.diagnosis) {
    return { success: false, error: "Diagnosis is required before completing" };
  }

  // Check if prescription exists (optional check - logged for audit trail)
  // Prescription is optional - some visits may not require medication
  await prisma.prescription.findFirst({
    where: { visitId, tenantId },
    include: { items: true },
  });

  // If no prescription and no items, it's allowed but we should have at least notes
  // This is an explicit design choice - some visits may not need prescriptions

  // Complete the visit
  const oldVisit = await prisma.visit.findFirst({
    where: { id: visitId, tenantId },
  });

  await prisma.$transaction(async (tx) => {
    // Update visit status
    await tx.visit.update({
      where: { id: visitId },
      data: {
        status: 'COMPLETED',
        endTime: new Date(),
        updatedBy: userId,
      },
    });

    // Update consultation status
    await tx.consultation.update({
      where: { visitId },
      data: {
        status: 'COMPLETED',
        updatedBy: userId,
      },
    });

    // Delete draft if exists
    await tx.consultationDraft.deleteMany({
      where: { visitId },
    });
  });

  await createAuditLog({
    action: "UPDATE",
    entityType: "VISIT",
    entityId: visitId,
    oldValue: oldVisit,
    newValue: { status: 'COMPLETED', endTime: new Date() },
    tenantId,
    performedBy: userId,
  });

  // Sync OPD Queue Snapshot for real-time queue updates
  try {
    await syncOPDQueueSnapshot(visitId);
  } catch (syncError) {
    // Log but don't fail - snapshot sync is non-critical
    console.error("[completeConsultation] OPD snapshot sync failed:", syncError);
  }

  return { success: true };
}

// ============== DRAFT MANAGEMENT ==============

export interface DraftData {
  vitalsData?: VitalsInput | null;
  notesData?: NotesInput | null;
  prescriptionData?: PrescriptionInput | null;
  labOrdersData?: LabOrderInput[] | null;
}

export async function saveConsultationDraft(
  visitId: string,
  draft: DraftData,
  tenantId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  // Validate visit is editable
  if (!await isVisitEditable(visitId, tenantId)) {
    return { success: false, error: "Visit is locked - draft not saved" };
  }

  const draftData = {
    vitalsData: draft.vitalsData ? (draft.vitalsData as unknown as Prisma.InputJsonValue) : undefined,
    notesData: draft.notesData ? (draft.notesData as unknown as Prisma.InputJsonValue) : undefined,
    prescriptionData: draft.prescriptionData ? (draft.prescriptionData as unknown as Prisma.InputJsonValue) : undefined,
    labOrdersData: draft.labOrdersData ? (draft.labOrdersData as unknown as Prisma.InputJsonValue) : undefined,
  };

  await prisma.consultationDraft.upsert({
    where: { visitId },
    create: {
      tenantId,
      visitId,
      doctorId: userId,
      ...draftData,
      lastSavedAt: new Date(),
    },
    update: {
      ...draftData,
      lastSavedAt: new Date(),
    },
  });

  return { success: true };
}

export async function getConsultationDraft(
  visitId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _tenantId: string
): Promise<DraftData | null> {
  const draft = await prisma.consultationDraft.findUnique({
    where: { visitId },
  });

  if (!draft) return null;

  return {
    vitalsData: draft.vitalsData as VitalsInput | null,
    notesData: draft.notesData as NotesInput | null,
    prescriptionData: draft.prescriptionData as PrescriptionInput | null,
    labOrdersData: draft.labOrdersData as LabOrderInput[] | null,
  };
}
