"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreatePurchaseOrderSchema, type CreatePurchaseOrderInput } from "@/lib/schemas/pharmacy-procurement-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2 } from "lucide-react";

interface VendorOption { id: string; code: string; name: string; }
interface ProductOption { id: string; code: string; name: string; }
interface POInitialData {
  id: string;
  vendorId: string;
  orderDate: string;
  expectedDate: string | null;
  notes: string | null;
  version: number;
  items: { productId: string; quantityOrdered: number; unitCost: string; tax: string; }[];
}

interface POFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: POInitialData | null;
}

export function POFormDrawer({ isOpen, onClose, onSuccess, initialData }: POFormDrawerProps) {
  const isEdit = !!initialData;
  const { addToast } = useToast();
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreatePurchaseOrderInput & { version?: number }>({
    resolver: zodResolver(CreatePurchaseOrderSchema) as any,
    defaultValues: {
      vendorId: "",
      orderDate: new Date().toISOString().split("T")[0],
      expectedDate: "",
      notes: "",
      items: [{ productId: "", quantityOrdered: 1, unitCost: 0, tax: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const fetchLookups = useCallback(async () => {
    try {
      const [vRes, pRes] = await Promise.all([
        fetch("/api/pharmacy/masters/vendors?limit=100&status=ACTIVE"),
        fetch("/api/pharmacy/masters/products?limit=100&status=ACTIVE"),
      ]);
      const [vData, pData] = await Promise.all([vRes.json(), pRes.json()]);
      if (vData.success) setVendors(vData.data || []);
      if (pData.success) setProducts(pData.data || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (isOpen) fetchLookups();
  }, [isOpen, fetchLookups]);

  useEffect(() => {
    if (initialData) {
      reset({
        vendorId: initialData.vendorId,
        orderDate: initialData.orderDate.split("T")[0],
        expectedDate: initialData.expectedDate?.split("T")[0] || "",
        notes: initialData.notes || "",
        items: initialData.items.map((i) => ({
          productId: i.productId,
          quantityOrdered: i.quantityOrdered,
          unitCost: parseFloat(i.unitCost),
          tax: parseFloat(i.tax),
        })),
        version: initialData.version,
      });
    } else {
      reset({
        vendorId: "",
        orderDate: new Date().toISOString().split("T")[0],
        expectedDate: "",
        notes: "",
        items: [{ productId: "", quantityOrdered: 1, unitCost: 0, tax: 0 }],
      });
    }
  }, [initialData, reset]);

  const onSubmit = async (data: CreatePurchaseOrderInput & { version?: number }) => {
    try {
      const payload = {
        ...data,
        expectedDate: data.expectedDate || undefined,
        notes: data.notes || undefined,
      };

      let url: string;
      let method: string;
      if (isEdit) {
        url = `/api/pharmacy/purchase-orders/${initialData!.id}`;
        method = "PUT";
        (payload as Record<string, unknown>).version = initialData!.version;
      } else {
        url = "/api/pharmacy/purchase-orders";
        method = "POST";
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        addToast("success", isEdit ? "PO updated" : "PO created");
        onSuccess();
      } else {
        addToast("error", result.message || "Failed");
      }
    } catch {
      addToast("error", "Network error");
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit Purchase Order" : "New Purchase Order"}>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Vendor */}
        <div>
          <Label>Vendor *</Label>
          <Select value={watch("vendorId")} onValueChange={(v) => setValue("vendorId", v)}>
            <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
            <SelectContent>
              {vendors.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.code} - {v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.vendorId && <p className="text-xs text-red-500 mt-1">{errors.vendorId.message}</p>}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Order Date *</Label>
            <Input type="date" {...register("orderDate")} />
            {errors.orderDate && <p className="text-xs text-red-500 mt-1">{errors.orderDate.message}</p>}
          </div>
          <div>
            <Label>Expected Date</Label>
            <Input type="date" {...register("expectedDate")} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <Label>Notes</Label>
          <Input {...register("notes")} placeholder="Optional notes..." />
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Line Items</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ productId: "", quantityOrdered: 1, unitCost: 0, tax: 0 })}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>

          {fields.map((field, idx) => (
            <div key={field.id} className="p-3 border rounded-lg space-y-2 bg-slate-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Item #{idx + 1}</span>
                {fields.length > 1 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)} className="h-6 w-6 p-0 text-red-500">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-xs">Product *</Label>
                <Select
                  value={watch(`items.${idx}.productId`)}
                  onValueChange={(v) => setValue(`items.${idx}.productId`, v)}
                >
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-xs">Qty *</Label>
                  <Input type="number" step="1" min="1" {...register(`items.${idx}.quantityOrdered`, { valueAsNumber: true })} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Unit Cost *</Label>
                  <Input type="number" step="0.01" min="0" {...register(`items.${idx}.unitCost`, { valueAsNumber: true })} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Tax</Label>
                  <Input type="number" step="0.01" min="0" {...register(`items.${idx}.tax`, { valueAsNumber: true })} className="h-8 text-sm" />
                </div>
              </div>
            </div>
          ))}
          {errors.items && typeof errors.items === "object" && "message" in errors.items && (
            <p className="text-xs text-red-500">{(errors.items as { message?: string }).message}</p>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving..." : isEdit ? "Update PO" : "Create PO"}</Button>
        </div>
      </form>
    </Drawer>
  );
}
