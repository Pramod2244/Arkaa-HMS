"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ManufacturerCreateSchema, type ManufacturerCreateInput } from "@/lib/schemas/pharmacy-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";

interface ManufacturerFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    code: string;
    name: string;
    licenseNumber: string | null;
    contactNumber: string | null;
    address: string | null;
    status: "ACTIVE" | "INACTIVE";
  } | null;
}

export function ManufacturerFormDrawer({ isOpen, onClose, onSuccess, initialData }: ManufacturerFormDrawerProps) {
  const isEdit = !!initialData;
  const { addToast } = useToast();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ManufacturerCreateInput>({
    resolver: zodResolver(ManufacturerCreateSchema) as any,
    defaultValues: { code: "", name: "", licenseNumber: "", contactNumber: "", address: "", status: "ACTIVE" },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        licenseNumber: initialData.licenseNumber || "",
        contactNumber: initialData.contactNumber || "",
        address: initialData.address || "",
        status: initialData.status,
      });
    } else {
      reset({ code: "", name: "", licenseNumber: "", contactNumber: "", address: "", status: "ACTIVE" });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: ManufacturerCreateInput) => {
    try {
      const url = isEdit ? `/api/pharmacy/masters/manufacturers?id=${initialData!.id}` : "/api/pharmacy/masters/manufacturers";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        addToast("success", isEdit ? "Updated" : "Created");
        onSuccess();
      } else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Manufacturer" : "Add Manufacturer"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Code *</Label>
              <Input id="code" {...register("code")} disabled={isEdit} />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register("name")} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input id="licenseNumber" {...register("licenseNumber")} />
            </div>
            <div>
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input id="contactNumber" {...register("contactNumber")} />
            </div>
          </div>
          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={watch("status")} onValueChange={(val) => setValue("status", val as "ACTIVE" | "INACTIVE")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
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
