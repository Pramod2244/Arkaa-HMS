"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { UserCheck, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/Toast";
import { PatientSelector } from "../patients/patient-selector";
import { VisitSchema, VisitFormData } from "@/lib/schemas/visit-schema";

interface Department {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  fullName: string;
}

interface PatientCheckInProps {
  trigger?: React.ReactNode;
  appointmentId?: string; // If checking in from an appointment
  onSuccess?: () => void;
}

export function PatientCheckIn({ trigger, appointmentId, onSuccess }: PatientCheckInProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const { addToast } = useToast();

  const {
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<VisitFormData>({
    resolver: zodResolver(VisitSchema),
    defaultValues: {
      visitType: "OPD",
      priority: "NORMAL",
      appointmentId,
    },
  });

  const selectedDepartmentId = watch("departmentId");

  // Load departments and doctors
  useState(() => {
    const loadData = async () => {
      try {
        // Load departments
        const deptResponse = await fetch("/api/departments");
        const deptData = await deptResponse.json();
        if (deptData.success) {
          setDepartments(Array.isArray(deptData.data) ? deptData.data : deptData.data?.departments || []);
        }

        // Load doctors
        const doctorResponse = await fetch("/api/users?role=DOCTOR");
        const doctorData = await doctorResponse.json();
        if (doctorData.success) {
          setDoctors(doctorData.data.users);
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };

    if (open) {
      loadData();
    }
  });

  const onSubmit = async (data: VisitFormData) => {
    try {
      setLoading(true);

      const response = await fetch("/api/visits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", "Patient checked in successfully");
        setOpen(false);
        onSuccess?.();
      } else {
        addToast("error", result.message || "Failed to check in patient");
      }
    } catch (error) {
      console.error("Check-in error:", error);
      addToast("error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <UserCheck className="h-4 w-4 mr-2" />
      Check In Patient
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Patient Check-In</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Patient Selection */}
          <div className="space-y-2">
            <Label>Patient *</Label>
            <PatientSelector
              onPatientSelect={(patient) => setValue("patientId", patient.id)}
            />
            {errors.patientId && (
              <p className="text-sm text-red-600">{errors.patientId.message}</p>
            )}
          </div>

          {/* Visit Type and Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Visit Type</Label>
              <Select onValueChange={(value: any) => setValue("visitType", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPD">OPD</SelectItem>
                  <SelectItem value="IPD">IPD</SelectItem>
                  <SelectItem value="EMERGENCY">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Priority</Label>
              <Select onValueChange={(value: any) => setValue("priority", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EMERGENCY">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                      Emergency
                    </div>
                  </SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Department and Doctor */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select onValueChange={(value) => setValue("departmentId", value)}>
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

            <div className="space-y-2">
              <Label>Doctor</Label>
              <Select onValueChange={(value) => setValue("doctorId", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doctor) => (
                    <SelectItem key={doctor.id} value={doctor.id}>
                      {doctor.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Checking In...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4 mr-2" />
                  Check In
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}