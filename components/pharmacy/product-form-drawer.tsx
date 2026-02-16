"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProductCreateSchema, type ProductCreateInput } from "@/lib/schemas/pharmacy-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Checkbox } from "@/components/ui/checkbox";

interface ManufacturerOption { id: string; code: string; name: string; }

interface ProductFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: {
    id: string;
    code: string;
    name: string;
    genericName: string;
    brandName: string | null;
    strength?: string | null;
    dosageForm?: string | null;
    scheduleType: string;
    manufacturerId?: string;
    manufacturer?: { name: string; id?: string };
    hsnCode?: string | null;
    gstPercent?: number | null;
    mrp: number | null;
    purchasePrice: number | null;
    minimumStock?: number;
    reorderLevel?: number;
    storageCondition?: string | null;
    isNarcotic?: boolean;
    status: "ACTIVE" | "INACTIVE";
  } | null;
}

export function ProductFormDrawer({ isOpen, onClose, onSuccess, initialData }: ProductFormDrawerProps) {
  const isEdit = !!initialData;
  const { addToast } = useToast();
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<ProductCreateInput>({
    resolver: zodResolver(ProductCreateSchema) as any,
    defaultValues: {
      code: "", name: "", genericName: "", brandName: "", strength: "", dosageForm: "",
      scheduleType: "OTC", manufacturerId: "", hsnCode: "",
      gstPercent: undefined, mrp: undefined, purchasePrice: undefined,
      minimumStock: 0, reorderLevel: 0, storageCondition: "", isNarcotic: false, status: "ACTIVE",
    },
  });

  // Load manufacturers for dropdown
  const fetchManufacturers = useCallback(async () => {
    try {
      const res = await fetch("/api/pharmacy/masters/manufacturers?limit=100&status=ACTIVE");
      const result = await res.json();
      if (result.success) setManufacturers(result.data || []);
    } catch { /* fallback empty */ }
  }, []);

  useEffect(() => {
    if (isOpen) fetchManufacturers();
  }, [isOpen, fetchManufacturers]);

  useEffect(() => {
    if (initialData) {
      reset({
        code: initialData.code, name: initialData.name,
        genericName: initialData.genericName || "", brandName: initialData.brandName || "",
        strength: initialData.strength || "", dosageForm: initialData.dosageForm || "",
        scheduleType: initialData.scheduleType as ProductCreateInput["scheduleType"],
        manufacturerId: initialData.manufacturerId || initialData.manufacturer?.id || "",
        hsnCode: initialData.hsnCode || "",
        gstPercent: initialData.gstPercent ?? undefined,
        mrp: initialData.mrp ? Number(initialData.mrp) : undefined,
        purchasePrice: initialData.purchasePrice ? Number(initialData.purchasePrice) : undefined,
        minimumStock: initialData.minimumStock || 0,
        reorderLevel: initialData.reorderLevel || 0,
        storageCondition: initialData.storageCondition || "",
        isNarcotic: initialData.isNarcotic || false,
        status: initialData.status,
      });
    } else {
      reset({
        code: "", name: "", genericName: "", brandName: "", strength: "", dosageForm: "",
        scheduleType: "OTC", manufacturerId: "", hsnCode: "",
        gstPercent: undefined, mrp: undefined, purchasePrice: undefined,
        minimumStock: 0, reorderLevel: 0, storageCondition: "", isNarcotic: false, status: "ACTIVE",
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: ProductCreateInput) => {
    try {
      const url = isEdit ? `/api/pharmacy/masters/products?id=${initialData!.id}` : "/api/pharmacy/masters/products";
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
    <Drawer isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Product" : "Add Product"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Code *</Label><Input {...register("code")} disabled={isEdit} />{errors.code && <p className="text-xs text-red-500 mt-1">{errors.code.message}</p>}</div>
            <div><Label>Name *</Label><Input {...register("name")} />{errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}</div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Generic Name</Label><Input {...register("genericName")} /></div>
            <div><Label>Brand Name</Label><Input {...register("brandName")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><Label>Strength</Label><Input {...register("strength")} placeholder="e.g. 500mg" /></div>
            <div><Label>Dosage Form</Label><Input {...register("dosageForm")} placeholder="e.g. Tablet" /></div>
          </div>

          {/* Schedule & Manufacturer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Schedule *</Label>
              <Select value={watch("scheduleType")} onValueChange={(v) => setValue("scheduleType", v as ProductCreateInput["scheduleType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OTC">OTC</SelectItem>
                  <SelectItem value="H">Schedule H</SelectItem>
                  <SelectItem value="H1">Schedule H1</SelectItem>
                  <SelectItem value="X">Schedule X</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Manufacturer *</Label>
              <Select value={watch("manufacturerId")} onValueChange={(v) => setValue("manufacturerId", v)}>
                <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {manufacturers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.manufacturerId && <p className="text-xs text-red-500 mt-1">{errors.manufacturerId.message}</p>}
            </div>
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-4">
            <div><Label>MRP (₹)</Label><Input type="number" step="0.01" {...register("mrp", { valueAsNumber: true })} /></div>
            <div><Label>Purchase Price (₹)</Label><Input type="number" step="0.01" {...register("purchasePrice", { valueAsNumber: true })} /></div>
            <div><Label>GST %</Label><Input type="number" step="0.01" {...register("gstPercent", { valueAsNumber: true })} /></div>
          </div>

          {/* Stock Levels */}
          <div className="grid grid-cols-3 gap-4">
            <div><Label>HSN Code</Label><Input {...register("hsnCode")} /></div>
            <div><Label>Min Stock</Label><Input type="number" {...register("minimumStock", { valueAsNumber: true })} /></div>
            <div><Label>Reorder Level</Label><Input type="number" {...register("reorderLevel", { valueAsNumber: true })} /></div>
          </div>

          <div><Label>Storage Condition</Label><Input {...register("storageCondition")} placeholder="e.g. Cool & Dry Place" /></div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="isNarcotic" checked={watch("isNarcotic")} onCheckedChange={(v) => setValue("isNarcotic", !!v)} />
              <Label htmlFor="isNarcotic">Narcotic Drug</Label>
            </div>
            <div>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "ACTIVE" | "INACTIVE")}>
                <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : isEdit ? "Update" : "Create"}</Button>
          </div>
        </form>
    </Drawer>
  );
}
