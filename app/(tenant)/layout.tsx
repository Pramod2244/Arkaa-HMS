import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TenantSidebar } from "@/components/tenant-sidebar";
import { TenantNavbar } from "@/components/tenant-navbar";
import { PageTransition } from "@/components/ui/PageTransition";
import { PatientSelectionProvider } from "@/contexts/patient-selection-context";

export default async function TenantLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.isSuperAdmin) redirect("/superadmin/dashboard");
  if (!session.tenantId || !session.tenantCode) redirect("/login");

  return (
    <PatientSelectionProvider>
      <div className="min-h-screen bg-slate-50">
        <TenantSidebar session={session} />
        <div className="pl-72">
          <TenantNavbar session={session} />
          <main className="p-6">
            <PageTransition>{children}</PageTransition>
          </main>
        </div>
      </div>
    </PatientSelectionProvider>
  );
}
