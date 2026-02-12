import { prisma } from './prisma';
import bcrypt from 'bcryptjs';

export async function authenticateUser({
  email,
  password,
  tenantId,
}: {
  email: string;
  password: string;
  tenantId?: string;
}) {
  const user = await prisma.user.findFirst({
    where: {
      email,
      tenantId: tenantId ?? null,
    },
    include: { tenant: true },
  });

  if (!user) {
    return { error: 'Invalid email or password.' };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: 'Invalid email or password.' };
  }

  if (user.isSuperAdmin) { 
    // SUPER_ADMIN can login without tenant
    return { user };
  }

  if (!tenantId) {
    return { error: 'Tenant ID required for tenant users.' };
  }

  if (user.tenantId !== tenantId) {
    return { error: 'User does not belong to this tenant.' };
  }

  return { user };
}
