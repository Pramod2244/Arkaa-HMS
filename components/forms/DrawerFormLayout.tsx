"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface DrawerFormLayoutProps {
  title: string;
  children: React.ReactNode;
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  disabled?: boolean;
}

export function DrawerFormLayout({
  title,
  children,
  onSave,
  onCancel,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  loading = false,
  disabled = false
}: DrawerFormLayoutProps) {
  return (
    <div className="space-y-6">
      {/* Form Title */}
      <div>
        <h3 className="text-lg font-medium text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600 mt-1">
          Fill in the details below to {saveLabel.toLowerCase()} the record.
        </p>
      </div>

      {/* Form Content */}
      <div className="space-y-6">
        {children}
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3 pt-6 border-t border-slate-200">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={loading}
        >
          {cancelLabel}
        </Button>
        <Button
          type="button"
          onClick={onSave}
          disabled={disabled || loading}
          className="min-w-[100px]"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            saveLabel
          )}
        </Button>
      </div>
    </div>
  );
}