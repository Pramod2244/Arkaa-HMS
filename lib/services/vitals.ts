import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { VitalsFormData } from "@/lib/schemas/clinical-schema";

export interface VitalsWithDetails {
  id: string;
  visitId: string;
  recordedAt: Date;
  recordedBy: string;

  // Measurements (nullable if not recorded)
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
  bmi?: number | null;
  respiratoryRate?: number | null;
  notes?: string | null;

  visit: {
    id: string;
    patient: {
      id: string;
      uhid: string;
      firstName: string;
      lastName: string | null;
      phoneNumber: string;
    };
  };
}

export async function createVitals(
  vitalsData: VitalsFormData,
  tenantId: string,
  userId: string
): Promise<VitalsWithDetails> {
  // Calculate BMI if weight and height are provided
  let bmi: number | undefined;
  if (vitalsData.weight && vitalsData.height) {
    const heightInMeters = vitalsData.heightUnit === "cm"
      ? vitalsData.height / 100
      : vitalsData.height * 0.0254; // inches to meters
    const weightInKg = vitalsData.weightUnit === "kg"
      ? vitalsData.weight
      : vitalsData.weight * 0.453592; // lbs to kg

    bmi = weightInKg / (heightInMeters * heightInMeters);
  }

  const vitals = await prisma.vital.create({
    data: {
      ...vitalsData,
      bmi,
      tenantId,
      recordedBy: userId,
    },
    include: {
      visit: {
        include: {
          patient: {
            select: {
              id: true,
              uhid: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });

  await createAuditLog({
    action: "CREATE",
    entityType: "VITAL",
    entityId: vitals.id,
    newValue: { vitalsData },
    tenantId,
    performedBy: userId,
  });

  return vitals;
}

export async function getVitalsByVisitId(
  visitId: string,
  tenantId: string
): Promise<VitalsWithDetails[]> {
  return prisma.vital.findMany({
    where: {
      visitId,
      tenantId,
    },
    include: {
      visit: {
        include: {
          patient: {
            select: {
              id: true,
              uhid: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
    orderBy: {
      recordedAt: "desc",
    },
  });
}

export async function getVitalsById(
  id: string,
  tenantId: string
): Promise<VitalsWithDetails | null> {
  return prisma.vital.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      visit: {
        include: {
          patient: {
            select: {
              id: true,
              uhid: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });
}

export async function updateVitals(
  id: string,
  vitalsData: Partial<VitalsFormData>,
  tenantId: string,
  userId: string
): Promise<VitalsWithDetails> {
  // Calculate BMI if weight and height are provided
  let bmi: number | undefined;
  if (vitalsData.weight && vitalsData.height) {
    const heightInMeters = vitalsData.heightUnit === "cm"
      ? vitalsData.height / 100
      : vitalsData.height * 0.0254;
    const weightInKg = vitalsData.weightUnit === "kg"
      ? vitalsData.weight
      : vitalsData.weight * 0.453592;

    bmi = weightInKg / (heightInMeters * heightInMeters);
  }

  const vitals = await prisma.vital.update({
    where: {
      id,
      tenantId,
    },
    data: {
      ...vitalsData,
      bmi,
    },
    include: {
      visit: {
        include: {
          patient: {
            select: {
              id: true,
              uhid: true,
              firstName: true,
              lastName: true,
              phoneNumber: true,
            },
          },
        },
      },
    },
  });

  await createAuditLog({
    action: "UPDATE",
    entityType: "VITAL",
    entityId: vitals.id,
    newValue: { vitalsData },
    tenantId,
    performedBy: userId,
  });

  return vitals;
}

export async function deleteVitals(
  id: string,
  tenantId: string,
  userId: string
): Promise<void> {
  const vitals = await prisma.vital.findFirst({
    where: {
      id,
      tenantId,
    },
  });

  if (!vitals) {
    throw new Error("Vitals not found");
  }

  await prisma.vital.delete({
    where: {
      id,
      tenantId,
    },
  });

  await createAuditLog({
    action: "DELETE",
    entityType: "VITAL",
    entityId: id,
    oldValue: { vitals },
    tenantId,
    performedBy: userId,
  });
}