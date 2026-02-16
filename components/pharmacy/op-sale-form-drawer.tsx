"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateOPSaleSchema, type CreateOPSaleInput } from "@/lib/schemas/pharmacy-dispensing-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Plus, Trash2 } from "lucide-react";

interface PatientOption { id: string; uhid: string; firstName: string; lastName: string; }
interface StoreOption { id: string; code: string; name: string; }
interface ProductOption { id: string; code: string; name: string; mrp: string; }

interface OPSaleFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function OPSaleFormDrawer({ isOpen, onClose, onSuccess }: OPSaleFormDrawerProps) {
  const { addToast } = useToast();
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [patientSearch, setPatientSearch] = useState("");

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateOPSaleInput>({
    resolver: zodResolver(CreateOPSaleSchema) as any,
    defaultValues: {
      patientId: "",
      storeId: "",
      visitId: "",
      prescriptionId: "",
      creditAllowed: false,
      notes: "",
      items: [{ productId: "", quantity: 1, discount: 0 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  const fetchLookups = useCallback(async () => {
    try {
      const [sRes, pRes] = await Promise.all([
        fetch("/api/pharmacy/masters/stores?limit=100&status=ACTIVE"),
        fetch("/api/pharmacy/masters/products?limit=100&status=ACTIVE"),
      ]);
      const [sData, pData] = await Promise.all([sRes.json(), pRes.json()]);
      if (sData.success) setStores(sData.data || []);
      if (pData.success) setProducts(pData.data || []);
    } catch {
      addToast("error", "Failed to load lookups");
    }
  }, [addToast]);

  const searchPatients = useCallback(async (query: string) => {
    if (query.length < 2) return;
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&limit=20`);
      const data = await res.json();
      if (data.success) setPatients(data.data?.patients || []);
    } catch {
      // Silent
    }
  }, []);

  useEffect(() => { if (isOpen) fetchLookups(); }, [isOpen, fetchLookups]);
  useEffect(() => { const t = setTimeout(() => searchPatients(patientSearch), 300); return () => clearTimeout(t); }, [patientSearch, searchPatients]);

  useEffect(() => {
    if (isOpen) {
      reset({
        patientId: "",
        storeId: "",
        visitId: "",
        prescriptionId: "",
        creditAllowed: false,
        notes: "",
        items: [{ productId: "", quantity: 1, discount: 0 }],
      });
      setPatientSearch("");
    }
  }, [isOpen, reset]);

  const calculateTotal = () => {
    let total = 0;
    for (const item of watchedItems || []) {
      const product = products.find((p) => p.id === item.productId);
      if (product) {
        total += parseFloat(product.mrp) * (item.quantity || 0) - (item.discount || 0) * (item.quantity || 0);
      }
    }
    return total;
  };

  const onSubmit = async (data: CreateOPSaleInput) => {
    try {
      const res = await fetch("/api/pharmacy/op-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (result.success) {
        addToast("success", result.message || "OP sale created");
        onSuccess();
      } else {
        addToast("error", result.message || "Failed to create sale");
      }
    } catch {
      addToast("error", "Network error");
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="New OP Pharmacy Sale">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Patient search */}
        <div>
          <Label>Patient *</Label>
          <Input
            placeholder="Type to search patients (name / UHID)..."
            value={patientSearch}
            onChange={(e) => setPatientSearch(e.target.value)}
            className="mb-2"
          />
          {patients.length > 0 && (
            <div className="border rounded-md max-h-32 overflow-auto">
              {patients.map((p) => (
                <div
                  key={p.id}
                  className={`px-3 py-2 cursor-pointer hover:bg-blue-50 text-sm ${watch("patientId") === p.id ? "bg-blue-100" : ""}`}
                  onClick={() => { setValue("patientId", p.id); setPatientSearch(`${p.firstName}${p.lastName ? " " + p.lastName : ""} (${p.uhid})`); setPatients([]); }}
                >
                  {p.firstName}{p.lastName ? " " + p.lastName : ""} — <span className="text-slate-500">{p.uhid}</span>
                </div>
              ))}
            </div>
          )}
          {errors.patientId && <p className="text-sm text-red-500 mt-1">{errors.patientId.message}</p>}
        </div>

        {/* Store */}
        <div>
          <Label>Store *</Label>
          <Select value={watch("storeId")} onValueChange={(v) => setValue("storeId", v)}>
            <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.storeId && <p className="text-sm text-red-500 mt-1">{errors.storeId.message}</p>}
        </div>

        {/* Prescription ID (optional) */}
        <div>
          <Label>Prescription ID (optional)</Label>
          <Input {...register("prescriptionId")} placeholder="Enter prescription ID if dispensing against Rx" />
        </div>

        {/* Credit allowed */}
        <div className="flex items-center gap-2">
          <input type="checkbox" id="creditAllowed" {...register("creditAllowed")} className="rounded" />
          <Label htmlFor="creditAllowed">Allow credit (patient pays later)</Label>
        </div>

        {/* Items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="font-semibold">Items</Label>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: "", quantity: 1, discount: 0 })}>
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </Button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => {
              const selectedProduct = products.find((p) => p.id === watchedItems?.[index]?.productId);
              return (
                <div key={field.id} className="border rounded-lg p-3 space-y-2 bg-slate-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Item {index + 1}</span>
                    {fields.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    )}
                  </div>

                  <div>
                    <Label>Product *</Label>
                    <Select value={watchedItems?.[index]?.productId || ""} onValueChange={(v) => setValue(`items.${index}.productId`, v)}>
                      <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name} ({p.code}) — ₹{p.mrp}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label>Qty *</Label>
                      <Input type="number" min="1" {...register(`items.${index}.quantity`, { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label>Discount/unit</Label>
                      <Input type="number" min="0" step="0.01" {...register(`items.${index}.discount`, { valueAsNumber: true })} />
                    </div>
                    <div>
                      <Label>MRP</Label>
                      <Input disabled value={selectedProduct ? `₹${selectedProduct.mrp}` : "-"} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {errors.items && <p className="text-sm text-red-500 mt-1">{typeof errors.items.message === "string" ? errors.items.message : "Item errors"}</p>}
        </div>

        {/* Total */}
        <div className="bg-blue-50 rounded-lg p-4 flex items-center justify-between">
          <span className="font-medium text-slate-700">Estimated Total</span>
          <span className="text-xl font-bold text-blue-700">&#8377;{calculateTotal().toFixed(2)}</span>
        </div>

        {/* Notes */}
        <div>
          <Label>Notes (optional)</Label>
          <Input {...register("notes")} placeholder="Any notes..." />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-4">
          <Button type="submit" className="flex-1" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Sale"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Drawer>
  );
}
