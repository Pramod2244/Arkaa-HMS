"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { VitalsRecording } from "./vitals-recording";
import { ConsultationForm } from "./consultation-form";
import { PrescriptionForm } from "./prescription-form";
import { Activity, Stethoscope, Pill, FileText, CheckCircle, Clock } from "lucide-react";

interface Patient {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string | null;
  phoneNumber: string;
  dateOfBirth: Date | null;
  gender: string | null;
}

interface Visit {
  id: string;
  visitType: string;
  priority: string;
  status: string;
  createdAt: Date;
  appointment: {
    id: string;
    appointmentDate: Date;
    appointmentTime: string | null;
    department: {
      id: string;
      name: string;
    } | null;
  } | null;
}

interface Consultation {
  id: string;
  chiefComplaint: string;
  consultationStatus: string;
  createdAt: Date;
  doctor: {
    id: string;
    firstName: string;
    lastName: string | null;
  };
}

interface DoctorConsultationProps {
  visitId: string;
}

export function DoctorConsultation({ visitId }: DoctorConsultationProps) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [vitals, setVitals] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [showVitalsDialog, setShowVitalsDialog] = useState(false);
  const [showConsultationDialog, setShowConsultationDialog] = useState(false);
  const [showPrescriptionDialog, setShowPrescriptionDialog] = useState(false);

  const router = useRouter();

  useEffect(() => {
    fetchVisitData();
  }, [visitId]);

  const fetchVisitData = async () => {
    try {
      // Fetch visit details
      const visitResponse = await fetch(`/api/visits/${visitId}`);
      const visitResult = await visitResponse.json();

      if (visitResult.success) {
        setVisit(visitResult.data);
        setPatient(visitResult.data.patient);

        // Fetch consultations for this visit
        const consultationsResponse = await fetch(`/api/consultations?visitId=${visitId}`);
        const consultationsResult = await consultationsResponse.json();
        if (consultationsResult.success) {
          setConsultations(consultationsResult.data);
        }

        // Fetch vitals for this visit
        const vitalsResponse = await fetch(`/api/vitals?visitId=${visitId}`);
        const vitalsResult = await vitalsResponse.json();
        if (vitalsResult.success) {
          setVitals(vitalsResult.data);
        }

        // Fetch prescriptions for this patient
        const prescriptionsResponse = await fetch(`/api/prescriptions?patientId=${visitResult.data.patient.id}`);
        const prescriptionsResult = await prescriptionsResponse.json();
        if (prescriptionsResult.success) {
          setPrescriptions(prescriptionsResult.data);
        }
      }
    } catch (error) {
      console.error("Error fetching visit data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleVitalsSuccess = () => {
    setShowVitalsDialog(false);
    fetchVisitData();
  };

  const handleConsultationSuccess = () => {
    setShowConsultationDialog(false);
    fetchVisitData();
  };

  const handlePrescriptionSuccess = () => {
    setShowPrescriptionDialog(false);
    fetchVisitData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading consultation...</p>
        </div>
      </div>
    );
  }

  if (!patient || !visit) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Visit not found</p>
      </div>
    );
  }

  const activeConsultation = consultations.find(c => c.consultationStatus === "IN_PROGRESS");

  return (
    <div className="space-y-6">
      {/* Patient Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">
                {patient.firstName} {patient.lastName}
              </CardTitle>
              <div className="flex items-center gap-4 mt-2">
                <Badge variant="outline">UHID: {patient.uhid}</Badge>
                <Badge variant="outline">{patient.phoneNumber}</Badge>
                {patient.dateOfBirth && (
                  <Badge variant="outline">
                    Age: {new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear()}
                  </Badge>
                )}
                {patient.gender && <Badge variant="outline">{patient.gender}</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={showVitalsDialog} onOpenChange={setShowVitalsDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Activity className="w-4 h-4 mr-2" />
                    Record Vitals
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Record Vitals</DialogTitle>
                  </DialogHeader>
                  <VitalsRecording
                    visitId={visitId}
                    onSuccess={handleVitalsSuccess}
                    onCancel={() => setShowVitalsDialog(false)}
                  />
                </DialogContent>
              </Dialog>

              {!activeConsultation && (
                <Dialog open={showConsultationDialog} onOpenChange={setShowConsultationDialog}>
                  <DialogTrigger asChild>
                    <Button>
                      <Stethoscope className="w-4 h-4 mr-2" />
                      Start Consultation
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Start Consultation</DialogTitle>
                    </DialogHeader>
                    <ConsultationForm
                      visitId={visitId}
                      patientId={patient.id}
                      onSuccess={handleConsultationSuccess}
                      onCancel={() => setShowConsultationDialog(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}

              {activeConsultation && (
                <Dialog open={showPrescriptionDialog} onOpenChange={setShowPrescriptionDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Pill className="w-4 h-4 mr-2" />
                      Create Prescription
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Create Prescription</DialogTitle>
                    </DialogHeader>
                    <PrescriptionForm
                      consultationId={activeConsultation.id}
                      patientId={patient.id}
                      doctorId={activeConsultation.doctor.id}
                      onSuccess={handlePrescriptionSuccess}
                      onCancel={() => setShowPrescriptionDialog(false)}
                    />
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Visit Details */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Visit Type</p>
              <p className="text-lg">{visit.visitType}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Priority</p>
              <Badge variant={visit.priority === "EMERGENCY" ? "destructive" : "default"}>
                {visit.priority}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={visit.status === "COMPLETED" ? "default" : "secondary"}>
                {visit.status}
              </Badge>
            </div>
          </div>
          {visit.appointment && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">Appointment Details</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                <div>
                  <p className="text-sm">Date: {new Date(visit.appointment.appointmentDate).toLocaleDateString()}</p>
                </div>
                {visit.appointment.appointmentTime && (
                  <div>
                    <p className="text-sm">Time: {visit.appointment.appointmentTime}</p>
                  </div>
                )}
                {visit.appointment.department && (
                  <div>
                    <p className="text-sm">Department: {visit.appointment.department.name}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Consultation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="vitals">Vitals ({vitals.length})</TabsTrigger>
          <TabsTrigger value="consultations">Consultations ({consultations.length})</TabsTrigger>
          <TabsTrigger value="prescriptions">Prescriptions ({prescriptions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Latest Vitals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Activity className="w-5 h-5 mr-2" />
                  Latest Vitals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vitals.length > 0 ? (
                  <div className="space-y-2">
                    {vitals[0].bloodPressureSystolic && (
                      <p className="text-sm">
                        <span className="font-medium">BP:</span> {vitals[0].bloodPressureSystolic}/{vitals[0].bloodPressureDiastolic} mmHg
                      </p>
                    )}
                    {vitals[0].pulse && (
                      <p className="text-sm">
                        <span className="font-medium">Pulse:</span> {vitals[0].pulse} bpm
                      </p>
                    )}
                    {vitals[0].temperature && (
                      <p className="text-sm">
                        <span className="font-medium">Temp:</span> {vitals[0].temperature}°{vitals[0].temperatureUnit}
                      </p>
                    )}
                    {vitals[0].spO2 && (
                      <p className="text-sm">
                        <span className="font-medium">SpO2:</span> {vitals[0].spO2}%
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No vitals recorded yet</p>
                )}
              </CardContent>
            </Card>

            {/* Active Consultation */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Stethoscope className="w-5 h-5 mr-2" />
                  Current Consultation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeConsultation ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      <span className="font-medium">Doctor:</span> Dr. {activeConsultation.doctor.firstName} {activeConsultation.doctor.lastName || ""}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Chief Complaint:</span> {activeConsultation.chiefComplaint}
                    </p>
                    <Badge variant="secondary">
                      <Clock className="w-3 h-3 mr-1" />
                      In Progress
                    </Badge>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No active consultation</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vitals" className="space-y-4">
          {vitals.length > 0 ? (
            vitals.map((vital) => (
              <Card key={vital.id}>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {vital.bloodPressureSystolic && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Blood Pressure</p>
                        <p className="text-lg">{vital.bloodPressureSystolic}/{vital.bloodPressureDiastolic} mmHg</p>
                      </div>
                    )}
                    {vital.pulse && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Pulse</p>
                        <p className="text-lg">{vital.pulse} bpm</p>
                      </div>
                    )}
                    {vital.temperature && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Temperature</p>
                        <p className="text-lg">{vital.temperature}°{vital.temperatureUnit}</p>
                      </div>
                    )}
                    {vital.spO2 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">SpO2</p>
                        <p className="text-lg">{vital.spO2}%</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Recorded on {new Date(vital.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Activity className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No vitals recorded for this visit</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="consultations" className="space-y-4">
          {consultations.length > 0 ? (
            consultations.map((consultation) => (
              <Card key={consultation.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-5 h-5" />
                      <span className="font-medium">
                        Dr. {consultation.doctor.firstName} {consultation.doctor.lastName || ""}
                      </span>
                    </div>
                    <Badge variant={consultation.consultationStatus === "COMPLETED" ? "default" : "secondary"}>
                      {consultation.consultationStatus === "COMPLETED" ? (
                        <><CheckCircle className="w-3 h-3 mr-1" /> Completed</>
                      ) : (
                        <><Clock className="w-3 h-3 mr-1" /> In Progress</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-sm mb-2">
                    <span className="font-medium">Chief Complaint:</span> {consultation.chiefComplaint}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Started on {new Date(consultation.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Stethoscope className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No consultations for this visit</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="prescriptions" className="space-y-4">
          {prescriptions.length > 0 ? (
            prescriptions.map((prescription) => (
              <Card key={prescription.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Pill className="w-5 h-5" />
                      <span className="font-medium">
                        Prescription by Dr. {prescription.doctor.firstName} {prescription.doctor.lastName || ""}
                      </span>
                    </div>
                    <Badge variant="outline">
                      {new Date(prescription.prescriptionDate).toLocaleDateString()}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {prescription.items.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div>
                          <p className="font-medium">{item.medicineName}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.dosage} - {item.frequency} - {item.duration}
                          </p>
                        </div>
                        <Badge variant="secondary">Qty: {item.quantity}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Pill className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No prescriptions for this patient</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}