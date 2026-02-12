import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Home, ChevronRight, Shield, Lock } from "lucide-react";

// Breadcrumb Component
function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-6">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1">
        <Home className="h-4 w-4" />
        Dashboard
      </Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-400">Administration</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Permissions</span>
    </nav>
  );
}

export default async function AdminPermissionsPage() {
  const session = await getSession();
  if (!session?.tenantId) redirect("/login");
  try {
    requirePermission(session, "ROLE_MANAGE");
  } catch {
    redirect("/dashboard");
  }

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { code: "asc" }],
  });

  const byModule = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
    const m = p.module ?? "Other";
    if (!acc[m]) acc[m] = [];
    acc[m].push(p);
    return acc;
  }, {});

  const sortedModules = Object.keys(byModule).sort();

  return (
    <div className="p-6">
      <Breadcrumb />
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-100 rounded-lg">
          <Shield className="h-6 w-6 text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">System Permissions</h1>
          <p className="text-sm text-slate-500">
            View all permission codes (assign to roles via{" "}
            <Link href="/admin/roles" className="text-blue-600 hover:underline">
              Role Management
            </Link>
            )
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-6">
        <div className="px-4 py-2 bg-slate-100 rounded-lg">
          <span className="text-2xl font-semibold text-slate-900">{permissions.length}</span>
          <span className="text-sm text-slate-500 ml-2">Total Permissions</span>
        </div>
        <div className="px-4 py-2 bg-slate-100 rounded-lg">
          <span className="text-2xl font-semibold text-slate-900">{sortedModules.length}</span>
          <span className="text-sm text-slate-500 ml-2">Modules</span>
        </div>
      </div>

      {/* Permission Modules */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sortedModules.map((module) => {
          const perms = byModule[module];
          return (
            <div key={module} className="border border-slate-200 rounded-lg bg-white shadow-sm overflow-hidden">
              {/* Module Header */}
              <div className="px-4 py-3 bg-slate-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-slate-400" />
                  <h3 className="font-semibold text-slate-800">{module}</h3>
                </div>
                <span className="text-xs text-slate-500 bg-slate-200 px-2 py-0.5 rounded-full">
                  {perms.length}
                </span>
              </div>
              
              {/* Permissions List */}
              <ul className="divide-y divide-slate-100">
                {perms.map((p) => (
                  <li key={p.id} className="px-4 py-2 hover:bg-slate-50">
                    <code className="text-xs font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {p.code}
                    </code>
                    <p className="text-sm text-slate-600 mt-0.5">{p.name}</p>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
