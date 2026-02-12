// Fix script: Create Visit records for checked-in appointments missing visits
import { prisma } from './lib/prisma';

async function main() {
  try {
    // Find checked-in appointments without visits
    const checkedInAppointments = await prisma.appointment.findMany({
      where: {
        status: 'CHECKED_IN',
      },
      include: {
        patient: true,
        doctorMaster: {
          select: { id: true, userId: true, fullName: true },
        },
        department: true,
      },
    });

    console.log(`Found ${checkedInAppointments.length} checked-in appointments`);

    for (const apt of checkedInAppointments) {
      // Check if visit already exists
      const existingVisit = await prisma.visit.findFirst({
        where: { appointmentId: apt.id },
      });

      if (existingVisit) {
        console.log(`Visit already exists for appointment ${apt.id}`);
        continue;
      }

      // Generate token number
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const lastToken = await prisma.visit.findFirst({
        where: {
          tenantId: apt.tenantId,
          departmentId: apt.departmentId,
          checkInTime: { gte: today, lt: tomorrow },
        },
        orderBy: { tokenNumber: 'desc' },
        select: { tokenNumber: true },
      });

      const tokenNumber = (lastToken?.tokenNumber || 0) + 1;

      // Get visit number
      const lastVisit = await prisma.visit.findFirst({
        where: { patientId: apt.patientId },
        orderBy: { visitNumber: 'desc' },
        select: { visitNumber: true },
      });

      const visitNumber = (lastVisit?.visitNumber || 0) + 1;

      // Create visit
      const visit = await prisma.visit.create({
        data: {
          patientId: apt.patientId,
          appointmentId: apt.id,
          doctorId: apt.doctorMaster?.userId || null,
          departmentId: apt.departmentId,
          visitType: 'OPD',
          visitNumber,
          tokenNumber,
          status: 'WAITING',
          priority: 'NORMAL',
          checkInTime: apt.checkedInAt || new Date(),
          notes: apt.chiefComplaint,
          tenantId: apt.tenantId,
          createdBy: 'SYSTEM_MIGRATION',
          updatedBy: 'SYSTEM_MIGRATION',
        },
      });

      console.log(`Created visit ${visit.id} for appointment ${apt.id} (Token #${tokenNumber})`);

      // Create OPD Queue Snapshot
      const patientName = [apt.patient.firstName, apt.patient.lastName].filter(Boolean).join(' ');

      await prisma.oPDQueueSnapshot.upsert({
        where: { visitId: visit.id },
        create: {
          tenantId: apt.tenantId,
          visitId: visit.id,
          patientId: apt.patientId,
          patientUhid: apt.patient.uhid,
          patientName,
          patientPhone: apt.patient.phoneNumber,
          patientGender: apt.patient.gender,
          patientDob: apt.patient.dateOfBirth,
          doctorId: apt.doctorMaster?.userId || null,
          doctorName: apt.doctorMaster?.fullName || null,
          departmentId: apt.departmentId || '',
          departmentName: apt.department?.name || '',
          tokenNumber,
          visitNumber,
          priority: 'NORMAL',
          status: 'WAITING',
          visitType: 'OPD',
          checkInTime: apt.checkedInAt || new Date(),
        },
        update: {},
      });

      console.log(`Created OPD snapshot for visit ${visit.id}`);
    }

    console.log('\n=== Migration complete ===');

    // Verify
    const visits = await prisma.visit.count();
    const snapshots = await prisma.oPDQueueSnapshot.count();
    console.log(`Total visits: ${visits}`);
    console.log(`Total OPD snapshots: ${snapshots}`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
