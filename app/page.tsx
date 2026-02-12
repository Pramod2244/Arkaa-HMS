import Link from "next/link";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const session = await getSession();
  if (session?.isSuperAdmin) redirect("/superadmin/dashboard");
  if (session?.tenantId) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <h1 className="text-3xl font-bold text-slate-900">HMS Cloud</h1>
      <p className="mt-2 text-slate-600">Multi-tenant Hospital Management System</p>
      <div className="mt-8 flex flex-wrap justify-center gap-4">
        <Link href="/login">
          <Button>Tenant Login</Button>
        </Link>
        <Link href="/superadmin/login">
          <Button variant="outline">Super Admin Login</Button>
        </Link>
      </div>
    </div>
  );
}
