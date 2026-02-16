"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateGoodsReceiptSchema, type CreateGoodsReceiptInput } from "@/lib/schemas/pharmacy-procurement-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2 } from "lucide-react";

interface StoreOption { id: string; code: string; name: string; }
interface ProductOption { id: string; code: string; name: string; }
interface POOption { id: string; poNumber: string; vendorName: string; status: string; }

interface GRNFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedPOId?: string;
}

export function GRNFormDrawer({ isOpen, onClose, onSuccess, preSelectedPOId }: GRNFormDrawerProps) {
  const { addToast } = useToast();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [approvedPOs, setApprovedPOs] = useState<POOption[]>([]);

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateGoodsReceiptInput>({
    resolver: zodResolver(CreateGoodsReceiptSchema) as any,
    defaultValues: {
      purchaseOrderId: preSelectedPOId || "",
      storeId: "",
      vendorInvoiceNumber: "",
      receivedDate: new Date().toISOString().split("T")[0],
      items: [{ productId: "", batchNumber: "", manufacturingDate: "", expiryDate: "", quantityReceived: 1, quantityRejected: 0, unitCost: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const fetchLookups = useCallback(async () => {
    try {
      const [sRes, pRes, poRes] = await Promise.all([
        fetch("/api/pharmacy/masters/stores?limit=100&status=ACTIVE"),
        fetch("/api/pharmacy/masters/products?limit=100&status=ACTIVE"),
        fetch("/api/pharmacy/purchase-orders?limit=100&status=APPROVED"),
      ]);
      const [sData, pData, poData] = await Promise.all([sRes.json(), pRes.json(), poRes.json()]);
      if (sData.success) setStores(sData.data || []);
      if (pData.success) setProducts(pData.data || []);
      if (poData.success) setApprovedPOs(poData.data?.map((po: Record<string, string>) => ({
        id: po.id, poNumber: po.poNumber, vendorName: po.vendorName, status: po.status,
      })) || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchLookups();
      reset({
        purchaseOrderId: preSelectedPOId || "",
        storeId: "",
        vendorInvoiceNumber: "",
        receivedDate: new Date().toISOString().split("T")[0],
        items: [{ productId: "", batchNumber: "", manufacturingDate: "", expiryDate: "", quantityReceived: 1, quantityRejected: 0, unitCost: 0 }],
      });
    }
  }, [isOpen, fetchLookups, reset, preSelectedPOId]);

  const onSubmit = async (data: CreateGoodsReceiptInput) => {
    try {
      const payload = {
        ...data,
        vendorInvoiceNumber: data.vendorInvoiceNumber || undefined,
        items: data.items.map((item) => ({
          ...item,
          manufacturingDate: item.manufacturingDate || undefined,
          quantityRejected: item.quantityRejected ?? 0,
        })),
      };

      const res = await fetch("/api/pharmacy/grn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        addToast("success", "Goods receipt created – inventory updated");
        onSuccess();
      } else {
        addToast("error", result.message || "Failed");
      }
    } catch {
      addToast("error", "Network error");
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Receive Goods (GRN)">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Purchase Order */}
        <div>
          <Label>Purchase Order *</Label>
          <Select value={watch("purchaseOrderId")} onValueChange={(v) => setValue("purchaseOrderId", v)}>
            <SelectTrigger><SelectValue placeholder="Select approved PO" /></SelectTrigger>
            <SelectContent>
              {approvedPOs.map((po) => (
                <SelectItem key={po.id} value={po.id}>{po.poNumber} — {po.vendorName} ({po.status})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.purchaseOrderId && <p className="text-xs text-red-500 mt-1">{errors.purchaseOrderId.message}</p>}
        </div>

        {/* Store */}
        <div>
          <Label>Receiving Store *</Label>
          <Select value={watch("storeId")} onValueChange={(v) => setValue("storeId", v)}>
            <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.storeId && <p className="text-xs text-red-500 mt-1">{errors.storeId.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Received Date *</Label>
            <Input type="date" {...register("receivedDate")} />
            {errors.receivedDate && <p className="text-xs text-red-500 mt-1">{errors.receivedDate.message}</p>}
          </div>
          <div>
            <Label>Vendor Invoice #</Label>
            <Input {...register("vendorInvoiceNumber")} placeholder="Optional" />
          </div>
        </div>

        {/* Items */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base font-medium">Items Received</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ productId: "", batchNumber: "", manufacturingDate: "", expiryDate: "", quantityReceived: 1, quantityRejected: 0, unitCost: 0 })}
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
                <Select value={watch(`items.${idx}.productId`)} onValueChange={(v) => setValue(`items.${idx}.productId`, v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.code} - {p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Batch Number *</Label>
                  <Input {...register(`items.${idx}.batchNumber`)} className="h-8 text-sm" placeholder="e.g. BATCH-001" />
                </div>
                <div>
                  <Label className="text-xs">Expiry Date *</Label>
                  <Input type="date" {...register(`items.${idx}.expiryDate`)} className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Mfg Date</Label>
                  <Input type="date" {...register(`items.${idx}.manufacturingDate`)} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Unit Cost *</Label>
                  <Input type="number" step="0.01" min="0" {...register(`items.${idx}.unitCost`, { valueAsNumber: true })} className="h-8 text-sm" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Qty Received *</Label>
                  <Input type="number" step="1" min="1" {...register(`items.${idx}.quantityReceived`, { valueAsNumber: true })} className="h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Qty Rejected</Label>
                  <Input type="number" step="1" min="0" {...register(`items.${idx}.quantityRejected`, { valueAsNumber: true })} className="h-8 text-sm" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Receiving..." : "Create GRN"}</Button>
        </div>
      </form>
    </Drawer>
  );
}
