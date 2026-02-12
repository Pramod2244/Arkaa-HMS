"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Calendar, Clock, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/Toast";
import { PatientSelector } from "../patients/patient-selector";
import { AppointmentSchema, AppointmentFormData } from "@/lib/schemas/appointment-schema";

interface Department {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  fullName: string;
}

interface AppointmentBookingProps {
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function AppointmentBooking({ trigger, onSuccess }: AppointmentBookingProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<AppointmentFormData>({
    resolver: zodResolver(AppointmentSchema),
  });

  const selectedDepartmentId = watch("departmentId");

  // Load departments and doctors
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load departments
        const deptResponse = await fetch("/api/departments");
        const deptData = await deptResponse.json();
        if (deptData.success) {
          setDepartments(deptData.data.departments);
        }

        // Load doctors (users with doctor role)
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
  }, [open]);

  // Load doctors when department changes
  useEffect(() => {
    if (selectedDepartmentId) {
      // In a real implementation, you might filter doctors by department
      // For now, we'll keep all doctors
    }
  }, [selectedDepartmentId]);

  const onSubmit = async (data: AppointmentFormData) => {
    try {
      setLoading(true);

      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", "Appointment booked successfully");
        reset();
        setOpen(false);
        onSuccess?.();
      } else {
        addToast("error", result.message || "Failed to book appointment");
      }
    } catch (error) {
      console.error("Appointment booking error:", error);
      addToast("error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const defaultTrigger = (
    <Button>
      <Calendar className="h-4 w-4 mr-2" />
      Book Appointment
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Book Appointment</DialogTitle>
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

          {/* Department and Doctor */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="departmentId">Department</Label>
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
              {errors.departmentId && (
                <p className="text-sm text-red-600">{errors.departmentId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="doctorId">Doctor</Label>
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
              {errors.doctorId && (
                <p className="text-sm text-red-600">{errors.doctorId.message}</p>
              )}
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="appointmentDate">Appointment Date *</Label>
              <Input
                id="appointmentDate"
                type="date"
                {...register("appointmentDate")}
                min={new Date().toISOString().split('T')[0]} // Today or later
              />
              {errors.appointmentDate && (
                <p className="text-sm text-red-600">{errors.appointmentDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="appointmentTime">Appointment Time</Label>
              <Input
                id="appointmentTime"
                type="time"
                {...register("appointmentTime")}
              />
              {errors.appointmentTime && (
                <p className="text-sm text-red-600">{errors.appointmentTime.message}</p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Any special notes or requirements..."
              rows={3}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Booking..." : "Book Appointment"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}