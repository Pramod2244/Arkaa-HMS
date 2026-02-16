"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { VendorCreateSchema, type VendorCreateInput } from "@/lib/schemas/pharmacy-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";

interface VendorFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    code: string;
    name: string;
    gstNumber: string | null;
    contactPerson: string | null;
    contactNumber: string | null;
    email: string | null;
    status: "ACTIVE" | "INACTIVE";
  } | null;
}

export function VendorFormDrawer({ isOpen, onClose, onSuccess, initialData }: VendorFormDrawerProps) {
  const isEdit = !!initialData;
  const { addToast } = useToast();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<VendorCreateInput>({
    resolver: zodResolver(VendorCreateSchema) as any,
    defaultValues: { code: "", name: "", gstNumber: "", contactPerson: "", contactNumber: "", email: "", status: "ACTIVE" },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code, name: initialData.name, gstNumber: initialData.gstNumber || "",
        contactPerson: initialData.contactPerson || "", contactNumber: initialData.contactNumber || "",
        email: initialData.email || "", status: initialData.status,
      });
    } else {
      reset({ code: "", name: "", gstNumber: "", contactPerson: "", contactNumber: "", email: "", status: "ACTIVE" });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: VendorCreateInput) => {
    try {
      const url = isEdit ? `/api/pharmacy/masters/vendors?id=${initialData!.id}` : "/api/pharmacy/masters/vendors";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) { addToast("success", isEdit ? "Updated" : "Created"); onSuccess(); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Vendor" : "Add Vendor"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Code *</Label><Input {...register("code")} disabled={isEdit} />{errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}</div>
            <div><Label>Name *</Label><Input {...register("name")} />{errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>GST Number</Label><Input {...register("gstNumber")} /></div>
            <div><Label>Email</Label><Input type="email" {...register("email")} />{errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Contact Person</Label><Input {...register("contactPerson")} /></div>
            <div><Label>Contact Number</Label><Input {...register("contactNumber")} /></div>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "ACTIVE" | "INACTIVE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}</Button>
          </div>
        </form>
    </Drawer>
  );
}
