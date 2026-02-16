"use client";

import { useState, useEffect, useRef } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  User,
  Phone,
  FileText,
  Heart,
  Briefcase,
  Flag,
  CreditCard,
  Stethoscope,
  AlertCircle,
  X,
  Camera,
  Folder,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import {
  PatientRegistrationSchema,
  PatientRegistrationFormValues,
  TITLE_CODES,
  RELATION_TYPES,
  BLOOD_GROUPS,
  MARITAL_STATUSES,
  CASTE_CATEGORIES,
  PAYMENT_MODES,
  CONSULTATION_TYPES,
  PRIORITIES,
  INDIAN_STATES,
} from "@/lib/schemas/patient-registration-schema";
import { PatientPhotoCapture } from "./patient-photo-capture";
import { PatientDocumentRepeater, PatientDocument } from "./patient-document-repeater";

// ============== INTERFACES ==============

interface Patient {
  id: string;
  uhid: string;
  titleCode?: number;
  firstName: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  ageYears?: number;
  ageMonths?: number;
  ageDays?: number;
  gender: "MALE" | "FEMALE" | "OTHER";
  maritalStatus?: "SINGLE" | "MARRIED" | "DIVORCED" | "WIDOWED" | "SEPARATED" | null;
  primaryMobile?: string;
  phoneNumber?: string;
  email?: string;
  // ... other fields
  [key: string]: unknown;
}

interface Department {
  id: string;
  name: string;
}

interface Doctor {
  id: string;
  fullName: string;
  departmentId?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onSuccess: () => void;
}

// ============== COLLAPSIBLE SECTION COMPONENT ==============

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  hasError?: boolean;
}

function CollapsibleSection({ title, icon, isOpen, onToggle, children, hasError }: SectionProps) {
  return (
    <div className={`border rounded-lg mb-4 ${hasError ? "border-red-300 bg-red-50/50" : "border-gray-200"}`}>
      <button
        type="button"
        className={`w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors ${
          hasError ? "bg-red-50" : ""
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className={hasError ? "text-red-500" : "text-gray-500"}>{icon}</span>
          <span className="font-medium text-gray-900">{title}</span>
          {hasError && <AlertCircle className="h-4 w-4 text-red-500" />}
        </div>
        {isOpen ? (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronRight className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="p-4 pt-0 border-t">{children}</div>}
    </div>
  );
}

// ============== FORM FIELD COMPONENT ==============

interface FieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}

function FormField({ label, required, error, children, className = "" }: FieldProps) {
  return (
    <div className={className}>
      <Label className={`text-sm font-medium ${error ? "text-red-600" : "text-gray-700"}`}>
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      <div className="mt-1">{children}</div>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

interface DuplicatePatient {
  id: string;
  uhid: string;
  firstName: string;
  lastName?: string;
  primaryMobile?: string;
  phoneNumber?: string;
}

// ============== MAIN COMPONENT ==============

export function PatientRegistrationDrawer({ open, onClose, patient, onSuccess }: Props) {
  // Form state
  const [loading, setLoading] = useState(false);
  const [registrationFee, setRegistrationFee] = useState(0);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicatePatient[] | null>(null);
  
  // Photo and Documents state
  const [patientPhoto, setPatientPhoto] = useState<string | null>(null);
  const [patientDocuments, setPatientDocuments] = useState<PatientDocument[]>([]);
  
  // Current user state for approved by
  const [currentUser, setCurrentUser] = useState<{ id: string; fullName: string } | null>(null);
  
  // Section state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identity: true,
    contact: true,
    photo: false,
    supportingDocuments: false,
    documents: false,
    demographics: false,
    professional: false,
    flags: false,
    billing: true,
    consultation: false,
  });

  const { addToast } = useToast();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Form setup
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    control,
  } = useForm<PatientRegistrationFormValues>({
    resolver: zodResolver(PatientRegistrationSchema),
    defaultValues: {
      gender: "MALE",
      nationality: "Indian",
      presentCountry: "India",
      permanentSameAsPresent: true,
      status: "ACTIVE",
      paymentMode: "CASH",
      registrationFee: 0,
      consultationType: "NORMAL",
      priority: "NORMAL",
      createVisit: false,
      isVip: false,
      isMlc: false,
      isEmergency: false,
    },
  });

  // Watch values for auto-calculations
  const watchedTitleCode = watch("titleCode");
  const watchedDob = watch("dateOfBirth");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _watchedAgeYears = watch("ageYears");
  const watchedPermanentSameAsPresent = watch("permanentSameAsPresent");
  const watchedCreateVisit = watch("createVisit");
  const watchedDepartmentId = watch("departmentId");
  const watchedDiscountPercent = watch("discountPercent");
  const watchedDiscountAmount = watch("discountAmount");
  const watchedRegFee = watch("registrationFee");
  const watchedMobile = watch("primaryMobile");

  // ============== EFFECTS ==============

  // Load configuration
  useEffect(() => {
    if (open) {
      fetchConfiguration();
      // Focus first input after drawer opens using id selector
      setTimeout(() => {
        const firstInput = document.getElementById('patient-firstName');
        firstInput?.focus();
      }, 100);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Load patient data for editing
  useEffect(() => {
    if (patient && open) {
      populateForm(patient);
    } else if (!patient && open) {
      // Reset form for new patient
      reset({
        gender: "MALE",
        nationality: "Indian",
        presentCountry: "India",
        permanentSameAsPresent: true,
        status: "ACTIVE",
        paymentMode: "CASH",
        registrationFee: registrationFee,
        consultationType: "NORMAL",
        priority: "NORMAL",
        createVisit: false,
        isVip: false,
        isMlc: false,
        isEmergency: false,
      });
      // Reset photo and documents for new patient
      setPatientPhoto(null);
      setPatientDocuments([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, open, reset, registrationFee]);

  // Auto-set gender from title code
  useEffect(() => {
    if (watchedTitleCode && TITLE_CODES[watchedTitleCode as keyof typeof TITLE_CODES]) {
      const titleInfo = TITLE_CODES[watchedTitleCode as keyof typeof TITLE_CODES];
      if (titleInfo.gender) {
        setValue("gender", titleInfo.gender as "MALE" | "FEMALE" | "OTHER");
      }
    }
  }, [watchedTitleCode, setValue]);

  // Auto-calculate age from DOB
  useEffect(() => {
    if (watchedDob) {
      const dob = new Date(watchedDob);
      const today = new Date();
      let years = today.getFullYear() - dob.getFullYear();
      let months = today.getMonth() - dob.getMonth();
      let days = today.getDate() - dob.getDate();

      if (days < 0) {
        months--;
        days += 30;
      }
      if (months < 0) {
        years--;
        months += 12;
      }

      setValue("ageYears", years);
      setValue("ageMonths", months);
      setValue("ageDays", days);
    }
  }, [watchedDob, setValue]);

  // Load doctors when department changes
  useEffect(() => {
    if (watchedDepartmentId) {
      fetchDoctors(watchedDepartmentId);
    }
  }, [watchedDepartmentId]);

  // Check for duplicate on mobile change
  useEffect(() => {
    if (watchedMobile && watchedMobile.length === 10 && !patient) {
      checkDuplicate(watchedMobile);
    }
  }, [watchedMobile, patient]);

  // ============== API CALLS ==============

  const fetchConfiguration = async () => {
    try {
      // Fetch registration fee and current user
      const regResponse = await fetch("/api/patients/register");
      if (regResponse.ok) {
        const regData = await regResponse.json();
        if (regData.success) {
          setRegistrationFee(regData.data.registrationFee || 0);
          setValue("registrationFee", regData.data.registrationFee || 0);
          // Set current user for approved by field
          if (regData.data.currentUser) {
            setCurrentUser(regData.data.currentUser);
            setValue("approvedBy", regData.data.currentUser.fullName);
            setValue("approvedById", regData.data.currentUser.id);
          }
        }
      }

      // Fetch departments
      const deptResponse = await fetch("/api/departments?status=ACTIVE");
      if (deptResponse.ok) {
        const deptData = await deptResponse.json();
        if (deptData.success) {
          setDepartments(deptData.data?.departments || deptData.data || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch configuration:", error);
    }
  };

  const fetchDoctors = async (departmentId: string) => {
    try {
      const response = await fetch(`/api/doctor?departmentId=${departmentId}&status=ACTIVE`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setDoctors(data.data?.doctors || data.data || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
    }
  };

  const checkDuplicate = async (mobile: string) => {
    try {
      const response = await fetch("/api/patients/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data.exists) {
          setDuplicateWarning(data.data.patients);
        } else {
          setDuplicateWarning(null);
        }
      }
    } catch (error) {
      console.error("Failed to check duplicate:", error);
    }
  };

  // ============== HELPERS ==============

  // Convert null values to empty strings for form compatibility
  // Zod schema accepts string | undefined | "", but not null
  const sanitizeForForm = (obj: Record<string, unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const key in obj) {
      const value = obj[key];
      // Convert null to empty string for string fields
      // Keep undefined/booleans/numbers as-is
      if (value === null) {
        result[key] = "";
      } else if (typeof value === "object" && !Array.isArray(value)) {
        // Don't recurse into nested objects
        result[key] = value;
      } else {
        result[key] = value;
      }
    }
    return result;
  };

  const populateForm = (data: Patient) => {
    const sanitizedData = sanitizeForForm(data as Record<string, unknown>);
    reset({
      ...sanitizedData,
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split("T")[0] : "",
      primaryMobile: data.primaryMobile || data.phoneNumber || "",
      registrationFee: registrationFee,
      paymentMode: "CASH",
      consultationType: "NORMAL",
      priority: "NORMAL",
      createVisit: false,
    });

    // Load existing photo
    const photoUrl = data.photoUrl as string | null | undefined;
    if (photoUrl && typeof photoUrl === "string") {
      setPatientPhoto(photoUrl);
    } else {
      setPatientPhoto(null);
    }

    // Load existing documents
    const documents = data.documents as Array<{
      id: string;
      documentName: string;
      documentType: string;
      documentNumber?: string;
      fileName?: string;
      fileSize?: number;
      mimeType?: string;
      fileUrl: string;
    }> | undefined;
    
    if (documents && Array.isArray(documents)) {
      const loadedDocs: PatientDocument[] = documents.map((doc) => ({
        id: doc.id,
        documentName: doc.documentName || "",
        documentType: doc.documentType || "OTHER",
        documentNumber: doc.documentNumber || "",
        fileName: doc.fileName || "",
        fileSize: doc.fileSize,
        mimeType: doc.mimeType || "",
        fileUrl: doc.fileUrl,
        fileData: undefined, // Existing docs don't have new fileData
        isNew: false,
        isDeleted: false,
      }));
      setPatientDocuments(loadedDocs);
    } else {
      setPatientDocuments([]);
    }
  };

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const calculateNetAmount = () => {
    const fee = watchedRegFee || 0;
    const discountPct = watchedDiscountPercent || 0;
    const discountAmt = watchedDiscountAmount || (fee * discountPct / 100);
    return Math.max(0, fee - discountAmt);
  };

  // Check if section has errors
  const sectionHasErrors = (section: string): boolean => {
    const sectionFields: Record<string, string[]> = {
      identity: ["titleCode", "firstName", "middleName", "lastName", "dateOfBirth", "ageYears", "gender", "maritalStatus"],
      contact: ["primaryMobile", "secondaryMobile", "email", "guardianName", "guardianMobile", "presentPincode"],
      documents: ["aadhaarNumber", "passportNumber", "panNumber"],
      demographics: ["bloodGroup", "motherTongue", "nationality", "religion", "casteCategory"],
      professional: ["occupation", "employerName", "corporateId", "employeeId"],
      flags: ["isVip", "isMlc", "isEmergency"],
      billing: ["registrationFee", "discountPercent", "discountAmount", "discountReason", "paymentMode"],
      consultation: ["consultationType", "departmentId", "doctorId", "priority"],
    };

    const fields = sectionFields[section] || [];
    return fields.some((field) => errors[field as keyof typeof errors]);
  };

  // ============== SUBMIT ==============

  const onSubmit = async (data: PatientRegistrationFormValues) => {
    try {
      setLoading(true);

      // Validate photo for MLC cases
      if (data.isMlc && !patientPhoto) {
        addToast("error", "Photo is mandatory for MLC cases");
        setOpenSections((prev) => ({ ...prev, photo: true }));
        setLoading(false);
        return;
      }

      const url = patient ? `/api/patients/${patient.id}` : "/api/patients/register";
      const method = patient ? "PUT" : "POST";

      // Prepare documents for submission (filter out deleted and include only with files)
      const documentsToSubmit = patientDocuments
        .filter((doc) => !doc.isDeleted && doc.documentName && (doc.fileData || doc.fileUrl))
        .map((doc) => ({
          id: doc.id,
          documentName: doc.documentName,
          documentType: doc.documentType,
          documentNumber: doc.documentNumber,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          mimeType: doc.mimeType,
          fileData: doc.fileData,
          fileUrl: doc.fileUrl,
          isNew: doc.isNew,
        }));

      // Collect IDs of deleted documents (only for existing documents, not new ones)
      const documentsToDelete = patientDocuments
        .filter((doc) => doc.isDeleted && doc.id && !doc.isNew)
        .map((doc) => doc.id);

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          photoUrl: patientPhoto,
          documents: documentsToSubmit,
          deleteDocumentIds: documentsToDelete,
          skipDuplicateCheck: duplicateWarning !== null, // Skip if user saw warning
        }),
      });

      const result = await response.json();

      if (result.success) {
        addToast(
          "success",
          patient
            ? "Patient updated successfully"
            : `Patient registered successfully. UHID: ${result.data.patient?.uhid}`
        );
        // Reset photo and documents state
        setPatientPhoto(null);
        setPatientDocuments([]);
        onSuccess();
      } else if (result.errorCode === "DUPLICATE_PATIENT") {
        setDuplicateWarning(result.data.duplicates);
        addToast("warning", "Potential duplicate patient found. Review and save again to confirm.");
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

  // ============== RENDER ==============

  const footer = (
    <div className="flex items-center justify-between">
      <div className="text-sm text-gray-500">
        {!patient && (
          <span>
            Net Amount: <strong className="text-lg text-green-600">₹{calculateNetAmount().toFixed(2)}</strong>
          </span>
        )}
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading} onClick={handleSubmit(onSubmit)}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {patient ? "Update Patient" : "Register Patient"}
        </Button>
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={open}
      onClose={onClose}
      title={patient ? `Edit Patient: ${patient.uhid}` : "New Patient Registration"}
      footer={footer}
      width="w-3/5"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-2">
        {/* Duplicate Warning */}
        {duplicateWarning && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div className="flex-1">
                <h4 className="font-medium text-yellow-800">Potential duplicate patient found</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Patient(s) with matching details already exist:
                </p>
                <ul className="mt-2 space-y-1">
                  {duplicateWarning.map((p: DuplicatePatient) => (
                    <li key={p.id} className="text-sm text-yellow-700">
                      • {p.uhid} - {p.firstName} {p.lastName} ({p.primaryMobile || p.phoneNumber})
                    </li>
                  ))}
                </ul>
                <p className="text-sm text-yellow-700 mt-2">
                  Click &quot;Register Patient&quot; again to confirm this is a new patient.
                </p>
              </div>
              <button type="button" onClick={() => setDuplicateWarning(null)} className="text-yellow-500 hover:text-yellow-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* SECTION: Patient Photo (Top of Form) */}
        <CollapsibleSection
          title="Patient Photo"
          icon={<Camera className="h-5 w-5" />}
          isOpen={openSections.photo}
          onToggle={() => toggleSection("photo")}
        >
          <div className="mt-4">
            <PatientPhotoCapture
              value={patientPhoto}
              onChange={setPatientPhoto}
              required={watch("isMlc") === true}
            />
            <p className="text-xs text-gray-500 mt-2">
              Max file size: 200KB. Only JPEG format. Photo will be cropped to square.
            </p>
          </div>
        </CollapsibleSection>

        {/* SECTION 1: Basic Identity */}
        <CollapsibleSection
          title="Basic Identity"
          icon={<User className="h-5 w-5" />}
          isOpen={openSections.identity}
          onToggle={() => toggleSection("identity")}
          hasError={sectionHasErrors("identity")}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            {/* Title */}
            <FormField label="Title" className="col-span-1">
              <Controller
                name="titleCode"
                control={control}
                render={({ field }) => (
                  <Select
                    value={field.value?.toString() || ""}
                    onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(TITLE_CODES).map((t) => (
                        <SelectItem key={t.code} value={t.code.toString()}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            {/* First Name */}
            <FormField label="First Name" required error={errors.firstName?.message}>
              <Input
                id="patient-firstName"
                {...register("firstName")}
                placeholder="First name"
                className={errors.firstName ? "border-red-300" : ""}
              />
            </FormField>

            {/* Middle Name */}
            <FormField label="Middle Name">
              <Input {...register("middleName")} placeholder="Middle name" />
            </FormField>

            {/* Last Name */}
            <FormField label="Last Name">
              <Input {...register("lastName")} placeholder="Last name" />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            {/* Date of Birth */}
            <FormField label="Date of Birth">
              <Input type="date" {...register("dateOfBirth")} max={new Date().toISOString().split("T")[0]} />
            </FormField>

            {/* Age */}
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Years">
                <Input
                  type="number"
                  {...register("ageYears", { valueAsNumber: true })}
                  placeholder="Y"
                  min={0}
                  max={150}
                />
              </FormField>
              <FormField label="Months">
                <Input
                  type="number"
                  {...register("ageMonths", { valueAsNumber: true })}
                  placeholder="M"
                  min={0}
                  max={11}
                />
              </FormField>
              <FormField label="Days">
                <Input
                  type="number"
                  {...register("ageDays", { valueAsNumber: true })}
                  placeholder="D"
                  min={0}
                  max={30}
                />
              </FormField>
            </div>

            {/* Gender */}
            <FormField label="Gender" required error={errors.gender?.message}>
              <Controller
                name="gender"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className={errors.gender ? "border-red-300" : ""}>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            {/* Marital Status */}
            <FormField label="Marital Status">
              <Controller
                name="maritalStatus"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARITAL_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          {/* Relation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <FormField label="Relation Type">
              <Controller
                name="relationType"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select relation" />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATION_TYPES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Relation Name" className="col-span-2">
              <Input {...register("relationName")} placeholder="Father's / Mother's / Spouse name" />
            </FormField>
          </div>
        </CollapsibleSection>

        {/* SECTION 2: Contact & Address */}
        <CollapsibleSection
          title="Contact & Address"
          icon={<Phone className="h-5 w-5" />}
          isOpen={openSections.contact}
          onToggle={() => toggleSection("contact")}
          hasError={sectionHasErrors("contact")}
        >
          <div className="space-y-4 mt-4">
            {/* Contact Numbers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Primary Mobile" required error={errors.primaryMobile?.message}>
                <Input
                  {...register("primaryMobile")}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className={errors.primaryMobile ? "border-red-300" : ""}
                />
              </FormField>

              <FormField label="Secondary Mobile" error={errors.secondaryMobile?.message}>
                <Input {...register("secondaryMobile")} placeholder="10-digit mobile" maxLength={10} />
              </FormField>

              <FormField label="Email" error={errors.email?.message}>
                <Input {...register("email")} type="email" placeholder="email@example.com" />
              </FormField>
            </div>

            {/* Guardian */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="Guardian Name">
                <Input {...register("guardianName")} placeholder="Guardian name" />
              </FormField>

              <FormField label="Guardian Relation">
                <Input {...register("guardianRelation")} placeholder="Relation" />
              </FormField>

              <FormField label="Guardian Mobile">
                <Input {...register("guardianMobile")} placeholder="10-digit mobile" maxLength={10} />
              </FormField>
            </div>

            {/* Present Address */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium text-gray-700 mb-3">Present Address</h4>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField label="House No." className="col-span-1">
                  <Input {...register("presentHouseNo")} placeholder="House/Flat No." />
                </FormField>
                <FormField label="Street" className="col-span-1">
                  <Input {...register("presentStreet")} placeholder="Street" />
                </FormField>
                <FormField label="Area" className="col-span-1">
                  <Input {...register("presentArea")} placeholder="Area/Locality" />
                </FormField>
                <FormField label="Village/Town" className="col-span-1">
                  <Input {...register("presentVillage")} placeholder="Village/Town" />
                </FormField>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                <FormField label="Taluk">
                  <Input {...register("presentTaluk")} placeholder="Taluk" />
                </FormField>
                <FormField label="District">
                  <Input {...register("presentDistrict")} placeholder="District" />
                </FormField>
                <FormField label="State">
                  <Controller
                    name="presentState"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ""} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map((state) => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField label="Pincode" error={errors.presentPincode?.message}>
                  <Input
                    {...register("presentPincode")}
                    placeholder="6-digit pincode"
                    maxLength={6}
                    className={errors.presentPincode ? "border-red-300" : ""}
                  />
                </FormField>
              </div>
            </div>

            {/* Permanent Address */}
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Controller
                  name="permanentSameAsPresent"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="permanentSame"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="permanentSame" className="font-medium text-gray-700 cursor-pointer">
                  Permanent address same as present
                </Label>
              </div>

              {!watchedPermanentSameAsPresent && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField label="House No." className="col-span-1">
                      <Input {...register("permanentHouseNo")} placeholder="House/Flat No." />
                    </FormField>
                    <FormField label="Street" className="col-span-1">
                      <Input {...register("permanentStreet")} placeholder="Street" />
                    </FormField>
                    <FormField label="Area" className="col-span-1">
                      <Input {...register("permanentArea")} placeholder="Area/Locality" />
                    </FormField>
                    <FormField label="Village/Town" className="col-span-1">
                      <Input {...register("permanentVillage")} placeholder="Village/Town" />
                    </FormField>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-3">
                    <FormField label="Taluk">
                      <Input {...register("permanentTaluk")} placeholder="Taluk" />
                    </FormField>
                    <FormField label="District">
                      <Input {...register("permanentDistrict")} placeholder="District" />
                    </FormField>
                    <FormField label="State">
                      <Controller
                        name="permanentState"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || ""} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                            <SelectContent>
                              {INDIAN_STATES.map((state) => (
                                <SelectItem key={state} value={state}>
                                  {state}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </FormField>
                    <FormField label="Pincode">
                      <Input {...register("permanentPincode")} placeholder="6-digit pincode" maxLength={6} />
                    </FormField>
                  </div>
                </>
              )}
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION 3: Identity Documents */}
        <CollapsibleSection
          title="Identity Documents"
          icon={<FileText className="h-5 w-5" />}
          isOpen={openSections.documents}
          onToggle={() => toggleSection("documents")}
          hasError={sectionHasErrors("documents")}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <FormField label="Aadhaar Number" error={errors.aadhaarNumber?.message}>
              <Input
                {...register("aadhaarNumber")}
                placeholder="12-digit Aadhaar"
                maxLength={12}
                className={errors.aadhaarNumber ? "border-red-300" : ""}
              />
            </FormField>

            <FormField label="Passport Number" error={errors.passportNumber?.message}>
              <Input
                {...register("passportNumber")}
                placeholder="Passport number"
                className={errors.passportNumber ? "border-red-300" : ""}
              />
            </FormField>

            <FormField label="PAN Number" error={errors.panNumber?.message}>
              <Input
                {...register("panNumber")}
                placeholder="ABCDE1234F"
                maxLength={10}
                className={`uppercase ${errors.panNumber ? "border-red-300" : ""}`}
              />
            </FormField>
          </div>
        </CollapsibleSection>

        {/* SECTION 4: Demographics */}
        <CollapsibleSection
          title="Demographics"
          icon={<Heart className="h-5 w-5" />}
          isOpen={openSections.demographics}
          onToggle={() => toggleSection("demographics")}
          hasError={sectionHasErrors("demographics")}
        >
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
            <FormField label="Blood Group">
              <Controller
                name="bloodGroup"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {BLOOD_GROUPS.map((bg) => (
                        <SelectItem key={bg.value} value={bg.value}>
                          {bg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>

            <FormField label="Mother Tongue">
              <Input {...register("motherTongue")} placeholder="e.g., Telugu" />
            </FormField>

            <FormField label="Nationality">
              <Input {...register("nationality")} placeholder="Nationality" defaultValue="Indian" />
            </FormField>

            <FormField label="Religion">
              <Input {...register("religion")} placeholder="Religion" />
            </FormField>

            <FormField label="Caste Category">
              <Controller
                name="casteCategory"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {CASTE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>
        </CollapsibleSection>

        {/* SECTION 5: Professional */}
        <CollapsibleSection
          title="Professional / Employment"
          icon={<Briefcase className="h-5 w-5" />}
          isOpen={openSections.professional}
          onToggle={() => toggleSection("professional")}
          hasError={sectionHasErrors("professional")}
        >
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <FormField label="Occupation">
              <Input {...register("occupation")} placeholder="Occupation" />
            </FormField>

            <FormField label="Employer Name">
              <Input {...register("employerName")} placeholder="Employer/Company name" />
            </FormField>

            <FormField label="Corporate Tie-up">
              <Input {...register("corporateId")} placeholder="Corporate ID" />
            </FormField>

            <FormField label="Employee ID">
              <Input {...register("employeeId")} placeholder="Employee ID" />
            </FormField>
          </div>
        </CollapsibleSection>

        {/* SECTION 6: Special Flags */}
        <CollapsibleSection
          title="Special Flags"
          icon={<Flag className="h-5 w-5" />}
          isOpen={openSections.flags}
          onToggle={() => toggleSection("flags")}
          hasError={sectionHasErrors("flags")}
        >
          <div className="flex flex-wrap gap-6 mt-4">
            <div className="flex items-center gap-2">
              <Controller
                name="isVip"
                control={control}
                render={({ field }) => (
                  <Checkbox id="isVip" checked={field.value ?? false} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="isVip" className="cursor-pointer flex items-center gap-1">
                <span className="text-yellow-600">👑</span> VIP Patient
              </Label>
              <span className="text-xs text-gray-500">(Visible to Doctor only)</span>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                name="isMlc"
                control={control}
                render={({ field }) => (
                  <Checkbox id="isMlc" checked={field.value ?? false} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="isMlc" className="cursor-pointer flex items-center gap-1">
                <span className="text-orange-600">⚠️</span> MLC Case
              </Label>
              <span className="text-xs text-gray-500">(Requires document upload)</span>
            </div>

            <div className="flex items-center gap-2">
              <Controller
                name="isEmergency"
                control={control}
                render={({ field }) => (
                  <Checkbox id="isEmergency" checked={field.value ?? false} onCheckedChange={field.onChange} />
                )}
              />
              <Label htmlFor="isEmergency" className="cursor-pointer flex items-center gap-1">
                <span className="text-red-600">🚨</span> Emergency
              </Label>
            </div>
          </div>

          {/* Medical History */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t">
            <FormField label="Allergies">
              <Textarea {...register("allergies")} placeholder="Known allergies" rows={2} />
            </FormField>

            <FormField label="Medical History">
              <Textarea {...register("medicalHistory")} placeholder="Relevant medical history" rows={2} />
            </FormField>
          </div>
        </CollapsibleSection>

        {/* SECTION 7: Supporting Documents */}
        <CollapsibleSection
          title="Supporting Documents"
          icon={<Folder className="h-5 w-5" />}
          isOpen={openSections.supportingDocuments}
          onToggle={() => toggleSection("supportingDocuments")}
        >
          <div className="mt-4">
            <PatientDocumentRepeater
              documents={patientDocuments}
              onChange={setPatientDocuments}
            />
            <p className="text-xs text-gray-500 mt-2">
              Allowed: PDF, JPG, PNG. Max file size per document: 2MB.
            </p>
          </div>
        </CollapsibleSection>

        {/* SECTION 9: Registration Billing (only for new registration) */}
        {!patient && (
          <CollapsibleSection
            title="Registration Billing"
            icon={<CreditCard className="h-5 w-5" />}
            isOpen={openSections.billing}
            onToggle={() => toggleSection("billing")}
            hasError={sectionHasErrors("billing")}
          >
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormField label="Registration Fee">
                  <Input
                    type="number"
                    {...register("registrationFee", { valueAsNumber: true })}
                    min={0}
                    step="0.01"
                  />
                </FormField>

                <FormField label="Discount %">
                  <Input
                    type="number"
                    {...register("discountPercent", { valueAsNumber: true })}
                    min={0}
                    max={100}
                    step="0.01"
                    placeholder="0"
                  />
                </FormField>

                <FormField label="Discount Amount">
                  <Input
                    type="number"
                    {...register("discountAmount", { valueAsNumber: true })}
                    min={0}
                    step="0.01"
                    placeholder="0"
                  />
                </FormField>

                <FormField label="Payment Mode">
                  <Controller
                    name="paymentMode"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value ?? "CASH"} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_MODES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
              </div>

              {((watchedDiscountPercent && watchedDiscountPercent > 0) || (watchedDiscountAmount && watchedDiscountAmount > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Discount Reason"
                    required
                    error={errors.discountReason?.message}
                  >
                    <Input
                      {...register("discountReason")}
                      placeholder="Reason for discount (mandatory)"
                      className={errors.discountReason ? "border-red-300" : ""}
                    />
                  </FormField>
                </div>
              )}

              {/* Approved By - Auto-populated from logged-in user */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Approved By">
                  <Input 
                    value={currentUser?.fullName || ""}
                    readOnly
                    disabled
                    className="bg-gray-50"
                  />
                  <input type="hidden" {...register("approvedBy")} />
                  <input type="hidden" {...register("approvedById")} />
                </FormField>
              </div>

              {/* Net Amount Display */}
              <div className="bg-green-50 rounded-lg p-4 flex items-center justify-between">
                <span className="text-gray-700">Net Amount Payable:</span>
                <span className="text-2xl font-bold text-green-600">
                  ₹{calculateNetAmount().toFixed(2)}
                </span>
              </div>
            </div>
          </CollapsibleSection>
        )}

        {/* SECTION 10: Initial Consultation (only for new registration) */}
        {!patient && (
          <CollapsibleSection
            title="Initial Consultation"
            icon={<Stethoscope className="h-5 w-5" />}
            isOpen={openSections.consultation}
            onToggle={() => toggleSection("consultation")}
            hasError={sectionHasErrors("consultation")}
          >
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-2">
                <Controller
                  name="createVisit"
                  control={control}
                  render={({ field }) => (
                    <Checkbox id="createVisit" checked={field.value ?? false} onCheckedChange={field.onChange} />
                  )}
                />
                <Label htmlFor="createVisit" className="cursor-pointer font-medium">
                  Create OPD Visit Now
                </Label>
                <span className="text-xs text-gray-500">(Generate token and add to queue)</span>
              </div>

              {watchedCreateVisit && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t">
                  <FormField label="Consultation Type">
                    <Controller
                      name="consultationType"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value ?? "NORMAL"} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CONSULTATION_TYPES.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField
                    label="Department"
                    required={watchedCreateVisit}
                    error={errors.departmentId?.message}
                  >
                    <Controller
                      name="departmentId"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger className={errors.departmentId ? "border-red-300" : ""}>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                          <SelectContent>
                            {departments.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField label="Doctor">
                    <Controller
                      name="doctorId"
                      control={control}
                      render={({ field }) => (
                        <Select
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          disabled={!watchedDepartmentId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={watchedDepartmentId ? "Select doctor" : "Select department first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {doctors.map((d) => (
                              <SelectItem key={d.id} value={d.id}>
                                {d.fullName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>

                  <FormField label="Priority">
                    <Controller
                      name="priority"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value ?? "NORMAL"} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </FormField>
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}
      </form>
    </Drawer>
  );
}
