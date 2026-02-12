import React from 'react';
import Link from 'next/link';
import { cookies } from 'next/headers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Example: get user role from cookie/session
  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value;

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-gray-900 text-white p-6">
        <nav>
          <ul>
            <li>
              <Link href="/dashboard">Dashboard</Link>
            </li>
            {role === 'SUPER_ADMIN' && (
              <li>
                <Link href="/dashboard/super-admin">Super Admin Panel</Link>
              </li>
            )}
            {(role === 'TENANT_ADMIN' || role === 'USER') && (
              <li>
                <Link href="/dashboard/tenant">Tenant Panel</Link>
              </li>
            )}
            <li>
              <Link href="/dashboard/profile">Profile</Link>
            </li>
          </ul>
        </nav>
      </aside>
      <main className="flex-1 bg-gray-100">{children}</main>
    </div>
  );
}

/*
Why side nav was not rendering earlier:
- In Next.js App Router, layouts must be placed in the correct segment (here, src/app/(dashboard)/layout.tsx).
- If you import the layout manually or place it outside the segment, it won't wrap the dashboard routes.
- Only files named layout.tsx in a route segment are automatically applied to all child pages.
*/
