import { prisma } from "@/lib/prisma";

/**
 * Generate a unique UHID (Unique Hospital ID) for a patient within a tenant.
 * Format: YYYYMMDD + sequential number (e.g., 20260203-0001)
 */
export async function generateUHID(tenantId: string): Promise<string> {
  const today = new Date();
  const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD

  // Find the highest UHID for today in this tenant
  const lastPatient = await prisma.patient.findFirst({
    where: {
      tenantId,
      uhid: {
        startsWith: datePrefix
      }
    },
    orderBy: {
      uhid: 'desc'
    },
    select: {
      uhid: true
    }
  });

  let sequenceNumber = 1;
  if (lastPatient) {
    // Extract the sequence number from the last UHID
    const lastSequence = parseInt(lastPatient.uhid.split('-')[1] || '0');
    sequenceNumber = lastSequence + 1;
  }

  // Format as YYYYMMDD-XXXX (zero-padded to 4 digits)
  const uhid = `${datePrefix}-${sequenceNumber.toString().padStart(4, '0')}`;

  return uhid;
}

/**
 * Calculate age from date of birth
 */
export function calculateAge(dateOfBirth: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
    age--;
  }

  return age;
}