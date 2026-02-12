"use client";

/**
 * Appointment Booking Drawer
 * 
 * Multi-step booking flow:
 * 1. Select Patient
 * 2. Select Department & Doctor
 * 3. Select Date & Time Slot
 * 4. Confirm Booking
 */

import React, { useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/Drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import {
  Calendar,
  Clock,
  User,
  Building2,
  Stethoscope,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  Search,
} from "lucide-react";

// Types
interface Patient {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  dateOfBirth: string | null;
  gender: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Doctor {
  id: string;
  doctorCode: string;
  fullName: string;
  specialization: string | null;
  qualification: string | null;
}

interface TimeSlot {
  time: string;
  endTime: string;
  maxCapacity: number;
  bookedCount: number;
  availableCount: number;
  isAvailable: boolean;
  isWalkInOnly: boolean;
}

interface DoctorDaySlots {
  doctorId: string;
  doctorName: string;
  departmentId: string;
  departmentName: string;
  date: string;
  dayOfWeek: string;
  totalCapacity: number;
  totalBooked: number;
  totalAvailable: number;
  maxPatientsPerDay: number | null;
  dailyBookedCount: number;
  isDayFull: boolean;
  allowWalkIn: boolean;
  slots: TimeSlot[];
}

interface AppointmentBookingDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (appointment: unknown) => void;
  preselectedPatient?: Patient;
  isWalkIn?: boolean;
}

type BookingStep = "patient" | "doctor" | "slot" | "confirm";

export default function AppointmentBookingDrawer({
  open,
  onClose,
  onSuccess,
  preselectedPatient,
  isWalkIn = false,
}: AppointmentBookingDrawerProps) {
  const { addToast } = useToast();

  // Step navigation
  const [currentStep, setCurrentStep] = useState<BookingStep>("patient");

  // Data states
  const [patients, setPatients] = useState<Patient[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slotData, setSlotData] = useState<DoctorDaySlots | null>(null);

  // Selection states
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(preselectedPatient || null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Loading states
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [, setLoadingDepartments] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Search states
  const [patientSearch, setPatientSearch] = useState("");

  // Reset on open/close
  useEffect(() => {
    if (open) {
      setCurrentStep(preselectedPatient ? "doctor" : "patient");
      setSelectedPatient(preselectedPatient || null);
      setSelectedDepartment("");
      setSelectedDoctor("");
      setSelectedDate(new Date().toISOString().split("T")[0]);
      setSelectedSlot(null);
      setChiefComplaint("");
      setNotes("");
      setPatientSearch("");
      fetchDepartments();
    }
  }, [open, preselectedPatient]);

  // Fetch patients
  const fetchPatients = useCallback(async (search: string) => {
    if (!search || search.length < 2) {
      setPatients([]);
      return;
    }

    setLoadingPatients(true);
    try {
      // apiClient.get returns data.data directly, so response is { patients: [...], pagination: {...} }
      const response = await apiClient.get(`/api/patients?search=${encodeURIComponent(search)}&limit=20`);
      setPatients(response?.patients || []);
    } catch (error) {
      console.error("Error fetching patients:", error);
      setPatients([]);
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  // Fetch departments
  const fetchDepartments = async () => {
    setLoadingDepartments(true);
    try {
      // apiClient.get returns data directly (array of departments)
      const response = await apiClient.get("/api/masters/departments?status=ACTIVE");
      setDepartments(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching departments:", error);
      setDepartments([]);
    } finally {
      setLoadingDepartments(false);
    }
  };

  // Fetch doctors for department
  const fetchDoctors = useCallback(async (departmentId: string) => {
    if (!departmentId) {
      setDoctors([]);
      return;
    }

    setLoadingDoctors(true);
    try {
      // apiClient.get returns data directly (array of doctors)
      const response = await apiClient.get(
        `/api/masters/doctors?departmentId=${departmentId}&status=ACTIVE&isSchedulable=true`
      );
      setDoctors(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      setDoctors([]);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  // Fetch slots for doctor/date
  const fetchSlots = useCallback(async (doctorId: string, date: string, departmentId: string) => {
    if (!doctorId || !date) {
      setSlotData(null);
      return;
    }

    setLoadingSlots(true);
    try {
      // apiClient.get returns data directly
      const response = await apiClient.get(
        `/api/appointments/slots?doctorId=${doctorId}&date=${date}&departmentId=${departmentId}`
      );
      setSlotData(response || null);
    } catch (error) {
      console.error("Error fetching slots:", error);
      setSlotData(null);
      addToast("error", "Failed to load slots or no availability for this date");
    } finally {
      setLoadingSlots(false);
    }
  }, [addToast]);

  // Handle department change
  useEffect(() => {
    if (selectedDepartment) {
      fetchDoctors(selectedDepartment);
      setSelectedDoctor("");
      setSlotData(null);
      setSelectedSlot(null);
    }
  }, [selectedDepartment, fetchDoctors]);

  // Handle doctor/date change
  useEffect(() => {
    if (selectedDoctor && selectedDate) {
      fetchSlots(selectedDoctor, selectedDate, selectedDepartment);
      setSelectedSlot(null);
    }
  }, [selectedDoctor, selectedDate, selectedDepartment, fetchSlots]);

  // Patient search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (patientSearch.length >= 2) {
        fetchPatients(patientSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch, fetchPatients]);

  // Navigation
  const goToStep = (step: BookingStep) => setCurrentStep(step);

  const canGoNext = (): boolean => {
    switch (currentStep) {
      case "patient":
        return !!selectedPatient;
      case "doctor":
        return !!selectedDepartment && !!selectedDoctor;
      case "slot":
        return !!selectedSlot;
      default:
        return false;
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case "patient":
        goToStep("doctor");
        break;
      case "doctor":
        goToStep("slot");
        break;
      case "slot":
        goToStep("confirm");
        break;
    }
  };

  const handleBack = () => {
    switch (currentStep) {
      case "doctor":
        if (!preselectedPatient) goToStep("patient");
        break;
      case "slot":
        goToStep("doctor");
        break;
      case "confirm":
        goToStep("slot");
        break;
    }
  };

  // Submit booking
  const handleSubmit = async () => {
    if (!selectedPatient || !selectedDepartment || !selectedDoctor || !selectedSlot) {
      addToast("error", "Please complete all required selections");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint = isWalkIn ? "/api/appointments/walkin" : "/api/appointments/book";
      const payload = isWalkIn
        ? {
            patientId: selectedPatient.id,
            departmentId: selectedDepartment,
            doctorId: selectedDoctor,
            chiefComplaint,
            notes,
          }
        : {
            patientId: selectedPatient.id,
            departmentId: selectedDepartment,
            doctorId: selectedDoctor,
            appointmentDate: selectedDate,
            appointmentTime: selectedSlot.time,
            slotEndTime: selectedSlot.endTime,
            isWalkIn,
            bookingSource: isWalkIn ? "WALKIN" : "RECEPTION",
            chiefComplaint,
            notes,
          };

      // apiClient throws on error, returns data directly on success
      const response = await apiClient.post(endpoint, payload);
      
      addToast("success", `Appointment booked! Token: ${response?.tokenNumber || 'N/A'}`);
      onSuccess?.(response);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to book appointment";
      addToast("error", message);
    } finally {
      setSubmitting(false);
    }
  };

  // Step indicator
  const steps: { key: BookingStep; label: string; icon: React.ReactNode }[] = [
    { key: "patient", label: "Patient", icon: <User className="h-4 w-4" /> },
    { key: "doctor", label: "Doctor", icon: <Stethoscope className="h-4 w-4" /> },
    { key: "slot", label: "Time Slot", icon: <Clock className="h-4 w-4" /> },
    { key: "confirm", label: "Confirm", icon: <Check className="h-4 w-4" /> },
  ];

  // Footer content
  const footerContent = (
    <div className="flex justify-between w-full">
      <Button
        variant="outline"
        onClick={handleBack}
        disabled={currentStep === "patient" || (currentStep === "doctor" && !!preselectedPatient)}
      >
        <ChevronLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {currentStep === "confirm" ? (
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Booking...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              Confirm Booking
            </>
          )}
        </Button>
      ) : (
        <Button onClick={handleNext} disabled={!canGoNext()}>
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={isWalkIn ? "Walk-In Appointment" : "Book Appointment"}
      footer={footerContent}
      width="w-full sm:w-2/5"
    >
      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4">
        {isWalkIn
          ? "Register a walk-in patient for today"
          : "Schedule an appointment for a patient"}
      </p>

      {/* Step Indicator */}
      <div className="flex items-center justify-between py-4 border-b">
        {steps.map((step, idx) => (
          <div
            key={step.key}
            className={`flex items-center gap-2 ${
              currentStep === step.key
                ? "text-primary"
                : steps.findIndex((s) => s.key === currentStep) > idx
                ? "text-muted-foreground"
                : "text-muted-foreground/50"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                currentStep === step.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : steps.findIndex((s) => s.key === currentStep) > idx
                  ? "border-primary/50 bg-primary/10"
                  : "border-muted"
              }`}
            >
              {step.icon}
            </div>
            <span className="hidden sm:inline text-sm font-medium">{step.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="py-6 min-h-[400px]">
        {/* Patient Selection */}
        {currentStep === "patient" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by UHID, name, or phone..."
                className="pl-10"
                value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                />
              </div>

              {loadingPatients && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              )}

              {!loadingPatients && patients.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {patients.map((patient) => (
                    <Card
                      key={patient.id}
                      className={`cursor-pointer transition-colors hover:bg-accent ${
                        selectedPatient?.id === patient.id ? "border-primary bg-primary/5" : ""
                      }`}
                      onClick={() => setSelectedPatient(patient)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {patient.firstName} {patient.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {patient.uhid} • {patient.phoneNumber || "No phone"}
                            </p>
                          </div>
                          {selectedPatient?.id === patient.id && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!loadingPatients && patientSearch.length >= 2 && patients.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No patients found. Try a different search.
                </div>
              )}

              {!loadingPatients && patientSearch.length < 2 && (
                <div className="text-center py-8 text-muted-foreground">
                  Enter at least 2 characters to search
                </div>
              )}
            </div>
          )}

          {/* Doctor Selection */}
          {currentStep === "doctor" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Department *</Label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {dept.name} ({dept.code})
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedDepartment && (
                <div className="space-y-2">
                  <Label>Doctor *</Label>
                  {loadingDoctors ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : doctors.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No doctors available in this department
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {doctors.map((doctor) => (
                        <Card
                          key={doctor.id}
                          className={`cursor-pointer transition-colors hover:bg-accent ${
                            selectedDoctor === doctor.id ? "border-primary bg-primary/5" : ""
                          }`}
                          onClick={() => setSelectedDoctor(doctor.id)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{doctor.fullName}</p>
                                <p className="text-sm text-muted-foreground">
                                  {doctor.doctorCode}
                                  {doctor.specialization && ` • ${doctor.specialization}`}
                                </p>
                              </div>
                              {selectedDoctor === doctor.id && (
                                <Check className="h-5 w-5 text-primary" />
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Slot Selection */}
          {currentStep === "slot" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
              </div>

              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : slotData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Available: {slotData.totalAvailable} / {slotData.totalCapacity}
                    </span>
                    {slotData.isDayFull && (
                      <Badge variant="destructive">Day Full</Badge>
                    )}
                    {slotData.allowWalkIn && (
                      <Badge variant="secondary">Walk-ins OK</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto">
                    {slotData.slots.map((slot) => (
                      <Button
                        key={slot.time}
                        variant={selectedSlot?.time === slot.time ? "default" : "outline"}
                        size="sm"
                        disabled={!slot.isAvailable}
                        className={`h-auto py-2 ${
                          !slot.isAvailable ? "opacity-50" : ""
                        }`}
                        onClick={() => setSelectedSlot(slot)}
                      >
                        <div className="text-center">
                          <div className="font-medium">{slot.time}</div>
                          <div className="text-xs opacity-70">
                            {slot.availableCount}/{slot.maxCapacity}
                          </div>
                        </div>
                      </Button>
                    ))}
                  </div>

                  {slotData.slots.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      No slots available for this date
                    </div>
                  )}
                </div>
              ) : selectedDoctor ? (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                  <AlertCircle className="h-8 w-8" />
                  <p>No availability found for this doctor on the selected date</p>
                </div>
              ) : null}
            </div>
          )}

          {/* Confirmation */}
          {currentStep === "confirm" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {selectedPatient?.firstName} {selectedPatient?.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedPatient?.uhid}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Stethoscope className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">
                        {doctors.find((d) => d.id === selectedDoctor)?.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {departments.find((d) => d.id === selectedDepartment)?.name}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedDate}</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedSlot?.time} - {selectedSlot?.endTime}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label>Chief Complaint (optional)</Label>
                <Textarea
                  placeholder="Brief description of the reason for visit..."
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea
                  placeholder="Additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>
    </Drawer>
  );
}
