"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VitalsSchema, VitalsFormData } from "@/lib/schemas/clinical-schema";

interface VitalsRecordingProps {
  visitId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function VitalsRecording({ visitId, onSuccess, onCancel }: VitalsRecordingProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<VitalsFormData>({
    resolver: zodResolver(VitalsSchema),
    defaultValues: {
      visitId,
      temperatureUnit: "F",
      weightUnit: "kg",
      heightUnit: "cm",
    },
  });

  const weight = watch("weight");
  const height = watch("height");
  const weightUnit = watch("weightUnit");
  const heightUnit = watch("heightUnit");

  // Calculate BMI when weight or height changes
  const calculateBMI = () => {
    if (weight && height) {
      const heightInMeters = heightUnit === "cm" ? height / 100 : height * 0.0254;
      const weightInKg = weightUnit === "kg" ? weight : weight * 0.453592;
      const bmi = weightInKg / (heightInMeters * heightInMeters);
      setValue("bmi", Math.round(bmi * 10) / 10);
    }
  };

  const onSubmit = async (data: VitalsFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/vitals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", "Vitals recorded successfully");
        onSuccess?.();
      } else {
        addToast("error", result.message || "Failed to record vitals");
      }
    } catch (error) {
      console.error("Error recording vitals:", error);
      addToast("error", "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Record Vitals</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Blood Pressure */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bloodPressureSystolic">Systolic BP (mmHg)</Label>
              <Input
                id="bloodPressureSystolic"
                type="number"
                placeholder="120"
                {...register("bloodPressureSystolic", { valueAsNumber: true })}
              />
              {errors.bloodPressureSystolic && (
                <p className="text-sm text-red-600">{errors.bloodPressureSystolic.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="bloodPressureDiastolic">Diastolic BP (mmHg)</Label>
              <Input
                id="bloodPressureDiastolic"
                type="number"
                placeholder="80"
                {...register("bloodPressureDiastolic", { valueAsNumber: true })}
              />
              {errors.bloodPressureDiastolic && (
                <p className="text-sm text-red-600">{errors.bloodPressureDiastolic.message}</p>
              )}
            </div>
          </div>

          {/* Pulse and Temperature */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pulse">Pulse (bpm)</Label>
              <Input
                id="pulse"
                type="number"
                placeholder="72"
                {...register("pulse", { valueAsNumber: true })}
              />
              {errors.pulse && (
                <p className="text-sm text-red-600">{errors.pulse.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature</Label>
              <div className="flex gap-2">
                <Input
                  id="temperature"
                  type="number"
                  step="0.1"
                  placeholder="98.6"
                  {...register("temperature", { valueAsNumber: true })}
                />
                <Select
                  value={watch("temperatureUnit")}
                  onValueChange={(value) => setValue("temperatureUnit", value as "F" | "C")}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="F">°F</SelectItem>
                    <SelectItem value="C">°C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {errors.temperature && (
                <p className="text-sm text-red-600">{errors.temperature.message}</p>
              )}
            </div>
          </div>

          {/* SpO2 and Respiratory Rate */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="spO2">SpO2 (%)</Label>
              <Input
                id="spO2"
                type="number"
                placeholder="98"
                {...register("spO2", { valueAsNumber: true })}
              />
              {errors.spO2 && (
                <p className="text-sm text-red-600">{errors.spO2.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="respiratoryRate">Respiratory Rate (breaths/min)</Label>
              <Input
                id="respiratoryRate"
                type="number"
                placeholder="16"
                {...register("respiratoryRate", { valueAsNumber: true })}
              />
              {errors.respiratoryRate && (
                <p className="text-sm text-red-600">{errors.respiratoryRate.message}</p>
              )}
            </div>
          </div>

          {/* Weight and Height */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Weight</Label>
              <div className="flex gap-2">
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="70"
                  {...register("weight", { valueAsNumber: true })}
                  onChange={(e) => {
                    register("weight").onChange(e);
                    setTimeout(calculateBMI, 100);
                  }}
                />
                <Select
                  value={watch("weightUnit")}
                  onValueChange={(value) => {
                    setValue("weightUnit", value as "kg" | "lbs");
                    setTimeout(calculateBMI, 100);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="lbs">lbs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {errors.weight && (
                <p className="text-sm text-red-600">{errors.weight.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height</Label>
              <div className="flex gap-2">
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  placeholder="170"
                  {...register("height", { valueAsNumber: true })}
                  onChange={(e) => {
                    register("height").onChange(e);
                    setTimeout(calculateBMI, 100);
                  }}
                />
                <Select
                  value={watch("heightUnit")}
                  onValueChange={(value) => {
                    setValue("heightUnit", value as "cm" | "inches");
                    setTimeout(calculateBMI, 100);
                  }}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cm">cm</SelectItem>
                    <SelectItem value="inches">inches</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {errors.height && (
                <p className="text-sm text-red-600">{errors.height.message}</p>
              )}
            </div>
          </div>

          {/* BMI */}
          <div className="space-y-2">
            <Label htmlFor="bmi">BMI (calculated)</Label>
            <Input
              id="bmi"
              type="number"
              step="0.1"
              placeholder="22.5"
              {...register("bmi", { valueAsNumber: true })}
              readOnly
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional notes about vitals..."
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
              {isSubmitting ? "Recording..." : "Record Vitals"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}