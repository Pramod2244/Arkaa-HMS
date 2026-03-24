import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import OPDQueue from "@/components/opd/OPDQueue";

export default async function OPDQueuePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const allowed =
    session.isSuperAdmin ||
    session.permissions.includes("OPD_QUEUE_VIEW") ||
    session.permissions.includes("APPOINTMENT_VIEW");
  if (!allowed) {
    redirect("/appointments");
  }

  return (
    <div className="space-y-6">
      <OPDQueue />
    </div>
  );
}
