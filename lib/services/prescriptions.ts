import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { PrescriptionFormData, PrescriptionItemFormData } from "@/lib/schemas/clinical-schema";

export interface PrescriptionWithDetails {
  id: string;
  patientId: string;
  doctorId: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
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
  doctor: {
    id: string;
    fullName: string;
  };
  items: Array<{
    id: string;
    medicineName: string;
    genericName?: string | null;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string | null;
    quantity?: number | null;
  }>;
}

export async function createPrescription(
  prescriptionData: PrescriptionFormData,
  tenantId: string,
  userId: string
): Promise<PrescriptionWithDetails> {
  // Resolve visitId from consultationId
  const consultation = await prisma.consultation.findFirst({
    where: { id: prescriptionData.consultationId, tenantId },
    select: { visitId: true },
  });

  if (!consultation) throw new Error("Consultation not found");

  const prescription = await prisma.prescription.create({
    data: {
      visitId: consultation.visitId,
      patientId: prescriptionData.patientId,
      doctorId: prescriptionData.doctorId,
      prescriptionDate: new Date(prescriptionData.prescriptionDate),
      notes: prescriptionData.notes,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
      items: {
        create: prescriptionData.items.map(item => ({
          ...item,
          tenantId,
          createdBy: userId,
          updatedBy: userId,
        })),
      },
    },
    include: {
      visit: {
        select: {
          id: true,
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
      doctor: {
        select: {
          id: true,
          fullName: true,
        },
      },
      items: true,
    },
  });

  await createAuditLog({
    action: "CREATE",
    entityType: "PRESCRIPTION",
    entityId: prescription.id,
    newValue: { prescriptionData },
    tenantId,
    performedBy: userId,
  });

  return prescription;
}

export async function getPrescriptionById(
  id: string,
  tenantId: string
): Promise<PrescriptionWithDetails | null> {
  return prisma.prescription.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      visit: {
        select: {
          id: true,
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
      doctor: {
        select: {
          id: true,
          fullName: true,
        },
      },
      items: true,
    },
  });
}

export async function getPrescriptionsByPatientId(
  patientId: string,
  tenantId: string
): Promise<PrescriptionWithDetails[]> {
  return prisma.prescription.findMany({
    where: {
      patientId,
      tenantId,
    },
    include: {
      visit: {
        select: {
          id: true,
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
      doctor: {
        select: {
          id: true,
          fullName: true,
        },
      },
      items: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function getPrescriptionsByConsultationId(
  consultationId: string,
  tenantId: string
): Promise<PrescriptionWithDetails[]> {
  // Resolve visitId from consultationId and query by visitId
  const consultation = await prisma.consultation.findFirst({
    where: { id: consultationId, tenantId },
    select: { visitId: true },
  });

  if (!consultation) return [];

  return prisma.prescription.findMany({
    where: {
      visitId: consultation.visitId,
      tenantId,
    },
    include: {
      visit: {
        select: {
          id: true,
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
      doctor: {
        select: {
          id: true,
          fullName: true,
        },
      },
      items: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updatePrescription(
  id: string,
  prescriptionData: Partial<PrescriptionFormData>,
  tenantId: string,
  userId: string
): Promise<PrescriptionWithDetails> {
  // Handle items update separately if provided
  const updateData: any = {
    ...prescriptionData,
    updatedBy: userId,
  };

  if (prescriptionData.prescriptionDate) {
    updateData.prescriptionDate = new Date(prescriptionData.prescriptionDate);
  }

  if (prescriptionData.items) {
    // Delete existing items and create new ones
    await prisma.prescriptionItem.deleteMany({
      where: {
        prescriptionId: id,
        tenantId,
      },
    });

    updateData.items = {
      create: prescriptionData.items.map(item => ({
        ...item,
        tenantId,
        createdBy: userId,
        updatedBy: userId,
      })),
    };
  }

  const prescription = await prisma.prescription.update({
    where: {
      id,
      tenantId,
    },
    data: updateData,
    include: {
      visit: {
        select: {
          id: true,
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
      doctor: {
        select: {
          id: true,
          fullName: true,
        },
      },
      items: true,
    },
  });

  await createAuditLog({
    action: "UPDATE",
    entityType: "PRESCRIPTION",
    entityId: prescription.id,
    newValue: { prescriptionData },
    tenantId,
    performedBy: userId,
  });

  return prescription;
}

export async function deletePrescription(
  id: string,
  tenantId: string,
  userId: string
): Promise<void> {
  const prescription = await prisma.prescription.findFirst({
    where: {
      id,
      tenantId,
    },
    include: {
      items: true,
    },
  });

  if (!prescription) {
    throw new Error("Prescription not found");
  }

  await prisma.prescription.delete({
    where: {
      id,
      tenantId,
    },
  });

  await createAuditLog({
    action: "DELETE",
    entityType: "PRESCRIPTION",
    entityId: id,
    oldValue: { prescription },
    tenantId,
    performedBy: userId,
  });
}