"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CreateReturnSchema, type CreateReturnInput } from "@/lib/schemas/pharmacy-return-schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";
import { Trash2, AlertTriangle, Search } from "lucide-react";

interface SaleSearchResult {
  id: string;
  saleNumber: string;
  patientName: string;
  uhid: string;
  storeName: string;
  saleType: string;
  status: string;
  netAmount: string;
}

interface SaleDetailItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  unitPrice: string;
  total: string;
}

interface SaleDetail {
  id: string;
  saleNumber: string;
  patientName: string;
  uhid: string;
  storeName: string;
  saleType: string;
  status: string;
  creditAllowed: boolean;
  prescriptionId: string | null;
  items: SaleDetailItem[];
}

interface ReturnFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReturnFormDrawer({ isOpen, onClose, onSuccess }: ReturnFormDrawerProps) {
  const { addToast } = useToast();
  const [saleSearch, setSaleSearch] = useState("");
  const [saleResults, setSaleResults] = useState<SaleSearchResult[]>([]);
  const [selectedSale, setSelectedSale] = useState<SaleDetail | null>(null);
  const [loadingSale, setLoadingSale] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  const { register, handleSubmit, control, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateReturnInput>({
    resolver: zodResolver(CreateReturnSchema) as any,
    defaultValues: {
      saleId: "",
      reason: "",
      items: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const searchSales = useCallback(async (query: string) => {
    if (query.length < 2) { setSaleResults([]); return; }
    setIsSearching(true);
    try {
      // Search both OP and IP completed sales
      const params = new URLSearchParams({ search: query, limit: "20", status: "COMPLETED" });
      const res = await fetch(`/api/pharmacy/op-sales?${params}`);
      const data = await res.json();
      if (data.success) {
        setSaleResults(data.data || []);
      }
    } catch {
      // Silent
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchSales(saleSearch), 300);
    return () => clearTimeout(t);
  }, [saleSearch, searchSales]);

  const loadSaleDetails = async (saleId: string, source: "op" | "ip") => {
    setLoadingSale(true);
    try {
      const endpoint = source === "ip" ? `/api/pharmacy/ip-sales/${saleId}` : `/api/pharmacy/op-sales/${saleId}`;
      const res = await fetch(endpoint);
      const result = await res.json();
      if (result.success) {
        const sale = result.data as SaleDetail;
        setSelectedSale(sale);
        setValue("saleId", sale.id);
        setSaleResults([]);
        setSaleSearch(sale.saleNumber);

        // Pre-populate return items from sale items with qty=0
        const returnItems = sale.items.map((item) => ({
          saleItemId: item.id,
          productId: item.productId,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          quantityReturned: 0,
        }));

        // Reset items
        while (fields.length > 0) remove(0);
        returnItems.forEach((ri) => append(ri));
      } else {
        addToast("error", result.message || "Failed to load sale");
      }
    } catch {
      addToast("error", "Failed to load sale details");
    } finally {
      setLoadingSale(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      reset({ saleId: "", reason: "", items: [] });
      setSelectedSale(null);
      setSaleSearch("");
      setSaleResults([]);
    }
  }, [isOpen, reset]);

  const watchedItems = watch("items");

  // Calculate estimated total
  const estimatedTotal = selectedSale
    ? watchedItems.reduce((sum, item, idx) => {
        const saleItem = selectedSale.items[idx];
        if (!saleItem || !item.quantityReturned) return sum;
        return sum + parseFloat(saleItem.unitPrice) * item.quantityReturned;
      }, 0)
    : 0;

  const onSubmit = async (data: CreateReturnInput) => {
    // Filter out items with qty 0
    const filteredItems = data.items.filter((i) => i.quantityReturned > 0);
    if (filteredItems.length === 0) {
      addToast("error", "Please enter return quantity for at least one item");
      return;
    }

    try {
      const res = await fetch("/api/pharmacy/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, items: filteredItems }),
      });
      const result = await res.json();
      if (result.success) {
        addToast("success", "Return created successfully");
        onSuccess();
      } else {
        addToast("error", result.message || "Failed to create return");
      }
    } catch {
      addToast("error", "Network error");
    }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="New Pharmacy Return">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Sale Search */}
          <div className="space-y-2">
            <Label>Search Sale *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by sale #, patient name, UHID..."
                value={saleSearch}
                onChange={(e) => { setSaleSearch(e.target.value); setSelectedSale(null); }}
                className="pl-9"
              />
            </div>
            {isSearching && <p className="text-xs text-slate-500">Searching...</p>}
            {saleResults.length > 0 && !selectedSale && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {saleResults.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full text-left p-3 hover:bg-slate-50 border-b last:border-b-0 text-sm"
                    onClick={() => loadSaleDetails(s.id, s.saleType === "IP" ? "ip" : "op")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-blue-700">{s.saleNumber}</span>
                      <Badge className="bg-slate-100 text-slate-700 text-xs">{s.saleType}</Badge>
                    </div>
                    <div className="text-slate-600">{s.patientName} ({s.uhid})</div>
                    <div className="text-slate-500">&#8377;{parseFloat(s.netAmount).toFixed(2)} — {s.storeName}</div>
                  </button>
                ))}
              </div>
            )}
            {errors.saleId && <p className="text-xs text-red-500">{errors.saleId.message}</p>}
          </div>

          {/* Selected Sale Info */}
          {selectedSale && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{selectedSale.saleNumber}</span>
                <Badge className="bg-blue-100 text-blue-700">{selectedSale.saleType}</Badge>
              </div>
              <div>Patient: {selectedSale.patientName} ({selectedSale.uhid})</div>
              <div>Store: {selectedSale.storeName}</div>
              {selectedSale.creditAllowed && (
                <Badge className="bg-orange-100 text-orange-700">Credit Sale</Badge>
              )}
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reason for Return *</Label>
            <Input {...register("reason")} placeholder="Enter reason for return" />
            {errors.reason && <p className="text-xs text-red-500">{errors.reason.message}</p>}
          </div>

          {/* Return Items */}
          {selectedSale && fields.length > 0 && (
            <div className="space-y-3">
              <Label>Return Items</Label>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2">Product</th>
                      <th className="text-left p-2">Batch</th>
                      <th className="text-right p-2">Sold</th>
                      <th className="text-right p-2">Return Qty</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="p-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field, idx) => {
                      const saleItem = selectedSale.items[idx];
                      if (!saleItem) return null;
                      const qty = watchedItems[idx]?.quantityReturned || 0;
                      const lineAmount = parseFloat(saleItem.unitPrice) * qty;
                      return (
                        <tr key={field.id} className="border-t">
                          <td className="p-2">
                            <div className="font-medium">{saleItem.productName}</div>
                            <div className="text-xs text-slate-500">{saleItem.genericName}</div>
                          </td>
                          <td className="p-2 text-slate-600">
                            <div>{saleItem.batchNumber}</div>
                            <div className="text-xs text-slate-400">Exp: {saleItem.expiryDate ? new Date(saleItem.expiryDate).toLocaleDateString() : "-"}</div>
                          </td>
                          <td className="p-2 text-right text-slate-600">{saleItem.quantity}</td>
                          <td className="p-2 text-right">
                            <Input
                              type="number"
                              {...register(`items.${idx}.quantityReturned`, { valueAsNumber: true })}
                              min={0}
                              max={parseFloat(saleItem.quantity)}
                              className="w-20 text-right ml-auto"
                            />
                          </td>
                          <td className="p-2 text-right font-medium">
                            {qty > 0 ? `₹${lineAmount.toFixed(2)}` : "-"}
                          </td>
                          <td className="p-2">
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => remove(idx)}>
                              <Trash2 className="h-3 w-3 text-red-400" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {errors.items && <p className="text-xs text-red-500">At least one item required</p>}
            </div>
          )}

          {/* Controlled Drug Warning */}
          {selectedSale?.prescriptionId && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-800">This sale may contain controlled drugs. A compliance audit entry will be created upon return.</span>
            </div>
          )}

          {/* Estimated Total */}
          {estimatedTotal > 0 && (
            <div className="bg-slate-50 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Estimated Return Total</span>
              <span className="text-lg font-semibold text-slate-900">&#8377;{estimatedTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || !selectedSale}>
            {isSubmitting ? "Creating..." : "Create Return (Draft)"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
