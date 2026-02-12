"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { SessionPayload } from "@/lib/auth";
import { LayoutDashboard, Building2, LogOut } from "lucide-react";

export function SuperAdminNav({ user }: { user: SessionPayload }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/superadmin/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white shadow-sm">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-6">
          <Link href="/superadmin/dashboard" className="text-lg font-semibold text-slate-800">
            HMS Cloud
          </Link>
          <nav className="hidden gap-4 md:flex">
            <Link
              href="/superadmin/dashboard"
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/superadmin/tenants"
              className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
            >
              <Building2 className="h-4 w-4" />
              Tenants
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-600">{user.fullName}</span>
          <Button type="button" variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </header>
  );
}
