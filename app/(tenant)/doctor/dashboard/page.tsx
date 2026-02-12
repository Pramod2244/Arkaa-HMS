import DoctorDashboard from "@/components/doctor/doctor-dashboard";

export const metadata = {
  title: "Doctor Dashboard | HMS",
  description: "Doctor OPD Dashboard - Manage your daily consultations",
};

export default function DoctorDashboardPage() {
  return (
    <div className="container mx-auto py-6">
      <DoctorDashboard />
    </div>
  );
}
