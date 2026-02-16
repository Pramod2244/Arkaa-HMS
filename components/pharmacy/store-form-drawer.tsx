"use client";

import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { StoreCreateSchema, type StoreCreateInput } from "@/lib/schemas/pharmacy-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";

interface StoreFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    code: string;
    name: string;
    type: "CENTRAL" | "OP" | "IP" | "SUB";
    licenseNumber: string | null;
    gstNumber: string | null;
    address?: string | null;
    managerName: string | null;
    contactNumber: string | null;
    status: "ACTIVE" | "INACTIVE";
  } | null;
}

export function StoreFormDrawer({ isOpen, onClose, onSuccess, initialData }: StoreFormDrawerProps) {
  const isEdit = !!initialData;
  const { addToast } = useToast();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StoreCreateInput>({
    resolver: zodResolver(StoreCreateSchema) as any,
    defaultValues: {
      code: "",
      name: "",
      type: "CENTRAL",
      licenseNumber: "",
      gstNumber: "",
      address: "",
      managerName: "",
      contactNumber: "",
      status: "ACTIVE",
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code,
        name: initialData.name,
        type: initialData.type,
        licenseNumber: initialData.licenseNumber || "",
        gstNumber: initialData.gstNumber || "",
        address: initialData.address || "",
        managerName: initialData.managerName || "",
        contactNumber: initialData.contactNumber || "",
        status: initialData.status,
      });
    } else {
      reset({
        code: "",
        name: "",
        type: "CENTRAL",
        licenseNumber: "",
        gstNumber: "",
        address: "",
        managerName: "",
        contactNumber: "",
        status: "ACTIVE",
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: StoreCreateInput) => {
    try {
      const url = isEdit
        ? `/api/pharmacy/masters/stores?id=${initialData!.id}`
        : "/api/pharmacy/masters/stores";

      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        addToast("success", isEdit ? "Store updated" : "Store created");
        onSuccess();
      } else {
        addToast("error", result.message || "Operation failed");
      }
    } catch {
      addToast("error", "Network error");
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Store" : "Add Store"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Code *</Label>
              <Input id="code" {...register("code")} disabled={isEdit} placeholder="e.g. STR001" />
              {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register("name")} placeholder="Store name" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type *</Label>
              <Select
                value={watch("type")}
                onValueChange={(val) => setValue("type", val as StoreCreateInput["type"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CENTRAL">Central</SelectItem>
                  <SelectItem value="OP">Out-Patient</SelectItem>
                  <SelectItem value="IP">In-Patient</SelectItem>
                  <SelectItem value="SUB">Sub Store</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={watch("status")}
                onValueChange={(val) => setValue("status", val as "ACTIVE" | "INACTIVE")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="INACTIVE">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="licenseNumber">License Number</Label>
              <Input id="licenseNumber" {...register("licenseNumber")} />
            </div>
            <div>
              <Label htmlFor="gstNumber">GST Number</Label>
              <Input id="gstNumber" {...register("gstNumber")} />
            </div>
          </div>

          <div>
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="managerName">Manager Name</Label>
              <Input id="managerName" {...register("managerName")} />
            </div>
            <div>
              <Label htmlFor="contactNumber">Contact Number</Label>
              <Input id="contactNumber" {...register("contactNumber")} />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}
            </Button>
          </div>
        </form>
    </Drawer>
  );
}
