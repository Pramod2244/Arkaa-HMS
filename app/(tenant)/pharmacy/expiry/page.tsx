"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/DataTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { useToast } from "@/components/ui/Toast";
import {
  Search, RefreshCw, AlertTriangle, Home, ChevronRight,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";

interface ExpiryRecord {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  quantityReceived: number;
  quantityRejected: number;
  grnNumber: string;
  storeName: string;
  daysToExpiry: number;
}

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Expiry Dashboard</span>
    </nav>
  );
}

function getExpiryBadge(daysToExpiry: number) {
  if (daysToExpiry <= 0) return <Badge className="bg-red-100 text-red-800">Expired</Badge>;
  if (daysToExpiry <= 30) return <Badge className="bg-red-100 text-red-700">≤ 30 days</Badge>;
  if (daysToExpiry <= 90) return <Badge className="bg-amber-100 text-amber-800">≤ 90 days</Badge>;
  if (daysToExpiry <= 180) return <Badge className="bg-yellow-100 text-yellow-800">≤ 180 days</Badge>;
  return <Badge className="bg-green-100 text-green-800">OK</Badge>;
}

export default function ExpiryDashboardPage() {
  const [records, setRecords] = useState<ExpiryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [rangeFilter, setRangeFilter] = useState("90"); // days
  const [summaryStats, setSummaryStats] = useState({ expired: 0, within30: 0, within90: 0, within180: 0 });
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ days: rangeFilter, limit: "200" });
      if (searchQuery) params.append("search", searchQuery);
      const res = await fetch(`/api/pharmacy/expiry?${params}`);
      const result = await res.json();
      if (result.success) {
        const items: ExpiryRecord[] = (result.data || []).map((item: ExpiryRecord) => ({
          ...item,
          daysToExpiry: differenceInDays(new Date(item.expiryDate), new Date()),
        }));
        setRecords(items);
        // Compute summary
        const expired = items.filter((i) => i.daysToExpiry <= 0).length;
        const within30 = items.filter((i) => i.daysToExpiry > 0 && i.daysToExpiry <= 30).length;
        const within90 = items.filter((i) => i.daysToExpiry > 30 && i.daysToExpiry <= 90).length;
        const within180 = items.filter((i) => i.daysToExpiry > 90 && i.daysToExpiry <= 180).length;
        setSummaryStats({ expired, within30, within90, within180 });
      } else {
        setRecords([]);
        addToast("error", result.message || "Failed to load");
      }
    } catch {
      setRecords([]);
      addToast("error", "Network error");
    } finally {
      setIsLoading(false);
    }
  }, [rangeFilter, searchQuery, addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    { key: "productCode" as keyof ExpiryRecord, header: "Product Code", render: (v: string) => <span className="font-medium">{v}</span> },
    { key: "productName" as keyof ExpiryRecord, header: "Product" },
    { key: "batchNumber" as keyof ExpiryRecord, header: "Batch" },
    { key: "storeName" as keyof ExpiryRecord, header: "Store" },
    { key: "expiryDate" as keyof ExpiryRecord, header: "Expiry", render: (v: string) => <span className="text-sm">{format(new Date(v), "PP")}</span> },
    {
      key: "daysToExpiry" as keyof ExpiryRecord, header: "Status",
      render: (v: number) => getExpiryBadge(v),
    },
    {
      key: "quantityReceived" as keyof ExpiryRecord, header: "Qty Received",
      render: (v: number, row: ExpiryRecord) => <span className="text-sm">{v - row.quantityRejected} ({v} recv / {row.quantityRejected} rej)</span>,
    },
    { key: "grnNumber" as keyof ExpiryRecord, header: "GRN #", render: (v: string) => <span className="text-sm text-slate-500">{v}</span> },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <Breadcrumb />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="h-6 w-6 text-amber-600" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Expiry Dashboard</h1>
            <p className="text-sm text-slate-500">Monitor batch expiry dates across all received goods</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-red-600">{summaryStats.expired}</p>
            <p className="text-sm text-slate-500 mt-1">Expired</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-red-500">{summaryStats.within30}</p>
            <p className="text-sm text-slate-500 mt-1">Expiring ≤ 30 days</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-amber-600">{summaryStats.within90}</p>
            <p className="text-sm text-slate-500 mt-1">Expiring 31-90 days</p>
          </GlassCard>
          <GlassCard className="p-4 text-center">
            <p className="text-3xl font-bold text-yellow-600">{summaryStats.within180}</p>
            <p className="text-sm text-slate-500 mt-1">Expiring 91-180 days</p>
          </GlassCard>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search product, batch..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={rangeFilter} onValueChange={setRangeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="Expiry range" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="30">Within 30 days</SelectItem>
                <SelectItem value="90">Within 90 days</SelectItem>
                <SelectItem value="180">Within 180 days</SelectItem>
                <SelectItem value="365">Within 1 year</SelectItem>
                <SelectItem value="expired">Expired only</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => fetchData()} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No expiring items found" />
        </GlassCard>
      </div>
    </PageTransition>
  );
}
