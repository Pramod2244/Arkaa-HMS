"use client";

/**
 * HMS Medical Masters - Department Form Drawer
 * 
 * Right-side drawer for editing departments (RESTRICTED).
 * 
 * IMPORTANT: Departments are SYSTEM MASTERS (predefined).
 * - Code and Name are READ-ONLY (cannot be changed)
 * - Only description and status can be edited
 * - No create mode - departments are seeded automatically
 */

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Drawer } from "@/components/ui/Drawer";
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
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Info, Loader2, Lock } from "lucide-react";
import { format } from "date-fns";

// ============== TYPES ==============

export interface DepartmentFormData {
  id?: string;
  code?: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  version?: number;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string | null;
  updatedBy?: string | null;
  usage?: {
    isUsed: boolean;
    usageCount: number;
    usedIn: { entity: string; count: number }[];
  };
}

interface DepartmentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DepartmentFormData) => Promise<void>;
  initialData?: DepartmentFormData | null;
  isLoading?: boolean;
}

// ============== VALIDATION SCHEMA ==============
// Only description and status are editable

const departmentFormSchema = z.object({
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .nullable()
    .optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

type FormValues = z.infer<typeof departmentFormSchema>;

// ============== COMPONENT ==============

export function DepartmentDrawer({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: DepartmentDrawerProps) {
  // Departments can only be edited (not created)
  const isEditing = !!initialData?.id;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: {
      description: "",
      status: "ACTIVE",
    },
  });

  const currentStatus = watch("status");

  // Reset form when drawer opens/closes or initial data changes
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        reset({
          description: initialData.description ?? "",
          status: initialData.status,
        });
      } else {
        reset({
          description: "",
          status: "ACTIVE",
        });
      }
    }
  }, [isOpen, initialData, reset]);

  const handleFormSubmit = async (data: FormValues) => {
    // Cannot edit without initial data (departments can't be created)
    if (!initialData?.id) {
      return;
    }

    const formData: DepartmentFormData = {
      id: initialData.id,
      name: initialData.name, // Keep original name (read-only)
      description: data.description || null,
      status: data.status,
      version: initialData.version,
    };

    await onSubmit(formData);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  // ============== RENDER ==============

  const footer = (
    <div className="flex justify-end gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={handleClose}
        disabled={isSubmitting || isLoading}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="department-form"
        disabled={isSubmitting || isLoading || !isEditing}
        className="bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {isSubmitting || isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Updating...
          </>
        ) : (
          <>Update Department</>
        )}
      </Button>
    </div>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title="Edit Department"
      footer={footer}
      width="w-[480px]"
    >
      <form
        id="department-form"
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-6"
      >
        {/* System Department Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-800">
            <p className="font-medium">System Department</p>
            <p className="mt-1 text-amber-700">
              Code and Name are read-only. You can only modify description and status.
            </p>
          </div>
        </div>

        {/* Read-only Code field */}
        {initialData?.code && (
          <div className="space-y-2">
            <Label className="text-slate-700 flex items-center gap-2">
              Code
              <Lock className="h-3 w-3 text-slate-400" />
            </Label>
            <div className="flex items-center gap-2">
              <Input
                value={initialData.code}
                disabled
                className="bg-slate-100 text-slate-600 font-mono cursor-not-allowed"
              />
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                Read-only
              </Badge>
            </div>
          </div>
        )}

        {/* Read-only Name field */}
        {initialData?.name && (
          <div className="space-y-2">
            <Label className="text-slate-700 flex items-center gap-2">
              Name
              <Lock className="h-3 w-3 text-slate-400" />
            </Label>
            <Input
              value={initialData.name}
              disabled
              className="bg-slate-100 text-slate-600 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500">
              Name is a system-defined value and cannot be changed
            </p>
          </div>
        )}

        {/* Description field - EDITABLE */}
        <div className="space-y-2">
          <Label htmlFor="description" className="text-slate-700">
            Description
          </Label>
          <Textarea
            id="description"
            {...register("description")}
            placeholder="Enter department description"
            rows={3}
            className={errors.description ? "border-red-500" : ""}
          />
          {errors.description && (
            <p className="text-sm text-red-500 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Status field - EDITABLE */}
        <div className="space-y-2">
          <Label htmlFor="status" className="text-slate-700">
            Status <span className="text-red-500">*</span>
          </Label>
          <Select
            value={currentStatus}
            onValueChange={(value: "ACTIVE" | "INACTIVE") =>
              setValue("status", value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ACTIVE">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  Active
                </div>
              </SelectItem>
              <SelectItem value="INACTIVE">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Inactive
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            Set to Active to enable this department for use in appointments and visits
          </p>
        </div>

        {/* Usage info */}
        {initialData?.usage && initialData.usage.isUsed && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-blue-800">
                  Department Usage
                </h4>
                <p className="text-xs text-blue-700 mt-1">
                  This department is currently used in:
                </p>
                <ul className="text-xs text-blue-700 mt-1 list-disc list-inside">
                  {initialData.usage.usedIn.map((usage) => (
                    <li key={usage.entity}>
                      {usage.count} {usage.entity}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Audit info */}
        {isEditing && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
            <h4 className="text-sm font-medium text-slate-700">
              Audit Information
            </h4>
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-600">
              {initialData?.createdAt && (
                <div>
                  <span className="text-slate-500">Created:</span>{" "}
                  {format(new Date(initialData.createdAt), "PPp")}
                </div>
              )}
              {initialData?.updatedAt && (
                <div>
                  <span className="text-slate-500">Updated:</span>{" "}
                  {format(new Date(initialData.updatedAt), "PPp")}
                </div>
              )}
              {initialData?.version && (
                <div>
                  <span className="text-slate-500">Version:</span>{" "}
                  {initialData.version}
                </div>
              )}
            </div>
          </div>
        )}
      </form>
    </Drawer>
  );
}

export default DepartmentDrawer;
