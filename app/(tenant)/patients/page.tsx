import { Suspense } from "react";
import { EnterprisePatientList } from "@/components/patients/enterprise-patient-list";
import { Loader2 } from "lucide-react";

export default function PatientsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <Suspense 
        fallback={
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading patients...</span>
          </div>
        }
      >
        <EnterprisePatientList />
      </Suspense>
    </div>
  );
}