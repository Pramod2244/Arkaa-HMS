import { Suspense } from "react";
import { ConsultationScreen } from "@/components/clinical/consultation-screen";

interface ConsultationPageProps {
  params: Promise<{ visitId: string }>;
}

export default async function ConsultationPage({ params }: ConsultationPageProps) {
  const { visitId } = await params;

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading consultation...</span>
      </div>
    }>
      <ConsultationScreen visitId={visitId} />
    </Suspense>
  );
}