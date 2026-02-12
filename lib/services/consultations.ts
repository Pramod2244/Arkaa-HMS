import { prisma } from "@/lib/prisma";
import { createAuditLog } from "@/lib/audit";
import { ConsultationFormData } from "@/lib/schemas/clinical-schema";

export interface ConsultationWithDetails {
  id: string;
  visitId: string;
  doctorId: string;
  consultationDate: Date;
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
      dateOfBirth: Date | null;
      gender: string | null;
    };
    appointment: {
      id: string;
      appointmentDate: Date;
      appointmentTime: string | null;
      department: {
        id: string;
        name: string;
      } | null;
    } | null;
    vitals: Array<{
      id: string;
      bloodPressureSystolic: number | null;
      bloodPressureDiastolic: number | null;
      pulseRate: number | null;
      temperature: number | null;
      spO2: number | null;
      recordedAt: Date;
    }>;
    prescriptions: Array<{
      id: string;
      prescriptionDate: Date;
      items: Array<{
        id: string;
        medicineName: string;
        dosage: string;
        frequency: string;
        duration: string;
      }>;
    }>;
  };
}

export async function createConsultation(
  consultationData: ConsultationFormData,
  tenantId: string,
  userId: string
): Promise<ConsultationWithDetails> {
  const consultation = await prisma.consultation.create({
    data: {
      ...consultationData,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
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
              dateOfBirth: true,
              gender: true,
            },
          },
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              appointmentTime: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          vitals: {
            select: {
              id: true,
              bloodPressureSystolic: true,
              bloodPressureDiastolic: true,
              pulseRate: true,
              temperature: true,
              spO2: true,
              recordedAt: true,
            },
            orderBy: {
              recordedAt: "desc",
            },
          },
          prescriptions: {
            select: {
              id: true,
              prescriptionDate: true,
              items: {
                select: {
                  id: true,
                  medicineName: true,
                  dosage: true,
                  frequency: true,
                  duration: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      },
    },
  });

  await createAuditLog({
    action: "CREATE",
    entityType: "CONSULTATION",
    entityId: consultation.id,
    newValue: { consultationData },
    tenantId,
    performedBy: userId,
  });

  return consultation;
}

export async function getConsultationById(
  id: string,
  tenantId: string
): Promise<ConsultationWithDetails | null> {
  const consultation = await prisma.consultation.findFirst({
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
              dateOfBirth: true,
              gender: true,
            },
          },
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              appointmentTime: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          vitals: {
            select: {
              id: true,
              bloodPressureSystolic: true,
              bloodPressureDiastolic: true,
              pulseRate: true,
              temperature: true,
              spO2: true,
              recordedAt: true,
            },
            orderBy: {
              recordedAt: "desc",
            },
          },
          prescriptions: {
            select: {
              id: true,
              prescriptionDate: true,
              items: {
                select: {
                  id: true,
                  medicineName: true,
                  dosage: true,
                  frequency: true,
                  duration: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
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
    },
  });

  return consultation as unknown as ConsultationWithDetails | null;
}

export async function getConsultationsByVisitId(
  visitId: string,
  tenantId: string
): Promise<ConsultationWithDetails[]> {
  return prisma.consultation.findMany({
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
              dateOfBirth: true,
              gender: true,
            },
          },
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              appointmentTime: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          vitals: {
            select: {
              id: true,
              bloodPressureSystolic: true,
              bloodPressureDiastolic: true,
              pulseRate: true,
              temperature: true,
              spO2: true,
              recordedAt: true,
            },
            orderBy: {
              recordedAt: "desc",
            },
          },
          prescriptions: {
            select: {
              id: true,
              prescriptionDate: true,
              items: {
                select: {
                  id: true,
                  medicineName: true,
                  dosage: true,
                  frequency: true,
                  duration: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
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
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateConsultation(
  id: string,
  consultationData: Partial<ConsultationFormData>,
  tenantId: string,
  userId: string
): Promise<ConsultationWithDetails> {
  const consultation = await prisma.consultation.update({
    where: {
      id,
      tenantId,
    },
    data: {
      ...consultationData,
      updatedBy: userId,
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
              dateOfBirth: true,
              gender: true,
            },
          },
          appointment: {
            select: {
              id: true,
              appointmentDate: true,
              appointmentTime: true,
              department: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          vitals: {
            select: {
              id: true,
              bloodPressureSystolic: true,
              bloodPressureDiastolic: true,
              pulseRate: true,
              temperature: true,
              spO2: true,
              recordedAt: true,
            },
            orderBy: {
              recordedAt: "desc",
            },
          },
          prescriptions: {
            select: {
              id: true,
              prescriptionDate: true,
              items: {
                select: {
                  id: true,
                  medicineName: true,
                  dosage: true,
                  frequency: true,
                  duration: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
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
    },
  });

  await createAuditLog({
    action: "UPDATE",
    entityType: "CONSULTATION",
    entityId: consultation.id,
    newValue: { consultationData },
    tenantId,
    performedBy: userId,
  });

  return consultation;
}

export async function completeConsultation(
  id: string,
  tenantId: string,
  userId: string
): Promise<ConsultationWithDetails> {
  return updateConsultation(
    id,
    { status: "COMPLETED" },
    tenantId,
    userId
  );
}

export async function cancelConsultation(
  id: string,
  tenantId: string,
  userId: string
): Promise<ConsultationWithDetails> {
  return updateConsultation(
    id,
    { status: "CANCELLED" },
    tenantId,
    userId
  );
}

