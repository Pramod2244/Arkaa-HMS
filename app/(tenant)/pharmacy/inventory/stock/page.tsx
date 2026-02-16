"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/DataTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { useToast } from "@/components/ui/Toast";
import {
  RefreshCw, ClipboardList, Home, ChevronRight as ChevronRightIcon,
} from "lucide-react";
import { format } from "date-fns";

interface StockRecord {
  id: string;
  storeId: string;
  storeName: string;
  productId: string;
  productCode: string;
  productName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string | null;
  availableQty: number;
  mrp: number | null;
  purchasePrice: number | null;
}

interface StoreOption { id: string; name: string; }

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Stock</span>
    </nav>
  );
}

export default function StockPage() {
  const [records, setRecords] = useState<StockRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStore, setSelectedStore] = useState("ALL");
  const { addToast } = useToast();

  const fetchStores = useCallback(async () => {
    try {
      const res = await fetch("/api/pharmacy/masters/stores?limit=100&status=ACTIVE");
      const result = await res.json();
      if (result.success) setStores(result.data || []);
    } catch { /* fallback */ }
  }, []);

  const fetchStock = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedStore !== "ALL") params.append("storeId", selectedStore);
      const res = await fetch(`/api/pharmacy/inventory/stock?${params}`);
      const result = await res.json();
      if (result.success) {
        const data = (result.data || []).map((r: Omit<StockRecord, 'id'>, i: number) => ({ ...r, id: `${r.storeId}-${r.productId}-${r.batchNumber}-${i}` }));
        setRecords(data);
      }
      else { setRecords([]); addToast("error", result.message || "Failed to load stock"); }
    } catch { setRecords([]); addToast("error", "Network error"); }
    finally { setIsLoading(false); }
  }, [selectedStore, addToast]);

  useEffect(() => { fetchStores(); }, [fetchStores]);
  useEffect(() => { fetchStock(); }, [fetchStock]);

  const columns = [
    { key: "productCode" as keyof StockRecord, header: "Product Code" },
    { key: "productName" as keyof StockRecord, header: "Product" },
    { key: "genericName" as keyof StockRecord, header: "Generic", render: (v: string) => <span className="text-slate-500">{v || "-"}</span> },
    { key: "storeName" as keyof StockRecord, header: "Store" },
    { key: "batchNumber" as keyof StockRecord, header: "Batch" },
    {
      key: "expiryDate" as keyof StockRecord, header: "Expiry",
      render: (v: string | null) => {
        if (!v) return <span className="text-slate-400">-</span>;
        const d = new Date(v);
        const isExpired = d < new Date();
        const isNear = d < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
        return (
          <span className={isExpired ? "text-red-600 font-medium" : isNear ? "text-orange-600" : "text-slate-600"}>
            {format(d, "PP")}
          </span>
        );
      },
    },
    {
      key: "availableQty" as keyof StockRecord, header: "Available Qty",
      render: (v: number) => (
        <Badge className={v <= 0 ? "bg-red-100 text-red-800" : v < 10 ? "bg-orange-100 text-orange-800" : "bg-green-100 text-green-800"}>
          {v}
        </Badge>
      ),
    },
    {
      key: "mrp" as keyof StockRecord, header: "MRP",
      render: (v: number | null) => <span className="text-slate-700">{v ? `₹${Number(v).toFixed(2)}` : "-"}</span>,
    },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <Breadcrumb />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><ClipboardList className="h-6 w-6 text-blue-600" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Inventory Stock</h1>
              <p className="text-sm text-slate-500">Real-time stock levels across stores</p>
            </div>
          </div>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <Select value={selectedStore} onValueChange={setSelectedStore}>
              <SelectTrigger className="w-[250px]"><SelectValue placeholder="All Stores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Stores</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={fetchStock} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
            <span className="text-sm text-slate-500 ml-auto">{records.length} records</span>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No stock records found" />
        </GlassCard>
      </div>
    </PageTransition>
  );
}
