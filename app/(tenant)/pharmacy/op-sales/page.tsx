"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/DataTable";
import { GlassCard } from "@/components/ui/GlassCard";
import { PageTransition } from "@/components/ui/PageTransition";
import { useToast } from "@/components/ui/Toast";
import {
  Search, RefreshCw, MoreHorizontal, Plus, Check, X,
  ShoppingBag, Home, ChevronRight, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { OPSaleFormDrawer } from "@/components/pharmacy/op-sale-form-drawer";

interface SaleRecord {
  id: string;
  saleNumber: string;
  patientId: string;
  patientName: string;
  uhid: string;
  storeId: string;
  storeName: string;
  saleType: string;
  status: string;
  totalAmount: string;
  discount: string;
  netAmount: string;
  creditAllowed: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
  RETURNED: "bg-purple-100 text-purple-700",
};

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-900 font-medium">OP Sales</span>
    </nav>
  );
}

export default function OPSalesPage() {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [limit] = useState(20);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewSaleId, setViewSaleId] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async (pageCursor?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (pageCursor) params.append("cursor", pageCursor);
      const res = await fetch(`/api/pharmacy/op-sales?${params}`);
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

  const handleApprove = async (rec: SaleRecord) => {
    if (!confirm(`Approve sale "${rec.saleNumber}"? This will allocate stock.`)) return;
    try {
      const detailRes = await fetch(`/api/pharmacy/op-sales/${rec.id}`);
      const detailResult = await detailRes.json();
      if (!detailResult.success) { addToast("error", "Failed to load sale details"); return; }

      const res = await fetch(`/api/pharmacy/op-sales/${rec.id}?action=approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: detailResult.data.version }),
      });
      const result = await res.json();
      if (result.success) { addToast("success", "Sale approved"); fetchData(null); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  const handleCancel = async (rec: SaleRecord) => {
    if (!confirm(`Cancel sale "${rec.saleNumber}"?`)) return;
    try {
      const detailRes = await fetch(`/api/pharmacy/op-sales/${rec.id}`);
      const detailResult = await detailRes.json();
      if (!detailResult.success) { addToast("error", "Failed to load sale details"); return; }

      const res = await fetch(`/api/pharmacy/op-sales/${rec.id}?action=cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: detailResult.data.version }),
      });
      const result = await res.json();
      if (result.success) { addToast("success", "Sale cancelled"); fetchData(null); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  const columns = [
    { key: "saleNumber" as keyof SaleRecord, header: "Sale #", render: (v: string) => <span className="font-medium text-blue-700">{v}</span> },
    { key: "patientName" as keyof SaleRecord, header: "Patient", render: (v: string, row: SaleRecord) => (
      <div><div className="font-medium">{v}</div><div className="text-xs text-slate-500">{row.uhid}</div></div>
    ) },
    { key: "storeName" as keyof SaleRecord, header: "Store" },
    { key: "itemCount" as keyof SaleRecord, header: "Items", render: (v: number) => <span className="text-sm text-slate-600">{v}</span> },
    { key: "netAmount" as keyof SaleRecord, header: "Net Amount", render: (v: string) => <span className="font-medium">&#8377;{parseFloat(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span> },
    { key: "creditAllowed" as keyof SaleRecord, header: "Credit", render: (v: boolean) => v ? <Badge className="bg-orange-100 text-orange-700">Credit</Badge> : <span className="text-sm text-slate-400">Cash</span> },
    {
      key: "status" as keyof SaleRecord, header: "Status",
      render: (v: string) => <Badge className={STATUS_COLORS[v] || "bg-slate-100 text-slate-700"}>{v.replace("_", " ")}</Badge>,
    },
    { key: "createdAt" as keyof SaleRecord, header: "Date", render: (v: string) => <span className="text-sm">{format(new Date(v), "PP")}</span> },
    {
      key: "id" as keyof SaleRecord, header: "Actions",
      render: (_v: string, row: SaleRecord) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewSaleId(row.id)}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
            {row.status === "PENDING_APPROVAL" && (
              <DropdownMenuItem onClick={() => handleApprove(row)}><Check className="h-4 w-4 mr-2" />Approve</DropdownMenuItem>
            )}
            {["DRAFT", "PENDING_APPROVAL", "COMPLETED"].includes(row.status) && (
              <DropdownMenuItem onClick={() => handleCancel(row)} className="text-red-600"><X className="h-4 w-4 mr-2" />Cancel</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <Breadcrumb />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><ShoppingBag className="h-6 w-6 text-green-600" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">OP Pharmacy Sales</h1>
              <p className="text-sm text-slate-500">Dispense medicines for outpatients with FIFO stock allocation</p>
            </div>
          </div>
          <Button onClick={() => setIsDrawerOpen(true)}><Plus className="h-4 w-4 mr-2" />New Sale</Button>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search sale #, patient..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
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
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No OP sales found" />
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </GlassCard>

        <OPSaleFormDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onSuccess={() => { setIsDrawerOpen(false); fetchData(null); }}
        />

        {/* Simple detail view dialog */}
        {viewSaleId && (
          <SaleDetailModal saleId={viewSaleId} onClose={() => setViewSaleId(null)} />
        )}
      </div>
    </PageTransition>
  );
}

// =====================================================
// SALE DETAIL MODAL
// =====================================================

function SaleDetailModal({ saleId, onClose }: { saleId: string; onClose: () => void }) {
  const [sale, setSale] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pharmacy/op-sales/${saleId}`);
        const result = await res.json();
        if (result.success) setSale(result.data);
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    })();
  }, [saleId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Sale Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : sale ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Sale #:</span> <span className="font-medium">{sale.saleNumber as string}</span></div>
              <div><span className="text-slate-500">Status:</span> <Badge className={STATUS_COLORS[(sale.status as string)] || "bg-slate-100"}>{(sale.status as string).replace("_", " ")}</Badge></div>
              <div><span className="text-slate-500">Patient:</span> {sale.patientName as string} ({sale.uhid as string})</div>
              <div><span className="text-slate-500">Store:</span> {sale.storeName as string}</div>
              <div><span className="text-slate-500">Total:</span> &#8377;{parseFloat(sale.totalAmount as string).toFixed(2)}</div>
              <div><span className="text-slate-500">Discount:</span> &#8377;{parseFloat(sale.discount as string).toFixed(2)}</div>
              <div><span className="text-slate-500">Net Amount:</span> <span className="font-semibold">&#8377;{parseFloat(sale.netAmount as string).toFixed(2)}</span></div>
              <div><span className="text-slate-500">Credit:</span> {sale.creditAllowed ? "Yes" : "No"}</div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Items</h3>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2">Product</th>
                    <th className="text-left p-2">Batch</th>
                    <th className="text-right p-2">Qty</th>
                    <th className="text-right p-2">Price</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(sale.items as Array<Record<string, string>>)?.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{item.productName}</td>
                      <td className="p-2 text-slate-600">{item.batchNumber}</td>
                      <td className="p-2 text-right">{item.quantity}</td>
                      <td className="p-2 text-right">&#8377;{parseFloat(item.unitPrice).toFixed(2)}</td>
                      <td className="p-2 text-right font-medium">&#8377;{parseFloat(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-red-500">Failed to load sale</p>
        )}
      </div>
    </div>
  );
}
