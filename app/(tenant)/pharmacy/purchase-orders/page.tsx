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
  Search, RefreshCw, MoreHorizontal, Edit, Trash2, Plus, Check, X,
  ShoppingCart, Home, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { POFormDrawer } from "@/components/pharmacy/po-form-drawer";

interface PORecord {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  subtotal: string;
  tax: string;
  total: string;
  itemCount: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  APPROVED: "bg-blue-100 text-blue-800",
  SENT: "bg-indigo-100 text-indigo-800",
  PARTIAL: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-700",
};

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRight className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Purchase Orders</span>
    </nav>
  );
}

export default function PurchaseOrdersPage() {
  const [records, setRecords] = useState<PORecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [limit] = useState(20);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PORecord | null>(null);
  const [editData, setEditData] = useState<{
    id: string; vendorId: string; orderDate: string; expectedDate: string | null; notes: string | null; version: number;
    items: { productId: string; quantityOrdered: number; unitCost: string; tax: string; }[];
  } | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async (pageCursor?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (pageCursor) params.append("cursor", pageCursor);
      const res = await fetch(`/api/pharmacy/purchase-orders?${params}`);
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

  const handleEdit = async (rec: PORecord) => {
    try {
      const res = await fetch(`/api/pharmacy/purchase-orders/${rec.id}`);
      const result = await res.json();
      if (result.success) {
        setEditData({
          id: result.data.id,
          vendorId: result.data.vendorId,
          orderDate: result.data.orderDate,
          expectedDate: result.data.expectedDate,
          notes: result.data.notes,
          version: result.data.version,
          items: result.data.items.map((i: Record<string, string | number>) => ({
            productId: i.productId, quantityOrdered: i.quantityOrdered, unitCost: i.unitCost, tax: i.tax,
          })),
        });
        setIsDrawerOpen(true);
      } else {
        addToast("error", result.message || "Failed to load PO");
      }
    } catch {
      addToast("error", "Network error");
    }
  };

  const handleAction = async (rec: PORecord, action: "approve" | "cancel") => {
    const label = action === "approve" ? "Approve" : "Cancel";
    if (!confirm(`${label} "${rec.poNumber}"?`)) return;
    try {
      const res = await fetch(`/api/pharmacy/purchase-orders/${rec.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, version: rec.version }),
      });
      const result = await res.json();
      if (result.success) { addToast("success", `PO ${action}d`); fetchData(null); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  const handleDelete = async (rec: PORecord) => {
    if (!confirm(`Delete "${rec.poNumber}"?`)) return;
    try {
      const res = await fetch(`/api/pharmacy/purchase-orders/${rec.id}?version=${rec.version}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { addToast("success", "Deleted"); fetchData(null); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  const columns = [
    { key: "poNumber" as keyof PORecord, header: "PO #", render: (v: string) => <span className="font-medium text-blue-700">{v}</span> },
    { key: "vendorName" as keyof PORecord, header: "Vendor" },
    { key: "orderDate" as keyof PORecord, header: "Order Date", render: (v: string) => <span className="text-sm">{format(new Date(v), "PP")}</span> },
    { key: "itemCount" as keyof PORecord, header: "Items", render: (v: number) => <span className="text-sm text-slate-600">{v}</span> },
    { key: "total" as keyof PORecord, header: "Total", render: (v: string) => <span className="font-medium">₹{parseFloat(v).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span> },
    {
      key: "status" as keyof PORecord, header: "Status",
      render: (v: string) => <Badge className={STATUS_COLORS[v] || "bg-slate-100 text-slate-700"}>{v}</Badge>,
    },
    {
      key: "id" as keyof PORecord, header: "Actions",
      render: (_v: string, row: PORecord) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {row.status === "DRAFT" && (
              <>
                <DropdownMenuItem onClick={() => handleEdit(row)}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction(row, "approve")}><Check className="h-4 w-4 mr-2" />Approve</DropdownMenuItem>
              </>
            )}
            {["DRAFT", "APPROVED", "SENT"].includes(row.status) && (
              <DropdownMenuItem onClick={() => handleAction(row, "cancel")} className="text-orange-600"><X className="h-4 w-4 mr-2" />Cancel</DropdownMenuItem>
            )}
            {["DRAFT", "CANCELLED"].includes(row.status) && (
              <DropdownMenuItem onClick={() => handleDelete(row)} className="text-red-600"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
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
            <div className="p-2 bg-blue-100 rounded-lg"><ShoppingCart className="h-6 w-6 text-blue-600" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Purchase Orders</h1>
              <p className="text-sm text-slate-500">Create and manage purchase orders for pharmacy procurement</p>
            </div>
          </div>
          <Button onClick={() => { setEditData(null); setIsDrawerOpen(true); }}><Plus className="h-4 w-4 mr-2" />New PO</Button>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search PO #, vendor..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="PARTIAL">Partial</SelectItem>
                <SelectItem value="RECEIVED">Received</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => fetchData(null)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No purchase orders found" />
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </GlassCard>

        <POFormDrawer
          isOpen={isDrawerOpen}
          onClose={() => { setIsDrawerOpen(false); setEditData(null); }}
          onSuccess={() => { setIsDrawerOpen(false); setEditData(null); fetchData(null); }}
          initialData={editData}
        />
      </div>
    </PageTransition>
  );
}
