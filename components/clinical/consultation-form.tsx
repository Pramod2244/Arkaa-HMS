"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConsultationSchema, ConsultationFormData } from "@/lib/schemas/clinical-schema";

interface ConsultationFormProps {
  visitId: string;
  patientId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: Partial<ConsultationFormData>;
}

export function ConsultationForm({ visitId, patientId, onSuccess, onCancel, initialData }: ConsultationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctors, setDoctors] = useState<Array<{ id: string; firstName: string; lastName: string | null }>>([]);
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ConsultationFormData>({
    resolver: zodResolver(ConsultationSchema),
    defaultValues: {
      visitId,
      doctorId: "",
      chiefComplaint: "",
      historyOfPresentIllness: "",
      pastMedicalHistory: "",
      familyHistory: "",
      socialHistory: "",
      allergies: "",
      medications: "",
      physicalExamination: "",
      diagnosis: "",
      differentialDiagnosis: "",
      investigations: "",
      treatmentPlan: "",
      followUpPlan: "",
      notes: "",
      status: "IN_PROGRESS",
      ...initialData,
    },
  });

  // Fetch doctors list
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        const response = await fetch("/api/users?role=DOCTOR");
        const result = await response.json();
        if (result.success) {
          setDoctors(result.data);
        }
      } catch (error) {
        console.error("Error fetching doctors:", error);
      }
    };

    fetchDoctors();
  }, []);

  const onSubmit = async (data: ConsultationFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/consultations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", "Consultation started successfully");
        onSuccess?.();
      } else {
        addToast("error", result.message || "Failed to start consultation");
      }
    } catch (error) {
      console.error("Error starting consultation:", error);
      addToast("error", "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Start Consultation</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Doctor Selection */}
          <div className="space-y-2">
            <Label htmlFor="doctorId">Consulting Doctor *</Label>
            <Select
              value={watch("doctorId")}
              onValueChange={(value) => setValue("doctorId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select doctor" />
              </SelectTrigger>
              <SelectContent>
                {doctors.map((doctor) => (
                  <SelectItem key={doctor.id} value={doctor.id}>
                    Dr. {doctor.firstName} {doctor.lastName || ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.doctorId && (
              <p className="text-sm text-red-600">{errors.doctorId.message}</p>
            )}
          </div>

          {/* Chief Complaint */}
          <div className="space-y-2">
            <Label htmlFor="chiefComplaint">Chief Complaint *</Label>
            <Textarea
              id="chiefComplaint"
              placeholder="Patient's main complaint..."
              {...register("chiefComplaint")}
            />
            {errors.chiefComplaint && (
              <p className="text-sm text-red-600">{errors.chiefComplaint.message}</p>
            )}
          </div>

          {/* History of Present Illness */}
          <div className="space-y-2">
            <Label htmlFor="historyOfPresentIllness">History of Present Illness</Label>
            <Textarea
              id="historyOfPresentIllness"
              placeholder="Detailed history of current illness..."
              {...register("historyOfPresentIllness")}
            />
            {errors.historyOfPresentIllness && (
              <p className="text-sm text-red-600">{errors.historyOfPresentIllness.message}</p>
            )}
          </div>

          {/* Past Medical History */}
          <div className="space-y-2">
            <Label htmlFor="pastMedicalHistory">Past Medical History</Label>
            <Textarea
              id="pastMedicalHistory"
              placeholder="Previous medical conditions, surgeries, etc..."
              {...register("pastMedicalHistory")}
            />
            {errors.pastMedicalHistory && (
              <p className="text-sm text-red-600">{errors.pastMedicalHistory.message}</p>
            )}
          </div>

          {/* Family and Social History */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="familyHistory">Family History</Label>
              <Textarea
                id="familyHistory"
                placeholder="Family medical history..."
                {...register("familyHistory")}
              />
              {errors.familyHistory && (
                <p className="text-sm text-red-600">{errors.familyHistory.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="socialHistory">Social History</Label>
              <Textarea
                id="socialHistory"
                placeholder="Occupation, habits, lifestyle..."
                {...register("socialHistory")}
              />
              {errors.socialHistory && (
                <p className="text-sm text-red-600">{errors.socialHistory.message}</p>
              )}
            </div>
          </div>

          {/* Allergies and Medications */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Textarea
                id="allergies"
                placeholder="Known allergies..."
                {...register("allergies")}
              />
              {errors.allergies && (
                <p className="text-sm text-red-600">{errors.allergies.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="medications">Current Medications</Label>
              <Textarea
                id="medications"
                placeholder="Current medications and dosages..."
                {...register("medications")}
              />
              {errors.medications && (
                <p className="text-sm text-red-600">{errors.medications.message}</p>
              )}
            </div>
          </div>

          {/* Physical Examination */}
          <div className="space-y-2">
            <Label htmlFor="physicalExamination">Physical Examination</Label>
            <Textarea
              id="physicalExamination"
              placeholder="Findings from physical examination..."
              {...register("physicalExamination")}
            />
            {errors.physicalExamination && (
              <p className="text-sm text-red-600">{errors.physicalExamination.message}</p>
            )}
          </div>

          {/* Assessment and Diagnosis */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnosis</Label>
              <Textarea
                id="diagnosis"
                placeholder="Primary diagnosis..."
                {...register("diagnosis")}
              />
              {errors.diagnosis && (
                <p className="text-sm text-red-600">{errors.diagnosis.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="differentialDiagnosis">Differential Diagnosis</Label>
              <Textarea
                id="differentialDiagnosis"
                placeholder="Differential diagnosis..."
                {...register("differentialDiagnosis")}
              />
              {errors.differentialDiagnosis && (
                <p className="text-sm text-red-600">{errors.differentialDiagnosis.message}</p>
              )}
            </div>
          </div>

          {/* Treatment Plan */}
          <div className="space-y-2">
            <Label htmlFor="treatmentPlan">Treatment Plan</Label>
            <Textarea
              id="treatmentPlan"
              placeholder="Recommended treatment and management plan..."
              {...register("treatmentPlan")}
            />
            {errors.treatmentPlan && (
              <p className="text-sm text-red-600">{errors.treatmentPlan.message}</p>
            )}
          </div>

          {/* Investigations */}
          <div className="space-y-2">
            <Label htmlFor="investigations">Investigations</Label>
            <Textarea
              id="investigations"
              placeholder="Recommended tests and investigations..."
              {...register("investigations")}
            />
            {errors.investigations && (
              <p className="text-sm text-red-600">{errors.investigations.message}</p>
            )}
          </div>

          {/* Follow-up Plan */}
          <div className="space-y-2">
            <Label htmlFor="followUpPlan">Follow-up Plan</Label>
            <Textarea
              id="followUpPlan"
              placeholder="Follow-up care plan..."
              {...register("followUpPlan")}
            />
            {errors.followUpPlan && (
              <p className="text-sm text-red-600">{errors.followUpPlan.message}</p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional consultation notes..."
              {...register("notes")}
            />
            {errors.notes && (
              <p className="text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Starting Consultation..." : "Start Consultation"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}