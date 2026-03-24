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
  Store,
  Factory,
  Truck,
  Package,
  ClipboardList,
  ShoppingCart,
  FileInput,
  AlertTriangle,
  ShoppingBag,
  History,
  CreditCard,
  RotateCcw,
  BarChart3,
  PieChart,
  TrendingUp,
  ShieldCheck,
  ChevronLeft,
} from "lucide-react";

function hasPermission(session: SessionPayload, code?: string): boolean {
  if (session.isSuperAdmin) return true;
  if (!code) return true;
  // Support OR-listing of permissions e.g. "OPD_QUEUE_VIEW|APPOINTMENT_VIEW"
  const codes = code.split("|").map((c) => c.trim()).filter(Boolean);
  if (codes.length === 0) return true;
  return codes.some((c) => session.permissions.includes(c));
}

const navItems: { href: string; label: string; icon: React.ElementType; permission?: string; section?: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "main" },
  { href: "/patients", label: "Patients", icon: UserPlus, permission: "PATIENT_VIEW", section: "main" },
  
  { href: "/doctor/dashboard", label: "My OPD", icon: BriefcaseMedical, permission: "CONSULTATION_VIEW", section: "clinical" },
  { href: "/appointments", label: "Appointments", icon: Calendar, permission: "APPOINTMENT_VIEW", section: "clinical" },
  { href: "/opd-queue", label: "OPD Queue", icon: ClipboardList, permission: "OPD_QUEUE_VIEW|APPOINTMENT_VIEW", section: "clinical" },
  { href: "/consultations", label: "Consultations", icon: Stethoscope, permission: "CONSULTATION_VIEW", section: "clinical" },
  { href: "/vitals", label: "Vitals", icon: Activity, permission: "VITAL_VIEW", section: "clinical" },
  { href: "/prescriptions", label: "Prescriptions", icon: Pill, permission: "PRESCRIPTION_VIEW", section: "clinical" },
  { href: "/visits", label: "Visits", icon: ClipboardCheck, permission: "VISIT_VIEW", section: "clinical" },
  
  { href: "/admin/users", label: "Users", icon: Users, permission: "USER_MANAGE", section: "management" },
  { href: "/admin/roles", label: "Roles", icon: Shield, permission: "ROLE_MANAGE", section: "management" },
  { href: "/admin/permissions", label: "Permissions", icon: Key, permission: "ROLE_MANAGE", section: "management" },
  
  { href: "/admin/reports", label: "Report Dashboard", icon: FileText, permission: "REPORTS_VIEW", section: "reports" },
  { href: "/admin/reports/billing", label: "Billing Analysis", icon: TrendingUp, permission: "REPORTS_VIEW", section: "reports" },
  { href: "/admin/reports/clinical", label: "Clinical Insights", icon: BarChart3, permission: "REPORTS_VIEW", section: "reports" },
  { href: "/admin/reports/inventory", label: "Inventory Alerts", icon: PieChart, permission: "REPORTS_VIEW", section: "reports" },
  { href: "/admin/reports/audit", label: "Audit Logs", icon: ShieldCheck, permission: "REPORTS_VIEW", section: "reports" },
    { href: "/admin/settings", label: "Settings", icon: Settings, permission: "SETTINGS_MANAGE", section: "settings" },
  
    { href: "/pharmacy/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "PHARMACY_SALE_VIEW", section: "pharmacy" },
    { href: "/medical-masters/departments", label: "Departments", icon: Building2, permission: "SETTINGS_MANAGE", section: "masters" },  { href: "/medical-masters/doctors", label: "Doctors", icon: Stethoscope, permission: "SETTINGS_MANAGE", section: "masters" },

  { href: "/pharmacy/masters/stores", label: "Stores", icon: Store, permission: "PHARMACY_STORE_VIEW", section: "pharmacy" },
  { href: "/pharmacy/masters/manufacturers", label: "Manufacturers", icon: Factory, permission: "PHARMACY_MANUFACTURER_VIEW", section: "pharmacy" },
  { href: "/pharmacy/masters/vendors", label: "Vendors", icon: Truck, permission: "PHARMACY_VENDOR_VIEW", section: "pharmacy" },
  { href: "/pharmacy/masters/products", label: "Products", icon: Package, permission: "PHARMACY_PRODUCT_VIEW", section: "pharmacy" },
  { href: "/pharmacy/inventory/stock", label: "Stock", icon: ClipboardList, permission: "PHARMACY_INVENTORY_VIEW", section: "pharmacy" },
  { href: "/pharmacy/purchase-orders", label: "Purchase Orders", icon: ShoppingCart, permission: "PO_VIEW", section: "pharmacy" },
  { href: "/pharmacy/grn", label: "Goods Receipt", icon: FileInput, permission: "GRN_VIEW", section: "pharmacy" },
  { href: "/pharmacy/expiry", label: "Expiry Dashboard", icon: AlertTriangle, permission: "PHARMACY_EXPIRY_VIEW", section: "pharmacy" },
  { href: "/pharmacy/op-sales", label: "OP Pharmacy", icon: ShoppingBag, permission: "PHARMACY_SALE_VIEW", section: "pharmacy" },
  { href: "/pharmacy/ip-sales", label: "IP Pharmacy", icon: ShoppingBag, permission: "PHARMACY_SALE_VIEW", section: "pharmacy" },
  { href: "/pharmacy/returns", label: "Returns", icon: RotateCcw, permission: "PHARMACY_RETURN_VIEW", section: "pharmacy" },
  { href: "/pharmacy/sales-history", label: "Sales History", icon: History, permission: "PHARMACY_SALE_VIEW", section: "pharmacy" },
  { href: "/pharmacy/credit-ledger", label: "Credit Ledger", icon: CreditCard, permission: "PHARMACY_CREDIT_VIEW", section: "pharmacy" },
];

export function TenantSidebar({
  session,
  collapsed,
  setCollapsed,
}: {
  session: SessionPayload;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
}) {
  const pathname = usePathname();

  const visibleNavItems = navItems.filter(
    (item) => !item.permission || hasPermission(session, item.permission)
  );

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const renderNavLink = (item: (typeof navItems)[number]) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <div key={item.href} className="group relative">
        <Link
          href={item.href}
          className={cn(
            "group relative flex items-center rounded-lg py-2.5 text-sm font-medium transition-all duration-300 ease-in-out",
            collapsed ? "justify-center px-2" : "gap-3 px-3",
            active
              ? "bg-[#5865F2] text-white shadow-sm"
              : "text-slate-500 hover:bg-[#EEF2FF] hover:text-slate-800 transition-colors duration-200"
          )}
          title={collapsed ? item.label : undefined}
        >
          {active && <div className="absolute left-0 top-0 h-full w-1 rounded-r-full bg-white/90" />}
          <Icon
            className={cn(
              "h-5 w-5 shrink-0 transition-all duration-300 ease-in-out",
              active ? "text-white" : "text-slate-400 group-hover:text-slate-700"
            )}
          />
          <span
            className={cn(
              "truncate transition-opacity duration-200 ease-in-out",
              collapsed ? "ml-0 w-0 overflow-hidden opacity-0" : "ml-0 w-auto opacity-100"
            )}
          >
            {item.label}
          </span>
        </Link>
        {collapsed && (
          <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity duration-300 group-hover:opacity-100">
            {item.label}
          </div>
        )}
      </div>
    );
  };

  const renderSection = (title: string, section: string) => {
    const sectionItems = visibleNavItems.filter((item) => item.section === section);
    if (!sectionItems.length) return null;

    return (
      <div>
        {!collapsed && (
          <h3 className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </h3>
        )}
        <div className="space-y-1">{sectionItems.map(renderNavLink)}</div>
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "pointer-events-auto flex h-screen shrink-0 flex-col overflow-x-hidden border-r border-slate-200 bg-white text-slate-600 shadow-sm transition-all duration-300 ease-in-out",
        collapsed ? "w-[70px]" : "w-[240px]"
      )}
    >
      {/* Top Section - Tenant Info */}
      <div
        className={cn(
          "relative flex h-16 items-center justify-between border-b border-slate-200 px-4",
          collapsed ? "gap-0" : "gap-3"
        )}
      >
        <div className="flex items-center">
          <TenantLogo size={collapsed ? 36 : 40} name={undefined} />
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-slate-500 transition-transform duration-200 ease-in-out hover:scale-110 hover:bg-slate-100 hover:text-slate-700"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft
            className={cn(
              "h-4 w-4 transition-transform duration-300 ease-in-out",
              collapsed ? "rotate-180" : "rotate-0"
            )}
          />
        </button>
      </div>

      {/* Navigation Section */}
      <nav className={cn("flex-1 overflow-y-auto overflow-x-hidden py-6", collapsed ? "px-2" : "px-4")}>
        <div className="space-y-8">
          {renderSection("Main", "main")}
          {renderSection("Clinical", "clinical")}
          {renderSection("Management", "management")}
          {renderSection("Reports", "reports")}
          {renderSection("Medical Masters", "masters")}
          {renderSection("Pharmacy", "pharmacy")}
        </div>
      </nav>

      {/* Bottom Section - User Actions */}
      <div className={cn("border-t border-slate-200", collapsed ? "p-2" : "p-4")}>
        <div className="space-y-1">
          <div className="group relative">
            <Link
              href="/settings"
              className={cn(
                "group flex items-center rounded-lg py-2.5 text-sm font-medium text-slate-500 transition-all duration-300 ease-in-out hover:bg-[#EEF2FF] hover:text-slate-800 transition-colors duration-200",
                collapsed ? "justify-center px-2" : "gap-3 px-3"
              )}
              title={collapsed ? "Settings" : undefined}
            >
              <Settings className="h-5 w-5 text-slate-400 transition-all duration-300 ease-in-out group-hover:text-slate-700" />
              <span
                className={cn(
                  "transition-opacity duration-200 ease-in-out",
                  collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
                )}
              >
                Settings
              </span>
            </Link>
            {collapsed && (
              <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 opacity-0 shadow-lg transition-opacity duration-300 group-hover:opacity-100">
                Settings
              </div>
            )}
          </div>

          <button
            onClick={async () => {
              await fetch("/api/auth/logout", { method: "POST" });
              window.location.href = "/login";
            }}
            className={cn(
              "group flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-rose-500 transition-all duration-300 ease-in-out hover:bg-rose-50 hover:text-rose-600 transition-colors duration-200",
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            )}
            title={collapsed ? "Logout" : undefined}
          >
            <LogOut className="h-5 w-5 text-rose-500 transition-all duration-300 ease-in-out group-hover:text-rose-600" />
            <span
              className={cn(
                "transition-opacity duration-200 ease-in-out",
                collapsed ? "w-0 overflow-hidden opacity-0" : "w-auto opacity-100"
              )}
            >
              Logout
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
}
