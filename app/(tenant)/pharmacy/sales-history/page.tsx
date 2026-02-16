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
  Search, RefreshCw, History, Home, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

interface SaleRecord {
  id: string;
  saleNumber: string;
  patientName: string;
  uhid: string;
  storeName: string;
  saleType: string;
  status: string;
  netAmount: string;
  creditAllowed: boolean;
  itemCount: number;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-purple-100 text-purple-700",
};

const TYPE_COLORS: Record<string, string> = {
  OP: "bg-blue-100 text-blue-700",
  IP: "bg-purple-100 text-purple-700",
  WALKIN: "bg-teal-100 text-teal-700",
};

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Sales History</span>
    </nav>
  );
}

export default function SalesHistoryPage() {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("OP");
  const [limit] = useState(20);
  const { addToast } = useToast();

  const fetchData = useCallback(async (pageCursor?: string | null) => {
    setIsLoading(true);
    try {
      const endpoint = typeFilter === "IP" ? "/api/pharmacy/ip-sales" : "/api/pharmacy/op-sales";
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (pageCursor) params.append("cursor", pageCursor);
      const res = await fetch(`${endpoint}?${params}`);
      const result = await res.json();
      if (result.success) {
        setRecords(result.data || []);
        setCursor(result.pagination?.cursor || null);
        setHasMore(result.pagination?.hasMore || false);
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
  }, [searchQuery, statusFilter, typeFilter, limit, addToast]);

  useEffect(() => { setCursorHistory([]); setCursor(null); fetchData(null); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => { setCursorHistory([]); setCursor(null); }, 300); return () => clearTimeout(t); }, [searchQuery]);

  const handleNext = () => { if (cursor) { setCursorHistory((p) => [...p, cursor]); fetchData(cursor); } };
  const handlePrev = () => { const h = [...cursorHistory]; h.pop(); setCursorHistory(h); fetchData(h[h.length - 1] || null); };

  const columns = [
    { key: "saleNumber" as keyof SaleRecord, header: "Sale #", render: (v: string) => <span className="font-medium text-blue-700">{v}</span> },
    { key: "patientName" as keyof SaleRecord, header: "Patient", render: (v: string, row: SaleRecord) => (
      <div><div className="font-medium">{v}</div><div className="text-xs text-slate-500">{row.uhid}</div></div>
    ) },
    { key: "storeName" as keyof SaleRecord, header: "Store" },
    { key: "saleType" as keyof SaleRecord, header: "Type", render: (v: string) => <Badge className={TYPE_COLORS[v] || "bg-slate-100"}>{v}</Badge> },
    { key: "itemCount" as keyof SaleRecord, header: "Items" },
    { key: "netAmount" as keyof SaleRecord, header: "Net Amount", render: (v: string) => <span className="font-medium">&#8377;{parseFloat(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span> },
    {
      key: "status" as keyof SaleRecord, header: "Status",
      render: (v: string) => <Badge className={STATUS_COLORS[v] || "bg-slate-100 text-slate-700"}>{v.replace("_", " ")}</Badge>,
    },
    { key: "createdAt" as keyof SaleRecord, header: "Date", render: (v: string) => <span className="text-sm">{format(new Date(v), "PP")}</span> },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <Breadcrumb />
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg"><History className="h-6 w-6 text-amber-600" /></div>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Sales History</h1>
            <p className="text-sm text-slate-500">View all pharmacy sales across OP and IP channels</p>
          </div>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search sale #, patient..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setCursorHistory([]); }}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OP">OP Sales</SelectItem>
                <SelectItem value="IP">IP Sales</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="RETURNED">Returned</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => fetchData(null)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No sales found" />
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </GlassCard>
      </div>
    </PageTransition>
  );
}
