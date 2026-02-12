import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateUser } from '@/lib/authService';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  tenantId: z.string().optional(),
});

export async function POST(request: Request) {
  const body = await request.json();
  const result = loginSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.issues.map(e => e.message).join(', ') },
      { status: 400 }
    );
  }

  const { email, password, tenantId } = result.data;
  const { user, error } = await authenticateUser({ email, password, tenantId });

  if (error || !user) {
    return NextResponse.json({ error: error || 'Authentication failed' }, { status: 401 });
  }

  // TODO: Set session/cookie here (implementation depends on your session strategy)
  // For demo, just return user info
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
      tenantId: user.tenantId,
    },
  });
}
