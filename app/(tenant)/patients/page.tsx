import { Suspense } from "react";
import { PatientList } from "@/components/patients/patient-list";

export default function PatientsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
        <p className="text-gray-600">Manage patient registrations and information</p>
      </div>

      <Suspense fallback={<div>Loading patients...</div>}>
        <PatientList />
      </Suspense>
    </div>
  );
}