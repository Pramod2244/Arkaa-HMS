import { z } from "zod";

export const PatientSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(50, "First name must be less than 50 characters"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name must be less than 50 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], {
    message: "Gender is required",
  }),
  phoneNumber: z.string().min(1, "Phone number is required").regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  address: z.string().max(200, "Address must be less than 200 characters").optional().or(z.literal("")),
  emergencyContactName: z.string().max(100, "Emergency contact name must be less than 100 characters").optional().or(z.literal("")),
  emergencyContactPhone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format").optional().or(z.literal("")),
  bloodGroup: z.enum(["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"]).optional(),
  allergies: z.string().max(500, "Allergies description must be less than 500 characters").optional().or(z.literal("")),
  medicalHistory: z.string().max(1000, "Medical history must be less than 1000 characters").optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

export type PatientFormData = z.infer<typeof PatientSchema>;