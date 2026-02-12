"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
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
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { PatientSchema, PatientFormData } from "@/lib/schemas/patient-schema";

interface Patient {
  id: string;
  uhid: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  phoneNumber: string;
  email?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: "A_POSITIVE" | "A_NEGATIVE" | "B_POSITIVE" | "B_NEGATIVE" | "AB_POSITIVE" | "AB_NEGATIVE" | "O_POSITIVE" | "O_NEGATIVE";
  allergies?: string;
  medicalHistory?: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

interface PatientFormDrawerProps {
  open: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onSuccess: () => void;
}

const bloodGroups = [
  { value: "A_POSITIVE", label: "A+" },
  { value: "A_NEGATIVE", label: "A-" },
  { value: "B_POSITIVE", label: "B+" },
  { value: "B_NEGATIVE", label: "B-" },
  { value: "AB_POSITIVE", label: "AB+" },
  { value: "AB_NEGATIVE", label: "AB-" },
  { value: "O_POSITIVE", label: "O+" },
  { value: "O_NEGATIVE", label: "O-" },
];

export function PatientFormDrawer({ open, onClose, patient, onSuccess }: PatientFormDrawerProps) {
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<PatientFormData>({
    resolver: zodResolver(PatientSchema),
    defaultValues: {
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (patient) {
      reset({
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth.split('T')[0], // Format for date input
        gender: patient.gender,
        phoneNumber: patient.phoneNumber,
        email: patient.email || "",
        address: patient.address || "",
        emergencyContactName: patient.emergencyContactName || "",
        emergencyContactPhone: patient.emergencyContactPhone || "",
        bloodGroup: patient.bloodGroup || undefined,
        allergies: patient.allergies || "",
        medicalHistory: patient.medicalHistory || "",
        status: patient.status,
      });
    } else {
      reset({
        firstName: "",
        lastName: "",
        dateOfBirth: "",
        gender: undefined,
        phoneNumber: "",
        email: "",
        address: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        bloodGroup: undefined,
        allergies: "",
        medicalHistory: "",
        status: "ACTIVE",
      });
    }
  }, [patient, reset]);

  const onSubmit = async (data: PatientFormData) => {
    try {
      setLoading(true);

      const url = patient ? `/api/patients/${patient.id}` : "/api/patients";
      const method = patient ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", patient ? "Patient updated successfully" : "Patient created successfully");
        onSuccess();
      } else {
        addToast("error", result.message || "Something went wrong");
      }
    } catch (error) {
      console.error("Form submission error:", error);
      addToast("error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const footer = (
    <div className="flex justify-end gap-4">
      <Button type="button" variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button type="submit" disabled={loading} onClick={handleSubmit(onSubmit)}>
        {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {patient ? "Update Patient" : "Create Patient"}
      </Button>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={patient ? "Edit Patient" : "Add New Patient"}
      footer={footer}
      width="w-3/5"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Basic Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                {...register("firstName")}
                placeholder="Enter first name"
              />
              {errors.firstName && (
                <p className="text-sm text-red-600 mt-1">{errors.firstName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                {...register("lastName")}
                placeholder="Enter last name"
              />
              {errors.lastName && (
                <p className="text-sm text-red-600 mt-1">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateOfBirth">Date of Birth *</Label>
              <Input
                id="dateOfBirth"
                type="date"
                {...register("dateOfBirth")}
              />
              {errors.dateOfBirth && (
                <p className="text-sm text-red-600 mt-1">{errors.dateOfBirth.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="gender">Gender *</Label>
              <Select onValueChange={(value) => setValue("gender", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
              {errors.gender && (
                <p className="text-sm text-red-600 mt-1">{errors.gender.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phoneNumber">Phone Number *</Label>
              <Input
                id="phoneNumber"
                {...register("phoneNumber")}
                placeholder="Enter phone number"
              />
              {errors.phoneNumber && (
                <p className="text-sm text-red-600 mt-1">{errors.phoneNumber.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                placeholder="Enter email address"
              />
              {errors.email && (
                <p className="text-sm text-red-600 mt-1">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              {...register("address")}
              placeholder="Enter address"
              rows={3}
            />
            {errors.address && (
              <p className="text-sm text-red-600 mt-1">{errors.address.message}</p>
            )}
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Emergency Contact</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="emergencyContactName">Contact Name</Label>
              <Input
                id="emergencyContactName"
                {...register("emergencyContactName")}
                placeholder="Enter emergency contact name"
              />
              {errors.emergencyContactName && (
                <p className="text-sm text-red-600 mt-1">{errors.emergencyContactName.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="emergencyContactPhone">Contact Phone</Label>
              <Input
                id="emergencyContactPhone"
                {...register("emergencyContactPhone")}
                placeholder="Enter emergency contact phone"
              />
              {errors.emergencyContactPhone && (
                <p className="text-sm text-red-600 mt-1">{errors.emergencyContactPhone.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Medical Information */}
        <div className="space-y-4">
          <h3 className="text-lg font-medium">Medical Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bloodGroup">Blood Group</Label>
              <Select onValueChange={(value) => setValue("bloodGroup", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {bloodGroups.map((group) => (
                    <SelectItem key={group.value} value={group.value}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.bloodGroup && (
                <p className="text-sm text-red-600 mt-1">{errors.bloodGroup.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="status">Status</Label>
              <Select onValueChange={(value) => setValue("status", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-sm text-red-600 mt-1">{errors.status.message}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="allergies">Allergies</Label>
            <Textarea
              id="allergies"
              {...register("allergies")}
              placeholder="Enter any allergies"
              rows={2}
            />
            {errors.allergies && (
              <p className="text-sm text-red-600 mt-1">{errors.allergies.message}</p>
            )}
          </div>

          <div>
            <Label htmlFor="medicalHistory">Medical History</Label>
            <Textarea
              id="medicalHistory"
              {...register("medicalHistory")}
              placeholder="Enter medical history"
              rows={3}
            />
            {errors.medicalHistory && (
              <p className="text-sm text-red-600 mt-1">{errors.medicalHistory.message}</p>
            )}
          </div>
        </div>
      </form>
    </Drawer>
  );
}