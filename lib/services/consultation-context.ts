/**
 * Phase-3: Consultation Context Service
 * 
 * Single API response for the doctor consultation screen.
 * Loads ALL data needed for the visit in ONE query.
 * 
 * NO N+1 queries. NO multiple API calls.
 */

import { prisma } from "@/lib/prisma";

// ============== TYPES ==============

export interface PatientSummary {
  id: string;
  uhid: string;
  fullName: string;
  firstName: string;
  lastName: string | null;
  age: number;
  gender: string;
  dateOfBirth: Date;
  phoneNumber: string;
  bloodGroup: string | null;
  allergies: string | null;
  medicalHistory: string | null;
}

export interface VisitSummary {
  id: string;
  visitNumber: number;
  visitType: string;
  status: string;
  priority: string;
  checkInTime: Date | null;
  startTime: Date | null;
  endTime: Date | null;
  notes: string | null;
  createdAt: Date;
  department: {
    id: string;
    name: string;
  } | null;
  doctor: {
    id: string;
    fullName: string;
  } | null;
  appointment: {
    id: string;
    appointmentDate: Date;
    appointmentTime: string | null;
  } | null;
}

export interface VitalEntry {
  id: string;
  recordedAt: Date;
  recordedBy: string;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  pulseRate: number | null;
  temperature: number | null;
  temperatureUnit: string | null;
  spO2: number | null;
  weight: number | null;
  weightUnit: string | null;
  height: number | null;
  heightUnit: string | null;
  bmi: number | null;
  respiratoryRate: number | null;
  notes: string | null;
}

export interface ConsultationNotes {
  id: string;
  chiefComplaint: string;
  historyOfPresentIllness: string | null;
  pastMedicalHistory: string | null;
  familyHistory: string | null;
  socialHistory: string | null;
  allergies: string | null;
  medications: string | null;
  physicalExamination: string | null;
  diagnosis: string | null;
  differentialDiagnosis: string | null;
  investigations: string | null;
  treatmentPlan: string | null;
  followUpPlan: string | null;
  notes: string | null;
  status: string;
}

export interface PrescriptionItem {
  id: string;
  medicineName: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  route: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  timing: string | null;
  instructions: string | null;
  quantity: number | null;
}

export interface PrescriptionData {
  id: string;
  prescriptionDate: Date;
  status: string;
  notes: string | null;
  diagnosis?: string;
  followUpAdvice?: string;
  items: PrescriptionItem[];
}

export interface LabOrderData {
  id: string;
  orderNumber: string;
  orderDate: Date;
  status: string;
  priority: string;
  notes: string | null;
  items: Array<{
    id: string;
    testName: string;
    testCode: string | null;
    category: string | null;
    priority: string;
    status: string;
    notes: string | null;
  }>;
}

export interface PastVisitSummary {
  id: string;
  visitNumber: number;
  visitDate: Date;
  diagnosis: string | null;
  doctorName: string | null;
  departmentName: string | null;
}

export interface LastPrescriptionSummary {
  id: string;
  prescriptionDate: Date;
  diagnosis: string | null;
  itemCount: number;
  items: Array<{
    medicineName: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
}

export interface ConsultationDraftData {
  vitalsData: VitalEntry[] | null;
  notesData: Partial<ConsultationNotes> | null;
  prescriptionData: {
    diagnosis: string;
    followUpAdvice: string;
    items: Omit<PrescriptionItem, 'id'>[];
  } | null;
  labOrdersData: Array<{
    testName: string;
    testCode: string | null;
    category: string | null;
    priority: string;
    notes: string | null;
  }> | null;
  lastSavedAt: Date | null;
}

export interface ConsultationContext {
  patient: PatientSummary;
  visit: VisitSummary;
  vitals: VitalEntry[];
  consultation: ConsultationNotes | null;
  prescription: PrescriptionData | null;
  labOrders: LabOrderData[];
  pastVisits: PastVisitSummary[];
  lastPrescription: LastPrescriptionSummary | null;
  draft: ConsultationDraftData | null;
  isLocked: boolean;
  canEdit: boolean;
}

// ============== HELPER FUNCTIONS ==============

function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// ============== MAIN SERVICE ==============

/**
 * Get complete consultation context for a visit
 * 
 * @param visitId - The visit ID
 * @param tenantId - Tenant ID for isolation
 * @param doctorId - Doctor user ID for access control
 * @returns Complete consultation context or null if not found/unauthorized
 */
export async function getConsultationContext(
  visitId: string,
  tenantId: string,
  doctorId: string
): Promise<ConsultationContext | null> {
  // Single optimized query with all related data
  const visit = await prisma.visit.findFirst({
    where: {
      id: visitId,
      tenantId,
    },
    include: {
      patient: true,
      department: {
        select: { id: true, name: true },
      },
      doctor: {
        select: { id: true, fullName: true },
      },
      appointment: {
        select: {
          id: true,
          appointmentDate: true,
          appointmentTime: true,
        },
      },
      vitals: {
        orderBy: { recordedAt: 'desc' },
      },
      consultations: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      prescriptions: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: {
          items: true,
        },
      },
      labOrders: {
        orderBy: { orderDate: 'desc' },
        include: {
          items: true,
        },
      },
    },
  });

  if (!visit) {
    return null;
  }

  // Access control: Doctor must be assigned to the visit OR be admin
  // (Admin check done at API layer via permissions)
  const isAssignedDoctor = visit.doctorId === doctorId;
  
  // Get past visits (last 3, excluding current)
  const pastVisits = await prisma.visit.findMany({
    where: {
      tenantId,
      patientId: visit.patientId,
      id: { not: visitId },
      status: 'COMPLETED',
    },
    orderBy: { createdAt: 'desc' },
    take: 3,
    include: {
      consultations: {
        take: 1,
        select: { diagnosis: true },
      },
      doctor: {
        select: { fullName: true },
      },
      department: {
        select: { name: true },
      },
    },
  });

  // Get last prescription from previous visits
  const lastPrescription = await prisma.prescription.findFirst({
    where: {
      tenantId,
      patientId: visit.patientId,
      visitId: { not: visitId },
    },
    orderBy: { prescriptionDate: 'desc' },
    include: {
      items: {
        take: 5,
        select: {
          medicineName: true,
          dosage: true,
          frequency: true,
          duration: true,
        },
      },
      visit: {
        include: {
          consultations: {
            take: 1,
            select: { diagnosis: true },
          },
        },
      },
    },
  });

  // Get draft if exists
  const draft = await prisma.consultationDraft.findUnique({
    where: { visitId },
  });

  // Build response
  const isLocked = visit.status === 'COMPLETED' || visit.status === 'CANCELLED';
  const canEdit = isAssignedDoctor && !isLocked;

  const consultation = visit.consultations[0] || null;
  const prescription = visit.prescriptions[0] || null;

  return {
    patient: {
      id: visit.patient.id,
      uhid: visit.patient.uhid,
      fullName: `${visit.patient.firstName} ${visit.patient.lastName || ''}`.trim(),
      firstName: visit.patient.firstName,
      lastName: visit.patient.lastName,
      age: calculateAge(visit.patient.dateOfBirth),
      gender: visit.patient.gender,
      dateOfBirth: visit.patient.dateOfBirth,
      phoneNumber: visit.patient.phoneNumber,
      bloodGroup: visit.patient.bloodGroup,
      allergies: visit.patient.allergies,
      medicalHistory: visit.patient.medicalHistory,
    },
    visit: {
      id: visit.id,
      visitNumber: visit.visitNumber,
      visitType: visit.visitType,
      status: visit.status,
      priority: visit.priority,
      checkInTime: visit.checkInTime,
      startTime: visit.startTime,
      endTime: visit.endTime,
      notes: visit.notes,
      createdAt: visit.createdAt,
      department: visit.department,
      doctor: visit.doctor,
      appointment: visit.appointment,
    },
    vitals: visit.vitals.map(v => ({
      id: v.id,
      recordedAt: v.recordedAt,
      recordedBy: v.recordedBy,
      bloodPressureSystolic: v.bloodPressureSystolic,
      bloodPressureDiastolic: v.bloodPressureDiastolic,
      pulseRate: v.pulseRate,
      temperature: v.temperature,
      temperatureUnit: v.temperatureUnit,
      spO2: v.spO2,
      weight: v.weight,
      weightUnit: v.weightUnit,
      height: v.height,
      heightUnit: v.heightUnit,
      bmi: v.bmi,
      respiratoryRate: v.respiratoryRate,
      notes: v.notes,
    })),
    consultation: consultation ? {
      id: consultation.id,
      chiefComplaint: consultation.chiefComplaint,
      historyOfPresentIllness: consultation.historyOfPresentIllness,
      pastMedicalHistory: consultation.pastMedicalHistory,
      familyHistory: consultation.familyHistory,
      socialHistory: consultation.socialHistory,
      allergies: consultation.allergies,
      medications: consultation.medications,
      physicalExamination: consultation.physicalExamination,
      diagnosis: consultation.diagnosis,
      differentialDiagnosis: consultation.differentialDiagnosis,
      investigations: consultation.investigations,
      treatmentPlan: consultation.treatmentPlan,
      followUpPlan: consultation.followUpPlan,
      notes: consultation.notes,
      status: consultation.status,
    } : null,
    prescription: prescription ? {
      id: prescription.id,
      prescriptionDate: prescription.prescriptionDate,
      status: prescription.status,
      notes: prescription.notes,
      items: prescription.items.map(item => ({
        id: item.id,
        medicineName: item.medicineName,
        genericName: item.genericName,
        strength: item.strength,
        dosageForm: item.dosageForm,
        route: item.route,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        timing: item.timing,
        instructions: item.instructions,
        quantity: item.quantity,
      })),
    } : null,
    labOrders: visit.labOrders.map(order => ({
      id: order.id,
      orderNumber: order.orderNumber,
      orderDate: order.orderDate,
      status: order.status,
      priority: order.priority,
      notes: order.notes,
      items: order.items.map(item => ({
        id: item.id,
        testName: item.testName,
        testCode: item.testCode,
        category: item.category,
        priority: item.priority,
        status: item.status,
        notes: item.notes,
      })),
    })),
    pastVisits: pastVisits.map(pv => ({
      id: pv.id,
      visitNumber: pv.visitNumber,
      visitDate: pv.createdAt,
      diagnosis: pv.consultations[0]?.diagnosis || null,
      doctorName: pv.doctor?.fullName || null,
      departmentName: pv.department?.name || null,
    })),
    lastPrescription: lastPrescription ? {
      id: lastPrescription.id,
      prescriptionDate: lastPrescription.prescriptionDate,
      diagnosis: lastPrescription.visit?.consultations[0]?.diagnosis || null,
      itemCount: lastPrescription.items.length,
      items: lastPrescription.items,
    } : null,
    draft: draft ? {
      vitalsData: draft.vitalsData as VitalEntry[] | null,
      notesData: draft.notesData as Partial<ConsultationNotes> | null,
      prescriptionData: draft.prescriptionData as ConsultationDraftData['prescriptionData'],
      labOrdersData: draft.labOrdersData as ConsultationDraftData['labOrdersData'],
      lastSavedAt: draft.lastSavedAt,
    } : null,
    isLocked,
    canEdit,
  };
}

/**
 * Check if a visit is editable
 */
export async function isVisitEditable(
  visitId: string,
  tenantId: string
): Promise<boolean> {
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, tenantId },
    select: { status: true },
  });
  
  if (!visit) return false;
  return visit.status !== 'COMPLETED' && visit.status !== 'CANCELLED';
}

/**
 * Validate doctor has access to the visit
 */
export async function validateDoctorAccess(
  visitId: string,
  tenantId: string,
  doctorId: string
): Promise<{ valid: boolean; visit: { status: string; doctorId: string | null } | null }> {
  const visit = await prisma.visit.findFirst({
    where: { id: visitId, tenantId },
    select: { status: true, doctorId: true },
  });
  
  if (!visit) {
    return { valid: false, visit: null };
  }
  
  // Doctor must be assigned to the visit
  if (visit.doctorId !== doctorId) {
    return { valid: false, visit };
  }
  
  return { valid: true, visit };
}
