import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TenantLogo } from '@/components/ui/TenantLogo';
import { HomeIcon, UsersIcon, CalendarIcon, ChartBarIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/dashboard/staff', label: 'Staff', icon: UsersIcon },
  { href: '/dashboard/appointments', label: 'Appointments', icon: CalendarIcon },
  { href: '/dashboard/reports', label: 'Reports', icon: ChartBarIcon },
  { href: '/dashboard/settings', label: 'Settings', icon: Cog6ToothIcon },
];

export function Sidebar({ tenant }: { tenant?: { logoUrl?: string; name: string; primaryColor?: string } }) {
  const pathname = usePathname();
  return (
    <aside
      className="relative w-64 min-h-screen bg-gradient-to-b from-primary/90 to-primary/60 text-white shadow-xl flex flex-col"
      style={tenant?.primaryColor ? { background: `linear-gradient(180deg, ${tenant.primaryColor} 0%, #2563eb 100%)` } : {}}
    >
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <TenantLogo logoUrl={tenant?.logoUrl} name={tenant?.name} />
        <span className="font-bold text-lg tracking-tight truncate">{tenant?.name || 'HMS Cloud'}</span>
      </div>
      <nav className="flex-1 py-4">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={
                    'flex items-center gap-3 px-6 py-2 rounded-lg transition-all duration-150 group ' +
                    (active
                      ? 'bg-white/10 border-l-4 border-emerald-400 text-white shadow-md'
                      : 'hover:bg-white/5 hover:text-emerald-200 text-white/80')
                  }
                  style={active && tenant?.primaryColor ? { borderLeftColor: tenant.primaryColor } : {}}
                >
                  <Icon className="h-5 w-5 text-white/70 group-hover:text-emerald-300 transition" />
                  <span className="font-medium text-base">{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto px-6 py-4 text-xs text-white/60">
        &copy; {new Date().getFullYear()} HMS Cloud
      </div>
    </aside>
  );
}
