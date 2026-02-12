import { z } from "zod";

export const VisitSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  appointmentId: z.string().optional(),
  doctorId: z.string().optional(),
  departmentId: z.string().optional(),
  visitType: z.enum(["OPD", "IPD", "EMERGENCY"]),
  priority: z.enum(["EMERGENCY", "URGENT", "NORMAL", "LOW"]),
  notes: z.string().optional(),
});

export type VisitFormData = z.infer<typeof VisitSchema>;