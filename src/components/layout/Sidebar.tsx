'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TenantLogo } from '@/components/ui/TenantLogo';
import { 
  HomeIcon, 
  UsersIcon, 
  CalendarIcon, 
  ChartBarIcon, 
  Cog6ToothIcon,
  ChevronLeftIcon,
  ChevronRightIcon
} from '@heroicons/react/24/outline';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: HomeIcon },
  { href: '/dashboard/staff', label: 'Staff', icon: UsersIcon },
  { href: '/dashboard/appointments', label: 'Appointments', icon: CalendarIcon },
  { href: '/dashboard/reports', label: 'Reports', icon: ChartBarIcon },
  { href: '/dashboard/settings', label: 'Settings', icon: Cog6ToothIcon },
];

export function Sidebar({ tenant }: { tenant?: { logoUrl?: string; name: string; primaryColor?: string } }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`relative min-h-screen bg-[#0F172A] shadow-xl flex flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-[70px]' : 'w-[240px]'
      }`}
    >
      {/* Header with Logo and Toggle Button */}
      <div
        className={`flex items-center gap-3 px-4 py-6 border-b border-slate-700/20 ${
          isCollapsed ? 'justify-center' : 'justify-between'
        } transition-all duration-300`}
      >
        {!isCollapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <TenantLogo logoUrl={tenant?.logoUrl} name={tenant?.name} />
            <span className="font-bold text-lg text-white truncate">{tenant?.name || 'HMS'}</span>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-[#1E293B] transition-all duration-300 text-[#94A3B8] hover:text-white flex-shrink-0"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <ChevronLeftIcon className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <li key={href} className="relative group">
                <Link
                  href={href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-300 ease-in-out relative ${
                    active
                      ? 'bg-[#2563EB] text-white'
                      : 'text-[#94A3B8] hover:bg-[#1E293B] hover:text-white'
                  } ${isCollapsed ? 'justify-center' : ''}`}
                  title={isCollapsed ? label : ''}
                >
                  {active && !isCollapsed && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r" />
                  )}
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-medium text-sm transition-opacity duration-300">
                      {label}
                    </span>
                  )}
                </Link>

                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 px-3 py-1.5 bg-slate-900 border border-slate-700 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap z-50 transform">
                    {label}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div
        className={`px-4 py-4 border-t border-slate-700/20 text-[#64748B] text-xs text-center transition-all duration-300 ${
          isCollapsed ? 'opacity-0 h-0 py-0' : 'opacity-100'
        }`}
      >
        &copy; {new Date().getFullYear()} HMS
      </div>
    </aside>
  );
}
