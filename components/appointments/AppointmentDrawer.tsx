"use client";

import { useState, useEffect } from "react";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/Drawer";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/Toast";
import { fetchApi } from "@/lib/api-client";
import { DoctorCalendar } from "./DoctorCalendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Patient {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string | null;
  gender: string;
  dateOfBirth: string;
  phoneNumber: string;
}

interface Department {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  fullName: string;
  userId: string;
}

interface AppointmentDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: Patient | null;
  departmentId?: string;
  onSuccess?: () => void;
}

const extractDepartments = (response: unknown): Department[] => {
  if (Array.isArray(response)) return response as Department[];
  if (response && typeof response === "object") {
    const data = (response as { data?: unknown }).data;
    if (Array.isArray(data)) return data as Department[];
    if (data && typeof data === "object") {
      const departments = (data as { departments?: unknown }).departments;
      if (Array.isArray(departments)) return departments as Department[];
    }
  }
  return [];
};

const extractDoctors = (response: unknown): Doctor[] => {
  if (Array.isArray(response)) return response as Doctor[];
  if (response && typeof response === "object") {
    const data = (response as { data?: unknown }).data;
    if (Array.isArray(data)) return data as Doctor[];
    if (data && typeof data === "object") {
      const doctors = (data as { doctors?: unknown }).doctors;
      if (Array.isArray(doctors)) return doctors as Doctor[];
    }
  }
  return [];
};

export function AppointmentDrawer({
  open,
  onOpenChange,
  patient,
  departmentId: initialDepartmentId,
  onSuccess,
}: AppointmentDrawerProps) {
  const { addToast } = useToast();

  // State management
  const [step, setStep] = useState<"patient" | "select" | "calendar" | "confirm">("select");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState(
    initialDepartmentId || ""
  );
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<{
    doctorId: string;
    doctorName: string;
    date: Date;
    time: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open && !patient) {
      console.warn("[AppointmentDrawer] Opened without patient selected");
      addToast("error", "Please select a patient before scheduling an appointment");
    }
  }, [open, patient, addToast]);

  // Load departments on drawer open
  useEffect(() => {
    if (!open) return;

    const loadDepartments = async () => {
      try {
        const response = await fetchApi("/api/departments", { method: "GET" });
        const departmentsData = extractDepartments(response);
        setDepartments(departmentsData);
        if (initialDepartmentId && departmentsData.length > 0) {
          setSelectedDepartment(initialDepartmentId);
        }
      } catch (error) {
        console.error("[AppointmentDrawer] Error loading departments:", error);
        addToast("error", "Failed to load departments");
      }
    };

    loadDepartments();
  }, [open, initialDepartmentId, addToast]);

  // Load doctors when department changes
  useEffect(() => {
    if (!selectedDepartment || !open) return;

    const loadDoctors = async () => {
      try {
        const response = await fetchApi(
          `/api/departments/${selectedDepartment}/doctors`,
          { method: "GET" }
        );
        const doctorsData = extractDoctors(response);
        console.log("[AppointmentDrawer] Doctors loaded:", doctorsData);
        setDoctors(doctorsData);
        setSelectedDoctor(""); // Reset doctor selection
      } catch (error) {
        console.error("[AppointmentDrawer] Error loading doctors:", error);
        addToast("error", "Failed to load doctors for this department");
      }
    };

    loadDoctors();
  }, [selectedDepartment, open, addToast]);

  // Handle slot selection from calendar
  const handleSlotSelect = (slot: {
    doctorId: string;
    doctorName: string;
    date: Date;
    time: string;
  }) => {
    console.log("[AppointmentDrawer] Slot selected:", slot);
    setSelectedSlot(slot);
    setStep("confirm");
  };

  // Create appointment
  const handleCreateAppointment = async () => {
    if (!patient || !selectedSlot) {
      addToast("error", "Missing appointment details");
      return;
    }

    try {
      setConfirming(true);
      console.log("[AppointmentDrawer] Creating appointment:", {
        patientId: patient.id,
        doctorId: selectedSlot.doctorId,
        appointmentDate: selectedSlot.date.toISOString().split("T")[0],
        appointmentTime: selectedSlot.time,
        departmentId: selectedDepartment,
        notes,
      });

      const response = await fetchApi("/api/appointments", {
        method: "POST",
        body: JSON.stringify({
          patientId: patient.id,
          doctorId: selectedSlot.doctorId,
          appointmentDate: selectedSlot.date.toISOString().split("T")[0],
          appointmentTime: selectedSlot.time,
          departmentId: selectedDepartment || null,
          notes: notes || null,
        }),
      });

      if (response.success) {
        console.log(
          "[AppointmentDrawer] Appointment created successfully",
          response.data
        );
        addToast("success", `Appointment booked! Token: ${response.data?.tokenNumber}`);

        // Reset and close
        setStep("select");
        setSelectedSlot(null);
        setSelectedDoctor("");
        setSelectedDepartment(initialDepartmentId || "");
        setNotes("");
        onOpenChange(false);
        onSuccess?.();
      } else {
        console.error(
          "[AppointmentDrawer] Failed to create appointment:",
          response.message
        );
        addToast(
          "error",
          response.message || "Failed to book appointment"
        );
      }
    } catch (error) {
      console.error("[AppointmentDrawer] Error creating appointment:", error);
      addToast("error", "An error occurred while booking the appointment");
    } finally {
      setConfirming(false);
    }
  };

  const patientAge = patient
    ? Math.floor(
        (new Date().getTime() -
          new Date(patient.dateOfBirth).getTime()) /
          (365.25 * 24 * 60 * 60 * 1000)
      )
    : 0;

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Schedule Appointment"
      width="w-full md:w-[520px]"
      footer={
        <div className="flex gap-2">
          {step !== "select" && (
            <Button
              variant="outline"
              onClick={() => {
                if (step === "calendar") setStep("select");
                if (step === "confirm") setStep("calendar");
              }}
              className="flex-1"
            >
              Back
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="h-full flex flex-col bg-white overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {/* Patient Context */}
          {patient && (
            <Card className="mb-6 bg-blue-50 border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">
                    {patient.firstName} {patient.lastName || ""}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-sm text-gray-700">
                    <div>
                      <span className="text-gray-600">MRN:</span> {patient.uhid}
                    </div>
                    <div>
                      <span className="text-gray-600">Age:</span> {patientAge} yrs
                    </div>
                    <div>
                      <span className="text-gray-600">Gender:</span>{" "}
                      {patient.gender}
                    </div>
                    <div>
                      <span className="text-gray-600">Phone:</span>{" "}
                      {patient.phoneNumber}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary">Selected</Badge>
              </div>
            </Card>
          )}

          {!patient && (
            <Card className="mb-6 bg-red-50 border-red-200 p-4">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-900 font-semibold">
                    No Patient Selected
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Please select a patient before scheduling an appointment.
                  </p>
                </div>
              </div>
            </Card>
          )}

          {patient && step === "select" && (
            <div className="space-y-4">
              {/* Department Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Department *
                </label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Doctor Selection */}
              {selectedDepartment && (
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Doctor *
                  </label>
                  <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select doctor" />
                    </SelectTrigger>
                    <SelectContent>
                      {doctors.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          {doc.fullName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special requirements..."
                  className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              {/* Action Button */}
              <Button
                onClick={() => setStep("calendar")}
                disabled={!selectedDepartment || !selectedDoctor}
                className="w-full"
              >
                View Doctor&apos;s Calendar
              </Button>
            </div>
          )}

          {patient && step === "calendar" && selectedDoctor && (
            <div className="space-y-4">
              <DoctorCalendar
                doctorIds={[selectedDoctor]}
                departmentId={selectedDepartment}
                onSlotSelect={handleSlotSelect}
                selectedSlot={selectedSlot}
              />
            </div>
          )}

          {patient && step === "confirm" && selectedSlot && (
            <div className="space-y-4">
              <Card className="bg-green-50 border-green-200 p-4">
                <div className="flex gap-2 items-start">
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900">
                      Appointment Details
                    </h3>
                    <div className="mt-3 space-y-2 text-sm text-green-800">
                      <div>
                        <span className="font-medium">Doctor:</span>{" "}
                        {selectedSlot.doctorName}
                      </div>
                      <div>
                        <span className="font-medium">Date:</span>{" "}
                        {selectedSlot.date.toLocaleDateString()}
                      </div>
                      <div>
                        <span className="font-medium">Time:</span>{" "}
                        {selectedSlot.time}
                      </div>
                      <div>
                        <span className="font-medium">Patient:</span>{" "}
                        {patient.firstName} {patient.lastName}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {notes && (
                <Card className="p-4 bg-gray-50">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Notes:</span> {notes}
                  </p>
                </Card>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("calendar")}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  onClick={handleCreateAppointment}
                  disabled={confirming}
                  className="flex-1"
                >
                  {confirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Confirm Appointment"
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}
