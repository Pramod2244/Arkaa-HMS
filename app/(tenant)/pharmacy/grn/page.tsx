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
  Search, RefreshCw, Plus,
  FileInput, Home, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { GRNFormDrawer } from "@/components/pharmacy/grn-form-drawer";

interface GRNRecord {
  id: string;
  grnNumber: string;
  purchaseOrderId: string;
  poNumber: string;
  storeId: string;
  storeName: string;
  vendorInvoiceNumber: string | null;
  receivedDate: string;
  status: string;
  itemCount: number;
  totalQuantity: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: "bg-green-100 text-green-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-700",
};

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Goods Receipt</span>
    </nav>
  );
}

export default function GoodsReceiptPage() {
  const [records, setRecords] = useState<GRNRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [limit] = useState(20);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { addToast } = useToast();

  const fetchData = useCallback(async (pageCursor?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (pageCursor) params.append("cursor", pageCursor);
      const res = await fetch(`/api/pharmacy/grn?${params}`);
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
  }, [searchQuery, statusFilter, limit, addToast]);

  useEffect(() => { setCursorHistory([]); setCursor(null); fetchData(null); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => { setCursorHistory([]); setCursor(null); }, 300); return () => clearTimeout(t); }, [searchQuery]);

  const handleNext = () => { if (cursor) { setCursorHistory((p) => [...p, cursor]); fetchData(cursor); } };
  const handlePrev = () => { const h = [...cursorHistory]; h.pop(); setCursorHistory(h); fetchData(h[h.length - 1] || null); };

  const columns = [
    { key: "grnNumber" as keyof GRNRecord, header: "GRN #", render: (v: string) => <span className="font-medium text-blue-700">{v}</span> },
    { key: "poNumber" as keyof GRNRecord, header: "PO #", render: (v: string) => <span className="text-sm text-slate-600">{v}</span> },
    { key: "storeName" as keyof GRNRecord, header: "Store" },
    { key: "receivedDate" as keyof GRNRecord, header: "Received", render: (v: string) => <span className="text-sm">{format(new Date(v), "PP")}</span> },
    { key: "itemCount" as keyof GRNRecord, header: "Items", render: (v: number) => <span className="text-sm">{v}</span> },
    { key: "totalQuantity" as keyof GRNRecord, header: "Accepted Qty", render: (v: number) => <span className="font-medium">{v}</span> },
    { key: "vendorInvoiceNumber" as keyof GRNRecord, header: "Invoice #", render: (v: string | null) => <span className="text-sm text-slate-500">{v || "-"}</span> },
    {
      key: "status" as keyof GRNRecord, header: "Status",
      render: (v: string) => <Badge className={STATUS_COLORS[v] || "bg-slate-100 text-slate-700"}>{v}</Badge>,
    },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <Breadcrumb />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><FileInput className="h-6 w-6 text-green-600" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Goods Receipt Notes</h1>
              <p className="text-sm text-slate-500">Receive goods against approved purchase orders</p>
            </div>
          </div>
          <Button onClick={() => setIsDrawerOpen(true)}><Plus className="h-4 w-4 mr-2" />Receive Goods</Button>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search GRN #, PO #, invoice..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => fetchData(null)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No goods receipts found" />
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </GlassCard>

        <GRNFormDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onSuccess={() => { setIsDrawerOpen(false); fetchData(null); }}
        />
      </div>
    </PageTransition>
  );
}
