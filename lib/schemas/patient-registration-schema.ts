import { z } from "zod";

// ============== TITLE CODES ==============
export const TITLE_CODES = {
  1: { code: 1, label: "Mr.", gender: "MALE" },
  2: { code: 2, label: "Mrs.", gender: "FEMALE" },
  3: { code: 3, label: "Ms.", gender: "FEMALE" },
  4: { code: 4, label: "Master", gender: "MALE" },
  5: { code: 5, label: "Baby", gender: null }, // Gender selectable
  6: { code: 6, label: "Dr.", gender: null },   // Gender selectable
} as const;

// ============== RELATION TYPES ==============
export const RELATION_TYPES = [
  { value: "FATHER", label: "S/O (Son Of)", shortLabel: "S/O" },
  { value: "MOTHER", label: "D/O (Daughter Of)", shortLabel: "D/O" },
  { value: "SPOUSE", label: "W/O (Wife Of)", shortLabel: "W/O" },
  { value: "GUARDIAN", label: "C/O (Care Of)", shortLabel: "C/O" },
  { value: "SELF", label: "Self", shortLabel: "Self" },
] as const;

// ============== AADHAAR VALIDATION ==============
const aadhaarRegex = /^[2-9]{1}[0-9]{11}$/;
const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const passportRegex = /^[A-Z]{1}[0-9]{7}$/;
const mobileRegex = /^[6-9][0-9]{9}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;

// ============== SECTION 1: BASIC IDENTITY ==============
export const BasicIdentitySchema = z.object({
  titleCode: z.number().int().min(1).max(6).optional().nullable(),
  firstName: z.string()
    .min(1, "First name is required")
    .max(50, "First name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]+$/, "First name can only contain letters"),
  middleName: z.string()
    .max(50, "Middle name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]*$/, "Middle name can only contain letters")
    .optional()
    .nullable()
    .transform(val => val ?? ""),
  lastName: z.string()
    .max(50, "Last name must be less than 50 characters")
    .regex(/^[a-zA-Z\s]*$/, "Last name can only contain letters")
    .optional()
    .nullable()
    .transform(val => val ?? ""),
  dateOfBirth: z.string().optional().nullable().transform(val => val ?? ""),
  ageYears: z.number().int().min(0).max(150).optional().nullable(),
  ageMonths: z.number().int().min(0).max(11).optional().nullable(),
  ageDays: z.number().int().min(0).max(30).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], { message: "Gender is required" }),
  maritalStatus: z.enum(["SINGLE", "MARRIED", "DIVORCED", "WIDOWED", "SEPARATED"]).optional().nullable(),
});

// ============== SECTION 2: PATIENT RELATION ==============
export const PatientRelationSchema = z.object({
  relationType: z.enum(["FATHER", "MOTHER", "SPOUSE", "GUARDIAN", "SELF"]).optional().nullable(),
  relationName: z.string()
    .max(100, "Relation name must be less than 100 characters")
    .optional()
    .nullable()
    .transform(val => val ?? ""),
  relationMobile: z.string()
    .regex(mobileRegex, "Invalid mobile number (10 digits, starting with 6-9)")
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform(val => val ?? ""),
});

// ============== SECTION 3: CONTACT & ADDRESS ==============
export const ContactAddressSchema = z.object({
  // Primary Contact
  primaryMobile: z.string()
    .min(1, "Primary mobile is required")
    .regex(mobileRegex, "Invalid mobile number (10 digits, starting with 6-9)"),
  secondaryMobile: z.union([
    z.literal(""),
    z.string().regex(mobileRegex, "Invalid mobile number")
  ]).optional().nullable(),
  email: z.union([
    z.literal(""),
    z.string().email("Invalid email address")
  ]).optional().nullable(),
  
  // Guardian Contact
  guardianName: z.string()
    .max(100, "Guardian name must be less than 100 characters")
    .optional()
    .nullable(),
  guardianRelation: z.string()
    .max(50)
    .optional()
    .nullable(),
  guardianMobile: z.union([
    z.literal(""),
    z.string().regex(mobileRegex, "Invalid mobile number")
  ]).optional().nullable(),

  // Present Address
  presentHouseNo: z.string().max(50).optional().nullable(),
  presentStreet: z.string().max(100).optional().nullable(),
  presentArea: z.string().max(100).optional().nullable(),
  presentVillage: z.string().max(100).optional().nullable(),
  presentTaluk: z.string().max(100).optional().nullable(),
  presentDistrict: z.string().max(100).optional().nullable(),
  presentState: z.string().max(100).optional().nullable(),
  presentCountry: z.string().max(100).default("India").optional().nullable(),
  presentPincode: z.union([
    z.literal(""),
    z.string().regex(pincodeRegex, "Invalid pincode (6 digits)")
  ]).optional().nullable(),

  // Permanent Address
  permanentSameAsPresent: z.boolean().default(true),
  permanentHouseNo: z.string().max(50).optional().nullable(),
  permanentStreet: z.string().max(100).optional().nullable(),
  permanentArea: z.string().max(100).optional().nullable(),
  permanentVillage: z.string().max(100).optional().nullable(),
  permanentTaluk: z.string().max(100).optional().nullable(),
  permanentDistrict: z.string().max(100).optional().nullable(),
  permanentState: z.string().max(100).optional().nullable(),
  permanentCountry: z.string().max(100).optional().nullable(),
  permanentPincode: z.union([
    z.literal(""),
    z.string().regex(pincodeRegex, "Invalid pincode")
  ]).optional().nullable(),
});

// ============== SECTION 4: IDENTITY DOCUMENTS ==============
export const IdentityDocumentsSchema = z.object({
  aadhaarNumber: z.union([
    z.literal(""),
    z.string().regex(aadhaarRegex, "Invalid Aadhaar number (12 digits, cannot start with 0 or 1)")
  ]).optional().nullable(),
  passportNumber: z.union([
    z.literal(""),
    z.string().regex(passportRegex, "Invalid passport number (1 letter followed by 7 digits)")
  ]).optional().nullable(),
  panNumber: z.union([
    z.literal(""),
    z.string().regex(panRegex, "Invalid PAN number (format: ABCDE1234F)")
  ]).optional().nullable(),
});

// ============== SECTION 5: DEMOGRAPHICS ==============
export const DemographicsSchema = z.object({
  bloodGroup: z.enum([
    "A_POSITIVE", "A_NEGATIVE",
    "B_POSITIVE", "B_NEGATIVE",
    "AB_POSITIVE", "AB_NEGATIVE",
    "O_POSITIVE", "O_NEGATIVE"
  ]).optional().nullable(),
  motherTongue: z.string().max(50).optional().nullable(),
  nationality: z.string().max(50).default("Indian").optional().nullable(),
  religion: z.string().max(50).optional().nullable(),
  casteCategory: z.enum(["GENERAL", "OBC", "SC", "ST", "OTHER"]).optional().nullable(),
});

// ============== SECTION 6: PROFESSIONAL ==============
export const ProfessionalSchema = z.object({
  occupation: z.string().max(100).optional().nullable(),
  employerName: z.string().max(200).optional().nullable(),
  corporateId: z.string().optional().nullable(),
  employeeId: z.string().max(50).optional().nullable(),
});

// ============== SECTION 7: SPECIAL FLAGS ==============
export const SpecialFlagsSchema = z.object({
  isVip: z.boolean().optional().nullable().default(false),
  isMlc: z.boolean().optional().nullable().default(false),
  isEmergency: z.boolean().optional().nullable().default(false),
});

// ============== SECTION 8: PHOTO ==============
export const PhotoSchema = z.object({
  photoUrl: z.union([
    z.literal(""),
    z.string().url()
  ]).optional().nullable(),
});

// ============== SECTION 9: REGISTRATION BILLING ==============
// Base schema without refinement (for spreading into combined schema)
export const RegistrationBillingBaseSchema = z.object({
  registrationFee: z.number().min(0).optional().nullable().default(0),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  discountAmount: z.number().min(0).optional().nullable(),
  discountReason: z.string().max(200).optional().nullable(),
  approvedBy: z.string().optional().nullable(),
  approvedById: z.union([
    z.literal(""),
    z.string().uuid()
  ]).optional().nullable(),
  paymentMode: z.enum(["CASH", "CARD", "UPI", "NET_BANKING", "CHEQUE", "INSURANCE", "OTHER"]).optional().nullable().default("CASH"),
  counterNumber: z.string().max(20).optional().nullable(),
});

// Full schema with refinement (for standalone use)
export const RegistrationBillingSchema = RegistrationBillingBaseSchema.refine((data) => {
  // If discount is applied, reason is mandatory
  if ((data.discountPercent && data.discountPercent > 0) || (data.discountAmount && data.discountAmount > 0)) {
    return data.discountReason && data.discountReason.trim().length > 0;
  }
  return true;
}, {
  message: "Discount reason is mandatory when discount is applied",
  path: ["discountReason"],
});

// ============== SECTION 10: INITIAL CONSULTATION ==============
export const InitialConsultationSchema = z.object({
  createVisit: z.boolean().optional().nullable().default(false),
  consultationType: z.enum(["NORMAL", "EMERGENCY", "FOLLOW_UP"]).optional().nullable().default("NORMAL"),
  departmentId: z.string().optional().nullable(),
  doctorId: z.string().optional().nullable(),
  priority: z.enum(["EMERGENCY", "URGENT", "NORMAL", "LOW"]).optional().nullable().default("NORMAL"),
});

// ============== COMBINED PATIENT REGISTRATION SCHEMA ==============
// Base schema without refinements (for use with .partial())
export const PatientRegistrationBaseSchema = z.object({
  // Basic Identity
  ...BasicIdentitySchema.shape,
  
  // Patient Relation
  ...PatientRelationSchema.shape,
  
  // Contact & Address
  ...ContactAddressSchema.shape,
  
  // Identity Documents
  ...IdentityDocumentsSchema.shape,
  
  // Demographics
  ...DemographicsSchema.shape,
  
  // Professional
  ...ProfessionalSchema.shape,
  
  // Special Flags
  ...SpecialFlagsSchema.shape,
  
  // Photo
  ...PhotoSchema.shape,
  
  // Registration Billing (use base schema without refinement, add refinement at end)
  ...RegistrationBillingBaseSchema.shape,
  
  // Initial Consultation
  ...InitialConsultationSchema.shape,
  
  // Medical History (basic)
  allergies: z.string().max(500).optional().nullable(),
  medicalHistory: z.string().max(1000).optional().nullable(),
  
  // Status
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().nullable().default("ACTIVE"),
});

// Full schema with refinements (for registration validation)
export const PatientRegistrationSchema = PatientRegistrationBaseSchema.refine((data) => {
  // If discount is applied, reason is mandatory
  if ((data.discountPercent && data.discountPercent > 0) || (data.discountAmount && data.discountAmount > 0)) {
    return data.discountReason && data.discountReason.trim().length > 0;
  }
  return true;
}, {
  message: "Discount reason is mandatory when discount is applied",
  path: ["discountReason"],
}).refine((data) => {
  // If createVisit is true, departmentId is required
  if (data.createVisit && !data.departmentId) {
    return false;
  }
  return true;
}, {
  message: "Department is required when creating a visit",
  path: ["departmentId"],
});

// ============== PATIENT UPDATE SCHEMA (for editing) ==============
// Use base schema without refinements for .partial()
export const PatientUpdateSchema = PatientRegistrationBaseSchema.partial().extend({
  id: z.string().min(1, "Patient ID is required"),
});

// ============== PATIENT SEARCH SCHEMA ==============
export const PatientSearchSchema = z.object({
  search: z.string().optional(),
  uhid: z.string().optional(),
  mobile: z.string().optional(),
  aadhaar: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "DECEASED", "ALL"]).optional(),
  registrationDateFrom: z.string().optional(),
  registrationDateTo: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// ============== DOCUMENT UPLOAD SCHEMA ==============
export const PatientDocumentUploadSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  documentType: z.enum([
    "AADHAAR", "PASSPORT", "PAN", "DRIVING_LICENSE",
    "VOTER_ID", "INSURANCE_CARD", "EMPLOYEE_ID", "MLC_DOCUMENT", "OTHER"
  ]),
  documentNumber: z.string().optional(),
  fileUrl: z.string().url("Invalid file URL"),
  fileName: z.string().optional(),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
});

// ============== TYPE EXPORTS ==============
export type PatientRegistrationInput = z.infer<typeof PatientRegistrationSchema>;
// Form input type (before transforms/defaults) - for react-hook-form
export type PatientRegistrationFormValues = z.input<typeof PatientRegistrationSchema>;
export type PatientUpdateInput = z.infer<typeof PatientUpdateSchema>;
export type PatientSearchInput = z.infer<typeof PatientSearchSchema>;
export type PatientDocumentUploadInput = z.infer<typeof PatientDocumentUploadSchema>;
export type BasicIdentityInput = z.infer<typeof BasicIdentitySchema>;
export type ContactAddressInput = z.infer<typeof ContactAddressSchema>;
export type RegistrationBillingInput = z.infer<typeof RegistrationBillingSchema>;
export type InitialConsultationInput = z.infer<typeof InitialConsultationSchema>;

// ============== CONSTANTS FOR UI ==============
export const BLOOD_GROUPS = [
  { value: "A_POSITIVE", label: "A+" },
  { value: "A_NEGATIVE", label: "A-" },
  { value: "B_POSITIVE", label: "B+" },
  { value: "B_NEGATIVE", label: "B-" },
  { value: "AB_POSITIVE", label: "AB+" },
  { value: "AB_NEGATIVE", label: "AB-" },
  { value: "O_POSITIVE", label: "O+" },
  { value: "O_NEGATIVE", label: "O-" },
] as const;

export const MARITAL_STATUSES = [
  { value: "SINGLE", label: "Single" },
  { value: "MARRIED", label: "Married" },
  { value: "DIVORCED", label: "Divorced" },
  { value: "WIDOWED", label: "Widowed" },
  { value: "SEPARATED", label: "Separated" },
] as const;

export const CASTE_CATEGORIES = [
  { value: "GENERAL", label: "General" },
  { value: "OBC", label: "OBC" },
  { value: "SC", label: "SC" },
  { value: "ST", label: "ST" },
  { value: "OTHER", label: "Other" },
] as const;

export const PAYMENT_MODES = [
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "NET_BANKING", label: "Net Banking" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "OTHER", label: "Other" },
] as const;

export const CONSULTATION_TYPES = [
  { value: "NORMAL", label: "Normal" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "FOLLOW_UP", label: "Follow-up" },
] as const;

export const PRIORITIES = [
  { value: "EMERGENCY", label: "Emergency", color: "red" },
  { value: "URGENT", label: "Urgent", color: "orange" },
  { value: "NORMAL", label: "Normal", color: "blue" },
  { value: "LOW", label: "Low", color: "gray" },
] as const;

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
] as const;
