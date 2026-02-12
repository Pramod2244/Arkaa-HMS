"use client";

/**
 * HMS Medical Masters - Doctor Form Drawer
 * 
 * Multi-step drawer form for creating and editing doctors.
 * Sections:
 * 1. Identity - User link, registration details
 * 2. Personal - Name, gender, DOB, contact
 * 3. Professional - Qualifications, specializations, fees
 * 4. Departments - Primary + secondary department mapping
 * 5. Settings - Schedulable, walk-in, status
 */

import React, { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import {
  User,
  FileText,
  GraduationCap,
  Building2,
  Settings,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Save,
  X,
  AlertCircle,
} from "lucide-react";

// ============== TYPES ==============

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Doctor {
  id: string;
  doctorCode: string;
  userId: string;
  registrationNumber: string;
  registrationAuthority?: string;
  registrationDate?: Date | null;
  fullName: string;
  gender: "MALE" | "FEMALE" | "OTHER";
  dateOfBirth?: Date | null;
  mobile: string;
  email?: string | null;
  qualifications: string[];
  specializations: string[];
  yearsOfExperience?: number | null;
  consultationFee: number;
  followUpFee?: number | null;
  primaryDepartmentId: string;
  status: "ACTIVE" | "INACTIVE" | "ON_LEAVE";
  isSchedulable: boolean;
  allowWalkIn: boolean;
  version: number;
  departments?: {
    id: string;
    departmentId: string;
    isPrimary: boolean;
    department: Department;
  }[];
  user?: {
    id: string;
    email: string;
    fullName: string;
    isActive: boolean;
  };
}

interface User {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
}

interface DoctorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  doctor: Doctor | null;
  departments: Department[];
}

// ============== FORM SCHEMA ==============

const DoctorFormSchema = z.object({
  // Identity
  userId: z.string().min(1, "User is required"),
  registrationNumber: z.string().min(1, "Registration number is required"),
  registrationAuthority: z.string().optional(),
  registrationDate: z.string().optional(),
  
  // Personal
  fullName: z.string().min(2, "Full name is required"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  dateOfBirth: z.string().optional(),
  mobile: z.string().min(10, "Mobile number must be at least 10 digits"),
  email: z.string().email().optional().or(z.literal("")),
  
  // Professional
  qualifications: z.string().min(1, "At least one qualification is required"),
  specializations: z.string().optional(),
  yearsOfExperience: z.coerce.number().min(0).optional(),
  consultationFee: z.coerce.number().min(0, "Consultation fee is required"),
  followUpFee: z.coerce.number().min(0).optional(),
  
  // Departments
  primaryDepartmentId: z.string().min(1, "Primary department is required"),
  departmentIds: z.array(z.string()).min(1, "At least one department is required"),
  
  // Settings
  status: z.enum(["ACTIVE", "INACTIVE", "ON_LEAVE"]),
  isSchedulable: z.boolean(),
  allowWalkIn: z.boolean(),
});

type DoctorFormData = z.infer<typeof DoctorFormSchema>;

// ============== STEP CONFIG ==============

const STEPS = [
  { id: 1, name: "Identity", icon: User },
  { id: 2, name: "Personal", icon: FileText },
  { id: 3, name: "Professional", icon: GraduationCap },
  { id: 4, name: "Departments", icon: Building2 },
  { id: 5, name: "Settings", icon: Settings },
];

// ============== COMPONENT ==============

export function DoctorDrawer({
  isOpen,
  onClose,
  onSuccess,
  doctor,
  departments,
}: DoctorDrawerProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<string[]>([]);

  const isEditing = !!doctor;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    trigger,
  } = useForm<DoctorFormData>({
    resolver: zodResolver(DoctorFormSchema),
    defaultValues: {
      userId: "",
      registrationNumber: "",
      registrationAuthority: "",
      registrationDate: "",
      fullName: "",
      gender: "MALE",
      dateOfBirth: "",
      mobile: "",
      email: "",
      qualifications: "",
      specializations: "",
      yearsOfExperience: undefined,
      consultationFee: 0,
      followUpFee: undefined,
      primaryDepartmentId: "",
      departmentIds: [],
      status: "ACTIVE",
      isSchedulable: true,
      allowWalkIn: true,
    },
    mode: "onChange",
  });

  const watchedPrimaryDept = watch("primaryDepartmentId");

  // ============== FETCH USERS ==============

  const fetchAvailableUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      // Fetch users that can be doctors (active users without doctor profile)
      const response = await fetch("/api/admin/users?isActive=true&limit=100");
      const result = await response.json();
      
      // API returns array directly or { success, data } format
      if (Array.isArray(result)) {
        // Filter to only active users
        setAvailableUsers(result.filter((u: User) => u.isActive));
      } else if (result.success && result.data) {
        setAvailableUsers(result.data.filter((u: User) => u.isActive));
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && !isEditing) {
      fetchAvailableUsers();
    }
  }, [isOpen, isEditing, fetchAvailableUsers]);

  // ============== POPULATE FORM FOR EDITING ==============

  useEffect(() => {
    if (isOpen && doctor) {
      const deptIds = doctor.departments?.map((d) => d.departmentId) || [doctor.primaryDepartmentId];
      setSelectedDepartmentIds(deptIds);
      
      reset({
        userId: doctor.userId,
        registrationNumber: doctor.registrationNumber,
        registrationAuthority: doctor.registrationAuthority || "",
        registrationDate: doctor.registrationDate 
          ? new Date(doctor.registrationDate).toISOString().split("T")[0] 
          : "",
        fullName: doctor.fullName,
        gender: doctor.gender,
        dateOfBirth: doctor.dateOfBirth 
          ? new Date(doctor.dateOfBirth).toISOString().split("T")[0] 
          : "",
        mobile: doctor.mobile,
        email: doctor.email || "",
        qualifications: doctor.qualifications.join(", "),
        specializations: doctor.specializations?.join(", ") || "",
        yearsOfExperience: doctor.yearsOfExperience || undefined,
        consultationFee: doctor.consultationFee,
        followUpFee: doctor.followUpFee || undefined,
        primaryDepartmentId: doctor.primaryDepartmentId,
        departmentIds: deptIds,
        status: doctor.status,
        isSchedulable: doctor.isSchedulable,
        allowWalkIn: doctor.allowWalkIn,
      });
    } else if (isOpen && !doctor) {
      setSelectedDepartmentIds([]);
      reset({
        userId: "",
        registrationNumber: "",
        registrationAuthority: "",
        registrationDate: "",
        fullName: "",
        gender: "MALE",
        dateOfBirth: "",
        mobile: "",
        email: "",
        qualifications: "",
        specializations: "",
        yearsOfExperience: undefined,
        consultationFee: 0,
        followUpFee: undefined,
        primaryDepartmentId: "",
        departmentIds: [],
        status: "ACTIVE",
        isSchedulable: true,
        allowWalkIn: true,
      });
    }
    setCurrentStep(1);
    setError(null);
  }, [isOpen, doctor, reset]);

  // ============== SYNC DEPARTMENT SELECTIONS ==============

  useEffect(() => {
    setValue("departmentIds", selectedDepartmentIds);
  }, [selectedDepartmentIds, setValue]);

  // Ensure primary dept is always included
  useEffect(() => {
    if (watchedPrimaryDept && !selectedDepartmentIds.includes(watchedPrimaryDept)) {
      setSelectedDepartmentIds((prev) => [...prev, watchedPrimaryDept]);
    }
  }, [watchedPrimaryDept, selectedDepartmentIds]);

  // ============== STEP NAVIGATION ==============

  const validateStep = async () => {
    let fieldsToValidate: (keyof DoctorFormData)[] = [];
    
    switch (currentStep) {
      case 1:
        fieldsToValidate = ["userId", "registrationNumber"];
        break;
      case 2:
        fieldsToValidate = ["fullName", "gender", "mobile"];
        break;
      case 3:
        fieldsToValidate = ["qualifications", "consultationFee"];
        break;
      case 4:
        fieldsToValidate = ["primaryDepartmentId", "departmentIds"];
        break;
      case 5:
        fieldsToValidate = ["status", "isSchedulable", "allowWalkIn"];
        break;
    }

    const result = await trigger(fieldsToValidate);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateStep();
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  // ============== FORM SUBMISSION ==============

  const onSubmit = async (data: DoctorFormData) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const payload = {
        ...data,
        qualifications: data.qualifications.split(",").map((q) => q.trim()).filter(Boolean),
        specializations: data.specializations 
          ? data.specializations.split(",").map((s) => s.trim()).filter(Boolean) 
          : [],
        registrationDate: data.registrationDate || null,
        dateOfBirth: data.dateOfBirth || null,
        email: data.email || null,
        yearsOfExperience: data.yearsOfExperience || null,
        followUpFee: data.followUpFee || null,
        ...(isEditing && { version: doctor.version }),
      };

      const url = isEditing 
        ? `/api/masters/doctors/${doctor.id}` 
        : "/api/masters/doctors";
      
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to save doctor");
      }

      onSuccess();
    } catch (error) {
      console.error("Submit error:", error);
      setError(error instanceof Error ? error.message : "Failed to save doctor");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============== DEPARTMENT TOGGLE ==============

  const toggleDepartment = (deptId: string) => {
    setSelectedDepartmentIds((prev) => {
      if (prev.includes(deptId)) {
        // Can't remove primary department
        if (deptId === watchedPrimaryDept) return prev;
        return prev.filter((id) => id !== deptId);
      }
      return [...prev, deptId];
    });
  };

  // ============== RENDER STEPS ==============

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Identity Information</h3>
            
            {/* User Selection */}
            <div className="space-y-2">
              <Label htmlFor="userId">Link to User Account *</Label>
              <Select
                value={watch("userId")}
                onValueChange={(value) => {
                  setValue("userId", value);
                  const user = availableUsers.find((u) => u.id === value);
                  if (user && !watch("fullName")) {
                    setValue("fullName", user.fullName);
                    setValue("email", user.email);
                  }
                }}
                disabled={isEditing || isLoadingUsers}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingUsers ? "Loading users..." : "Select user"} />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.fullName} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.userId && (
                <p className="text-sm text-red-500">{errors.userId.message}</p>
              )}
            </div>

            {/* Registration Number */}
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">Registration Number (MCI/State) *</Label>
              <Input
                id="registrationNumber"
                placeholder="e.g., MCI-123456"
                {...register("registrationNumber")}
              />
              {errors.registrationNumber && (
                <p className="text-sm text-red-500">{errors.registrationNumber.message}</p>
              )}
            </div>

            {/* Registration Authority */}
            <div className="space-y-2">
              <Label htmlFor="registrationAuthority">Registration Authority</Label>
              <Input
                id="registrationAuthority"
                placeholder="e.g., Medical Council of India"
                {...register("registrationAuthority")}
              />
            </div>

            {/* Registration Date */}
            <div className="space-y-2">
              <Label htmlFor="registrationDate">Registration Date</Label>
              <Input
                id="registrationDate"
                type="date"
                {...register("registrationDate")}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Personal Information</h3>
            
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                placeholder="Dr. John Doe"
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-sm text-red-500">{errors.fullName.message}</p>
              )}
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender">Gender *</Label>
              <Select
                value={watch("gender")}
                onValueChange={(value) => setValue("gender", value as "MALE" | "FEMALE" | "OTHER")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MALE">Male</SelectItem>
                  <SelectItem value="FEMALE">Female</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date of Birth */}
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth</Label>
              <Input
                id="dateOfBirth"
                type="date"
                {...register("dateOfBirth")}
              />
            </div>

            {/* Mobile */}
            <div className="space-y-2">
              <Label htmlFor="mobile">Mobile Number *</Label>
              <Input
                id="mobile"
                placeholder="9876543210"
                {...register("mobile")}
              />
              {errors.mobile && (
                <p className="text-sm text-red-500">{errors.mobile.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="doctor@hospital.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Professional Information</h3>
            
            {/* Qualifications */}
            <div className="space-y-2">
              <Label htmlFor="qualifications">Qualifications * (comma separated)</Label>
              <Input
                id="qualifications"
                placeholder="MBBS, MD, DM"
                {...register("qualifications")}
              />
              {errors.qualifications && (
                <p className="text-sm text-red-500">{errors.qualifications.message}</p>
              )}
              <p className="text-xs text-slate-500">Enter qualifications separated by commas</p>
            </div>

            {/* Specializations */}
            <div className="space-y-2">
              <Label htmlFor="specializations">Specializations (comma separated)</Label>
              <Input
                id="specializations"
                placeholder="Cardiology, Interventional Cardiology"
                {...register("specializations")}
              />
              <p className="text-xs text-slate-500">Enter specializations separated by commas</p>
            </div>

            {/* Years of Experience */}
            <div className="space-y-2">
              <Label htmlFor="yearsOfExperience">Years of Experience</Label>
              <Input
                id="yearsOfExperience"
                type="number"
                min="0"
                placeholder="10"
                {...register("yearsOfExperience")}
              />
            </div>

            {/* Consultation Fee */}
            <div className="space-y-2">
              <Label htmlFor="consultationFee">Consultation Fee (₹) *</Label>
              <Input
                id="consultationFee"
                type="number"
                min="0"
                placeholder="500"
                {...register("consultationFee")}
              />
              {errors.consultationFee && (
                <p className="text-sm text-red-500">{errors.consultationFee.message}</p>
              )}
            </div>

            {/* Follow-up Fee */}
            <div className="space-y-2">
              <Label htmlFor="followUpFee">Follow-up Fee (₹)</Label>
              <Input
                id="followUpFee"
                type="number"
                min="0"
                placeholder="300"
                {...register("followUpFee")}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Department Assignment</h3>
            
            {/* Primary Department */}
            <div className="space-y-2">
              <Label htmlFor="primaryDepartmentId">Primary Department *</Label>
              <Select
                value={watch("primaryDepartmentId")}
                onValueChange={(value) => setValue("primaryDepartmentId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select primary department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.code} - {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.primaryDepartmentId && (
                <p className="text-sm text-red-500">{errors.primaryDepartmentId.message}</p>
              )}
            </div>

            {/* All Departments */}
            <div className="space-y-2">
              <Label>All Departments (select all that apply)</Label>
              <div className="border rounded-lg p-3 max-h-[200px] overflow-y-auto space-y-2">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`dept-${dept.id}`}
                      checked={selectedDepartmentIds.includes(dept.id)}
                      onCheckedChange={() => toggleDepartment(dept.id)}
                      disabled={dept.id === watchedPrimaryDept}
                    />
                    <Label 
                      htmlFor={`dept-${dept.id}`} 
                      className="flex-1 cursor-pointer font-normal"
                    >
                      {dept.code} - {dept.name}
                      {dept.id === watchedPrimaryDept && (
                        <span className="ml-2 text-xs text-blue-600">(Primary)</span>
                      )}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.departmentIds && (
                <p className="text-sm text-red-500">{errors.departmentIds.message}</p>
              )}
              <p className="text-xs text-slate-500">
                Selected: {selectedDepartmentIds.length} department(s)
              </p>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Settings</h3>
            
            {/* Status */}
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(value) => setValue("status", value as "ACTIVE" | "INACTIVE" | "ON_LEAVE")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                  <SelectItem value="ON_LEAVE">On Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Schedulable */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox
                id="isSchedulable"
                checked={watch("isSchedulable")}
                onCheckedChange={(checked) => setValue("isSchedulable", !!checked)}
              />
              <div>
                <Label htmlFor="isSchedulable" className="cursor-pointer">
                  Available for Appointments
                </Label>
                <p className="text-xs text-slate-500">
                  Doctor can be booked for scheduled appointments
                </p>
              </div>
            </div>

            {/* Walk-in */}
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              <Checkbox
                id="allowWalkIn"
                checked={watch("allowWalkIn")}
                onCheckedChange={(checked) => setValue("allowWalkIn", !!checked)}
              />
              <div>
                <Label htmlFor="allowWalkIn" className="cursor-pointer">
                  Allow Walk-in Patients
                </Label>
                <p className="text-xs text-slate-500">
                  Doctor accepts walk-in OPD patients
                </p>
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 bg-slate-50 rounded-lg mt-6">
              <h4 className="font-medium text-slate-800 mb-2">Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-slate-500">Name:</span>
                <span>{watch("fullName")}</span>
                <span className="text-slate-500">Registration:</span>
                <span>{watch("registrationNumber")}</span>
                <span className="text-slate-500">Primary Dept:</span>
                <span>
                  {departments.find((d) => d.id === watch("primaryDepartmentId"))?.name || "-"}
                </span>
                <span className="text-slate-500">Total Depts:</span>
                <span>{selectedDepartmentIds.length}</span>
                <span className="text-slate-500">Consultation Fee:</span>
                <span>₹{watch("consultationFee")}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ============== RENDER ==============

  const drawerTitle = isEditing ? `Edit Doctor - ${doctor.doctorCode}` : "Add New Doctor";

  const drawerFooter = (
    <div className="flex items-center justify-between w-full">
      <Button
        type="button"
        variant="outline"
        onClick={currentStep === 1 ? onClose : handleBack}
      >
        {currentStep === 1 ? (
          <>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </>
        ) : (
          <>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </>
        )}
      </Button>

      {currentStep < STEPS.length ? (
        <Button type="button" onClick={handleNext}>
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      ) : (
        <Button type="button" onClick={handleSubmit(onSubmit)} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {isEditing ? "Update Doctor" : "Create Doctor"}
            </>
          )}
        </Button>
      )}
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={drawerTitle}
      footer={drawerFooter}
      width="w-[600px]"
    >
      {/* Description */}
      <p className="text-sm text-slate-500 mb-4">
        {isEditing 
          ? "Update doctor information and department assignments" 
          : "Create a new doctor profile with registration and department details"}
      </p>

      {/* Step Indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <React.Fragment key={step.id}>
                <div
                  className={`flex items-center gap-2 ${
                    isActive 
                      ? "text-blue-600" 
                      : isCompleted 
                        ? "text-green-600" 
                        : "text-slate-400"
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isActive 
                        ? "bg-blue-100" 
                        : isCompleted 
                          ? "bg-green-100" 
                          : "bg-slate-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-medium hidden sm:inline">
                    {step.name}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 ${
                      isCompleted ? "bg-green-300" : "bg-slate-200"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}
      
      {/* Form Content */}
      {renderStep()}
    </Drawer>
  );
}
