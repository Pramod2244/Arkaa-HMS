"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function getDashboardData() {
  try {
    const session = await getSession();
    if (!session?.tenantId) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [patientCount, userCount, departmentCount] = await Promise.all([
      prisma.patient.count({ where: { tenantId: session.tenantId } }),
      prisma.user.count({ where: { tenantId: session.tenantId, isActive: true } }),
      prisma.department.count({ where: { tenantId: session.tenantId } }),
    ]);

    return {
      patientCount,
      userCount,
      departmentCount,
      tenantName: session.tenantName,
    };
  } catch (error) {
    console.error('Dashboard data error:', error);
    return {
      patientCount: 0,
      userCount: 0,
      departmentCount: 0,
      tenantName: null,
    };
  }
}