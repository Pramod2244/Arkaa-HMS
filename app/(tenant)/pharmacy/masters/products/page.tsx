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
  Search, RefreshCw, MoreHorizontal, Edit, Trash2, Plus,
  Package, Home, ChevronRight as ChevronRightIcon, ChevronRight,
  Upload, Download
} from "lucide-react";
import { format } from "date-fns";
import { ProductFormDrawer } from "@/components/pharmacy/product-form-drawer";
import { MasterImportDialog } from "@/components/masters/MasterImportDialog";

interface ProductRecord {
  id: string;
  code: string;
  name: string;
  genericName: string;
  brandName: string | null;
  strength: string | null;
  dosageForm: string | null;
  scheduleType: string;
  manufacturerId: string;
  manufacturer?: { id: string; name: string };
  hsnCode: string | null;
  gstPercent: number | null;
  mrp: number | null;
  purchasePrice: number | null;
  minimumStock: number;
  reorderLevel: number;
  storageCondition: string | null;
  isNarcotic: boolean;
  status: "ACTIVE" | "INACTIVE";
  updatedAt: string;
}

function Breadcrumb() {
  return (
    <nav className="flex items-center gap-2 text-sm text-slate-500 mb-4">
      <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1"><Home className="h-4 w-4" /> Dashboard</Link>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-400">Pharmacy</span>
      <ChevronRightIcon className="h-4 w-4" />
      <span className="text-slate-900 font-medium">Products</span>
    </nav>
  );
}

export default function ProductsPage() {
  const [records, setRecords] = useState<ProductRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [scheduleFilter, setScheduleFilter] = useState("ALL");
  const [limit] = useState(20);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<ProductRecord | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const { addToast } = useToast();

  const fetchData = useCallback(async (pageCursor?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: limit.toString() });
      if (searchQuery) params.append("search", searchQuery);
      if (statusFilter !== "ALL") params.append("status", statusFilter);
      if (scheduleFilter !== "ALL") params.append("scheduleType", scheduleFilter);
      if (pageCursor) params.append("cursor", pageCursor);
      const res = await fetch(`/api/pharmacy/masters/products?${params}`);
      const result = await res.json();
      if (result.success) { setRecords(result.data || []); setCursor(result.pagination?.cursor || null); setHasMore(result.pagination?.hasMore || false); }
      else { setRecords([]); addToast("error", result.message || "Failed to load"); }
    } catch { setRecords([]); addToast("error", "Network error"); }
    finally { setIsLoading(false); }
  }, [searchQuery, statusFilter, scheduleFilter, limit, addToast]);

  useEffect(() => { setCursorHistory([]); setCursor(null); fetchData(null); }, [fetchData]);
  useEffect(() => { const t = setTimeout(() => { setCursorHistory([]); setCursor(null); }, 300); return () => clearTimeout(t); }, [searchQuery]);

  const handleNext = () => { if (cursor) { setCursorHistory(p => [...p, cursor]); fetchData(cursor); } };
  const handlePrev = () => { const h = [...cursorHistory]; h.pop(); setCursorHistory(h); fetchData(h[h.length - 1] || null); };

  const handleDelete = async (rec: ProductRecord) => {
    if (!confirm(`Delete "${rec.name}"?`)) return;
    try {
      const res = await fetch(`/api/pharmacy/masters/products?id=${rec.id}`, { method: "DELETE" });
      const result = await res.json();
      if (result.success) { addToast("success", "Deleted"); fetchData(null); }
      else addToast("error", result.message || "Failed");
    } catch { addToast("error", "Network error"); }
  };

  const scheduleColors: Record<string, string> = {
    H: "bg-orange-100 text-orange-800",
    H1: "bg-red-100 text-red-800",
    X: "bg-purple-100 text-purple-800",
    OTC: "bg-green-100 text-green-800",
  };

  const columns = [
    { key: "code" as keyof ProductRecord, header: "Code" },
    { key: "name" as keyof ProductRecord, header: "Name" },
    { key: "genericName" as keyof ProductRecord, header: "Generic", render: (v: string) => <span className="text-slate-500">{v || "-"}</span> },
    {
      key: "scheduleType" as keyof ProductRecord, header: "Schedule",
      render: (v: string) => <Badge className={scheduleColors[v] || "bg-slate-100 text-slate-600"}>{v}</Badge>,
    },
    {
      key: "mrp" as keyof ProductRecord, header: "MRP",
      render: (v: number | null) => <span className="text-slate-700 font-medium">{v ? `₹${Number(v).toFixed(2)}` : "-"}</span>,
    },
    {
      key: "status" as keyof ProductRecord, header: "Status",
      render: (v: "ACTIVE" | "INACTIVE") => <Badge className={v === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-600"}>{v}</Badge>,
    },
    {
      key: "updatedAt" as keyof ProductRecord, header: "Updated",
      render: (v: string) => <span className="text-slate-500 text-sm">{format(new Date(v), "PP")}</span>,
    },
    {
      key: "id" as keyof ProductRecord, header: "Actions",
      render: (_v: string, row: ProductRecord) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelected(row); setIsDrawerOpen(true); }}><Edit className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDelete(row)} className="text-red-600"><Trash2 className="h-4 w-4 mr-2" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const handleExport = () => {
    const csvHeader = [
      "Code","Name","Generic Name","Brand Name","Strength","Dosage Form","Schedule","Manufacturer","HSN Code","GST %","MRP","Purchase Price","Min Stock","Reorder Level","Storage Condition","Narcotic","Status"
    ];
    const csvRows = records.map(r => [
      r.code,
      r.name,
      r.genericName,
      r.brandName ?? "",
      r.strength ?? "",
      r.dosageForm ?? "",
      r.scheduleType,
      r.manufacturer?.name ?? "",
      r.hsnCode ?? "",
      r.gstPercent ?? "",
      r.mrp ?? "",
      r.purchasePrice ?? "",
      r.minimumStock ?? "",
      r.reorderLevel ?? "",
      r.storageCondition ?? "",
      r.isNarcotic ? "Yes" : "No",
      r.status
    ]);
    const csv = [csvHeader.join(","), ...csvRows.map(row => row.map(val => `"${val}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pharmacy_products_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <PageTransition>
      <div className="p-6 space-y-6">
        <Breadcrumb />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Package className="h-6 w-6 text-blue-600" /></div>
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
              <p className="text-sm text-slate-500">Manage pharmaceutical products</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setIsImportOpen(true)} variant="outline"><Upload className="h-4 w-4 mr-2" />Import</Button>
            <Button onClick={handleExport} variant="outline"><Download className="h-4 w-4 mr-2" />Export</Button>
            <Button onClick={() => { setSelected(null); setIsDrawerOpen(true); }}><Plus className="h-4 w-4 mr-2" />Add Product</Button>
          </div>
        </div>

        <GlassCard className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input placeholder="Search products..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">All Status</SelectItem><SelectItem value="ACTIVE">Active</SelectItem><SelectItem value="INACTIVE">Inactive</SelectItem></SelectContent>
            </Select>
            <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Schedules" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Schedules</SelectItem>
                <SelectItem value="H">Schedule H</SelectItem>
                <SelectItem value="H1">Schedule H1</SelectItem>
                <SelectItem value="X">Schedule X</SelectItem>
                <SelectItem value="OTC">OTC</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" onClick={() => fetchData(null)} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </GlassCard>

        <GlassCard className="p-0 overflow-hidden">
          <DataTable columns={columns} data={records} loading={isLoading} emptyMessage="No products found" />
          <div className="flex items-center justify-end px-4 py-3 border-t gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev} disabled={cursorHistory.length === 0}>Previous</Button>
            <Button variant="outline" size="sm" onClick={handleNext} disabled={!hasMore}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
          </div>
        </GlassCard>

        <ProductFormDrawer
          isOpen={isDrawerOpen}
          onClose={() => { setIsDrawerOpen(false); setSelected(null); }}
          onSuccess={() => { setIsDrawerOpen(false); setSelected(null); fetchData(null); }}
          initialData={selected}
        />
        <MasterImportDialog
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          entityName="Product"
          templateUrl="/templates/pharmacy-products-template.csv"
          onImport={async () => ({ totalRows: 0, successCount: 0, errorCount: 0, errors: [], isDryRun: true })}
        />
      </div>
    </PageTransition>
  );
}
