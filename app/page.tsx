import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import LandingView from "@/components/auth/LandingView";

export default async function HomePage() {
  const session = await getSession();
  if (session?.isSuperAdmin) redirect("/superadmin/dashboard");
  if (session?.tenantId) redirect("/dashboard");

  return <LandingView />;
}
