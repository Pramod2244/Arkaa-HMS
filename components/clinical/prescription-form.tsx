"use client";

import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { PrescriptionSchema, PrescriptionFormData, PrescriptionItemFormData } from "@/lib/schemas/clinical-schema";

interface PrescriptionFormProps {
  consultationId: string;
  patientId: string;
  doctorId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
  initialData?: Partial<PrescriptionFormData>;
}

export function PrescriptionForm({
  consultationId,
  patientId,
  doctorId,
  onSuccess,
  onCancel,
  initialData
}: PrescriptionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm<PrescriptionFormData>({
    resolver: zodResolver(PrescriptionSchema),
    defaultValues: {
      consultationId,
      patientId,
      doctorId,
      prescriptionDate: new Date().toISOString().split('T')[0],
      notes: "",
      items: [
        {
          medicineName: "",
          genericName: "",
          dosage: "",
          frequency: "",
          duration: "",
          instructions: "",
          quantity: 1,
        },
      ],
      ...initialData,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const addMedicine = () => {
    append({
      medicineName: "",
      genericName: "",
      dosage: "",
      frequency: "",
      duration: "",
      instructions: "",
      quantity: 1,
    });
  };

  const removeMedicine = (index: number) => {
    if (fields.length > 1) {
      remove(index);
    }
  };

  const onSubmit = async (data: PrescriptionFormData) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/prescriptions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", "Prescription created successfully");
        onSuccess?.();
      } else {
        addToast("error", result.message || "Failed to create prescription");
      }
    } catch (error) {
      console.error("Error creating prescription:", error);
      addToast("error", "Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>Create Prescription</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Prescription Date */}
          <div className="space-y-2">
            <Label htmlFor="prescriptionDate">Prescription Date *</Label>
            <Input
              id="prescriptionDate"
              type="date"
              {...register("prescriptionDate")}
            />
            {errors.prescriptionDate && (
              <p className="text-sm text-red-600">{errors.prescriptionDate.message}</p>
            )}
          </div>

          {/* Medicine Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-lg font-semibold">Medicines</Label>
              <Button type="button" onClick={addMedicine} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Medicine
              </Button>
            </div>

            {fields.map((field, index) => (
              <Card key={field.id} className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Medicine Name */}
                  <div className="space-y-2">
                    <Label htmlFor={`items.${index}.medicineName`}>Medicine Name *</Label>
                    <Input
                      id={`items.${index}.medicineName`}
                      placeholder="e.g., Amoxicillin"
                      {...register(`items.${index}.medicineName`)}
                    />
                    {errors.items?.[index]?.medicineName && (
                      <p className="text-sm text-red-600">
                        {errors.items[index]?.medicineName?.message}
                      </p>
                    )}
                  </div>

                  {/* Generic Name */}
                  <div className="space-y-2">
                    <Label htmlFor={`items.${index}.genericName`}>Generic Name</Label>
                    <Input
                      id={`items.${index}.genericName`}
                      placeholder="e.g., Amoxicillin Trihydrate"
                      {...register(`items.${index}.genericName`)}
                    />
                  </div>

                  {/* Dosage */}
                  <div className="space-y-2">
                    <Label htmlFor={`items.${index}.dosage`}>Dosage *</Label>
                    <Input
                      id={`items.${index}.dosage`}
                      placeholder="e.g., 500mg"
                      {...register(`items.${index}.dosage`)}
                    />
                    {errors.items?.[index]?.dosage && (
                      <p className="text-sm text-red-600">
                        {errors.items[index]?.dosage?.message}
                      </p>
                    )}
                  </div>

                  {/* Frequency */}
                  <div className="space-y-2">
                    <Label htmlFor={`items.${index}.frequency`}>Frequency *</Label>
                    <Select
                      value={watch(`items.${index}.frequency`)}
                      onValueChange={(value) => setValue(`items.${index}.frequency`, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Once daily">Once daily</SelectItem>
                        <SelectItem value="Twice daily">Twice daily</SelectItem>
                        <SelectItem value="Three times daily">Three times daily</SelectItem>
                        <SelectItem value="Four times daily">Four times daily</SelectItem>
                        <SelectItem value="Every 6 hours">Every 6 hours</SelectItem>
                        <SelectItem value="Every 8 hours">Every 8 hours</SelectItem>
                        <SelectItem value="Every 12 hours">Every 12 hours</SelectItem>
                        <SelectItem value="As needed">As needed</SelectItem>
                        <SelectItem value="Before meals">Before meals</SelectItem>
                        <SelectItem value="After meals">After meals</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.items?.[index]?.frequency && (
                      <p className="text-sm text-red-600">
                        {errors.items[index]?.frequency?.message}
                      </p>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <Label htmlFor={`items.${index}.duration`}>Duration *</Label>
                    <Input
                      id={`items.${index}.duration`}
                      placeholder="e.g., 7 days"
                      {...register(`items.${index}.duration`)}
                    />
                    {errors.items?.[index]?.duration && (
                      <p className="text-sm text-red-600">
                        {errors.items[index]?.duration?.message}
                      </p>
                    )}
                  </div>

                  {/* Quantity */}
                  <div className="space-y-2">
                    <Label htmlFor={`items.${index}.quantity`}>Quantity *</Label>
                    <Input
                      id={`items.${index}.quantity`}
                      type="number"
                      min="1"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                    {errors.items?.[index]?.quantity && (
                      <p className="text-sm text-red-600">
                        {errors.items[index]?.quantity?.message}
                      </p>
                    )}
                  </div>

                  {/* Instructions */}
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor={`items.${index}.instructions`}>Instructions</Label>
                    <Input
                      id={`items.${index}.instructions`}
                      placeholder="e.g., Take with food"
                      {...register(`items.${index}.instructions`)}
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="flex items-end">
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => removeMedicine(index)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Prescription Notes</Label>
            <Textarea
              id="notes"
              placeholder="Additional prescription notes..."
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
              {isSubmitting ? "Creating Prescription..." : "Create Prescription"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}