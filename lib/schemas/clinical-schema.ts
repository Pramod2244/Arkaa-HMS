import { z } from "zod";

export const VitalsSchema = z.object({
  visitId: z.string().min(1, "Visit is required"),
  bloodPressureSystolic: z.number().min(60).max(250).optional(),
  bloodPressureDiastolic: z.number().min(40).max(150).optional(),
  pulse: z.number().min(40).max(200).optional(),
  temperature: z.number().min(95).max(110).optional(),
  temperatureUnit: z.enum(["F", "C"]),
  spO2: z.number().min(70).max(100).optional(),
  weight: z.number().min(1).max(500).optional(),
  weightUnit: z.enum(["kg", "lbs"]),
  height: z.number().min(30).max(250).optional(),
  heightUnit: z.enum(["cm", "inches"]),
  bmi: z.number().optional(),
  respiratoryRate: z.number().min(8).max(60).optional(),
  notes: z.string().optional(),
});

export type VitalsFormData = z.infer<typeof VitalsSchema>;

export const ConsultationSchema = z.object({
  visitId: z.string().min(1, "Visit is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  chiefComplaint: z.string().min(1, "Chief complaint is required"),
  historyOfPresentIllness: z.string().optional(),
  pastMedicalHistory: z.string().optional(),
  familyHistory: z.string().optional(),
  socialHistory: z.string().optional(),
  allergies: z.string().optional(),
  medications: z.string().optional(),
  physicalExamination: z.string().optional(),
  diagnosis: z.string().optional(),
  differentialDiagnosis: z.string().optional(),
  investigations: z.string().optional(),
  treatmentPlan: z.string().optional(),
  followUpPlan: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]),
});

export type ConsultationFormData = z.infer<typeof ConsultationSchema>;

export const PrescriptionItemSchema = z.object({
  medicineName: z.string().min(1, "Medicine name is required"),
  genericName: z.string().optional(),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  instructions: z.string().optional(),
  quantity: z.number().min(1, "Quantity is required"),
});

export type PrescriptionItemFormData = z.infer<typeof PrescriptionItemSchema>;

export const PrescriptionSchema = z.object({
  consultationId: z.string().min(1, "Consultation is required"),
  patientId: z.string().min(1, "Patient is required"),
  doctorId: z.string().min(1, "Doctor is required"),
  prescriptionDate: z.string().min(1, "Prescription date is required"),
  notes: z.string().optional(),
  items: z.array(PrescriptionItemSchema).min(1, "At least one medicine is required"),
});

export type PrescriptionFormData = z.infer<typeof PrescriptionSchema>;