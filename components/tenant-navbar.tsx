"use client";

import { useRouter, usePathname } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { SessionPayload } from "@/lib/auth";
import { LogOut, User, Settings, ChevronDown, Home } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';

  const lastSegment = segments[segments.length - 1];
  const titleMap: Record<string, string> = {
    'dashboard': 'Dashboard',
    'users': 'User Management',
    'roles': 'Role Management',
    'permissions': 'Permissions',
    'departments': 'Departments',
    'settings': 'Settings',
    'reports': 'Reports',
  };

  return titleMap[lastSegment] || lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
}

function generateBreadcrumbs(pathname: string): Array<{ label: string; href?: string }> {
  const segments = pathname.split('/').filter(Boolean);
  const breadcrumbs = [{ label: 'Dashboard', href: '/dashboard' }];

  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    if (segment !== 'dashboard') {
      const label = segment.charAt(0).toUpperCase() + segment.slice(1).replace('-', ' ');
      breadcrumbs.push({ label, href: currentPath });
    }
  }

  return breadcrumbs;
}

export function TenantNavbar({ session }: { session: SessionPayload }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const breadcrumbs = generateBreadcrumbs(pathname);
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm">
      <div className="h-16 px-6">
        <div className="flex items-center justify-between h-full">
          {/* Left side - Breadcrumbs and Page Title */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-slate-600">
              {breadcrumbs.map((crumb, index) => (
                <div key={crumb.href || index} className="flex items-center">
                  {index > 0 && <span className="mx-2 text-slate-400">/</span>}
                  {crumb.href ? (
                    <button
                      onClick={() => router.push(crumb.href!)}
                      className="hover:text-slate-900 transition-colors"
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className="font-medium text-slate-900">{crumb.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right side - User Menu */}
          <div className="flex items-center space-x-4">
            {/* System Status */}
            <div className="hidden md:flex items-center space-x-2 text-sm text-slate-600">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Online</span>
            </div>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center space-x-3 hover:bg-slate-50 rounded-lg px-3 py-2 transition-colors"
              >
                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-slate-600" />
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium text-slate-900">{session.fullName}</p>
                  <p className="text-xs text-slate-500">{session.email}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>

              <AnimatePresence>
                {showUserMenu && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-30"
                      onClick={() => setShowUserMenu(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 z-40"
                    >
                      <div className="p-4 border-b border-slate-200">
                        <p className="font-medium text-slate-900">{session.fullName}</p>
                        <p className="text-sm text-slate-600">{session.email}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {session.tenantName || session.tenantCode}
                        </p>
                      </div>
                      <div className="py-2">
                        <button className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
                          <Settings className="h-4 w-4" />
                          <span>Account Settings</span>
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
