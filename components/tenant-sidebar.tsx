"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { SessionPayload } from "@/lib/auth";
import { TenantLogo } from "@/components/ui/TenantLogo";
import {
  LayoutDashboard,
  Users,
  Shield,
  Key,
  Settings,
  FileText,
  Building2,
  LogOut,
  UserPlus,
  Calendar,
  Stethoscope,
  Activity,
  Pill,
  ClipboardCheck,
  BriefcaseMedical,
} from "lucide-react";

function hasPermission(session: SessionPayload, code: string): boolean {
  if (session.isSuperAdmin) return true;
  return session.permissions.includes(code);
}

const navItems: { href: string; label: string; icon: React.ElementType; permission?: string; section?: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/departments", label: "Departments", icon: Building2, section: "main" },
  { href: "/patients", label: "Patients", icon: UserPlus, permission: "PATIENT_VIEW", section: "main" },
  
  { href: "/doctor/dashboard", label: "My OPD", icon: BriefcaseMedical, permission: "CONSULTATION_VIEW", section: "clinical" },
  { href: "/appointments", label: "Appointments", icon: Calendar, permission: "APPOINTMENT_VIEW", section: "clinical" },
  { href: "/consultations", label: "Consultations", icon: Stethoscope, permission: "CONSULTATION_VIEW", section: "clinical" },
  { href: "/vitals", label: "Vitals", icon: Activity, permission: "VITAL_VIEW", section: "clinical" },
  { href: "/prescriptions", label: "Prescriptions", icon: Pill, permission: "PRESCRIPTION_VIEW", section: "clinical" },
  { href: "/visits", label: "Visits", icon: ClipboardCheck, permission: "VISIT_VIEW", section: "clinical" },
  
  { href: "/admin/users", label: "Users", icon: Users, permission: "USER_MANAGE", section: "management" },
  { href: "/admin/roles", label: "Roles", icon: Shield, permission: "ROLE_MANAGE", section: "management" },
  { href: "/admin/permissions", label: "Permissions", icon: Key, permission: "ROLE_MANAGE", section: "management" },
  
  { href: "/admin/reports", label: "Reports", icon: FileText, permission: "REPORTS_VIEW", section: "reports" },
  { href: "/admin/settings", label: "Settings", icon: Settings, permission: "SETTINGS_MANAGE", section: "settings" },
  
  { href: "/medical-masters/departments", label: "Departments", icon: Building2, permission: "SETTINGS_MANAGE", section: "masters" },
  { href: "/medical-masters/doctors", label: "Doctors", icon: Stethoscope, permission: "SETTINGS_MANAGE", section: "masters" },
];

export function TenantSidebar({ session }: { session: SessionPayload }) {
  const pathname = usePathname();

  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(session, item.permission)
  );

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="fixed left-0 top-0 z-50 h-screen w-72 bg-slate-900 text-slate-300 shadow-xl pointer-events-auto">
      {/* Top Section - Tenant Info */}
      <div className="flex h-20 items-center border-b border-slate-700 px-6">
        <div className="flex items-center space-x-3">
          <TenantLogo
            size={44}
            name={session.tenantName || session.tenantCode || undefined}
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold text-white">
              {session.tenantName || session.tenantCode}
            </h2>
            <p className="text-xs text-slate-400">Healthcare Management</p>
          </div>
        </div>
      </div>

      {/* Navigation Section */}
      <nav className="flex flex-1 flex-col px-4 py-6">
        <div className="space-y-8">
          {/* Main Section */}
          <div>
            <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Main
            </h3>
            <div className="space-y-1">
              {visibleNavItems
                .filter((item) => item.section === "main")
                .map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-blue-600/10 text-blue-400 shadow-sm"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      )}
                    >
                      {active && (
                        <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-r-full" />
                      )}
                      <Icon
                        className={cn(
                          "h-5 w-5 transition-colors duration-200",
                          active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
            </div>
          </div>

          {/* Clinical Section */}
          {visibleNavItems.some((item) => item.section === "clinical") && (
            <div>
              <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Clinical
              </h3>
              <div className="space-y-1">
                {visibleNavItems
                  .filter((item) => item.section === "clinical")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-blue-600/10 text-blue-400 shadow-sm"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        )}
                      >
                        {active && (
                          <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-r-full" />
                        )}
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors duration-200",
                            active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Management Section */}
          {visibleNavItems.some((item) => item.section === "management") && (
            <div>
              <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Management
              </h3>
              <div className="space-y-1">
                {visibleNavItems
                  .filter((item) => item.section === "management")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-blue-600/10 text-blue-400 shadow-sm"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        )}
                      >
                        {active && (
                          <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-r-full" />
                        )}
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors duration-200",
                            active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Reports Section */}
          {visibleNavItems.some((item) => item.section === "reports") && (
            <div>
              <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Reports
              </h3>
              <div className="space-y-1">
                {visibleNavItems
                  .filter((item) => item.section === "reports")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-blue-600/10 text-blue-400 shadow-sm"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        )}
                      >
                        {active && (
                          <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-r-full" />
                        )}
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors duration-200",
                            active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Medical Masters Section */}
          {visibleNavItems.some((item) => item.section === "masters") && (
            <div>
              <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Medical Masters
              </h3>
              <div className="space-y-1">
                {visibleNavItems
                  .filter((item) => item.section === "masters")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-blue-600/10 text-blue-400 shadow-sm"
                            : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                        )}
                      >
                        {active && (
                          <div className="absolute left-0 top-0 h-full w-1 bg-blue-500 rounded-r-full" />
                        )}
                        <Icon
                          className={cn(
                            "h-5 w-5 transition-colors duration-200",
                            active ? "text-blue-400" : "text-slate-500 group-hover:text-slate-300"
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Bottom Section - User Actions */}
      <div className="border-t border-slate-700 p-4">
        <div className="space-y-1">
          <Link
            href="/settings"
            className="group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-slate-200"
          >
            <Settings className="h-5 w-5 text-slate-500 group-hover:text-slate-300" />
            <span>Settings</span>
          </Link>
          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-400 transition-all duration-200 hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-5 w-5 text-red-500 group-hover:text-red-300" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
