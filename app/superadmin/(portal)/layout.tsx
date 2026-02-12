import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SuperAdminNav } from "@/components/superadmin-nav";

export default async function SuperAdminPortalLayout({
  children,
}: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.isSuperAdmin) {
    redirect("/superadmin/login");
  }
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <SuperAdminNav user={session} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
