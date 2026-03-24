import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { TenantLayoutShell } from "@/components/tenant-layout-shell";
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
      <TenantLayoutShell session={session}>{children}</TenantLayoutShell>
    </PatientSelectionProvider>
  );
}
