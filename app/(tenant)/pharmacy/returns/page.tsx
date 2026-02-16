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
  RotateCcw, Home, ChevronRight, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { ReturnFormDrawer } from "@/components/pharmacy/return-form-drawer";

interface ReturnRecord {
  id: string;
  returnNumber: string;
  saleNumber: string;
  saleId: string;
  patientId: string | null;
  patientName: string;
  uhid: string;
  returnType: string;
  reason: string;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-amber-100 text-amber-800",
  APPROVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
};

const TYPE_COLORS: Record<string, string> = {
  OP_RETURN: "bg-blue-100 text-blue-800",
  IP_RETURN: "bg-purple-100 text-purple-800",
};

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Returns</span>
    </nav>
  );
}

export default function PharmacyReturnsPage() {
  const [records, setRecords] = useState<ReturnRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [limit] = useState(20);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewReturnId, setViewReturnId] = useState<string | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async (pageCursor?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (typeFilter !== "ALL") params.append("returnType", typeFilter);
      if (pageCursor) params.append("cursor", pageCursor);
      const res = await fetch(`/api/pharmacy/returns?${params}`);
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

  const handleApprove = async (rec: ReturnRecord) => {
    if (!confirm(`Approve return "${rec.returnNumber}"? This will restore stock via ledger.`)) return;
    try {
      const detailRes = await fetch(`/api/pharmacy/returns/${rec.id}`);
      const detailResult = await detailRes.json();
      if (!detailResult.success) { addToast("error", "Failed to load return details"); return; }

      const res = await fetch(`/api/pharmacy/returns/${rec.id}?action=approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: detailResult.data.version }),
      });
      const result = await res.json();
      if (result.success) { addToast("success", "Return approved — stock restored"); fetchData(null); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  const handleCancel = async (rec: ReturnRecord) => {
    if (!confirm(`Cancel return "${rec.returnNumber}"?`)) return;
    try {
      const detailRes = await fetch(`/api/pharmacy/returns/${rec.id}`);
      const detailResult = await detailRes.json();
      if (!detailResult.success) { addToast("error", "Failed to load return details"); return; }

      const res = await fetch(`/api/pharmacy/returns/${rec.id}?action=cancel`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: detailResult.data.version }),
      });
      const result = await res.json();
      if (result.success) { addToast("success", "Return cancelled"); fetchData(null); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  const columns = [
    { key: "returnNumber" as keyof ReturnRecord, header: "Return #", render: (v: string) => <span className="font-medium text-blue-700">{v}</span> },
    { key: "saleNumber" as keyof ReturnRecord, header: "Sale #", render: (v: string) => <span className="text-sm text-slate-600">{v}</span> },
    { key: "patientName" as keyof ReturnRecord, header: "Patient", render: (v: string, row: ReturnRecord) => (
      <div><div className="font-medium">{v}</div><div className="text-xs text-slate-500">{row.uhid}</div></div>
    ) },
    { key: "returnType" as keyof ReturnRecord, header: "Type", render: (v: string) => (
      <Badge className={TYPE_COLORS[v] || "bg-slate-100 text-slate-700"}>{v === "OP_RETURN" ? "OP" : "IP"}</Badge>
    ) },
    { key: "itemCount" as keyof ReturnRecord, header: "Items", render: (v: number) => <span className="text-sm text-slate-600">{v}</span> },
    { key: "total" as keyof ReturnRecord, header: "Total", render: (v: string) => <span className="font-medium">&#8377;{parseFloat(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span> },
    {
      key: "status" as keyof ReturnRecord, header: "Status",
      render: (v: string) => <Badge className={STATUS_COLORS[v] || "bg-slate-100 text-slate-700"}>{v}</Badge>,
    },
    { key: "createdAt" as keyof ReturnRecord, header: "Date", render: (v: string) => <span className="text-sm">{format(new Date(v), "PP")}</span> },
    {
      key: "id" as keyof ReturnRecord, header: "Actions",
      render: (_v: string, row: ReturnRecord) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setViewReturnId(row.id)}><Eye className="h-4 w-4 mr-2" />View Details</DropdownMenuItem>
            {row.status === "DRAFT" && (
              <DropdownMenuItem onClick={() => handleApprove(row)}><Check className="h-4 w-4 mr-2" />Approve</DropdownMenuItem>
            )}
            {row.status === "DRAFT" && (
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
            <div className="p-2 bg-orange-100 rounded-lg"><RotateCcw className="h-6 w-6 text-orange-600" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Pharmacy Returns</h1>
              <p className="text-sm text-slate-500">Process OP &amp; IP sale returns with batch-aware ledger reversal</p>
            </div>
          </div>
          <Button onClick={() => setIsDrawerOpen(true)}><Plus className="h-4 w-4 mr-2" />New Return</Button>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search return #, sale #, patient..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="OP_RETURN">OP Return</SelectItem>
                <SelectItem value="IP_RETURN">IP Return</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => fetchData(null)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No pharmacy returns found" />
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </GlassCard>

        <ReturnFormDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          onSuccess={() => { setIsDrawerOpen(false); fetchData(null); }}
        />

        {viewReturnId && (
          <ReturnDetailModal returnId={viewReturnId} onClose={() => setViewReturnId(null)} />
        )}
      </div>
    </PageTransition>
  );
}

// =====================================================
// RETURN DETAIL MODAL
// =====================================================

function ReturnDetailModal({ returnId, onClose }: { returnId: string; onClose: () => void }) {
  const [ret, setRet] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pharmacy/returns/${returnId}`);
        const result = await res.json();
        if (result.success) setRet(result.data);
      } catch {
        // Silent
      } finally {
        setLoading(false);
      }
    })();
  }, [returnId]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Return Details</h2>
          <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        {loading ? (
          <p className="text-slate-500">Loading...</p>
        ) : ret ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-slate-500">Return #:</span> <span className="font-medium">{ret.returnNumber as string}</span></div>
              <div><span className="text-slate-500">Status:</span> <Badge className={STATUS_COLORS[(ret.status as string)] || "bg-slate-100"}>{ret.status as string}</Badge></div>
              <div><span className="text-slate-500">Sale #:</span> {ret.saleNumber as string}</div>
              <div><span className="text-slate-500">Type:</span> <Badge className={TYPE_COLORS[(ret.returnType as string)] || "bg-slate-100"}>{(ret.returnType as string) === "OP_RETURN" ? "OP Return" : "IP Return"}</Badge></div>
              <div><span className="text-slate-500">Patient:</span> {ret.patientName as string} ({ret.uhid as string})</div>
              <div><span className="text-slate-500">Total:</span> <span className="font-semibold">&#8377;{parseFloat(ret.total as string).toFixed(2)}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Reason:</span> {ret.reason as string}</div>
            </div>
            <div>
              <h3 className="font-medium mb-2">Return Items</h3>
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-2">Product</th>
                    <th className="text-left p-2">Batch</th>
                    <th className="text-right p-2">Qty Returned</th>
                    <th className="text-right p-2">Unit Price</th>
                    <th className="text-right p-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(ret.items as Array<Record<string, string>>)?.map((item, idx) => (
                    <tr key={idx} className="border-t">
                      <td className="p-2">{item.productName}</td>
                      <td className="p-2 text-slate-600">{item.batchNumber}</td>
                      <td className="p-2 text-right">{item.quantityReturned}</td>
                      <td className="p-2 text-right">&#8377;{parseFloat(item.unitPrice).toFixed(2)}</td>
                      <td className="p-2 text-right font-medium">&#8377;{parseFloat(item.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-red-500">Failed to load return</p>
        )}
      </div>
    </div>
  );
}
