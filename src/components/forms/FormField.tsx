"use client";

import { ReactNode } from "react";
import { FieldError } from "react-hook-form";
import { Label } from "@/components/ui/label";

interface FormFieldProps {
  label: string;
  error?: FieldError;
  helperText?: string;
  required?: boolean;
  children: ReactNode;
}

export function FormField({
  label,
  error,
  helperText,
  required = false,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>
      {children}
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error.message}
        </p>
      )}
      {helperText && !error && (
        <p className="text-sm text-gray-500">{helperText}</p>
      )}
    </div>
  );
}